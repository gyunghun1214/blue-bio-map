"""Collect a supplement to the ChEMBL link snapshot for links accepted after it (network).

Same ChEMBL release, filters and cohort counting as scripts/collect_mbpi_links.py, whose functions it reuses. It reads the
config's paper_links (species without P703 statements) and paper_links_p703 and collects every linked compound the base
snapshot does not hold: InChIKey -> ChEMBL parent, PubChem CIDs, Wikidata P703 taxon count, admitted pChEMBL activities with
the depositor's activity_comment, new targets, and cohort counts at the new medians (with and without the comment-flagged
rows the 3.20 rule drops). The builder merges the file into the snapshot; a cohort the snapshot already holds must keep its total.

Usage: PYTHONUTF8=1 python scripts/collect_mbpi_supplement.py --config config/verified-indices-v3.27.json [--cache DIR]
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from collections import defaultdict
from datetime import date
from pathlib import Path
from statistics import median

sys.path.insert(0, str(Path(__file__).resolve().parent))
import collect_mbpi_links as C  # noqa: E402

ROOT = C.ROOT


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--cache", type=Path, help="reuse raw responses between runs (not committed)")
    args = parser.parse_args()
    if args.cache:
        args.cache.mkdir(parents=True, exist_ok=True)
        C.CACHE = args.cache
    read = lambda p: json.loads((ROOT / p).read_text(encoding="utf-8"))
    cfg = json.loads(args.config.read_text(encoding="utf-8"))
    rule = cfg["chembl_bioactivity"]
    base = read(rule["snapshot"])
    if {k: rule[k] for k in base["filters"]} != base["filters"]:  # the file records the filters it was collected with
        raise ValueError("config ChEMBL filters differ from the base snapshot's")
    status = C.get(C.CHEMBL + "status.json")
    version = f"{status['chembl_db_version']} ({status['chembl_release_date']})"
    if version != base["sources"]["chembl_mbpi"]["version"]:
        raise ValueError(f"ChEMBL release {version} differs from the snapshot's {base['sources']['chembl_mbpi']['version']}")
    today = date.today().isoformat()

    have = {(s["aphia_id"], l["inchikey"]) for s in base["species"] for l in s["links"]}
    paper = [p for p in read(rule["paper_links"])["links"] if (p["aphia_id"], p["inchikey"]) not in have]
    p703 = read(rule["paper_links_p703"])["links"] if rule.get("paper_links_p703") else []
    iks = sorted({p["inchikey"] for p in paper + p703} - set(base["compounds"]))
    if not iks:
        raise ValueError("no linked compound outside the snapshot")

    qids = {b["ik"]["value"]: C.qid(b, "c") for b in C.sparql(
        "SELECT ?c ?ik WHERE { VALUES ?ik { %s } ?c wdt:P235 ?ik }" % " ".join(json.dumps(k) for k in iks))}
    counts = {C.qid(b, "c"): int(b["n"]["value"]) for b in C.sparql(C.COUNT_QUERY % " ".join("wd:" + q for q in sorted(set(qids.values()))))}
    for p in p703:  # the supplement file names the item; it must be the one Wikidata gives for the key
        if p["inchikey"] in qids and p.get("compound_qid") != qids[p["inchikey"]]:
            raise ValueError(f"{p['inchikey']}: compound_qid {p.get('compound_qid')} differs from Wikidata {qids[p['inchikey']]}")

    identity = {}
    for ik in iks:  # same identity step as the snapshot collector
        m = C.get(f"{C.CHEMBL}molecule/{ik}.json?only=molecule_chembl_id,pref_name,molecule_hierarchy", missing_ok=True)
        cid = C.get(f"{C.PUG}pug/compound/inchikey/{ik}/cids/JSON", missing_ok=True, pause=0.25)
        parent = m and (m.get("molecule_hierarchy") or {}).get("parent_chembl_id") or (m and m["molecule_chembl_id"])
        identity[ik] = {"chembl_id": m and m["molecule_chembl_id"], "parent_chembl_id": parent,
                        "chembl_pref_name": m and m.get("pref_name"), "pubchem_cids": cid["IdentifierList"]["CID"] if cid else []}
    parents = sorted({v["parent_chembl_id"] for v in identity.values() if v["parent_chembl_id"]})
    if set(parents) & set(base["parent_names"]):
        raise ValueError("a new compound's parent is already in the snapshot")
    molecules = {p: C.get(f"{C.CHEMBL}molecule/{p}.json?only=molecule_chembl_id,pref_name,max_phase") for p in parents}

    fields = C.ACT_FIELDS + ",activity_comment"
    activities, comments, excluded, checks = [], {}, defaultdict(lambda: defaultdict(int)), []
    for p in parents:
        url = f"{C.CHEMBL}activity.json?limit=1000&pchembl_value__isnull=false&parent_molecule_chembl_id={p}&only={fields}"
        own = []
        while url:
            page = C.get(url)
            own += page["activities"]
            url = page["page_meta"]["next"] and "https://www.ebi.ac.uk" + page["page_meta"]["next"]
        kept = [a for a in own if not C.admitted(a, rule)]
        for a in own:
            reason = C.admitted(a, rule)
            if reason:
                excluded[p][reason] += 1
        api = sum(C.chembl_count({**f, "parent_molecule_chembl_id": p}) for f in C.cohort_filter(rule))
        checks.append({"parent_chembl_id": p, "client_admitted": len(kept), "api_filtered": api})
        if api != len(kept):
            raise ValueError(f"{p}: ChEMBL API filter count {api} differs from client filter {len(kept)}")
        activities += [{k: a[k] for k in ("activity_id", "parent_molecule_chembl_id", "target_chembl_id", "standard_type",
                                          "assay_chembl_id", "assay_type", "document_chembl_id", "data_validity_comment")}
                       | {"pchembl_value": float(a["pchembl_value"])} for a in kept]
        comments |= {str(a["activity_id"]): a.get("activity_comment") for a in kept}

    tids = sorted({a["target_chembl_id"] for a in activities} - set(base["targets"]))
    targets = {}
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
    all_targets = {**base["targets"], **targets}

    # cohort counts at each new median, with all admitted rows and without the rows the 3.20 rule drops
    drop = set(rule.get("excluded_activity_comments", []))
    values = defaultdict(lambda: ([], []))
    for a in activities:
        both = values[(a["parent_molecule_chembl_id"], a["target_chembl_id"], a["standard_type"])]
        both[0].append(a["pchembl_value"])
        if (comments[str(a["activity_id"])] or "").lower() not in drop:
            both[1].append(a["pchembl_value"])
    scored_types = {t for s in rule["strata"].values() for t in s["target_types"]}
    cohorts = defaultdict(lambda: {"below": {}, "equal": {}})
    for (p, t, st), (every, kept) in sorted(values.items()):
        if all_targets[t]["target_type"] not in scored_types:
            continue
        key = f"{t}|{st}"
        old = base["cohorts"].get(key)
        base_f = [{**f, "target_chembl_id": t, "standard_type": st} for f in C.cohort_filter(rule)]
        c = cohorts[key]
        if "total" not in c:
            c["total"] = sum(C.chembl_count(f) for f in base_f)
            if old and old["total"] != c["total"]:
                raise ValueError(f"{key}: cohort total {c['total']} differs from the snapshot's {old['total']}")
        for v in (every, kept):
            if not v:
                continue
            m = round(median(v), 3)
            if str(m) in c["below"] or (old and str(m) in old["below"]):
                continue
            c["below"][str(m)] = sum(C.chembl_count({**f, "pchembl_value__lt": m}) for f in base_f)
            c["equal"][str(m)] = sum(C.chembl_count({**f, "pchembl_value": m}) for f in base_f) if round(m, 2) == m else 0

    # one link per (species, compound) with all its papers, as collect_mbpi_links.py builds it; a compound the base already
    # holds keeps the base item, so the commonness fence still sees its taxon count
    known = {l["inchikey"]: l["compound_qid"] for s in base["species"] for l in s["links"] if l["compound_qid"]}
    grouped = {}
    for p in paper:
        grouped.setdefault((p["aphia_id"], p["inchikey"]), set()).add("doi:" + p["doi"].lower())
    links = [{"aphia_id": a, "compound_qid": qids.get(ik) or known.get(ik), "inchikey": ik,
              "statements": [{"taxon_qid": "original_paper", "references": sorted(refs)}]} for (a, ik), refs in sorted(grouped.items())]
    out = {
        "snapshot_date": today, "queried_on": today, "base_snapshot": rule["snapshot"], "chembl_version": version,
        "purpose": "Compounds of species -> compound links accepted after the base snapshot, collected from the same ChEMBL release "
                   "with the same filters. Merged into the base snapshot by build_verified_indices.py (chembl_bioactivity.snapshot_supplement).",
        "filters": base["filters"], "api_filter_checks": checks, "species_links": links,
        "reference_dois": {"doi:" + p["doi"].lower(): p["doi"].lower() for p in paper},
        "compound_taxon_counts": dict(sorted(counts.items())), "compounds": identity,
        "parent_names": {p: m["pref_name"] for p, m in molecules.items()},
        "parent_max_phase": {p: m["max_phase"] and float(m["max_phase"]) for p, m in molecules.items()},
        "activities": sorted(activities, key=lambda a: a["activity_id"]), "activity_comments": dict(sorted(comments.items())),
        "activity_exclusions": {p: dict(sorted(v.items())) for p, v in sorted(excluded.items())},
        "targets": dict(sorted(targets.items())), "cohorts": dict(sorted(cohorts.items()))}
    path = ROOT / f"research/verified-indices/snapshots/mbpi-links-supplement-{today}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"{path}: {len(iks)} compounds, {len(activities)} activities, {len(targets)} new targets, {len(cohorts)} cohorts")


if __name__ == "__main__":
    main()
