"""Build the 4.3 xanthine-oxidase (XO) peptide cohort from its reviewed candidate list.

No public database holds XO-inhibitory peptides, so the cohort is literature-built
(research/verified-indices/prereg-fill-all-4.3-2026-10-05.md 1.3). Every candidate found
by the documented PubMed search sits in the review file with two independent checks
(source fidelity; criteria and arithmetic). A candidate becomes a member only when both
checks confirmed it; one member per sequence (median uM). The scored species' own
peptides are never members. Usage: python scripts/build_xo_cohort.py [--check]
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "research" / "verified-indices" / "xo-cohort-review-4.3-2026-10-05.json"
OUT = ROOT / "research" / "verified-indices" / "xo-cohort-4.3-2026-10-05.json"


def build(review: dict) -> dict:
    own = set(review["never_members"])
    groups: dict[str, list[dict]] = {}
    for c in review["candidates"]:
        checks = c["checks"]
        keep = (c["decision"] == "member" and checks["fidelity"]["verdict"] == "confirmed"
                and checks["criteria"]["verdict"] == "confirmed" and c["sequence"] not in own)
        if c["decision"] == "member" and not keep:
            raise ValueError(f"{c['sequence']} {c['doi']}: a member needs both checks confirmed")
        if keep:
            if not (isinstance(c["ic50_uM"], (int, float)) and c["ic50_uM"] > 0):
                raise ValueError(f"{c['sequence']}: IC50 in uM required")
            groups.setdefault(c["sequence"], []).append(c)
    members = [{"sequence": s, "ic50_uM": round(median(r["ic50_uM"] for r in rows), 2),
                "rows": [{k: r[k] for k in ("doi", "pmid", "value_as_published", "ic50_uM", "readout", "material", "designed", "access")}
                         for r in rows]} for s, rows in sorted(groups.items())]
    p = [6 - math.log10(m["ic50_uM"]) for m in members]
    return {"schema_version": 1, "snapshot_date": review["snapshot_date"], "cohort_id": review["cohort_id"],
            "target": review["target"], "endpoint": "IC50", "prereg": review["prereg"], "search": review["search"],
            "member_rule": review["member_rule"], "built_by": "scripts/build_xo_cohort.py", "size": len(members),
            "median_pIC50": round(median(p), 3), "members": members,
            "excluded": [{"sequence": c["sequence"], "doi": c["doi"], "reason": c["reason"]}
                         for c in review["candidates"] if c["decision"] != "member"]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare the committed cohort without writing")
    args = parser.parse_args()
    text = json.dumps(build(json.loads(REVIEW.read_text(encoding="utf-8"))), ensure_ascii=False, indent=1) + "\n"
    if args.check:
        if OUT.read_text(encoding="utf-8") != text:
            raise SystemExit("XO cohort differs from its review file")
        print("XO cohort matches its review file")
    else:
        OUT.write_text(text, encoding="utf-8")
        print(f"Wrote {OUT.name}: {json.loads(text)['size']} members")


if __name__ == "__main__":
    main()
