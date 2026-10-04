"""미탐색 후보 beyond the 30 species (team-lead decision 2026-10-04).

A species recorded in the map box (OBIS checklist or GBIF species facet, resolved to an accepted WoRMS species) is listed
when it shares its WoRMS genus with one of the 30 species whose published BBVI (default weight) is at least the
unexplored-candidate threshold of the report. It is outside the 30, so no indicator was collected for it (information
sufficiency 0). No score is inferred or copied from the relative.

Occurrence cells follow the 22-candidate review rules of scripts/build_expansion_cells.py unchanged (licences, identity,
coordinates, duplicates, 1 km land buffer, NIBR holder points). A congener of a species published only at 4° is published
at 4° too. Raw responses are cached in the ignored tmp/unexplored/cells/; only generalized cells reach dist/.
"""
import json
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_expansion_cells as B  # noqa: E402

B.CACHE = ROOT / "tmp/unexplored/cells"
REPORT = ROOT / "dist/assessments.json"
OUT = ROOT / "dist/unexplored-candidates.json"
REVIEWED = "2026-10-04"
NIBR_SEARCH = "https://species.nibr.go.kr/geo/html/search.do?"


def accepted_species(aphia):
    """Accepted species-rank WoRMS record for an AphiaID (following valid_AphiaID once), or None."""
    rec = B.cached(f"worms/id_{aphia}.json", lambda: B.get(f"{B.WORMS}AphiaRecordByAphiaID/{aphia}"))
    if rec and rec.get("valid_AphiaID") and rec["valid_AphiaID"] != aphia:
        rec = B.cached(f"worms/id_{rec['valid_AphiaID']}.json", lambda: B.get(f"{B.WORMS}AphiaRecordByAphiaID/{rec['valid_AphiaID']}"))
    return rec if rec and rec.get("status") == "accepted" and rec.get("rank") == "Species" else None


def genus_of(aphia):
    node, out, family = B.cached(f"worms/class_{aphia}.json", lambda: B.get(f"{B.WORMS}AphiaClassificationByAphiaID/{aphia}")), None, None
    while node:
        if node.get("rank") == "Family":
            family = node["scientificname"]
        if node.get("rank") == "Genus":
            out = {"aphiaID": node["AphiaID"], "name": node["scientificname"], "family": family}
        node = node.get("child")
    return out


def gbif_genus_key(genus, kingdom):
    """GBIF backbone key of the genus. A homonym makes the strict match fall back to the kingdom (Anadara, Ulva), so then
    the accepted genus of the same family among the match alternatives is taken; no key when none fits."""
    m = B.cached(f"gbif_genus_{genus['aphiaID']}.json", lambda: B.get(B.GBIF + "species/match?" + urllib.parse.urlencode(
        {"name": genus["name"], "rank": "GENUS", "kingdom": kingdom, "strict": "true"}))) or {}
    if m.get("rank") == "GENUS" and m.get("matchType") == "EXACT" and m.get("canonicalName") == genus["name"]:
        return m["usageKey"]
    v = B.cached(f"gbif_genus_verbose_{genus['aphiaID']}.json", lambda: B.get(B.GBIF + "species/match?" + urllib.parse.urlencode(
        {"name": genus["name"], "verbose": "true"}))) or {}
    alt = [a for a in v.get("alternatives", []) if a.get("rank") == "GENUS" and a.get("status") == "ACCEPTED"
           and a.get("canonicalName") == genus["name"] and a.get("family") == genus["family"] and a.get("kingdom") == kingdom]
    return alt[0]["usageKey"] if len(alt) == 1 else None


def congeners(genus, kingdom):
    """Accepted species of the genus recorded in the box by OBIS or GBIF, as {AphiaID: found_in}."""
    found = {}
    obis = B.cached(f"checklist_obis_{genus['aphiaID']}.json", lambda: B.get(B.OBIS + "checklist?" + urllib.parse.urlencode(
        {"taxonid": genus["aphiaID"], "geometry": B.BOX, "size": 1000})))
    for t in (obis or {}).get("results", []):
        if t.get("taxonRank") == "Species":
            found.setdefault(t.get("acceptedNameUsageID") or t["taxonID"], set()).add("OBIS")
    key = gbif_genus_key(genus, kingdom)
    if key:
        facet = B.cached(f"gbif_facet_{key}.json", lambda: B.get(B.GBIF + "occurrence/search?" + urllib.parse.urlencode(
            {"taxonKey": key, "geometry": B.BOX, "hasCoordinate": "true", "limit": 0, "facet": "speciesKey", "facetLimit": 1000})))
        for f in (facet["facets"][0]["counts"] if (facet or {}).get("facets") else []):
            sp = B.cached(f"gbif_species_{f['name']}.json", lambda: B.get(B.GBIF + f"species/{f['name']}"))
            for r in B.worms((sp or {}).get("canonicalName") or ""):
                if r.get("valid_AphiaID"):
                    found.setdefault(r["valid_AphiaID"], set()).add("GBIF")
    out = {}
    for aphia, srcs in found.items():
        rec = accepted_species(aphia)
        if rec and rec["scientificname"].split()[0] == genus["name"]:
            out.setdefault(rec["AphiaID"], {"name": rec["scientificname"], "found_in": set()})["found_in"] |= srcs
    # WoRMS can carry the same species twice, once with the subgenus in the name; the plain binomial is kept
    plain = {v["name"] for v in out.values()}
    return {k: v for k, v in out.items() if re.sub(r" \([^)]*\)", "", v["name"]) == v["name"]
            or re.sub(r" \([^)]*\)", "", v["name"]) not in plain}


def korean_name(name):
    """Korean name from the NIBR species portal when exactly one entry carries this binomial; else None. Without a Korean
    name the portal puts the epithet in taxon_nm (Ulva adhaerens -> 'adhaerens'), so a name needs Hangul."""
    page = B.cached("nibr_name/" + re.sub(r"\W+", "_", name) + ".json", lambda: B.get(NIBR_SEARCH + urllib.parse.urlencode(
        {"type": "species_list1", "keyword": name})))
    hits = {r["taxon_nm"] for r in (page.get("data") or {}).get("list", [])
            if re.sub(r"<[^>]+>", "", r.get("taxon_full_nm_em") or "").startswith(name + " ") and re.search("[가-힣]", r.get("taxon_nm") or "")}
    return hits.pop() if len(hits) == 1 else None


def main():
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    rule = report["method"]["unexplored_candidates"]
    threshold = rule["relative_min_bbvi"]
    species30 = report["species"] + report["candidate_species"]
    ids30 = {s["aphia_id"] for s in species30}
    for d in ("worms", "nibr_name"):
        (B.CACHE / d).mkdir(parents=True, exist_ok=True)
    relatives = sorted((s for s in species30 if (s["scores"]["BBVI"] or 0) >= threshold), key=lambda s: -s["scores"]["BBVI"])
    by_genus = {}
    for s in relatives:
        g = genus_of(s["aphia_id"])
        kingdom = B.worms(s["scientific_name"])[0]["kingdom"]
        by_genus.setdefault(g["aphiaID"], {"genus": g, "kingdom": kingdom, "relatives": []})["relatives"].append(s)
    result = []
    for gid, g in sorted(by_genus.items(), key=lambda kv: kv[1]["genus"]["name"]):
        four = [s for s in g["relatives"] if s["aphia_id"] in B.FOUR_DEGREE]
        for aphia, c in sorted(congeners(g["genus"], g["kingdom"]).items(), key=lambda kv: kv[1]["name"]):
            if aphia in ids30:
                continue
            if four:
                B.FOUR_DEGREE[aphia] = f"같은 속 {four[0]['korean_name']}이(가) 4°로만 공개되는 채취 대상이라 4°로만 공개"
            sp = {"aphiaID": aphia, "name": c["name"]}
            try:
                gbif = B.cached(f"{aphia}-gbif.json", lambda: B.fetch_gbif(sp))
                obis = B.cached(f"{aphia}-obis.json", lambda: B.fetch_obis(sp))
                nibr = B.cached(f"{aphia}-nibr.json", lambda: B.fetch_nibr(gbif))
            except ValueError as e:  # a failed completeness check lists the species without cells rather than guessing
                entry = {"aphiaID": aphia, "name": c["name"], "sizeDeg": None, "cells": [],
                         "review": {"status": "fetch_check_failed", "reason": str(e)}}
            else:
                held = B.nibr_records(nibr)
                entry = B.review(sp, {**gbif, "records": gbif["records"] + held,
                                      "nibr": {"specimens": len(nibr["records"]), "pointsInBox": len(held)}}, obis)
            entry["koreanName"] = korean_name(c["name"])
            entry["genus"] = g["genus"]["name"]
            entry["foundIn"] = sorted(c["found_in"])
            entry["relatives"] = [{"aphiaID": s["aphia_id"], "label": s["korean_name"], "name": s["scientific_name"],
                                   "BBVI": s["scores"]["BBVI"]} for s in g["relatives"]]
            result.append(entry)
            print(f'{c["name"]}\t{entry["koreanName"]}\t{len(entry["cells"])} cells\t{entry["review"].get("accepted", entry["review"]["status"])}', flush=True)
    OUT.write_text(json.dumps({
        "schemaVersion": "unexplored-candidates-1", "reviewedOn": REVIEWED, "reportVersion": report["method_version"],
        "rule": ("Team-lead decision 2026-10-04: a species outside the 30, recorded in the map box (OBIS checklist or GBIF "
                 "species facet, accepted WoRMS species), that shares its WoRMS genus with one of the 30 whose published BBVI "
                 f"(default weight) is at least {threshold}. No indicator was collected for it and no score is inferred or copied."),
        "cellRules": "scripts/build_expansion_cells.py (22-candidate review rules), unchanged; a congener of a 4° species is published at 4°",
        "scope": ("Generalized occurrence cells from reviewed GBIF and OBIS records. Not distribution, abundance, stock size "
                  "or value. A listed species is a lead for survey, not a finding."),
        "queryBox": "124–132°E · 33–38.7°N",
        "koreanNames": "NIBR species portal (species.nibr.go.kr), exact binomial match; null when absent or ambiguous",
        "relatives": [{"aphiaID": s["aphia_id"], "label": s["korean_name"], "name": s["scientific_name"], "BBVI": s["scores"]["BBVI"]}
                      for s in relatives],
        "species": result}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("species", len(result), "with cells", sum(bool(s["cells"]) for s in result), "cells", sum(len(s["cells"]) for s in result))


if __name__ == "__main__":
    main()
