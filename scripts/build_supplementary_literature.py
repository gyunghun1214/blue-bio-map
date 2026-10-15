"""Build dist/supplementary-literature.json: related papers per species that no score uses.

verified-4.13 (research/verified-indices/prereg-4.13-2026-10-14.md 3-D): the 2026-10-14 literature search found papers
that the fixed rules cannot score (another substrate, a range, a figure-only value, the same group's follow-up, a
species-name question). The page lists them under the MBPI section as '관련 문헌(점수 미사용)', apart from the
'근거 논문 1편' label, which keeps its meaning (independent replication of the top MBPI item). These records never enter
MFPI, MBPI, MCUI, BBVI, the matrix, the map colours or any ranking: the indicator build does not read this file.
A record without a DOI is never listed (team decision 2026-10-14). Offline.

Usage: python scripts/build_supplementary_literature.py [--check]
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RECORD = ROOT / "research/verified-indices/supplementary-literature-2026-10-15.json"
DEFAULT_REPORT = ROOT / "dist/assessments.json"
DEFAULT_OUTPUT = ROOT / "dist/supplementary-literature.json"
SCHEMA = "supplementary-literature-1"
RELATIONS = {"same_item_followup", "new_quantitative", "link_support", "contrary", "context", "excluded"}
CHECKED_VIA = {"full_text", "abstract"}
DOI = re.compile(r"^10\.\d{4,9}/\S+$")
PUBLIC = ("aphia_id", "doi", "year", "journal", "title_ko", "finding", "relation", "not_scored_reason", "checked_on", "checked_via")


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def build(record: dict, report: dict) -> dict:
    require(record.get("schema_version") == SCHEMA, "unknown supplementary-literature schema")
    species = {s["aphia_id"] for s in report["species"] + report.get("candidate_species", [])}
    # a paper a score already uses is shown with that score, not here
    scored = {d.lower() for s in report["species"] + report.get("candidate_species", [])
              for x in s.get("bioactivity_trace") or [] for d in x.get("original_paper_dois", [])}
    # nor is a paper the species detail already shows as a partial record ('후속 조사 단서'), so one paper sits in one place
    scored |= {(report["sources"].get(p["source_id"]) or {}).get("doi", "").lower()
               for s in report["species"] + report.get("candidate_species", [])
               for p in s.get("bioactivity_partial") or []} - {""}
    rows = []
    for r in record["records"]:
        what = f"{r.get('aphia_id')} {r.get('doi')}"
        require(r.get("aphia_id") in species, f"{what}: not one of the report's species")
        require(isinstance(r.get("doi"), str) and DOI.fullmatch(r["doi"]) is not None, f"{what}: a DOI (10.xxxx/...) is required")
        require(r["doi"].lower() not in scored, f"{what}: this paper is already shown with a score or as a partial record")
        require(r.get("relation") in RELATIONS, f"{what}: relation must be one of {sorted(RELATIONS)}")
        require(isinstance(r.get("year"), int) and 1900 <= r["year"] <= int(record["snapshot_date"][:4]), f"{what}: year")
        require(all(isinstance(r.get(k), str) and r[k].strip() for k in ("journal", "title_ko", "finding", "not_scored_reason")),
                f"{what}: journal, title_ko, finding and not_scored_reason are required")
        require(r.get("checked_via") in CHECKED_VIA, f"{what}: checked_via must be full_text or abstract")
        require(isinstance(r.get("checked_on"), str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", r["checked_on"])
                and r["checked_on"] <= record["snapshot_date"], f"{what}: checked_on")
        rows.append({k: r[k] for k in PUBLIC})
    keys = [(r["aphia_id"], r["doi"].lower()) for r in rows]
    require(len(keys) == len(set(keys)), "duplicate supplementary-literature row")
    order = ["contrary", "same_item_followup", "new_quantitative", "link_support", "context", "excluded"]
    return {"schema_version": SCHEMA, "snapshot_date": record["snapshot_date"], "prereg": record["prereg"],
            "scope_note": record["scope_note"], "decision": record["decision"],
            "records": sorted(rows, key=lambda r: (r["aphia_id"], order.index(r["relation"]), -r["year"], r["doi"]))}


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
        require(args.out.read_text(encoding="utf-8") == content, "supplementary literature differs from reproducible build")
        print("Reproducible supplementary literature matches committed output")
    else:
        args.out.write_text(content, encoding="utf-8")
        rows = json.loads(content)["records"]
        print(f"Wrote {args.out}: {len(rows)} records, {len({r['aphia_id'] for r in rows})} species")


if __name__ == "__main__":
    main()
