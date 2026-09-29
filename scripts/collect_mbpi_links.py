"""Collect the diagram-stage-2 species -> compound -> ChEMBL activity snapshot (network).

Stages (the builder reads only the written snapshot; `--check` there is offline):
  1. names     - WoRMS accepted name + synonyms (the AphiaID <-> synonym map) and NCBI taxid
  2. link      - Wikidata P703 (found in taxon, LOTUS) statements for taxa whose P225 is one of
                 those names, with their P248 (stated in) references; one SPARQL query per species
  3. identity  - InChIKey -> ChEMBL molecule (parent) and PubChem CIDs
  4. activity  - ChEMBL pChEMBL activities of the parents, admitted by the config filters
  5. cohort    - ChEMBL counts for each target x endpoint cohort at each species value
Only IDs, names and numbers needed for the score are stored (ChEMBL CC BY-SA 3.0,
Wikidata CC0, PubChem, Cellosaurus CC BY 4.0, WoRMS CC BY 4.0).

Usage: PYTHONUTF8=1 python scripts/collect_mbpi_links.py [--cache DIR]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "verified-indices-v3.1.json"
UA = {"User-Agent": "BlueBioValueMap-research/1.0 (research@example.org)", "Accept": "application/json"}
WORMS = "https://www.marinespecies.org/rest/"
WDQS = "https://query.wikidata.org/sparql"
WDAPI = "https://www.wikidata.org/w/api.php"
CHEMBL = "https://www.ebi.ac.uk/chembl/api/data/"
PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/"
CELLOSAURUS = "https://api.cellosaurus.org/cell-line/"
LINK_QUERY = """SELECT ?taxon ?name ?c ?ik ?st ?ref WHERE {
  VALUES ?name { %s }
  ?taxon wdt:P225 ?name .
  OPTIONAL { ?c p:P703 ?st . ?st ps:P703 ?taxon . ?c wdt:P235 ?ik .
             OPTIONAL { ?st prov:wasDerivedFrom/pr:P248 ?ref } }
}"""
COUNT_QUERY = "SELECT ?c (COUNT(DISTINCT ?t) AS ?n) WHERE { VALUES ?c { %s } ?c wdt:P703 ?t } GROUP BY ?c"
ACT_FIELDS = ("activity_id,assay_chembl_id,assay_type,data_validity_comment,document_chembl_id,molecule_chembl_id,"
              "parent_molecule_chembl_id,pchembl_value,potential_duplicate,standard_relation,standard_type,target_chembl_id")
CACHE: Path | None = None


def get(url: str, *, missing_ok: bool = False, pause: float = 0.25):
    """GET JSON with retries; a 404 is None only when the caller says absence is an answer."""
    key = CACHE and CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".json")
    if key and key.exists():
        return json.loads(key.read_text(encoding="utf-8"))
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
                body = r.read()
            if not body and not missing_ok:
                raise ValueError(f"empty response: {url}")
            data = json.loads(body) if body else None  # WoRMS answers "none" with HTTP 204
            break
        except urllib.error.HTTPError as e:
            if e.code == 404 and missing_ok:
                data = None
                break
            if e.code not in (429, 500, 502, 503, 504) or attempt == 4:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 5 * (attempt + 1)))
        except (urllib.error.URLError, TimeoutError):
            if attempt == 4:
                raise
            time.sleep(5 * (attempt + 1))
    time.sleep(pause)
    if key:
        key.write_text(json.dumps(data), encoding="utf-8")
    return data


def sparql(query: str) -> list[dict]:
    return get(WDQS + "?format=json&query=" + urllib.parse.quote(query), pause=1.0)["results"]["bindings"]


def qid(binding: dict, name: str) -> str | None:
    return binding[name]["value"].rsplit("/", 1)[1] if name in binding else None


def chembl_count(params: dict) -> int:
    return get(CHEMBL + "activity.json?limit=1&only=activity_id&" + urllib.parse.urlencode(params))["page_meta"]["total_count"]


def admitted(row: dict, rule: dict) -> str | None:
    """The config filters applied to one activity; returns the exclusion reason or None."""
    if row["standard_relation"] != rule["standard_relation"]:
        return "relation_not_equal"
    if row["data_validity_comment"] not in rule["data_validity_comments"]:
        return "data_validity_flag"
    if rule["exclude_potential_duplicate"] and row["potential_duplicate"]:
        return "potential_duplicate"
    if row["assay_type"] not in rule["assay_types"]:
        return "assay_type"
    return None


def cohort_filter(rule: dict) -> list[dict]:
    """The same filters as `admitted` in API form; validity needs one query per accepted comment."""
    base = {"standard_relation": rule["standard_relation"], "pchembl_value__isnull": "false",
            "assay_type__in": ",".join(rule["assay_types"])}
    if rule["exclude_potential_duplicate"]:
        base["potential_duplicate"] = 0
    return [{**base, **({"data_validity_comment__isnull": "true"} if c is None else {"data_validity_comment": c})}
            for c in rule["data_validity_comments"]]


def main() -> None:
    global CACHE
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", type=Path, help="reuse raw responses between runs (not committed)")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.cache:
        args.cache.mkdir(parents=True, exist_ok=True)
        CACHE = args.cache
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    rule = config["chembl_bioactivity"]
    today = date.today().isoformat()
    species = json.loads((ROOT / "dist/matrix-readiness.json").read_text(encoding="utf-8"))["species"]
    status = get(CHEMBL + "status.json")

    # verified original-paper links for species without P703 statements (research/verified-indices/mbpi-paper-links-*.json)
    papers = json.loads((ROOT / rule["paper_links"]).read_text(encoding="utf-8"))["links"]
    paper_iks = sorted({p["inchikey"] for p in papers})
    paper_qids = {b["ik"]["value"]: qid(b, "c") for b in sparql(
        "SELECT ?c ?ik WHERE { VALUES ?ik { %s } ?c wdt:P235 ?ik }" % " ".join(json.dumps(k) for k in paper_iks))}

    # 1-2. names and links, one SPARQL query per species
    out_species, compounds = [], {}
    for s in sorted(species, key=lambda x: x["aphia_id"]):
        aphia = s["aphia_id"]
        record = get(f"{WORMS}AphiaRecordByAphiaID/{aphia}")
        if record["status"] != "accepted" or record["scientificname"] != s["scientific_name"]:
            raise ValueError(f"{aphia}: WoRMS accepted name differs from the published identity")
        synonyms = sorted({x["scientificname"] for x in get(f"{WORMS}AphiaSynonymsByAphiaID/{aphia}", missing_ok=True) or []}
                          - {record["scientificname"]})
        ncbi = get(f"{WORMS}AphiaExternalIDByAphiaID/{aphia}?type=ncbi", missing_ok=True) or []
        names = [record["scientificname"], *synonyms]
        rows = sparql(LINK_QUERY % " ".join(json.dumps(n) for n in names))
        taxa = sorted({(qid(b, "taxon"), b["name"]["value"]) for b in rows})
        links = defaultdict(lambda: {"statements": defaultdict(set)})
        for b in rows:
            if "c" not in b:
                continue
            c = qid(b, "c")
            links[c] |= {"inchikey": b["ik"]["value"], "qid": c}
            refs = links[c]["statements"][qid(b, "taxon")]
            if "ref" in b:
                refs.add(qid(b, "ref"))
            compounds[c] = b["ik"]["value"]
        for p in (p for p in papers if p["aphia_id"] == aphia):  # keyed by InChIKey when Wikidata has no item
            c = paper_qids.get(p["inchikey"])
            links[c or p["inchikey"]] |= {"inchikey": p["inchikey"], "qid": c}
            links[c or p["inchikey"]]["statements"]["original_paper"].add("doi:" + p["doi"].lower())
            if c:
                compounds[c] = p["inchikey"]
        sections = []
        for taxid in ncbi:
            page = get(f"{PUG}pug_view/data/taxonomy/{taxid}/JSON?heading=Natural%20Products", missing_ok=True)
            if page:
                info = page["Record"]["Section"][0]["Section"][0]["Information"]
                sections.append({"ncbi_taxid": taxid, "heading": "Natural Products",
                                 "citations": sorted({e["Citation"] for i in info for e in i.get("ExtendedReference", [])}),
                                 "reference_numbers": sorted({i["ReferenceNumber"] for i in info})})
        out_species.append({
            "aphia_id": aphia, "scientific_name": s["scientific_name"], "worms_synonyms": synonyms, "ncbi_taxids": ncbi,
            "wikidata_taxa": [{"qid": q, "name": n} for q, n in taxa],
            "pubchem_taxonomy_natural_products": sections,
            "links": [{"compound_qid": v["qid"], "inchikey": v["inchikey"],
                       "statements": [{"taxon_qid": t, "references": sorted(r)} for t, r in sorted(v["statements"].items())]}
                      for c, v in sorted(links.items())]})
        print(aphia, s["scientific_name"], "names", len(names), "taxa", len(taxa), "compounds", len(links), flush=True)

    # reference DOIs (scholarly items left the main query graph in 2025; read them from the entity API)
    refs = sorted({r for s in out_species for l in s["links"] for st in l["statements"] for r in st["references"] if r[0] == "Q"})
    dois = {r: r[4:] for s in out_species for l in s["links"] for st in l["statements"] for r in st["references"] if r[:4] == "doi:"}
    for i in range(0, len(refs), 50):
        entities = get(f"{WDAPI}?action=wbgetentities&props=claims&format=json&ids=" + "|".join(refs[i:i + 50]))["entities"]
        for q in refs[i:i + 50]:
            claim = entities.get(q, {}).get("claims", {}).get("P356", [])
            dois[q] = claim[0]["mainsnak"]["datavalue"]["value"] if claim and "datavalue" in claim[0]["mainsnak"] else None

    # LOTUS taxon count per compound, for the species-specificity rule
    counts, cq = {}, sorted(compounds)
    for i in range(0, len(cq), 100):
        for b in sparql(COUNT_QUERY % " ".join("wd:" + c for c in cq[i:i + 100])):
            counts[qid(b, "c")] = int(b["n"]["value"])

    # 3. identity: InChIKey -> ChEMBL parent -> PubChem CIDs
    identity = {}
    for ik in sorted(set(compounds.values())):
        m = get(f"{CHEMBL}molecule/{ik}.json?only=molecule_chembl_id,pref_name,molecule_hierarchy", missing_ok=True)
        cid = get(f"{PUG}pug/compound/inchikey/{ik}/cids/JSON", missing_ok=True, pause=0.25)
        parent = m and (m.get("molecule_hierarchy") or {}).get("parent_chembl_id") or (m and m["molecule_chembl_id"])
        identity[ik] = {"chembl_id": m and m["molecule_chembl_id"], "parent_chembl_id": parent,
                        "chembl_pref_name": m and m.get("pref_name"),
                        "pubchem_cids": cid["IdentifierList"]["CID"] if cid else []}
    parents = sorted({v["parent_chembl_id"] for v in identity.values() if v["parent_chembl_id"]})
    molecules = {p: get(f"{CHEMBL}molecule/{p}.json?only=molecule_chembl_id,pref_name,max_phase") for p in parents}
    names = {p: m["pref_name"] for p, m in molecules.items()}
    max_phase = {p: m["max_phase"] and float(m["max_phase"]) for p, m in molecules.items()}

    # 4. activities of each parent (ChEMBL silently ignores unknown filters, so the API filters are
    #    re-checked against the client filter on every parent before any cohort count is trusted)
    activities, excluded, checks = [], defaultdict(lambda: defaultdict(int)), []
    for p in parents:
        url = f"{CHEMBL}activity.json?limit=1000&pchembl_value__isnull=false&parent_molecule_chembl_id={p}&only={ACT_FIELDS}"
        own = []
        while url:
            page = get(url)
            own += page["activities"]
            url = page["page_meta"]["next"] and "https://www.ebi.ac.uk" + page["page_meta"]["next"]
        kept = [a for a in own if not admitted(a, rule)]
        for a in own:
            reason = admitted(a, rule)
            if reason:
                excluded[p][reason] += 1
        api = sum(chembl_count({**f, "parent_molecule_chembl_id": p}) for f in cohort_filter(rule))
        checks.append({"parent_chembl_id": p, "client_admitted": len(kept), "api_filtered": api})
        if api != len(kept):
            raise ValueError(f"{p}: ChEMBL API filter count {api} differs from client filter {len(kept)}")
        activities += [{k: a[k] for k in ("activity_id", "parent_molecule_chembl_id", "target_chembl_id", "standard_type",
                                          "assay_chembl_id", "assay_type", "document_chembl_id", "data_validity_comment")}
                       | {"pchembl_value": float(a["pchembl_value"])} for a in kept]

    # targets, their organism class (pathogen stratum) and Cellosaurus category (cancer cell-line stratum)
    tids, targets = sorted({a["target_chembl_id"] for a in activities}), {}
    for i in range(0, len(tids), 100):
        for t in get(f"{CHEMBL}target.json?limit=1000&only=target_chembl_id,target_type,pref_name,organism,tax_id"
                     f"&target_chembl_id__in={','.join(tids[i:i + 100])}")["targets"]:
            targets[t["target_chembl_id"]] = {k: t[k] for k in ("target_type", "pref_name", "organism", "tax_id")}
    for t in targets.values():
        if t["target_type"] == "ORGANISM" and t["tax_id"]:
            o = get(f"{CHEMBL}organism.json?tax_id={t['tax_id']}")["organisms"]
            t["organism_class"] = o and [o[0]["l1"], o[0]["l2"], o[0]["l3"]]
        if t["target_type"] == "CELL-LINE":
            lines = get(f"{CHEMBL}cell_line.json?only=cell_name,cellosaurus_id&cell_name={urllib.parse.quote(t['pref_name'])}")["cell_lines"]
            cvcl = lines[0]["cellosaurus_id"] if len(lines) == 1 else None
            ca = cvcl and get(f"{CELLOSAURUS}{cvcl}?fields=ca&format=json", missing_ok=True)
            t["cellosaurus"] = {"id": cvcl, "category": ca and ca["Cellosaurus"]["cell-line-list"][0].get("category")}

    # 5. cohort counts: every target x endpoint an admitted species value falls in (strata are applied by the builder)
    values = defaultdict(list)
    for a in activities:
        values[(a["parent_molecule_chembl_id"], a["target_chembl_id"], a["standard_type"])].append(a["pchembl_value"])
    cohorts = defaultdict(lambda: {"below": {}, "equal": {}})
    scored_types = {t for s in rule["strata"].values() for t in s["target_types"]}
    for (p, t, st), v in sorted(values.items()):
        if targets[t]["target_type"] not in scored_types:
            continue
        key, m = f"{t}|{st}", round(median(v), 3)
        base = [{**f, "target_chembl_id": t, "standard_type": st} for f in cohort_filter(rule)]
        c = cohorts[key]
        if "total" not in c:
            c["total"] = sum(chembl_count(f) for f in base)
        if str(m) not in c["below"]:
            c["below"][str(m)] = sum(chembl_count({**f, "pchembl_value__lt": m}) for f in base)
            c["equal"][str(m)] = sum(chembl_count({**f, "pchembl_value": m}) for f in base) if round(m, 2) == m else 0
    snapshot = {
        "snapshot_date": today, "queried_on": today,
        "sources": {  # registered like evidence sources (url, provider, version, terms, accessed)
            "worms_rest_mbpi": {"provider": "World Register of Marine Species", "title": "WoRMS REST accepted names, synonyms and NCBI IDs",
                                "version": f"queried {today}", "url": WORMS, "accessed": today, "license": "CC BY 4.0",
                                "terms": "CC BY 4.0; the AphiaID <-> synonym map is stored per species"},
            "wikidata_p703_lotus": {"provider": "Wikidata (LOTUS natural products import)", "title": "P703 found-in-taxon statements and P248 references",
                                    "version": f"query service, queried {today}", "url": WDQS, "accessed": today, "license": "CC0 1.0",
                                    "terms": "CC0; P703 statements are mostly LOTUS imports (DOI 10.5281/zenodo.5794106)",
                                    "query": LINK_QUERY, "count_query": COUNT_QUERY, "user_agent": UA["User-Agent"]},
            "chembl_mbpi": {"provider": "EMBL-EBI ChEMBL", "title": "ChEMBL molecule, activity, target and cell-line resources",
                            "version": f"{status['chembl_db_version']} ({status['chembl_release_date']})", "url": CHEMBL,
                            "accessed": today, "license": "CC BY-SA 3.0",
                            "terms": "CC BY-SA 3.0; only IDs, pChEMBL values and cohort counts are stored"},
            "pubchem_inchikey_mbpi": {"provider": "NCBI PubChem", "title": "PUG REST InChIKey -> CID and taxonomy 'Natural Products' section",
                                      "version": f"queried {today}", "url": PUG, "accessed": today, "license": "NCBI public access",
                                      "terms": "NCBI public access; taxonomy section presence only (the sdqagent compound table returned HTTP 404 on 2026-09-29)"},
            "cellosaurus_mbpi": {"provider": "SIB Cellosaurus", "title": "Cell-line category for ChEMBL CELL-LINE targets",
                                 "version": f"API, queried {today}", "url": CELLOSAURUS, "accessed": today, "license": "CC BY 4.0",
                                 "terms": "CC BY 4.0; category field only"}},
        "filters": {k: rule[k] for k in ("standard_relation", "data_validity_comments", "exclude_potential_duplicate", "assay_types")},
        "api_filter_checks": checks, "species": out_species, "reference_dois": dois,
        "compound_taxon_counts": dict(sorted(counts.items())), "compounds": identity, "parent_names": names,
        "parent_max_phase": max_phase, "paper_links": rule["paper_links"],
        "activities": sorted(activities, key=lambda a: a["activity_id"]),
        "activity_exclusions": {p: dict(sorted(v.items())) for p, v in sorted(excluded.items())},
        "targets": dict(sorted(targets.items())), "cohorts": dict(sorted(cohorts.items()))}
    out = args.out or ROOT / f"research/verified-indices/snapshots/mbpi-links-{today}.json"
    out.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"{out}: {sum(len(s['links']) for s in out_species)} links, {len(parents)} ChEMBL parents, "
          f"{len(activities)} activities, {len(cohorts)} cohorts")


if __name__ == "__main__":
    main()
