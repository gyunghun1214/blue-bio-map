"""Build dist/origin-review.json: whether each scored MBPI item was made by the species itself, display only.

research/verified-indices/origin-class-rule-2026-10-15.md: every item of every species' bioactivity_trace gets one
origin_class from the facts recorded in research/verified-indices/origin-review-2026-10-15.json (peptide items by their
original paper DOI, ChEMBL items by species and compound). The class is the first fact met in ORDER; an item with no recorded
fact is 'unknown'. Only 'producer_confirmed' counts as confirmed. mbpi_origin_strict is MBPI computed the same way (maximum
adjusted value, one decimal) over the confirmed items only; it is a reference value and enters no score, type, list, weight,
map colour or ranking: the indicator build does not read this file. Also writes the result tables as Markdown. Offline.

Usage: python scripts/build_origin_review.py [--check]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RECORD = ROOT / "research/verified-indices/origin-review-2026-10-15.json"
DEFAULT_REPORT = ROOT / "dist/assessments.json"
DEFAULT_OUTPUT = ROOT / "dist/origin-review.json"
DEFAULT_TABLES = ROOT / "research/verified-indices/origin-review-result-2026-10-15.md"
RECORD_SCHEMA = "origin-review-record-1"
SCHEMA = "origin-review-1"

# The rule (origin-class-rule-2026-10-15 2·3): recorded fact -> class, checked in this order.
ORDER = [("other_species_sample", "sample_mismatch"),
         ("processing_product", "artifact_possible"),
         ("other_producer", "associated_possible"),
         ("own_production", "producer_confirmed")]
CLASSES = {"producer_confirmed": "이 종이 만든 것으로 확인",
           "associated_possible": "먹이·공생균·미생물 유래 가능",
           "artifact_possible": "추출·가공 중 생성 가능",
           "sample_mismatch": "다른 종 시료에서 잰 값",
           "unknown": "기원 판단 근거 없음"}
CONFIRMED = {"producer_confirmed"}
FACTS = {f for f, _ in ORDER}
TESTED = {"not_read", "other_species", "commercial_or_synthetic", "this_species"}


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def round1(x: float) -> float:
    return float(f"{x:.1f}")


def item_key(item: dict) -> str:
    return item["stratum_id"] + "|" + (item.get("compound_id") or item["record_ids"][0])


def item_name(item: dict) -> str:
    return item.get("peptide_name") or item.get("peptide_sequence") or item.get("compound_name") or item.get("compound_id")


def classify(facts: list[dict]) -> str:
    present = {f["fact"] for f in facts}
    return next((cls for fact, cls in ORDER if fact in present), "unknown")


def check_facts(facts: list, what: str) -> None:
    require(isinstance(facts, list), f"{what}: facts must be a list")
    for f in facts:
        require(f.get("fact") in FACTS, f"{what}: unknown fact {f.get('fact')}")
        require(isinstance(f.get("ko"), str) and f["ko"].strip(), f"{what}: every fact needs a one-line reason")
        require(isinstance(f.get("sources"), list) and f["sources"], f"{what}: every fact needs a source")
    require(len({f["fact"] for f in facts}) == len(facts), f"{what}: a fact is listed twice")


def ordered(facts: list[dict]) -> list[dict]:
    rank = {fact: i for i, (fact, _) in enumerate(ORDER)}
    return sorted(facts, key=lambda f: rank[f["fact"]])


def build(record: dict, report: dict) -> dict:
    require(record.get("schema_version") == RECORD_SCHEMA, "unknown origin-review record schema")
    papers = {doi.lower(): p for doi, p in record["papers"].items()}
    for doi, p in papers.items():
        check_facts(p["facts"], doi)
    compounds = {}
    for c in record["compounds"]:
        what = f"{c.get('aphia_id')} {c.get('compound_id')}"
        require((c["aphia_id"], c["compound_id"]) not in compounds, f"{what}: listed twice")
        require(c.get("tested_material") in TESTED, f"{what}: tested_material must be one of {sorted(TESTED)}")
        check_facts(c["facts"], what)
        require(("other_species_sample" in {f["fact"] for f in c["facts"]}) == (c["tested_material"] == "other_species"),
                f"{what}: other_species_sample and tested_material 'other_species' go together")
        compounds[(c["aphia_id"], c["compound_id"])] = c
    used_papers, used_compounds = set(), set()
    rows = []
    for s in report["species"] + report.get("candidate_species", []):
        trace = s.get("bioactivity_trace") or []
        items = []
        for it in trace:
            if it["stratum_kind"] == "chembl":
                found = compounds.get((s["aphia_id"], it["compound_id"]))
                if found:
                    used_compounds.add((s["aphia_id"], it["compound_id"]))
                facts, tested = (found["facts"], found["tested_material"]) if found else ([], "not_read")
            else:
                dois = [d.lower() for d in it["original_paper_dois"]]
                require(len(dois) == 1, f"{s['korean_name']} {item_key(it)}: one original paper expected")
                found = papers.get(dois[0])
                if found:
                    used_papers.add(dois[0])
                facts, tested = (found["facts"], None) if found else ([], None)
            cls = classify(facts)
            facts = ordered(facts)
            items.append({"key": item_key(it), "stratum_kind": it["stratum_kind"], "name": item_name(it),
                          "adjusted": round1(it["adjusted"]), "origin_class": cls,
                          "confirmed": cls in CONFIRMED,
                          "reason_ko": facts[0]["ko"] if facts else CLASSES["unknown"] + "(기록 없음)",
                          "other_reasons_ko": [f["ko"] for f in facts[1:]],
                          "sources": sorted({x for f in facts for x in f["sources"]}),
                          **({"tested_material": tested} if tested else {})})
        keys = [i["key"] for i in items]
        require(len(keys) == len(set(keys)), f"{s['korean_name']}: item keys are not unique")
        mbpi = s["scores"]["MBPI"]
        top = None
        if trace:
            best = max(range(len(trace)), key=lambda i: trace[i]["adjusted"])  # first of equal items, as in the build
            top = items[best]
            require(mbpi == round1(trace[best]["adjusted"]), f"{s['korean_name']}: MBPI is not the maximum adjusted value")
        kept = [i for i, it in zip(items, trace) if i["confirmed"]]
        strict = round1(max(it["adjusted"] for i, it in zip(items, trace) if i["confirmed"])) if kept else None
        rows.append({"aphia_id": s["aphia_id"], "korean_name": s["korean_name"], "scientific_name": s["scientific_name"],
                     "mbpi": mbpi, "mbpi_origin_strict": strict,
                     "top_item_key": top["key"] if top else None,
                     "top_origin": None if not top else ("confirmed" if top["confirmed"] else "suspect"),
                     "top_origin_class": top["origin_class"] if top else None,
                     "item_count": len(items), "suspect_count": sum(not i["confirmed"] for i in items), "items": items})
    require(used_papers == set(papers), f"record papers not used by any item: {sorted(set(papers) - used_papers)}")
    require(used_compounds == set(compounds), f"record compounds not used by any item: {sorted(set(compounds) - used_compounds)}")
    posthoc = []
    for c in record.get("posthoc_cases", []):
        check_facts(c["facts"], c["scientific_name"])
        cls = classify(c["facts"]) if c.get("compound_id") else None
        posthoc.append({"scientific_name": c["scientific_name"], "compound": c["name"], "origin_class": cls,
                        "reasons_ko": [f["ko"] for f in ordered(c["facts"])] or [c.get("note", "")]})
    every = [i for r in rows for i in r["items"]]
    return {"schema_version": SCHEMA, "report_version": report["method_version"], "rule": record["rule"],
            "record": DEFAULT_RECORD.relative_to(ROOT).as_posix(), "reviewed_on": record["reviewed_on"], "display_only": True,
            "classes": CLASSES, "order": [cls for _, cls in ORDER] + ["unknown"], "confirmed_classes": sorted(CONFIRMED),
            "summary": {"species": len(rows), "items": len(every),
                        "by_class": {k: sum(i["origin_class"] == k for i in every) for k in CLASSES},
                        "suspect_items": sum(not i["confirmed"] for i in every),
                        "top_suspect_species": [r["korean_name"] for r in rows if r["top_origin"] == "suspect"]},
            "species": rows, "posthoc_cases": posthoc}


def render(out: dict) -> str:
    return json.dumps(out, ensure_ascii=False, indent=1) + "\n"


def tables(out: dict) -> str:
    s = out["summary"]
    fmt = lambda v: "없음" if v is None else f"{v:.1f}"
    lines = ["# 화합물 기원 분류 결과 · 2026-10-15", "",
             f"`scripts/build_origin_review.py`가 `{out['record']}`와 `dist/assessments.json`({out['report_version']})으로 만든 표입니다. "
             f"규칙은 `{out['rule']}`(출력보다 먼저 커밋). 점수·유형·50선·가중치는 바뀌지 않습니다.", "",
             "## 요약", "",
             f"- 종 {s['species']}개, MBPI 점수 항목 {s['items']}개",
             f"- 의심 항목(확인됨이 아닌 항목) {s['suspect_items']}개: " +
             ", ".join(f"{k} {v}" for k, v in s["by_class"].items()),
             f"- 최상위 항목이 의심으로 분류된 종 {len(s['top_suspect_species'])}개: {', '.join(s['top_suspect_species'])}", "",
             "## MBPI와 참고값 mbpi_origin_strict", "",
             "| 종 | MBPI | 참고값(확인 항목만) | 차이 | 최상위 근거 기원 | 최상위 분류 | 의심/전체 |", "|---|---:|---:|---:|---|---|---:|"]
    for r in out["species"]:
        diff = "–" if r["mbpi_origin_strict"] is None else f"{r['mbpi_origin_strict'] - r['mbpi']:+.1f}"
        lines.append(f"| {r['korean_name']} | {fmt(r['mbpi'])} | {fmt(r['mbpi_origin_strict'])} | {diff} | "
                     f"{'확인됨' if r['top_origin'] == 'confirmed' else '의심'} | {r['top_origin_class']} | {r['suspect_count']}/{r['item_count']} |")
    lines += ["", "## 항목별 origin_class", "", "| 종 | 항목 | 층 | 조정값 | origin_class | 사유 |", "|---|---|---|---:|---|---|"]
    for r in out["species"]:
        for i in sorted(r["items"], key=lambda x: -x["adjusted"]):
            mark = "" if i["confirmed"] else "⚠ "
            why = " ".join([i["reason_ko"]] + i["other_reasons_ko"]).replace("|", "/")
            lines.append(f"| {r['korean_name']} | {i['name']} | {i['stratum_kind']} | {i['adjusted']:.1f} | {mark}{i['origin_class']} | {why} |")
    lines += ["", "## 사후 검증 3종(30종 밖, 참고)", "", "| 종 | 화합물 | origin_class | 사유 |", "|---|---|---|---|"]
    for c in out["posthoc_cases"]:
        lines.append(f"| {c['scientific_name']} | {c['compound']} | {c['origin_class'] or '계산 안 됨'} | {' '.join(c['reasons_ko'])} |")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", type=Path, default=DEFAULT_RECORD)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--tables", type=Path, default=DEFAULT_TABLES)
    parser.add_argument("--check", action="store_true", help="compare existing output without writing")
    args = parser.parse_args()
    read = lambda p: json.loads(p.read_text(encoding="utf-8"))
    out = build(read(args.record), read(args.report))
    content, md = render(out), tables(out)
    if args.check:
        require(args.out.read_text(encoding="utf-8") == content, "origin review differs from reproducible build")
        require(args.tables.read_text(encoding="utf-8") == md, "origin review tables differ from reproducible build")
        print("Reproducible origin review matches committed output")
    else:
        args.out.write_text(content, encoding="utf-8")
        args.tables.write_text(md, encoding="utf-8")
        print(f"Wrote {args.out} and {args.tables}: {json.dumps(out['summary'], ensure_ascii=False)}")


if __name__ == "__main__":
    main()
