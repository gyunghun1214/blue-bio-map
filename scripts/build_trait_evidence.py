"""Build dist/trait-evidence.json: display-only literature values for the drug-use chips.

Team-lead decision 2026-10-03 ('표시 전용'): a drug-use chip that no adopted MBPI item reaches may show reviewed
single-compound or single-peptide values from the literature. They are labelled as outside every score and never
enter MFPI, MBPI, MCUI, BBVI, the matrix or the map colours. The reviewed record, with pending and excluded rows,
is research/verified-indices/trait-display-evidence-2026-10-03.json; this script only checks it and copies the
admitted rows. Offline.

Usage: python scripts/build_trait_evidence.py [--check]
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RECORD = ROOT / "research/verified-indices/trait-display-evidence-2026-10-03.json"
DEFAULT_REPORT = ROOT / "dist/assessments.json"
DEFAULT_OUTPUT = ROOT / "dist/trait-evidence.json"
SCHEMA = "trait-display-evidence-1"
# The chips this file may fill: drug traits only, and none whose chip already counts adopted MBPI items by rule.
TRAITS = {"fungus", "pain", "antioxidant", "diabetes", "resistant"}
MATERIALS = {"isolated_compound", "synthetic_peptide", "purified_peptide"}
VERIFIED = {"full_text", "chembl_record"}   # abstract-only values stay in 'pending'
PUBLIC = ("aphia_id", "trait", "name", "material", "assay", "endpoint", "relation", "value", "unit", "doi", "verified_against")


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def build(record: dict, report: dict) -> dict:
    require(record.get("schema_version") == SCHEMA, "unknown trait-evidence schema")
    species = {s["aphia_id"] for s in report["species"] + report.get("candidate_species", [])}
    rows = []
    for r in record["records"]:
        what = f"{r.get('korean_name')} {r.get('name')}"
        require(r["aphia_id"] in species, f"{what}: not one of the report's species")
        require(r["trait"] in TRAITS, f"{what}: trait {r['trait']} is not a display-only drug trait")
        require(r["material"] in MATERIALS, f"{what}: material must be a single compound or peptide")
        require(r["relation"] == "=", f"{what}: censored or ranged values are not shown")
        require(isinstance(r["value"], (int, float)) and math.isfinite(r["value"]) and r["value"] > 0, f"{what}: value")
        require(bool(r.get("unit")) and bool(r.get("assay")) and bool(r.get("endpoint")), f"{what}: unit, assay and endpoint")
        require(str(r.get("doi", "")).startswith("10."), f"{what}: a DOI is required")
        require(r["verified_against"] in VERIFIED, f"{what}: value must be read in the full text or a ChEMBL record")
        require(bool(r.get("evidence")), f"{what}: the review note is required")
        rows.append({k: r[k] for k in PUBLIC})
    keys = [(r["aphia_id"], r["trait"], r["name"], r["assay"]) for r in rows]
    require(len(keys) == len(set(keys)), "duplicate trait-evidence row")
    return {"schema_version": SCHEMA, "snapshot_date": record["snapshot_date"], "scope_note": record["scope_note"],
            "decision": record["decision"], "records": sorted(rows, key=lambda r: (r["trait"], r["aphia_id"], r["value"]))}


def render(out: dict) -> str:
    return json.dumps(out, ensure_ascii=False, indent=1) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", type=Path, default=DEFAULT_RECORD)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="compare existing output without writing")
    args = parser.parse_args()
    read = lambda p: json.loads(p.read_text(encoding="utf-8"))
    content = render(build(read(args.record), read(args.report)))
    if args.check:
        require(args.out.read_text(encoding="utf-8") == content, "trait evidence differs from reproducible build")
        print("Reproducible trait evidence matches committed output")
    else:
        args.out.write_text(content, encoding="utf-8")
        rows = json.loads(content)["records"]
        print(f"Wrote {args.out}: {len(rows)} rows, " + str({t: len({r['aphia_id'] for r in rows if r['trait'] == t}) for t in sorted(TRAITS)}))


if __name__ == "__main__":
    main()
