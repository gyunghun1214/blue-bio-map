"""Build dist/posthoc-scorecard.json (the '검증 기록' table of the method tab, fold 04) and, with --csv, the same table as CSV.

Every row comes from posthoc.validation_sets of the published report (dist/assessments.json); config/posthoc-scorecard.json
only adds the Korean name, a one-line description, whether the criterion was fixed before the run and what was done after a
check that did not pass, and which stored numbers of the first record file a row quotes (`figure`: the values are read from
that record here, never typed in the config). `outcome_class` normalises the stored `result` into five classes (config outcome_rule):
통과 · 실패 · 실패 후 사용 중단 · 일관성 확인(독립 아님) · 검증 불성립. A same-data or two-species consistency check is never
통과. The stored results and their records are read, never rewritten. Nothing here enters a score, a type or the map: the
indicator build does not read this file. Offline.

Usage: python scripts/build_posthoc_scorecard.py [--check] [--csv reports/posthoc-scorecard.csv]
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config/posthoc-scorecard.json"
DEFAULT_REPORT = ROOT / "dist/assessments.json"
DEFAULT_OUTPUT = ROOT / "dist/posthoc-scorecard.json"
DEFAULT_CSV = ROOT / "reports/posthoc-scorecard.csv"
CONFIG_SCHEMA = "posthoc-scorecard-config-1"
SCHEMA = "posthoc-scorecard-1"
CLASSES = ["통과", "실패", "실패 후 사용 중단", "일관성 확인(독립 아님)", "검증 불성립"]
CONSISTENCY = {"consistent_same_data", "reproduced_n2"}
PREREG = {"yes": "예", "no": "아니오"}
CSV_COLUMNS = ["순서", "지표", "검증 이름", "무엇을 확인했나", "사전 등록", "사전 등록 메모", "저장된 결과(result)",
               "outcome_class", "화면 표시", "기록 수치", "실패 후 조치", "조치 내용", "기록 파일"]


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def outcome_class(validation: dict, note: dict) -> str:
    result = validation.get("result")
    if result == "passed":
        return "통과"
    if result in CONSISTENCY:
        return "일관성 확인(독립 아님)"
    if result == "not_computable":
        return "검증 불성립"
    require(result == "failed", f"unknown posthoc result {result!r}")
    if note["after_failure"]["action"] == "removed":
        return "실패 후 사용 중단"
    sample = note.get("min_sample")
    if sample:
        value = validation.get(sample["field"])
        require(isinstance(value, int), f"min_sample field {sample['field']!r} is not stored")
        if value < sample["min"]:
            return "검증 불성립"
    return "실패"


def record_figure(key: str, spec: dict | None, records: list[str]) -> dict | None:
    """The numbers a row quotes from its first record file: each path is read from that JSON as stored (a list is joined
    with '·' and {nI} gives its length); `of` pins a path to the value it must hold, so a label never moves to another row."""
    if not spec:
        return None
    require(records and records[0].endswith(".json"), f"{key}: a figure needs a JSON record")
    record = json.loads((ROOT / records[0]).read_text(encoding="utf-8"))

    def at(path):
        value = record
        for step in path:
            require(isinstance(value, (dict, list)), f"{key}: {path} not in {records[0]}")
            try:
                value = value[step]
            except (KeyError, IndexError, TypeError):
                raise ValueError(f"{key}: {path} not in {records[0]}") from None
        return value

    for path, expected in spec.get("of", []):
        require(at(path) == expected, f"{key}: {path} is not {expected!r} in {records[0]}")
    values = [at(path) for path in spec["paths"]]
    require(all(isinstance(v, (int, float, list)) and not isinstance(v, bool) for v in values), f"{key}: a figure value is not a number or list")
    text = spec["text"].format(*["·".join(map(str, v)) if isinstance(v, list) else str(v) for v in values],
                               **{f"n{i}": len(v) for i, v in enumerate(values) if isinstance(v, list)})
    return {"text": text, "record": records[0], "record_version": record.get("report_version")}


def indicator_badges(config: dict, rows: list[dict]) -> dict:
    labels, out = config["indicator_badges"]["labels"], {}
    for key in config["indicator_badges"]["order"]:
        classes = [r["outcome_class"] for r in rows if r["indicator"] == key]
        require(classes, f"no check for indicator {key}")
        state = "passed" if "통과" in classes else "limited" if "일관성 확인(독립 아님)" in classes else "not_passed"
        out[key] = {"state": state, "label": labels[state], "checks": len(classes),
                    "classes": {c: classes.count(c) for c in CLASSES if c in classes}}
    return out


def build(config: dict, report: dict) -> dict:
    require(config.get("schema_version") == CONFIG_SCHEMA, "unknown scorecard config schema")
    require(config["outcome_classes"] == CLASSES, "outcome classes changed")
    require(report["posthoc"] == report["method"]["posthoc"], "posthoc block differs from method.posthoc")
    sets, notes = report["posthoc"]["validation_sets"], config["sets"]
    require(set(sets) == set(notes), f"validation sets without scorecard text: {sorted(set(sets) ^ set(notes))}")
    species = report["species"] + report.get("candidate_species", [])
    fill = {"preliminary_species": sum(1 for s in species if s.get("mcui_basis") == "preliminary")}
    config_path = f"config/verified-indices-v{report['method_version'].removeprefix('verified-')}.json"
    rows = []
    for key, note in sorted(notes.items(), key=lambda kv: kv[1]["order"]):
        v, after = sets[key], note["after_failure"]
        require(after["action"] in config["actions"], f"{key}: unknown action")
        require(note["preregistered"] in PREREG, f"{key}: preregistered must be yes or no")
        cls = outcome_class(v, note)
        require(cls != "통과" or after["action"] == "none", f"{key}: a passed check has no action after failure")
        records = [p for p in (v.get("record"), v.get("prereg"), *note.get("extra_records", [])) if p]
        for p in records:
            require((ROOT / p).is_file(), f"{key}: record {p} not found")
        rows.append({
            "key": key, "order": note["order"], "indicator": note["indicator"], "name": note["name"],
            "checked": note["checked"], "preregistered": note["preregistered"],
            "preregistered_label": PREREG[note["preregistered"]], "preregistered_note": note["preregistered_note"],
            "result": v["result"], "outcome_class": cls, "outcome_label": config["display"][cls],
            "action": after["action"], "action_label": config["actions"][after["action"]],
            "action_detail": after["detail"].format(**fill), "action_history": after.get("history"),
            "exploratory": bool(v.get("exploratory")),
            "records": records or [config_path], "record_note": None if records else "별도 기록 파일 없음 · 지표 설정 파일의 posthoc 항목",
            "figure": record_figure(key, note.get("figure"), records),
        })
    # 2026-10-21 (site v4 09): checks registered before any result, each with its pre-registration file and the commit that
    # added that file alone; shown as their own rows ('등록됨') until a result is stored, never counted as a check
    registered = []
    for r in config.get("registered", []):
        require(r["indicator"] in config["indicator_badges"]["order"], f"{r['key']}: unknown indicator")
        require(r["key"] not in sets, f"{r['key']}: has a stored result; move it to sets")
        require((ROOT / r["prereg"]).is_file(), f"{r['key']}: pre-registration {r['prereg']} not found")
        require(re.fullmatch(r"[0-9a-f]{7}", r["prereg_commit"] or "") is not None, f"{r['key']}: prereg_commit must be a short SHA")
        require(re.fullmatch(r"\d{4}-\d{2}", r["results_due"] or "") is not None, f"{r['key']}: results_due must be YYYY-MM")
        registered.append({k: r[k] for k in ("key", "indicator", "name", "checked", "prereg", "prereg_commit", "results_due")})
    counts = {c: sum(r["outcome_class"] == c for r in rows) for c in CLASSES}
    return {
        "schema_version": SCHEMA, "display_only": True, "report_version": report["method_version"],
        "source": "dist/assessments.json posthoc.validation_sets + config/posthoc-scorecard.json",
        "repository": config["repository"], "total": len(rows), "counts": counts,
        "preregistered": sum(r["preregistered"] == "yes" for r in rows),
        "indicators": indicator_badges(config, rows), "rows": rows, "registered": registered,
    }


def render(out: dict) -> str:
    return json.dumps(out, ensure_ascii=False, indent=1) + "\n"


def render_csv(out: dict) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(CSV_COLUMNS)
    for r in out["rows"]:
        action = r["action_label"] if r["action"] != "none" else "해당 없음(점수에 사용)"
        w.writerow([r["order"], r["indicator"], r["name"], r["checked"], r["preregistered_label"], r["preregistered_note"],
                    r["result"], r["outcome_class"], r["outcome_label"],
                    f"{r['figure']['record_version']} 기록: {r['figure']['text']}" if r["figure"] else "", action,
                    r["action_detail"] + (f" ({r['action_history']})" if r["action_history"] else ""),
                    " ; ".join(r["records"])])
    for r in out.get("registered", []):
        w.writerow(["", r["indicator"], r["name"], r["checked"], "예", f"사전 등록 커밋 {r['prereg_commit']}", "", "등록됨",
                    f"등록됨 · 결과 {r['results_due']} 공개 예정", "", "", "", r["prereg"]])
    return "﻿" + buf.getvalue()  # BOM so spreadsheet programs read the Korean text as UTF-8


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--csv", type=Path, nargs="?", const=DEFAULT_CSV, help=f"also write the table as CSV (default {DEFAULT_CSV.relative_to(ROOT)})")
    parser.add_argument("--check", action="store_true", help="compare existing output without writing")
    args = parser.parse_args()
    read = lambda p: json.loads(p.read_text(encoding="utf-8"))
    out = build(read(args.config), read(args.report))
    targets = [(args.out, render(out))] + ([(args.csv, render_csv(out))] if args.csv else [])
    if args.check:
        stale = [str(p) for p, text in targets if not p.is_file() or p.read_text(encoding="utf-8") != text]
        require(not stale, f"out of date: {', '.join(stale)} (run scripts/build_posthoc_scorecard.py --csv)")
        print(f"posthoc scorecard up to date ({out['report_version']}, {out['total']} checks)")
        return
    for path, text in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode("utf-8"))
        print(f"wrote {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}")
    print(" · ".join(f"{c} {n}" for c, n in out["counts"].items()))


if __name__ == "__main__":
    main()
