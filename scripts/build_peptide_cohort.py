"""Freeze the verified-pilot-3 peptide comparison cohort from a local AHTPDB IC50 download.

AHTPDB (https://webs.iiitd.edu.in/raghava/ahtpdb/download.php) states no licence, so the
download itself is never committed. The cohort file keeps only AHTPDB row IDs, the value
used and the source hash; sequences are not redistributed.

Rule (ACE inhibition, HHL substrate):
  - assay column exactly "Cushman and Cheung (1971)" (hippuryl-His-Leu method)
  - IC50 a single number in uM, nM or mM (ranges, "<", ">", "uM/L", mass and % units dropped)
  - sequence of standard one-letter amino acids only
  - duplicate sequences collapse to one member; value = median of their uM values

  python scripts/build_peptide_cohort.py --source <pepic50.txt>          # write
  python scripts/build_peptide_cohort.py --source <pepic50.txt> --check  # compare
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research" / "verified-indices" / "peptide-cohort-ahtpdb-ace-hhl.json"
ASSAY = "Cushman and Cheung (1971)"
TO_UM = {"μM": 1.0, "µM": 1.0, "nM": 0.001, "mM": 1000.0}
VALUE = re.compile(r"([0-9]*\.?[0-9]+)\s*(μM|µM|nM|mM)")
SEQUENCE = re.compile(r"[ACDEFGHIKLMNPQRSTVWY]{2,}")


def build(source: Path) -> dict:
    raw = source.read_bytes()
    rows = list(csv.reader(raw.decode("utf-8").splitlines(), delimiter="\t"))[1:]
    groups: dict[str, list[tuple[int, float]]] = defaultdict(list)
    for r in rows:
        r = [c.strip() for c in r]
        m = VALUE.fullmatch(r[4])
        if r[8] == ASSAY and m and SEQUENCE.fullmatch(r[1]) and float(m.group(1)) > 0:
            groups[r[1]].append((int(r[0]), float(m.group(1)) * TO_UM[m.group(2)]))
    members = sorted(({"ahtpdb_ids": sorted(i for i, _ in g), "ic50_uM": round(median(v for _, v in g), 4)}
                      for g in groups.values()), key=lambda x: x["ahtpdb_ids"][0])
    return {"cohort_id": "ahtpdb-ace-ic50-hhl-cushman-cheung",
            "source": {"provider": "AHTPDB (IIIT-Delhi, Raghava group)", "file": "pepic50.txt (IC50 download)",
                       "url": "https://webs.iiitd.edu.in/raghava/ahtpdb/download.php", "retrieved": "2026-09-26",
                       "sha256": hashlib.sha256(raw).hexdigest(), "rows": len(rows),
                       "licence": "none stated; IDs and values only, sequences not redistributed"},
            "rule": __doc__.split("Rule")[1].split("python")[0].strip(),
            "size": len(members), "members": members}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--check", action="store_true")
    a = p.parse_args()
    text = json.dumps(build(a.source), ensure_ascii=False, indent=1) + "\n"
    if a.check:
        if OUT.read_text(encoding="utf-8") != text:
            raise SystemExit("peptide cohort differs from the frozen file")
        print("Peptide cohort matches frozen file")
    else:
        OUT.write_text(text, encoding="utf-8")
        print(f"Wrote {OUT}: {json.loads(text)['size']} peptides")


if __name__ == "__main__":
    main()
