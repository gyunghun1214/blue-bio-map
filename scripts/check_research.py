"""Check team research CSVs in research/ before they are merged.

Offline and read-only: it never fetches, fills, scores or uploads anything.
The table type comes from the file name prefix (bioactivity*, food*, species*),
and the columns must match research/templates/<type>.csv exactly.

    python scripts/check_research.py                 # research/submissions/
    python scripts/check_research.py research/examples
"""
from __future__ import annotations

import csv
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / "research" / "templates"
KINDS = ("bioactivity", "food", "species")

STATUS = {"found", "no_data", "not_searched", "no_access", "license_unclear"}
MATCH = {"accepted", "synonym", "genus", "related", "unresolved"}
REVIEW = {"unreviewed", "self_checked", "cross_checked"}
TOPICS = {
    "food": {"nutrition", "edible_portion", "aquaculture", "fishery"},
    "species": {"taxonomy", "occurrence", "iucn"},
}
# bioactivity link_level: how far the species -> compound -> assay chain is confirmed
LINK = {"compound": "종-화합물만 확인, 정량 실험 미확인", "assay": "종-화합물-정량 실험 모두 확인"}
EXPERIMENT = {"in_vitro", "in_vivo", "clinical", "in_silico", "other"}
IUCN = {"EX", "EW", "CR", "EN", "VU", "NT", "LC", "DD", "NE"}

APHIA = re.compile(r"[1-9]\d*")
DOI = re.compile(r"10\.\d{4,9}/\S+")
URL = re.compile(r"https?://\S+")
COMPOUND = re.compile(r"CID:\d+|[A-Z]{14}-[A-Z]{10}-[A-Z]")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
NUMBER = re.compile(r"[<>≤≥~]?\s*-?\d+(?:\.\d+)?")
LONG_CELL = 300  # longer cells look like pasted source text


def columns(kind):
    with open(TEMPLATES / f"{kind}.csv", encoding="utf-8-sig", newline="") as f:
        return next(csv.reader(f))


def check_row(kind, r):
    """Return (errors, warnings) for one row; r maps column -> stripped text."""
    err, warn = [], []

    def need(*cols, why=""):
        for c in cols:
            if not r[c]:
                err.append(f"{c} 비어 있음{why}")

    need("record_id", "scientific_name", "match_level", "data_status", "review_status")
    for col, allowed in (("data_status", STATUS), ("match_level", MATCH), ("review_status", REVIEW)):
        if r[col] and r[col] not in allowed:
            err.append(f"{col}={r[col]!r}: {', '.join(sorted(allowed))} 중 하나")
    if kind in TOPICS:
        need("topic")
        if r["topic"] and r["topic"] not in TOPICS[kind]:
            err.append(f"topic={r['topic']!r}: {', '.join(sorted(TOPICS[kind]))} 중 하나")

    if not r["aphia_id"]:
        (warn if r["match_level"] == "unresolved" else err).append("aphia_id 비어 있음")
    elif not APHIA.fullmatch(r["aphia_id"]):
        err.append(f"aphia_id={r['aphia_id']!r}: 숫자만 (예: 140658)")
    if r["doi"] and not DOI.fullmatch(r["doi"]):
        err.append(f"doi={r['doi']!r}: '10.'으로 시작하는 DOI만 (https://doi.org/ 빼기)")
    if r["source_url"] and not URL.fullmatch(r["source_url"]):
        err.append("source_url: http:// 또는 https:// 주소 하나만")
    if r["accessed"]:
        try:
            if len(r["accessed"]) != 10 or date.fromisoformat(r["accessed"]) > date.today():
                raise ValueError
        except ValueError:
            err.append(f"accessed={r['accessed']!r}: YYYY-MM-DD, 미래 날짜 불가")

    status = r["data_status"]
    partial = kind == "bioactivity" and r["link_level"] == "compound"
    full = kind == "bioactivity" and r["link_level"] == "assay"
    if status in {"no_data", "not_searched", "no_access"} and r["value"]:
        err.append(f"data_status={status}인데 value={r['value']!r}: 결측은 비워 두기 (0으로 쓰지 않기)")
    if status in {"found", "no_data", "no_access", "license_unclear"}:
        if not (r["source_url"] or r["doi"]):
            err.append("source_url·doi 모두 비어 있음 (어디서 찾았는지/찾지 못했는지)")
        need("accessed")
    if status == "no_data":
        need("claim", why=" (no_data: 검색한 이름·검색어·범위를 적어 재현 가능하게)")
    if status == "found":
        need("claim", "license", "limitations", why=" (found)")
        if not partial:
            need("value", why=" (found)")

    nutrition = kind == "food" and r["topic"] == "nutrition"
    numeric = bool(NUMBER.fullmatch(r["value"]))
    if status in {"found", "license_unclear"} and numeric and not r["unit"] and not nutrition:
        err.append("숫자 value에 unit 없음")
    if full and status in {"found", "license_unclear"}:
        need("compound_name", "experiment_type", "target", "assay", why=" (link_level=assay)")
        if r["value"] and not NUMBER.fullmatch(r["value"]):
            err.append(f"link_level=assay인데 value={r['value']!r}: 숫자만 (active 같은 말은 claim에, 정량값이 없으면 compound)")
    if status == "found":
        if nutrition:
            need("unit", "basis", why=" (영양값: 예 g, per 100 g edible portion)")
        if kind == "food" and r["topic"] in {"aquaculture", "fishery"}:
            need("region", "period")
        if kind == "species" and r["topic"] == "occurrence":
            need("region", "period")
        if kind == "species" and r["topic"] == "iucn":
            need("iucn_scope", "assessment_year")
            if r["value"] not in IUCN:
                err.append(f"IUCN value={r['value']!r}: {', '.join(sorted(IUCN))} 중 하나")
            if r["assessment_year"] and not re.fullmatch(r"(19|20)\d\d", r["assessment_year"]):
                err.append("assessment_year: 네 자리 연도")
    if kind == "bioactivity":
        if status in {"found", "license_unclear"}:
            need("link_level")
        if r["link_level"] and r["link_level"] not in LINK:
            err.append(f"link_level={r['link_level']!r}: compound(부분 연결) 또는 assay(완전 연결)")
        if partial:
            need("compound_name", why=" (link_level=compound)")
            if r["value"] or r["unit"]:
                err.append("link_level=compound인데 value/unit 있음: 정량값이 있으면 assay로, 없으면 비우기")
            if r["experiment_type"] or r["target"] or r["assay"]:
                err.append("link_level=compound인데 experiment_type/target/assay 있음: 실험을 확인했으면 assay 행으로")
        if r["compound_id"] and not COMPOUND.fullmatch(r["compound_id"]):
            err.append(f"compound_id={r['compound_id']!r}: CID:숫자 또는 InChIKey")
        if r["experiment_type"] and r["experiment_type"] not in EXPERIMENT:
            err.append(f"experiment_type: {', '.join(sorted(EXPERIMENT))} 중 하나")

    for col, text in r.items():
        if EMAIL.search(text):
            err.append(f"{col}: 이메일 주소로 보이는 값 (개인정보 넣지 않기)")
        if len(text) > LONG_CELL:
            warn.append(f"{col}: {len(text)}자 - 원문 붙여넣기 대신 요약")
    return err, warn


def check_file(path):
    """Return a list of (line, level, message)."""
    kind = next((k for k in KINDS if path.name.startswith(k)), None)
    if not kind:
        return [(0, "ERROR", f"파일 이름은 {', '.join(KINDS)} 중 하나로 시작")]
    try:
        with open(path, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.reader(f))
    except UnicodeDecodeError:
        return [(0, "ERROR", "UTF-8이 아님: 엑셀에서 'CSV UTF-8'로 다시 저장")]
    if not rows:
        return [(0, "ERROR", "빈 파일")]
    header, expected = [h.strip() for h in rows[0]], columns(kind)
    if header != expected:
        extra = [h for h in header if h not in expected]
        missing = [h for h in expected if h not in header]
        return [(1, "ERROR", f"열이 양식과 다름 - 없는 열: {missing or '-'}, 추가된 열(좌표·연락처 포함 금지): {extra or '-'}")]

    out, seen = [], {}
    for line, cells in enumerate(rows[1:], start=2):
        if not any(c.strip() for c in cells):
            continue
        if len(cells) != len(header):
            out.append((line, "ERROR", f"칸 수 {len(cells)}개, 양식은 {len(header)}개 (쉼표가 든 값은 따옴표로)"))
            continue
        r = {h: c.strip() for h, c in zip(header, cells)}
        if r["record_id"] in seen:
            out.append((line, "ERROR", f"record_id {r['record_id']!r} 중복 ({seen[r['record_id']]}행)"))
        seen.setdefault(r["record_id"], line)
        err, warn = check_row(kind, r)
        out += [(line, "ERROR", m) for m in err] + [(line, "WARN", m) for m in warn]
    return out


def main(args):
    sys.stdout.reconfigure(errors="replace")  # Windows cp949 consoles
    targets = [Path(a) for a in args] or [ROOT / "research" / "submissions"]
    files = sorted(p for t in targets for p in ([t] if t.is_file() else t.glob("*.csv")))
    if not files:
        print("검사할 CSV가 없습니다.")
        return 0
    errors = 0
    for path in files:
        issues = check_file(path)
        errors += sum(level == "ERROR" for _, level, _ in issues)
        print(f"\n{path.name}: {'통과' if not issues else f'{len(issues)}건'}")
        for line, level, msg in issues:
            print(f"  {line}행 {level}: {msg}")
    print(f"\n오류 {errors}건 - {'제출 전에 고쳐 주세요' if errors else '제출 가능 (내용 확인은 사람이)'}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
