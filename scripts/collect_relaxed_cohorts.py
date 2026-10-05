"""ChEMBL target x endpoint cohorts for the relaxation-(d) items (prereg-fill-all-4.3 1.4(d), prereg-4.4 2, prereg-4.5 2).

One cohort per (single-protein target, standard_type): every activity with a pChEMBL value that passes the ChEMBL
stratum's filters (relation '=', assay type B or F, no data-validity flag other than 'Manually validated', not a
potential duplicate). Agonist and antagonist assays are not split; the antagonist count is recorded. A tested peptide
that is itself a ChEMBL molecule has its own activity rows removed from its cohort and listed in the self-inclusion
check (prereg-4.5 2.3); a tested peptide absent from ChEMBL records zero document and molecule hits (4.4, cephalotocin).

The public API host is www; the wwwdev mirror is the documented fallback for the 2026-10-05 outage. Both served
ChEMBL_37 (2026-05-01) on the collection date; the host used is recorded in the snapshot.
"""
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research" / "verified-indices" / "snapshots" / "relaxed-chembl-cohorts-4.5-2026-10-05.json"
HOSTS = ["https://www.ebi.ac.uk", "https://wwwdev.ebi.ac.uk"]
CONTACT = "research@example.org"

# (target_chembl_id, standard_type) cohorts of every relaxed row published so far (4.4 + 4.5 candidates)
COHORTS = [("CHEMBL1921", "EC50"), ("CHEMBL1790", "EC50"),
           ("CHEMBL1855", "IC50"), ("CHEMBL5952", "Ki"), ("CHEMBL5952", "EC50"), ("CHEMBL3309", "IC50")]
# tested peptides: record_id prefix -> (ChEMBL molecule id or None, document DOI to check)
SELF = {
    "10.3390/md20050328:cephalotocin:CHEMBL1921": (None, "10.3390/md20050328"),
    "10.3390/md20050328:cephalotocin:CHEMBL1790": (None, "10.3390/md20050328"),
    "10.1074/jbc.M610413200:sbGnRH:CHEMBL1855:IC50": (None, "10.1074/jbc.M610413200"),
    "10.1021/acs.jmedchem.0c00643:FMRFamide:CHEMBL5952:Ki": ("CHEMBL262202", "10.1021/acs.jmedchem.0c00643"),
    "10.1021/acs.jmedchem.0c00643:FMRFamide:CHEMBL5952:EC50": ("CHEMBL262202", "10.1021/acs.jmedchem.0c00643"),
    "10.1021/acs.jmedchem.0c00643:FMRFamide:CHEMBL3309:IC50": ("CHEMBL262202", "10.1021/acs.jmedchem.0c00643"),
}
VALIDITY_OK = (None, "Manually validated")


def get(path, host_index=0):
    url = HOSTS[host_index] + path
    req = urllib.request.Request(url, headers={"User-Agent": f"blue-bio-map ({CONTACT})"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r), host_index
        except Exception:
            time.sleep(3 * (attempt + 1))
            if host_index + 1 < len(HOSTS):  # ponytail: one fallback host, not a retry framework
                return get(path, host_index + 1)
    raise SystemExit(f"ChEMBL API unreachable: {url}")


def admitted(a):
    return (a.get("standard_relation") == "=" and a.get("assay_type") in ("B", "F")
            and a.get("data_validity_comment") in VALIDITY_OK and not a.get("potential_duplicate")
            and a.get("pchembl_value") is not None)


def collect(target, std_type):
    host_used, offset, rows = 0, 0, []
    while True:
        q = urllib.parse.urlencode({"target_chembl_id": target, "standard_type": std_type,
                                    "pchembl_value__isnull": "false", "limit": 100, "offset": offset})
        d, host_used = get(f"/chembl/api/data/activity.json?{q}", host_used)
        rows += d["activities"]
        offset += 100
        if offset >= d["page_meta"]["total_count"]:
            break
    t, host_used = get(f"/chembl/api/data/target/{target}.json", host_used)
    self_mols = {m for m, _ in SELF.values() if m}
    kept, removed = [], []
    for a in sorted(rows, key=lambda x: x["activity_id"]):
        if not admitted(a):
            continue
        if a["molecule_chembl_id"] in self_mols:
            removed.append(a["activity_id"])
            continue
        kept.append({"activity_id": a["activity_id"], "pchembl": float(a["pchembl_value"]),
                     "molecule": a["molecule_chembl_id"], "document": a["document_chembl_id"],
                     "assay_type": a["assay_type"],
                     "antagonist_mode": "antagonist" in (a.get("assay_description") or "").lower()})
    return {"cohort_id": f"ChEMBL_37:{target}|{std_type}", "target_chembl_id": target,
            "target_name": t["pref_name"], "target_type": t["target_type"], "target_organism": t["organism"],
            "uniprot": sorted({c["accession"] for c in t.get("target_components", []) if c.get("accession")}),
            "standard_type": std_type,
            "query": f"{HOSTS[0]}/chembl/api/data/activity.json?" + urllib.parse.urlencode(
                {"target_chembl_id": target, "standard_type": std_type, "pchembl_value__isnull": "false"}),
            "records_with_pchembl": len(rows), "size": len(kept),
            "documents": len({m["document"] for m in kept}), "molecules": len({m["molecule"] for m in kept}),
            "antagonist_mode_records": sum(m["antagonist_mode"] for m in kept),
            "self_rows_removed": removed, "members": kept}, host_used


def main():
    today = time.strftime("%Y-%m-%d")
    status, host_used = get("/chembl/api/data/status.json")
    cohorts, hosts = [], {HOSTS[host_used]}
    for target, std_type in COHORTS:
        c, h = collect(target, std_type)
        cohorts.append(c)
        hosts.add(HOSTS[h])
        print(c["cohort_id"], "size", c["size"], "removed self rows", len(c["self_rows_removed"]))
    checks = []
    for record_id, (mol, doi) in sorted(SELF.items()):
        q = urllib.parse.urlencode({"doi__iexact": doi})
        d, _ = get(f"/chembl/api/data/document.json?{q}")
        doc_hits = d["page_meta"]["total_count"]
        target = record_id.split(":")[2]
        in_cohorts = sorted({c["cohort_id"] for c in cohorts
                             if c["target_chembl_id"] == target and any(m["molecule"] == mol for m in c["members"])})
        removed = sorted({i for c in cohorts if c["target_chembl_id"] == target for i in c["self_rows_removed"]}) if mol else []
        checks.append({"record_id": record_id, "document_hits": doc_hits,
                       # a tested peptide that IS a ChEMBL molecule: its rows are removed, so the cohort holds none
                       "molecule_hits": len(in_cohorts),
                       **({"molecule_chembl_id": mol, "excluded_activity_ids": removed,
                           "document_hits_note": "the value's own ChEMBL document exists; its rows are the excluded ones"} if mol else {})})
    out = {"schema_version": 2, "snapshot_date": today, "queried_on": today,
           "chembl_version": status["chembl_db_version"], "chembl_release_date": status["chembl_release_date"],
           "api_hosts": sorted(hosts),
           "prereg": "research/verified-indices/prereg-4.5-2026-10-05.md",
           "filters": {"standard_relation": "=", "data_validity_comments": [None, "Manually validated"],
                       "exclude_potential_duplicate": True, "assay_types": ["B", "F"]},
           "cohort_rule": "Cohort = every admitted ChEMBL activity with the same target_chembl_id and standard_type "
                          "(activity level, counted with the ChEMBL API at the snapshot date); a tested peptide's own "
                          "rows are removed and listed. Percentile = 100 x (count below + 0.5 x count equal) / total.",
           "self_inclusion_checks": checks, "collected_by": "scripts/collect_relaxed_cohorts.py",
           "cohorts": cohorts}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("wrote", OUT.relative_to(ROOT), f"({len(cohorts)} cohorts)")


if __name__ == "__main__":
    sys.exit(main())
