"""Build dist/aquaculture-tier.json: the farming stage shown for each of the 30 species (상업 양식 중 / 시험·연구 양식 / 기록 없음).

The rule and the per-species commercial records live in config/aquaculture-tier.json; the production numbers come from the KOSIS
해면양식업 table (all 143 items, 2015-2025) and the KOSIS-to-species links used since 4.12; whether a species has a reviewed
farming record at all comes from food_trace.aquaculture of the published report (dist/assessments.json). Display only: the MFPI
farming term (10 points when feasible) and every score, type and map colour are built without this file. Offline.

Usage: python scripts/build_aquaculture_tier.py [--check]
"""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config/aquaculture-tier.json"
DEFAULT_REPORT = ROOT / "dist/assessments.json"
DEFAULT_OUTPUT = ROOT / "dist/aquaculture-tier.json"
CONFIG_SCHEMA = "aquaculture-tier-config-1"
SCHEMA = "aquaculture-tier-1"
TIERS = ["commercial", "trial", "none"]


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def build(config: dict, report: dict, kosis_rows: list[dict], mapping_rows: list[dict]) -> dict:
    require(config.get("schema_version") == CONFIG_SCHEMA, "unknown config schema")
    labels, kosis, casip = config["labels"], config["kosis"], config["fao_casip"]
    require(sorted(labels) == sorted(TIERS), "labels must name commercial, trial and none")
    years = [str(y) for y in kosis["recent_years"]]
    table = {r["kosis_item"]: r for r in kosis_rows}
    require(len(table) == len(kosis_rows), "a KOSIS item appears twice")
    for r in kosis_rows:
        require(all(r[y] == "" or r[y].isdigit() for y in years), f"{r['kosis_item']}: tonnes must be whole numbers or blank")
    links = {int(r["aphia_id"]): r for r in mapping_rows}
    no_row = set(kosis["items_without_row"])
    require(not no_row & set(table), "an item listed without a row has a row")
    species = report["species"] + report["candidate_species"]
    sources = report["sources"]
    records = {r["aphia_id"]: r for r in config["commercial_records"]}
    require(len(records) == len(config["commercial_records"]), "a species has two commercial records")
    casip_ids = {int(k) for k in casip["species"]}

    rows, used = [], set()
    for s in species:
        aphia, q = s["aphia_id"], (s.get("food_trace") or {}).get("aquaculture")
        require(q is not None and q.get("reviewed") is True and type(q.get("feasible")) is bool,
                f"{s['korean_name']}: no reviewed farming record")
        link = links.get(aphia)
        require(link is not None, f"{s['korean_name']}: missing from the KOSIS link table")
        item, level = link["kosis_item"], link["match_level"]
        if level == "none":
            status, recent = "unmatched", None
        elif item in table:
            recent = sum(int(table[item][y] or 0) for y in years)
            status = ("species" if level == "species" else "broader") + ("_production" if recent > 0 else "_zero")
        else:
            require(item in no_row, f"{s['korean_name']}: KOSIS item {item!r} has no row and is not listed as such")
            status, recent = "no_row", None
        record = records.get(aphia)
        if not q["feasible"]:
            require(record is None, f"{s['korean_name']}: a commercial record for a species without a completed farming record")
            tier, basis, source_id = "none", "생활사·수확까지 이어진 양식 기록 없음(시도는 보고서 양식 기록에 있음)", q["source_id"]
        elif status == "species_production":
            require(record is None, f"{s['korean_name']}: rule 2 already applies; drop the commercial record")
            tier, source_id = "commercial", kosis["source_id"]
            basis = f"KOSIS 해면양식 '{item}' {years[0]}~{years[-1]}년 생산 {recent:,}톤"
        elif record is not None:
            sid = record["source_id"]
            require(sid in sources or (sid == casip["source_id"] and aphia in casip_ids), f"{s['korean_name']}: unknown source {sid}")
            tier, source_id, basis = "commercial", sid, record["why"]
            used.add(aphia)
        else:
            tier, source_id = "trial", q["source_id"]
            basis = "연구 시설이나 시험 양식장에서 한 주기 이상 키운 기록"
        rows.append({"aphia_id": aphia, "korean_name": s["korean_name"], "tier": tier, "tier_label": labels[tier],
                     "basis": basis, "source_id": source_id, "farming_record_source_id": q["source_id"],
                     "kosis": {"item": item or None, "match_level": level, "status": status,
                               "recent_t": recent, "recent_years": [int(y) for y in years]},
                     "fao_casip": aphia in casip_ids})
    require(used == set(records), f"commercial records for species not in the report or not needed: {sorted(set(records) - used)}")
    counts = {t: sum(r["tier"] == t for r in rows) for t in TIERS}
    return {"schema_version": SCHEMA, "display_only": True, "report_version": report["method_version"],
            "labels": labels, "rule": config["rule"], "counts": counts, "total": len(rows),
            "sources": {"kosis": {k: kosis[k] for k in ("source_id", "title", "url", "provider", "conditions", "version", "retrieved_on")},
                        "fao_casip": {k: casip[k] for k in ("source_id", "title", "url", "accessed", "note")}},
            "rows": rows}


def render(out: dict) -> str:
    return json.dumps(out, ensure_ascii=False, indent=1) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="compare the existing output without writing")
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    out = build(config, json.loads(args.report.read_text(encoding="utf-8")),
                read_csv(ROOT / config["kosis"]["raw_file"]), read_csv(ROOT / config["kosis"]["mapping_file"]))
    text = render(out)
    if args.check:
        require(args.out.is_file() and args.out.read_text(encoding="utf-8") == text,
                f"out of date: {args.out} (run scripts/build_aquaculture_tier.py)")
        print(f"aquaculture tier up to date ({out['report_version']}, {out['counts']})")
        return
    args.out.write_bytes(text.encode("utf-8"))
    print(f"wrote {args.out.relative_to(ROOT) if args.out.is_relative_to(ROOT) else args.out}")
    print(" · ".join(f"{out['labels'][t]} {n}" for t, n in out["counts"].items()))


if __name__ == "__main__":
    main()
