"""Run the repo's collect_mbpi_links.py stages 1-5 (its own functions, unchanged) for the three MBPI validation species only."""
import sys, json, urllib.parse
from collections import defaultdict
from statistics import median
from pathlib import Path
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]  # repository root
sys.path.insert(0, str(ROOT / "scripts"))
import collect_mbpi_links as C

HERE = Path(__file__).parent
C.CACHE = HERE / "cache"
C.CACHE.mkdir(exist_ok=True)
rule = json.loads((ROOT / "config/verified-indices-v3.25.json").read_text(encoding="utf-8"))["chembl_bioactivity"]
CASES = [(215429, "Conus magus"), (165849, "Halichondria (Halichondria) okadai"), (103756, "Ecteinascidia turbinata")]
EXTRA = json.loads((HERE / "extra_links.json").read_text(encoding="utf-8")) if (HERE / "extra_links.json").exists() else []

out_species, compounds = [], {}
for aphia, sci in CASES:
    rec = C.get(f"{C.WORMS}AphiaRecordByAphiaID/{aphia}")
    assert rec["status"] == "accepted" and rec["scientificname"] == sci, rec["scientificname"]
    syn = sorted({x["scientificname"] for x in C.get(f"{C.WORMS}AphiaSynonymsByAphiaID/{aphia}", missing_ok=True) or []} - {sci})
    ncbi = C.get(f"{C.WORMS}AphiaExternalIDByAphiaID/{aphia}?type=ncbi", missing_ok=True) or []
    rows = C.sparql(C.LINK_QUERY % " ".join(json.dumps(n) for n in [sci, *syn]))
    links = defaultdict(lambda: {"statements": defaultdict(set)})
    for b in rows:
        if "c" not in b:
            continue
        c = C.qid(b, "c")
        links[c] |= {"inchikey": b["ik"]["value"], "qid": c}
        refs = links[c]["statements"][C.qid(b, "taxon")]
        if "ref" in b:
            refs.add(C.qid(b, "ref"))
        compounds[c] = b["ik"]["value"]
    for p in (p for p in EXTRA if p["aphia_id"] == aphia):  # hypothetical original-paper links (not in the repo's paper_links)
        key = p.get("qid") or p["inchikey"]
        links[key] |= {"inchikey": p["inchikey"], "qid": p.get("qid")}
        links[key]["statements"]["original_paper"].add("doi:" + p["doi"].lower())
        compounds[key] = p["inchikey"]
    out_species.append({"aphia_id": aphia, "scientific_name": sci, "worms_synonyms": syn, "ncbi_taxids": ncbi,
                        "wikidata_taxa": sorted({(C.qid(b, "taxon"), b["name"]["value"]) for b in rows}),
                        "links": [{"compound_qid": v["qid"], "inchikey": v["inchikey"],
                                   "statements": [{"taxon_qid": t, "references": sorted(r)} for t, r in sorted(v["statements"].items())]}
                                  for c, v in sorted(links.items())]})
    print(aphia, sci, "links", len(links), flush=True)

refs = sorted({r for s in out_species for l in s["links"] for st in l["statements"] for r in st["references"] if r[0] == "Q"})
dois = {r: r[4:] for s in out_species for l in s["links"] for st in l["statements"] for r in st["references"] if r[:4] == "doi:"}
for i in range(0, len(refs), 50):
    ents = C.get(f"{C.WDAPI}?action=wbgetentities&props=claims&format=json&ids=" + "|".join(refs[i:i + 50]))["entities"]
    for q in refs[i:i + 50]:
        cl = ents.get(q, {}).get("claims", {}).get("P356", [])
        dois[q] = cl[0]["mainsnak"]["datavalue"]["value"] if cl and "datavalue" in cl[0]["mainsnak"] else None

counts = {}
cq = sorted(c for c in compounds if c.startswith("Q"))
for b in C.sparql(C.COUNT_QUERY % " ".join("wd:" + c for c in cq)):
    counts[C.qid(b, "c")] = int(b["n"]["value"])

identity = {}
for ik in sorted(set(compounds.values())):
    m = C.get(f"{C.CHEMBL}molecule/{ik}.json?only=molecule_chembl_id,pref_name,molecule_hierarchy", missing_ok=True)
    cid = C.get(f"{C.PUG}pug/compound/inchikey/{ik}/cids/JSON", missing_ok=True)
    parent = m and (m.get("molecule_hierarchy") or {}).get("parent_chembl_id") or (m and m["molecule_chembl_id"])
    identity[ik] = {"chembl_id": m and m["molecule_chembl_id"], "parent_chembl_id": parent, "chembl_pref_name": m and m.get("pref_name"),
                    "pubchem_cids": cid["IdentifierList"]["CID"] if cid else []}
parents = sorted({v["parent_chembl_id"] for v in identity.values() if v["parent_chembl_id"]})
mols = {p: C.get(f"{C.CHEMBL}molecule/{p}.json?only=molecule_chembl_id,pref_name,max_phase") for p in parents}
names = {p: m["pref_name"] for p, m in mols.items()}
max_phase = {p: m["max_phase"] and float(m["max_phase"]) for p, m in mols.items()}

activities, checks = [], []
for p in parents:
    url = f"{C.CHEMBL}activity.json?limit=1000&pchembl_value__isnull=false&parent_molecule_chembl_id={p}&only={C.ACT_FIELDS}"
    own = []
    while url:
        page = C.get(url)
        own += page["activities"]
        url = page["page_meta"]["next"] and "https://www.ebi.ac.uk" + page["page_meta"]["next"]
    kept = [a for a in own if not C.admitted(a, rule)]
    api = sum(C.chembl_count({**f, "parent_molecule_chembl_id": p}) for f in C.cohort_filter(rule))
    checks.append({"parent": p, "all_pchembl": len(own), "client_admitted": len(kept), "api_filtered": api})
    assert api == len(kept), (p, api, len(kept))
    activities += [{k: a[k] for k in ("activity_id", "parent_molecule_chembl_id", "target_chembl_id", "standard_type", "assay_chembl_id",
                                      "assay_type", "document_chembl_id", "data_validity_comment")}
                   | {"pchembl_value": float(a["pchembl_value"])} for a in kept]

comments = {}
ids = [a["activity_id"] for a in activities]
for i in range(0, len(ids), 50):
    page = C.get(f"{C.CHEMBL}activity.json?limit=50&only=activity_id,activity_comment&activity_id__in=" + ",".join(map(str, ids[i:i + 50])))
    for a in page["activities"]:
        comments[str(a["activity_id"])] = a["activity_comment"]
drop = set(rule["excluded_activity_comments"])

tids, targets = sorted({a["target_chembl_id"] for a in activities}), {}
for i in range(0, len(tids), 100):
    for t in C.get(f"{C.CHEMBL}target.json?limit=1000&only=target_chembl_id,target_type,pref_name,organism,tax_id"
                   f"&target_chembl_id__in={','.join(tids[i:i + 100])}")["targets"]:
        targets[t["target_chembl_id"]] = {k: t[k] for k in ("target_type", "pref_name", "organism", "tax_id")}
for t in targets.values():
    if t["target_type"] == "ORGANISM" and t["tax_id"]:
        o = C.get(f"{C.CHEMBL}organism.json?tax_id={t['tax_id']}")["organisms"]
        t["organism_class"] = o and [o[0]["l1"], o[0]["l2"], o[0]["l3"]]
    if t["target_type"] == "CELL-LINE":
        lines = C.get(f"{C.CHEMBL}cell_line.json?only=cell_name,cellosaurus_id&cell_name={urllib.parse.quote(t['pref_name'])}")["cell_lines"]
        cvcl = lines[0]["cellosaurus_id"] if len(lines) == 1 else None
        ca = cvcl and C.get(f"{C.CELLOSAURUS}{cvcl}?fields=ca&format=json", missing_ok=True)
        t["cellosaurus"] = {"id": cvcl, "category": ca and ca["Cellosaurus"]["cell-line-list"][0].get("category")}

# cohort positions at both medians: all admitted rows (collector) and comment-filtered rows (builder after 3.20)
values_all, values_kept = defaultdict(list), defaultdict(list)
for a in activities:
    k = (a["parent_molecule_chembl_id"], a["target_chembl_id"], a["standard_type"])
    values_all[k].append(a["pchembl_value"])
    if (comments.get(str(a["activity_id"])) or "").lower() not in drop:
        values_kept[k].append(a["pchembl_value"])
scored = {t for s in rule["strata"].values() for t in s["target_types"]}
cohorts = {}
for vals in (values_all, values_kept):
    for (p, t, st), v in sorted(vals.items()):
        if targets[t]["target_type"] not in scored or not v:
            continue
        key, m = f"{t}|{st}", round(median(v), 3)
        base = [{**f, "target_chembl_id": t, "standard_type": st} for f in C.cohort_filter(rule)]
        c = cohorts.setdefault(key, {"below": {}, "equal": {}})
        if "total" not in c:
            c["total"] = sum(C.chembl_count(f) for f in base)
        if str(m) not in c["below"]:
            c["below"][str(m)] = sum(C.chembl_count({**f, "pchembl_value__lt": m}) for f in base)
            c["equal"][str(m)] = sum(C.chembl_count({**f, "pchembl_value": m}) for f in base) if round(m, 2) == m else 0

snap = {"queried_on": sorted(C.QUERIED), "chembl_version": C.get(C.CHEMBL + "status.json")["chembl_db_version"],
        "species": out_species, "reference_dois": dois, "compound_taxon_counts": counts,
        "compounds": identity, "parent_names": names, "parent_max_phase": max_phase, "api_filter_checks": checks,
        "activities": sorted(activities, key=lambda a: a["activity_id"]), "activity_comments": comments,
        "targets": targets, "cohorts": cohorts}
(HERE / "cases-snapshot.json").write_text(json.dumps(snap, ensure_ascii=False, indent=1, default=list), encoding="utf-8")
print("parents", len(parents), "activities", len(activities), "cohorts", len(cohorts),
      "flagged", sum((comments.get(str(a["activity_id"])) or "").lower() in drop for a in activities))
