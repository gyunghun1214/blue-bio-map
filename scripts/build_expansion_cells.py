"""Public occurrence cells for the 22 candidate species, reviewed record by record (GBIF + OBIS).

Rules follow the approved map-1 prototype (output/database/publication/OCCURRENCE_REVIEW.md, 2026-09-24)
with the candidate additions of 2026-09-27:
- Box 124–132°E · 33–38.7°N, coordinates present, occurrence present. Fossils and captive, cultivated or
  living-collection records are excluded.
- Licence: GBIF record licence, OBIS dataset licence (and record licence when given) must be CC0 1.0,
  CC BY 4.0 or (2026-10-01, team-lead decision) CC BY-NC 4.0; the site is a non-commercial research demo and
  every cell lists its licences. ShareAlike, NoDerivatives and unclear terms are counted, never used.
- Identity: each record's species name must resolve in WoRMS to the candidate AphiaID (accepted name,
  synonym or infraspecific child). A GBIF backbone gap falls back to the genus key plus the verbatim name.
- Coordinates: OBIS xylookup shore distance < -1000 m = on land (2026-10-01: a 1 km landward buffer keeps
  tidal-flat and intertidal points that the coarse coastline puts on land; coordinates never moved); GBIF
  coordinate issues, uncertainty > 10 km and source-generalized coordinates are excluded; one calendar year
  is required (ranges over several years are excluded, as GBIF leaves their year empty).
  Missing uncertainty is allowed because no cell is smaller than 1°.
- Record review (2026-09-27): GenBank "UNVERIFIED" organism names fail identity; a market locality marks
  where a specimen was bought, not where it lived (markets pool distant catches), so it is excluded; a
  locality that cannot lie in the box excludes its coordinates. Landing ports are kept: 1° cells absorb them.
- Duplicates: same institution + catalogue number or same occurrenceID; an OBIS record of an accepted GBIF
  record's day and point, or of its holder, day and place within 0.05° with a catalogue number that one portal
  extends (149851 -> 149851.5046228), is the same record published twice.
- Cells: 1° (sensitivity unassessed: GBIF's strictest publication level) or 4° for harvest-sensitive species.
  Periods 2000–2015 and 2016–present; pre-2000 records form a separate historical period. A cell whose
  records all lie outside the South and North Korean EEZs (OBIS areas) is flagged. Record counts are not
  abundance and cells carry no species score.
Responses are cached in the ignored tmp/expansion-30/cells/ (exact coordinates and record IDs stay there);
delete that folder to re-fetch. Only generalized cells and per-reason counts reach dist/.
"""
import datetime
import json
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "tmp/expansion-30/cells"
OUT = ROOT / "dist/expansion-public-cells.json"
CATALOG = ROOT / "dist/candidate-catalog.json"
REVIEWED, THIS_YEAR = "2026-10-01", 2026
LAND_BUFFER_M = 1000  # shore distance below -1 km is on land
BOX = "POLYGON((124 33,132 33,132 38.7,124 38.7,124 33))"
GBIF, OBIS, WORMS = "https://api.gbif.org/v1/", "https://api.obis.org/v3/", "https://www.marinespecies.org/rest/"
BAD_ISSUES = {"ZERO_COORDINATE", "COORDINATE_INVALID", "COORDINATE_OUT_OF_RANGE", "COUNTRY_COORDINATE_MISMATCH",
              "PRESUMED_SWAPPED_COORDINATE", "PRESUMED_NEGATED_LATITUDE", "PRESUMED_NEGATED_LONGITUDE",
              "COORDINATE_REPROJECTION_FAILED"}  # map-1 list
OBIS_BAD_FLAGS = {"NO_COORD", "ZERO_COORD", "LAT_OUT_OF_RANGE", "LON_OUT_OF_RANGE"}
MANAGED = {"captive", "cultivated", "released", "managed"}
SPECIES_RANKS = {"SPECIES", "SUBSPECIES", "VARIETY", "FORM"}
KOREAN_EEZ = {"South Korea", "North Korea"}
MARKET = re.compile(r"\bmarket\b", re.I)
OUTSIDE_BOX_PLACES = re.compile(r"Miyake-jima")  # Izu Islands near 139.5°E; one record carries 129.5°E
# Sedentary, high-value or threatened stocks: released only at 4 degrees (sea-cucumber precedent, map-2).
FOUR_DEGREE = {397082: "IUCN 체크리스트 EN · 채취 압력이 큰 전복: 4°로만 공개",
               504357: "채취 대상 패류: 2026-09-25 4° 공개 결정 유지"}
REASONS = ["taxon_not_verified", "absent_or_dropped", "fossil_specimen", "license_not_open", "no_year",
           "multi_year_range", "coordinate_issue", "uncertainty_over_10km", "generalized_at_source",
           "captive_or_cultivated", "market_purchase_point", "locality_contradicts_coordinates",
           "on_land_obis_rule", "duplicate"]


def get(url, body=None):
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(),
                                         headers={"content-type": "application/json",
                                                  "user-agent": "blue-bio-map-candidate-cells/1 (research)"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r) if r.status == 200 else None  # WoRMS answers 204 for unknown names
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                return None
            if attempt == 3:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
        time.sleep(2 + 3 * attempt)


def cached(name, fetch):
    path = CACHE / name
    if not path.exists():
        path.write_text(json.dumps(fetch(), ensure_ascii=False), encoding="utf-8")
    return json.loads(path.read_text(encoding="utf-8"))


def licence(text):
    t = (text or "").lower().replace("-", " ")
    if re.search(r"share ?alike|by sa|nc sa|no ?deriv|by nd|nc nd", t):
        return None
    if re.search(r"non ?commercial|by nc", t):  # CC BY-NC 4.0 only (2026-10-01); other NC versions stay unclear
        return "CC BY-NC 4.0" if "4.0" in t else None
    if "publicdomain/zero" in t or "cc0" in t:
        return "CC0 1.0"
    if ("licenses/by/4.0" in t or "attribution" in t or "cc by" in t) and "4.0" in t:
        return "CC BY 4.0"
    return None


def worms(name):
    return cached("worms/" + re.sub(r"\W+", "_", name) + ".json", lambda: get(
        WORMS + "AphiaRecordsByName/" + urllib.parse.quote(name) + "?like=false&marine_only=false") or [])


def resolves(name, species):
    """True when every WoRMS entry for the name points to the candidate or one of its infraspecific taxa."""
    if not name:
        return False
    valid = {(r.get("valid_AphiaID"), r.get("valid_name") or "") for r in worms(name) if r.get("valid_AphiaID")}
    return bool(valid) and all(i == species["aphiaID"] or n.startswith(species["name"] + " ") for i, n in valid)


RANK_MARKERS = {"subsp.": "subsp.", "ssp.": "subsp.", "var.": "var.", "f.": "f.", "forma": "f."}


def canonical(name):
    """Species or infraspecific name without authorship, as WoRMS stores it; None for genus-only strings."""
    words = (name or "").split()
    if len(words) < 2 or not words[0].isalpha() or not words[1].isalpha() or not words[1].islower():
        return None
    words[0] = words[0].capitalize()
    if len(words) >= 4 and words[2] in RANK_MARKERS and words[3].isalpha() and words[3].islower():
        return " ".join(words[:2] + [RANK_MARKERS[words[2]], words[3]])
    return " ".join(words[:2])


def fetch_gbif(species):
    related = get(f'{WORMS}AphiaSynonymsByAphiaID/{species["aphiaID"]}') or []
    related += get(f'{WORMS}AphiaChildrenByAphiaID/{species["aphiaID"]}?marine_only=false') or []
    keys, genus, verbatim = set(), None, [None]
    for name in [species["name"]] + sorted({r["scientificname"] for r in related}):
        m = get(GBIF + "species/match?" + urllib.parse.urlencode({"name": name, "strict": "true"})) or {}
        # Only keys whose GBIF accepted species is the candidate in WoRMS, so other species are never fetched.
        if m.get("rank") in SPECIES_RANKS and resolves(m.get("species"), species):
            keys.add(m.get("acceptedUsageKey") or m["usageKey"])
    scope = {"geometry": BOX, "hasCoordinate": "true"}
    if not keys:  # backbone gap: records sit at the genus; each record's verbatim name is checked in WoRMS
        kingdom = worms(species["name"])[0]["kingdom"]  # genus names can be homonyms across kingdoms
        genus = get(GBIF + "species/match?" + urllib.parse.urlencode(
            {"name": species["name"].split()[0], "rank": "GENUS", "kingdom": kingdom, "strict": "true"}))["usageKey"]
        keys.add(genus)
        # Search results omit the verbatim name, so records are fetched per verbatim-name facet and tagged.
        facet = get(GBIF + "occurrence/search?" + urllib.parse.urlencode(
            {**scope, "taxonKey": genus, "limit": 0, "facet": "verbatimScientificName", "facetLimit": 1000}))
        verbatim = [f["name"] for f in facet["facets"][0]["counts"]] if facet["facets"] else []
    rows = {}
    for key in sorted(keys):
        for name in verbatim:
            for offset in range(0, 100000, 300):
                page = get(GBIF + "occurrence/search?" + urllib.parse.urlencode(
                    {**scope, "taxonKey": key, "limit": 300, "offset": offset,
                     **({"verbatimScientificName": name} if name else {})}))
                rows.update((r["key"], {**r, "_verbatim": name} if name else r) for r in page["results"])
                if page["endOfRecords"]:
                    break
    if genus and len(rows) != facet["count"]:
        raise ValueError(f'{species["name"]}: verbatim-name pages do not add up to the genus count')
    return {"keys": sorted(keys), "genusFallback": genus, "records": list(rows.values())}


def fetch_obis(species):
    q = {"taxonid": species["aphiaID"], "geometry": BOX}
    listing = get(OBIS + "dataset?" + urllib.parse.urlencode({**q, "size": 1000}))
    total = get(OBIS + "occurrence?" + urllib.parse.urlencode({**q, "size": 0}))["total"]
    if listing["total"] != len(listing["results"]) or total != sum(d.get("records") or 0 for d in listing["results"]):
        raise ValueError(f'OBIS dataset list incomplete for {species["name"]}')
    datasets, rows = [], []
    for d in listing["results"]:
        lic = licence(d.get("intellectualrights"))
        datasets.append({"id": d["id"], "title": d.get("title"), "records": d.get("records") or 0,
                         "licence": lic, "rights": d.get("intellectualrights")})
        if lic:  # records are only downloaded from CC0 / CC BY 4.0 / CC BY-NC 4.0 datasets
            page = get(OBIS + "occurrence?" + urllib.parse.urlencode({**q, "datasetid": d["id"], "size": 10000}))
            if page["total"] != len(page["results"]) or page["total"] != datasets[-1]["records"]:
                raise ValueError("OBIS page truncated for " + d["id"])
            rows += page["results"]
    return {"total": total, "datasets": datasets, "records": rows}


def year_of(ms):  # fromtimestamp() rejects pre-1970 values on Windows
    return (datetime.datetime(1970, 1, 1) + datetime.timedelta(milliseconds=ms)).year if ms is not None else None


def number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def identities(institution, catalogue, occurrence_id):
    ids = set()
    if catalogue:
        ids.add(("catalogue", institution, catalogue))
    if occurrence_id:
        ids.add(("occurrence", occurrence_id))
    return ids


def place(r):
    return {"inst": r.get("institutionCode"), "cat": re.sub(r"[^0-9]", "", r.get("catalogNumber") or ""), "locality": f'{r.get("locality") or ""} {r.get("verbatimLocality") or ""}'}


def normalize(species, gbif, obis):
    """Common record shape. Exact coordinates and IDs stay in memory; only cells are written."""
    out = []
    for r in sorted(gbif["records"], key=lambda r: r["key"]):
        name = r.get("species") if r.get("taxonRank") in SPECIES_RANKS else canonical(r.get("_verbatim"))
        est = {str(r.get(k) or "").lower() for k in ("degreeOfEstablishment", "establishmentMeans")}
        out.append({
            "src": "GBIF", "taxon": resolves(name, species) and "UNVERIFIED" not in (r.get("occurrenceRemarks") or ""),
            "present": r.get("occurrenceStatus") == "PRESENT",
            "fossil": r.get("basisOfRecord") == "FOSSIL_SPECIMEN", "licence": licence(r.get("license")),
            "year": r.get("year"), "range": "/" in (r.get("eventDate") or ""),
            "lat": r.get("decimalLatitude"), "lon": r.get("decimalLongitude"),
            "bad": bool(BAD_ISSUES & set(r.get("issues") or [])), "unc": number(r.get("coordinateUncertaintyInMeters")),
            "generalized": bool(r.get("dataGeneralizations") or r.get("informationWithheld")),
            "managed": r.get("basisOfRecord") == "LIVING_SPECIMEN" or bool(est & MANAGED),
            "ids": identities(r.get("institutionCode"), r.get("catalogNumber"), r.get("occurrenceID")),
            "date": (r.get("eventDate") or "")[:10], **place(r),
            "name": canonical(r.get("_verbatim")) or r.get("scientificName"), "dataset": ("GBIF", r.get("datasetKey")), "raw": r})
    licences = {d["id"]: d["licence"] for d in obis["datasets"]}
    for r in sorted(obis["records"], key=lambda r: r["id"]):
        est = {str(r.get(k) or "").lower() for k in ("degreeOfEstablishment", "establishmentMeans")}
        basis = str(r.get("basisOfRecord") or "").lower().replace("_", "")
        record_terms = re.sub(r"[^a-z]", "", str(r.get("license") or "").lower())
        y0, y1 = year_of(r.get("date_start")), year_of(r.get("date_end"))
        out.append({
            "src": "OBIS", "taxon": r.get("speciesid") == species["aphiaID"],
            "present": not r.get("absence") and not r.get("dropped"), "fossil": basis == "fossilspecimen",
            "licence": None if re.search(r"bysa|sharealike|bynd|noderiv", record_terms)
            else ("CC BY-NC 4.0" if licences.get(r.get("dataset_id")) else None) if re.search(r"bync|noncommercial", record_terms)
            else licences.get(r.get("dataset_id")),
            "year": y0 if y1 in (None, y0) else None, "range": y1 not in (None, y0),
            "lat": r.get("decimalLatitude"), "lon": r.get("decimalLongitude"),
            "bad": bool(OBIS_BAD_FLAGS & set(r.get("flags") or [])), "unc": number(r.get("coordinateUncertaintyInMeters")),
            "generalized": bool(r.get("dataGeneralizations") or r.get("informationWithheld")),
            "managed": basis == "livingspecimen" or bool(est & MANAGED),
            "ids": identities(r.get("institutionCode"), r.get("catalogNumber"), r.get("occurrenceID")),
            "date": (r.get("eventDate") or "")[:10], **place(r),
            "name": r.get("originalScientificName") or r.get("scientificName"), "dataset": ("OBIS", r.get("dataset_id")), "raw": r})
    return out


def first_reason(r):
    lat, lon = r["lat"], r["lon"]
    checks = [("taxon_not_verified", not r["taxon"]), ("absent_or_dropped", not r["present"]),
              ("fossil_specimen", r["fossil"]), ("license_not_open", not r["licence"]),
              ("multi_year_range", not r["year"] and r["range"]), ("no_year", not r["year"]),
              ("coordinate_issue", r["bad"] or not isinstance(lat, (int, float)) or not isinstance(lon, (int, float))
               or not (33 <= lat <= 38.7 and 124 <= lon <= 132)),
              ("uncertainty_over_10km", r["unc"] is not None and r["unc"] > 10000),
              ("generalized_at_source", r["generalized"]), ("captive_or_cultivated", r["managed"]),
              ("market_purchase_point", MARKET.search(r["locality"])),
              ("locality_contradicts_coordinates", OUTSIDE_BOX_PLACES.search(r["locality"]))]
    return next((why for why, bad in checks if bad), None)


def xylookup(aphia, points):
    """Shore distance and OBIS areas per point, cached by point so rule changes never misalign results."""
    path = CACHE / f"{aphia}-xylookup.json"
    known = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    todo = sorted({f"{lon},{lat}" for lon, lat in points} - known.keys())
    for i in range(0, len(todo), 500):
        batch = todo[i:i + 500]
        result = get("https://api.obis.org/xylookup", {"points": [[float(v) for v in k.split(",")] for k in batch],
                                                       "shoredistance": True, "areas": True})
        if len(result) != len(batch):
            raise ValueError("xylookup returned a different number of points")
        known.update(zip(batch, result))
    if todo:
        path.write_text(json.dumps(known), encoding="utf-8")
    return [known[f"{lon},{lat}"] for lon, lat in points]


def period(year):
    if year < 2000:
        return "2000년 이전", True
    return ("2000–2015", False) if year <= 2015 else (f"2016–{THIS_YEAR}", False)


def dataset_meta(src, key, obis_titles):
    if src == "GBIF":
        d = cached(f"gbif-dataset-{key}.json", lambda: get(GBIF + "dataset/" + key))
        return {"title": d.get("title"), "url": "https://www.gbif.org/dataset/" + key, "doi": d.get("doi"),
                "source": "GBIF"}
    return {"title": obis_titles.get(key), "url": "https://obis.org/dataset/" + key, "source": "OBIS"}


def copy_of(r, g):
    """Same day and point, or same holder, day and place with one catalogue number extending the other."""
    if r["date"] != g["date"]:
        return False
    if (round(r["lat"], 4), round(r["lon"], 4)) == (round(g["lat"], 4), round(g["lon"], 4)):
        return True
    short, long = sorted((r["cat"], g["cat"]), key=len)
    return (bool(r["inst"] and short) and r["inst"] == g["inst"] and long.startswith(short)
            and abs(r["lat"] - g["lat"]) <= 0.05 and abs(r["lon"] - g["lon"]) <= 0.05)


def screen(species, gbif, obis):
    """Accepted records (in memory only) and per-source exclusion counts that add up to the query totals."""
    reasons = {"GBIF": Counter(), "OBIS": Counter()}
    for d in obis["datasets"]:  # records of non-open OBIS datasets are counted, never downloaded
        if not d["licence"]:
            reasons["OBIS"]["license_not_open"] += d["records"]
    pending = []
    for r in normalize(species, gbif, obis):
        why = first_reason(r)
        if why:
            reasons[r["src"]][why] += 1
        else:
            pending.append(r)
    for r, x in zip(pending, xylookup(species["aphiaID"], [[r["lon"], r["lat"]] for r in pending])):
        areas = x.get("areas") or {}
        r["shore"] = x.get("shoredistance")
        r["lme"] = {a["name"] for a in areas.get("lme", [])}
        r["korean_eez"] = any(a["name"] in KOREAN_EEZ for a in areas.get("obis", []))
    accepted, seen = [], set()
    for r in pending:  # GBIF first (sorted by key), then OBIS
        if r["shore"] is None or r["shore"] < -LAND_BUFFER_M:
            why = "on_land_obis_rule"
        elif r["ids"] & seen or (r["src"] == "OBIS" and any(copy_of(r, g) for g in accepted if g["src"] == "GBIF")):
            why = "duplicate"
        else:
            why = None
        if why:
            reasons[r["src"]][why] += 1
            continue
        seen |= r["ids"]
        accepted.append(r)
    queried = {"GBIF": len(gbif["records"]), "OBIS": obis["total"]}
    for src in ("GBIF", "OBIS"):
        done = sum(reasons[src].values()) + sum(r["src"] == src for r in accepted)
        if done != queried[src]:
            raise ValueError(f'{species["name"]} {src}: {done} reviewed != {queried[src]} queried')
    return accepted, reasons, queried


def review(species, gbif, obis):
    size = 4 if species["aphiaID"] in FOUR_DEGREE else 1
    accepted, reasons, queried = screen(species, gbif, obis)
    groups = {}
    for r in accepted:
        label, historical = period(r["year"])
        key = (math.floor(r["lat"] / size) * size, math.floor(r["lon"] / size) * size, label)
        groups.setdefault(key, []).append(r)
    titles = {d["id"]: d["title"] for d in obis["datasets"]}
    cells = []
    for (lat0, lon0, label), rows in sorted(groups.items()):
        cites = {}
        for r in rows:
            meta = dataset_meta(*r["dataset"], titles)
            cites.setdefault(meta["url"], {**{k: v for k, v in meta.items() if v}, "licenses": set()})["licenses"].add(r["licence"])
        cells.append({
            "lat0": lat0, "lon0": lon0, "sizeDeg": size,
            "resolutionM": math.floor(min(size * 111320 * math.cos(math.radians(lat0 + size)), size * 110574)),
            "period": label, "historical": period(rows[0]["year"])[1],
            "outsideKoreanEEZ": not any(r["korean_eez"] for r in rows),
            "yearStart": min(r["year"] for r in rows), "yearEnd": max(r["year"] for r in rows),
            "records": len(rows), "sites": len({(round(r["lon"], 3), round(r["lat"], 3)) for r in rows}),
            "uncertaintyMissing": sum(r["unc"] is None for r in rows),
            "seaAreas": sorted({a for r in rows for a in r["lme"]}) or ["해역명 미확인"],
            "sources": sorted({r["src"] for r in rows}),
            "citations": [{**v, "licenses": sorted(v["licenses"])} for _, v in sorted(cites.items())],
            "licenses": sorted({r["licence"] for r in rows})})
    excluded = {src: {k: reasons[src][k] for k in REASONS if reasons[src][k]} for src in reasons}
    return {
        "aphiaID": species["aphiaID"], "name": species["name"], "sizeDeg": size,
        "sensitivity": FOUR_DEGREE.get(species["aphiaID"], "민감도 미평가: GBIF 지침의 가장 엄격한 공개 수준 1°"),
        "review": {
            "status": "cells_published" if cells else "no_eligible_records",
            "accepted": len(accepted), "historical": sum(r["year"] < 2000 for r in accepted),
            "outsideKoreanEEZ": sum(not r["korean_eez"] for r in accepted),
            "names": sorted({r["name"] for r in accepted}),
            "gbif": {"queried": queried["GBIF"], "accepted": sum(r["src"] == "GBIF" for r in accepted),
                     "excluded": excluded["GBIF"], "genusFallback": bool(gbif["genusFallback"]),
                     "query": "https://www.gbif.org/occurrence/search?" + urllib.parse.urlencode(
                         {"taxon_key": gbif["keys"], "geometry": BOX, "has_coordinate": "true"}, doseq=True)},
            "obis": {"queried": queried["OBIS"], "accepted": sum(r["src"] == "OBIS" for r in accepted),
                     "excluded": excluded["OBIS"], "datasets": len(obis["datasets"]),
                     "openDatasets": sum(bool(d["licence"]) for d in obis["datasets"]),
                     "query": "https://api.obis.org/v3/occurrence?" + urllib.parse.urlencode(
                         {"taxonid": species["aphiaID"], "geometry": BOX, "size": 0})}},
        "cells": cells}


def main():
    (CACHE / "worms").mkdir(parents=True, exist_ok=True)
    result = []
    for s in json.loads(CATALOG.read_text(encoding="utf-8"))["species"]:
        gbif = cached(f'{s["aphiaID"]}-gbif.json', lambda: fetch_gbif(s))
        obis = cached(f'{s["aphiaID"]}-obis.json', lambda: fetch_obis(s))
        entry = review(s, gbif, obis)
        result.append(entry)
        rv = entry["review"]
        print(f'{s["label"]}\t{len(entry["cells"])} cells\taccepted {rv["accepted"]} (hist {rv["historical"]}, '
              f'outside KR/KP EEZ {rv["outsideKoreanEEZ"]})\tGBIF {rv["gbif"]["queried"]} {rv["gbif"]["excluded"]}\t'
              f'OBIS {rv["obis"]["queried"]} {rv["obis"]["excluded"]}', flush=True)
    OUT.write_text(json.dumps({
        "schemaVersion": "candidate-public-cells-2", "reviewedOn": REVIEWED,
        "rules": "map-1 (2026-09-24) + candidate additions (2026-09-27) + CC BY-NC 4.0 and 1 km land buffer (2026-10-01): scripts/build_expansion_cells.py",
        "scope": ("Generalized occurrence cells from reviewed GBIF and OBIS records. Not current distribution, "
                  "abundance, stock size or regional value. Pre-2000 records are a separate historical period."),
        "queryBox": "124–132°E · 33–38.7°N",
        "species": result}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("cells", sum(len(s["cells"]) for s in result), "species with cells", sum(bool(s["cells"]) for s in result))


if __name__ == "__main__":
    main()
