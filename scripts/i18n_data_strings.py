"""영어 화면 자료 사전(dist/i18n-data-en.json) 관리 (2026-10-24, 표준 라이브러리만).

자료 파일(dist/*.json) 안의 한국어 문장(caveat·reason·label 등)은 점수 파일을 고치지 않고 이 사전으로 옮긴다.
키 = 정규화한 한국어 원문(앞뒤 공백 제거, 연속 공백 하나로), 값 = 영어. 영어 화면(?lang=en)에서만 i18n.js가 받는다.

대상: 화면 코드(app.js·live-data.js·intro.js·operations.js·expedition.js·chatbot.js)가 이름으로 읽는 필드의 한국어 문자열.
app.js의 SCREEN_FIX가 화면에서 바꿔 보여 주는 문장은 바뀐 글자도 대상이다(영어 화면도 같은 글자를 옮긴다).
파이프라인(scripts/build_*.py)이 자료 문장을 새로 만들면 이 사전도 갱신한다: --todo로 빠진 문장을 뽑아 번역하고 --add로 넣는다.

  python scripts/i18n_data_strings.py                    # 사전에 없는 문장(빠짐)과 더 이상 쓰이지 않는 항목(남음) 수
  python scripts/i18n_data_strings.py --check            # 빠진 문장이 있으면 종료 코드 1 (CI unit 잡)
  python scripts/i18n_data_strings.py --todo out.json    # 빠진 문장을 [{k, files}]로 쓴다(번역 묶음용)
  python scripts/i18n_data_strings.py --add tr.json      # {한국어: 영어} 파일을 사전에 넣는다(대상 문장만). 옆에 tr.species.json(배열)이
                                                         # 있으면 그 이름은 원어 그대로 둔다(keep_ko: 영어 화면에서 KO 표시)
  python scripts/i18n_data_strings.py --prune            # 더 이상 쓰이지 않는 항목을 지운다
  python scripts/i18n_data_strings.py --export-review    # docs/i18n-review.csv (ko,en,file,status=draft; 화면 사전 항목 포함)
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
DICT = DIST / "i18n-data-en.json"
REVIEW = ROOT / "docs" / "i18n-review.csv"
CODE = ("app.js", "live-data.js", "intro.js", "operations.js", "expedition.js", "chatbot.js")
# 한국어 화면 전용 사전(영어 원문 → 한국어)과 언어 사전 자체는 대상이 아니다
SKIP = {"screen-text-ko.json", "source-terms-ko.json", "i18n-data-en.json", "species-names-en.json"}
HANGUL = re.compile("[가-힣]")
SCHEMA = "i18n-data-en-1"
NOTE = ("영어 화면 자료 사전. 키 = 정규화한 한국어 원문(자료 파일), 값 = 영어. scripts/i18n_data_strings.py가 관리한다. "
        "번역은 Claude 초안이며 docs/i18n-review.csv로 팀 검토가 필요하다.")


def key(s):
    return " ".join(s.split())


def code_text():
    return "".join((DIST / f).read_text(encoding="utf-8") for f in CODE if (DIST / f).exists())


def screen_fix(code):
    """app.js SCREEN_FIX의 '원문':'화면 글자' 쌍(작은따옴표 문자열만)."""
    m = re.search(r"const SCREEN_FIX=\{(.*?)\};\n", code, re.S)
    if not m:
        return {}
    q = r"'((?:\\.|[^'\\])*)'"
    return {a.replace("\\'", "'"): b.replace("\\'", "'") for a, b in re.findall(q + r"\s*:\s*" + q, m.group(1))}


def collect():
    """{한국어 문장: {파일,…}}: 화면 코드가 이름으로 읽는 필드의 한국어 문자열."""
    code = code_text()
    seen = {}
    named = {}

    def used(k):
        if k not in named:
            named[k] = re.search(r"(?<![\w$])" + re.escape(k) + r"(?![\w$])", code) is not None
        return named[k]

    def walk(v, k, f):
        if isinstance(v, str):
            if HANGUL.search(v) and (k is None or used(k)):
                seen.setdefault(key(v), set()).add(f)
        elif isinstance(v, dict):
            for kk, x in v.items():
                walk(x, kk, f)
        elif isinstance(v, list):
            for x in v:
                walk(x, k, f)

    for p in sorted(DIST.glob("*.json")):
        if p.name not in SKIP:
            walk(json.loads(p.read_text(encoding="utf-8")), None, p.name)
    for a, b in screen_fix(code).items():
        if key(a) in seen and HANGUL.search(b):
            seen.setdefault(key(b), set()).update(seen[key(a)])
    return seen


def read_dict():
    if not DICT.exists():
        return {"schema": SCHEMA, "note": NOTE, "by_text": {}}
    d = json.loads(DICT.read_text(encoding="utf-8"))
    assert d.get("schema") == SCHEMA, "i18n-data-en.json schema"
    return d


def write_dict(d):
    d = {"schema": SCHEMA, "note": NOTE, "keep_ko": sorted(set(d.get("keep_ko", []))), "by_text": dict(sorted(d["by_text"].items()))}
    DICT.write_text(json.dumps(d, ensure_ascii=False, indent=0) + "\n", encoding="utf-8", newline="\n")


def ui_entries():
    """dist/i18n-en.js 화면 사전: [(묶음, 한국어, 영어)]"""
    p = DIST / "i18n-en.js"
    if not p.exists():
        return []
    out = []
    for m in re.finditer(r"// @section (.+?)\nObject\.assign\(I18N_EN,(\{.*?\n\})\);\n", p.read_text(encoding="utf-8"), re.S):
        out += [(m.group(1), k, v) for k, v in json.loads(m.group(2)).items()]
    return out


def main(argv):
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--check", action="store_true")
    g.add_argument("--todo")
    g.add_argument("--add")
    g.add_argument("--prune", action="store_true")
    g.add_argument("--export-review", action="store_true")
    a = ap.parse_args(argv)
    want = collect()
    d = read_dict()
    have = d["by_text"]
    keep = set(d.get("keep_ko", []))  # 원어 그대로 두는 이름(게재명 등): 영어 화면에서 KO 표시와 함께 한국어로 보인다
    missing = sorted(k for k in want if k not in have and k not in keep)
    stale = sorted(k for k in have if k not in want)
    if a.todo:
        Path(a.todo).write_text(json.dumps([{"k": k, "files": sorted(want[k])} for k in missing], ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{len(missing)} strings -> {a.todo}")
        return 0
    if a.add:
        new = {key(k): v for k, v in json.loads(Path(a.add).read_text(encoding="utf-8")).items()}
        kept = Path(a.add).with_suffix(".species.json")  # 번역 묶음에서 원어 그대로 두기로 한 이름
        if kept.exists():
            d["keep_ko"] = sorted(set(d.get("keep_ko", [])) | {key(k) for k in json.loads(kept.read_text(encoding="utf-8")) if key(k) in want})
        bad = [k for k in new if k not in want]
        have.update({k: v for k, v in new.items() if k in want})
        write_dict(d)
        print(f"+{len(new) - len(bad)} (skipped {len(bad)} not in data) -> {len(have)} entries")
        return 0
    if a.prune:
        for k in stale:
            del have[k]
        write_dict(d)
        print(f"pruned {len(stale)}")
        return 0
    if a.export_review:
        REVIEW.parent.mkdir(exist_ok=True)
        with REVIEW.open("w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(["ko", "en", "file", "status"])
            for sec, k, v in ui_entries():
                w.writerow([k, v, f"i18n-en.js · {sec}", "draft"])
            for k in sorted(have):
                w.writerow([k, have[k], "i18n-data-en.json · " + " ".join(sorted(want.get(k, {"(unused)"}))), "draft"])
        print(f"wrote {REVIEW.relative_to(ROOT)}")
        return 0
    print(f"data strings {len(want)} · in dictionary {len(want) - len(missing)} · missing {len(missing)} · stale {len(stale)}")
    for k in missing[:20]:
        print("  missing:", k[:80], "·", ", ".join(sorted(want[k])), flush=True)
    if a.check and missing:
        print("FAIL: python scripts/i18n_data_strings.py --todo out.json, translate, then --add")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
