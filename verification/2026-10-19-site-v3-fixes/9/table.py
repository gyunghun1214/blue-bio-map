"""Before/after table of every index number on screen for the 30 species (LKH 9/10, 2026-10-19):
python3 table.py before.json after.json out.md (the two files written by capture.mjs)"""
import json, re, sys

before, after = (json.load(open(p, encoding="utf-8")) for p in sys.argv[1:3])
TYPE = {"sustainable_use": "활용 지표 높음", "alternative_production": "두 지표 모두 높음",
        "conservation_priority": "보전 지표 높음", "baseline_survey": "두 지표 모두 낮음"}


def num(x):
    if x is None:
        return None
    m = re.search(r"\d+(?:\.\d+)?|—|–", x)
    return m.group(0) if m else None


def values(r):
    """index -> {surface: shown number}"""
    chip = {re.sub(r"[\d.]+.*$", "", c).replace("식량", "").replace("생리활성", "").replace("보전", "").replace("활용", ""): num(c)
            for c in r["chips"] or []}
    mt = r["matrix"] or ""
    v = {
        "MFPI": {"카드 칩": chip.get("MFPI"), "종 상세": num(r["detail"][1]), "비교 프로필": num(r["profile"][0]),
                 "비교 표": num(r["table"][0]), "바다 탐험": num(r["expedition"]["MFPI"])},
        "MBPI": {"카드 칩": chip.get("MBPI"), "종 상세": num(r["detail"][2]), "비교 프로필": num(r["profile"][1]),
                 "비교 표": num(r["table"][1]), "바다 탐험": num(r["expedition"]["MBPI"])},
        "BBVI": {"탐색 카드": num(r["card"][0]), "카드 칩": chip.get("BBVI"), "종 상세": num(r["detail"][0]),
                 "비교 표": num(r["table"][2]), "매트릭스 툴팁": num(re.search(r"BBVI ([\d.]+)", mt).group(1)),
                 "활용×보전 지도 줄": num(re.search(r"BBVI ([\d.]+)", r["valueType"]).group(1)), "바다 탐험": num(r["expedition"]["BBVI"])},
        "MCUI": {"탐색 카드": num(r["card"][1]), "카드 칩": chip.get("MCUI"), "종 상세": num(r["detail"][3]),
                 "비교 프로필": num(re.search(r"MCUIi([\d.]+)", r["profileText"]).group(1)), "비교 표": num(r["table"][3]),
                 "매트릭스 툴팁": num(re.search(r"MCUI ([\d.]+)", mt).group(1)),
                 "활용×보전 지도 줄": num(re.search(r"MCUI ([\d.]+)", r["valueType"]).group(1)), "바다 탐험": num(r["expedition"]["MCUI"])},
        "MBPI-Rx": {"비교 표": num(r["rx"]), "종 상세": num(r["rxDetail"])},
    }
    return v


def cell(b, a):
    sb, sa = sorted(set(x for x in b.values() if x)), sorted(set(x for x in a.values() if x))
    if sb == sa:
        return " / ".join(sa), []
    changed = sorted(k for k in a if b.get(k) != a.get(k))
    return f"{' / '.join(sb)} → **{' / '.join(sa)}**", changed


rows, nchanged, types_changed, changed_by = [], 0, [], {}
surfaces = {}
for label, rb in before.items():
    ra = after[label]
    vb, va = values(rb), values(ra)
    cells = []
    for k in ["MFPI", "MBPI", "BBVI", "MCUI", "MBPI-Rx"]:
        c, ch = cell(vb[k], va[k])
        cells.append(c.replace("—", "없음") if c in ("—", "") else c)
        for s in ch:
            surfaces.setdefault(k, set()).add(s)
        if ch:
            changed_by.setdefault(k, set()).add(label)
    if rb["type"] != ra["type"] or rb["officialType"] != ra["officialType"]:
        types_changed.append(label)
    pub = " · ".join("–" if x is None else f"{x:g}" if isinstance(x, (int, float)) else str(x) for x in rb["published"])
    rows.append(f"| {label} | {TYPE[rb['type']]}{'' if rb['type'] == ra['type'] else ' → ' + TYPE[ra['type']]} | {pub} | " + " | ".join(cells) + " |")
    if any("→" in c for c in cells):
        nchanged += 1

out = ["| 종 | 유형(전 = 후) | 공개값 MFPI · MBPI · MCUI · BBVI | MFPI | MBPI | BBVI | MCUI | MBPI-Rx |",
       "|---|---|---|---|---|---|---|---|"] + rows
changed_species = {k: sorted(v) for k, v in changed_by.items()}
out += ["", f"- 유형이 바뀐 종: {len(types_changed)}종" + (f" ({', '.join(types_changed)})" if types_changed else "") + " (지금 가중치의 유형과 공식 가중치의 유형 모두)",
        f"- 숫자가 하나라도 바뀐 종: {nchanged}종 / 30종"]
for k in ["MFPI", "MBPI", "BBVI", "MCUI", "MBPI-Rx"]:
    sp = changed_species.get(k, [])
    out.append(f"- {k}: " + (f"{len(sp)}종에서 바뀜 ({', '.join(sorted(surfaces.get(k, [])))})" + (f" · {', '.join(sp)}" if len(sp) <= 3 else "") if sp else "바뀐 곳 없음"))
out.append("- 값 칸은 그 지표가 나오는 모든 화면(탐색 카드·카드 칩·종 상세·비교 프로필·비교 표·매트릭스 툴팁·활용×보전 지도 줄·바다 탐험)의 숫자를 모은 것입니다. "
           "'10 / 10.0'처럼 한 칸에 값이 둘이면 화면마다 달랐다는 뜻입니다.")
open(sys.argv[3], "w", encoding="utf-8").write("\n".join(out) + "\n")
print("\n".join(out[-8:]))
