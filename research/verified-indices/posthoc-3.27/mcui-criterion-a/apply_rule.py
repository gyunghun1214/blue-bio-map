"""Apply fixed rule 'A-catch v1' (01_method_fixed_before_data.md) to FAO FishStat 2026.1.0.

No parameter here may be changed after seeing results (W, thresholds, eligibility).
Run: PYTHONUTF8=1 python apply_rule.py
"""
import csv, json, math, os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
FAO = os.path.join(HERE, "fao")
W = 10                      # window, years (rule 2)
AQ_SHARE_MAX = 0.5          # rule 3b
MIN_MEAN_T = 100            # rule 3c
KOREA = "410"

# (korean, aphia, ASFIS code or None, role, reference category, Rapid LC result from posthoc json / dist)
SPECIES = [
    # back-test 14 (posthoc-validation-2026-10-02.json order)
    ("해삼", 241776, "CUJ", "backtest", "EN", True),
    ("살오징어", 342067, "SQJ", "backtest", "LC", True),
    ("홍합(참담치)", 506159, "MUK", "backtest", "LC", True),
    ("참굴", 836033, "OYG", "backtest", "LC", True),
    ("바지락", 231750, "CLJ", "backtest", "LC", True),
    ("전복(종 수준)", 397082, "ABJ", "backtest", "EN", True),
    ("큰가리비", 393716, "JSC", "backtest", "LC", True),
    ("피조개", 504357, "ACB", "backtest", "LC", True),
    ("맛조개", 413600, "SVT", "backtest", "LC", False),
    ("고등어", 127022, "MAS", "backtest", "LC", True),
    ("멸치", 219984, "JAN", "backtest", "LC", True),
    ("참조기", 281273, "CRY", "backtest", "LC", True),
    ("방어", 276651, "AMJ", "backtest", "LC", True),
    ("갑오징어", 1666974, "EJK", "backtest", "LC", True),
    # 13 targets (all Rapid LC = True in dist/assessments.json)
    ("미역", 145721, "UDP", "target", None, True),
    ("멍게", 250680, "HYZ", "target", None, True),
    ("톳", 494972, "GQB", "target", None, True),
    ("다시마", 377084, "LNJ", "target", None, True),
    ("감태", 371986, None, "target", None, True),
    ("가시파래", 234476, "EBP", "target", None, True),
    ("괭생이모자반", 494853, "FIJ", "target", None, True),
    ("꼬시래기", 236157, "FFT", "target", None, True),
    ("청각", 145086, "KII", "target", None, True),
    ("넙치", 275816, "BAH", "target", None, True),
    ("조피볼락", 274849, "SFL", "target", None, True),
    ("대구", 254538, "PCO", "target", None, True),
    ("꽃게", 1061762, "GAZ", "target", None, True),
]


def load(path, codes, env_col=False):
    tot = defaultdict(float)          # (code, year) -> t, all countries
    kor = defaultdict(float)
    status = defaultdict(set)
    countries = defaultdict(set)
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            c = r["SPECIES.ALPHA_3_CODE"]
            if c not in codes or r["MEASURE"] != "Q_tlw":
                continue
            if r["VALUE"] in ("", None):
                continue
            y = int(r["PERIOD"]); v = float(r["VALUE"])
            tot[(c, y)] += v
            status[(c, y)].add(r["STATUS"])
            if v > 0:
                countries[c].add(r["COUNTRY.UN_CODE"])
            if r["COUNTRY.UN_CODE"] == KOREA:
                kor[(c, y)] += v
    return tot, kor, status, countries


def ols_reduction(years, vals):
    n = len(years)
    xs = years; ys = [math.log(v) for v in vals]
    mx = sum(xs) / n; my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    a = my - b * mx
    resid = [y - (a + b * x) for x, y in zip(xs, ys)]
    s2 = sum(e * e for e in resid) / (n - 2)
    se = math.sqrt(s2 / sxx)
    t = 2.262  # t(0.975, df=9) for n = 11
    R = 1 - math.exp(W * b)
    lo = 1 - math.exp(W * (b + t * se))   # smaller reduction
    hi = 1 - math.exp(W * (b - t * se))   # larger reduction
    return R, lo, hi, b


def level(R):
    if R >= 0.80: return "CR 수준"
    if R >= 0.50: return "EN 수준"
    if R >= 0.30: return "VU 수준"
    if R >= 0.20: return "NT 가능성"
    return "기준 A 미달"


def series_result(code, tot, aq, T):
    yrs = list(range(T - W, T + 1))
    cap = [tot.get((code, y)) for y in yrs]
    aqv = [aq.get((code, y), 0.0) for y in yrs]
    out = {"window": f"{yrs[0]}-{yrs[-1]}", "capture_t": dict(zip(yrs, cap)), "aquaculture_t": dict(zip(yrs, aqv))}
    reasons = []
    if any(v is None or v <= 0 for v in cap):
        reasons.append("창 안에 값 없음/0 (규칙 3a)")
    shares = [a / (a + (c or 0)) if (a + (c or 0)) > 0 else 0 for a, c in zip(aqv, cap)]
    out["max_aq_share"] = round(max(shares), 3)
    if max(shares) >= AQ_SHARE_MAX:
        reasons.append(f"양식 우세: 최대 양식 비율 {max(shares):.2f} ≥ 0.5 (규칙 3b)")
    valid = [v for v in cap if v]
    mean = sum(valid) / len(valid) if valid else 0
    out["mean_capture_t"] = round(mean, 1)
    if mean < MIN_MEAN_T:
        reasons.append(f"창 평균 {mean:.0f} t < 100 t (규칙 3c)")
    if not any(v is None or v <= 0 for v in cap):
        R, lo, hi, b = ols_reduction(yrs, cap)
        out.update(R=round(R, 3), R_ci95=[round(lo, 3), round(hi, 3)], slope=round(b, 4), level=level(R))
    out["ineligible"] = reasons
    return out


def call(rapid_lc, res):
    if res is None:
        return "판단 불가(FAO 종 수준 행 없음)"
    if res["ineligible"]:
        return "판단 불가(" + "; ".join(res["ineligible"]) + ")"
    R = res["R"]
    if R >= 0.30:
        return "위협 가능성(" + res["level"] + ", A2d 추론)"
    if R >= 0.20:
        return "NT 가능성"
    if not rapid_lc:
        return "LC 아님(분포 기준 미달)"
    return "아마 LC(분포 + 어획 감소 확인)"


def main():
    codes = {s[2] for s in SPECIES if s[2]}
    cap, capk, st, ctry = load(os.path.join(FAO, "Capture", "Capture_Quantity.csv"), codes)
    aq, aqk, _, _ = load(os.path.join(FAO, "Aquaculture", "Aquaculture_Quantity.csv"), codes)
    T = max(y for (_, y) in cap)
    out = {"rule": "A-catch v1", "fao_release": "FishStat 2026.1.0", "last_year": T, "rows": []}
    for ko, aphia, code, role, ref, rlc in SPECIES:
        row = {"korean_name": ko, "aphia_id": aphia, "asfis": code, "role": role, "reference": ref, "rapid_lc": rlc}
        if code:
            row["global"] = series_result(code, cap, aq, T)
            row["korea"] = series_result(code, capk, aqk, T)
            row["n_countries_capture"] = len(ctry[code])
            row["status_flags"] = sorted({s for (c, y), ss in st.items() if c == code and y >= T - W for s in ss})
        row["call"] = call(rlc, row.get("global"))
        row["call_korea_reference"] = call(rlc, row.get("korea")) if code else None
        out["rows"].append(row)
    json.dump(out, open(os.path.join(HERE, "results_A_catch_v1.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # back-test scoring (rule section 3)
    bt = [r for r in out["rows"] if r["role"] == "backtest"]
    thr = [r for r in bt if r["reference"] in ("VU", "EN", "CR")]
    false_lc = [r["korean_name"] for r in thr if r["call"].startswith("아마 LC")]
    detected = [r["korean_name"] for r in thr if r["call"].startswith("위협 가능성")]
    evaluable = [r for r in bt if not r["call"].startswith("판단 불가")]
    agree = [r["korean_name"] for r in bt if (r["reference"] in ("VU", "EN", "CR") and r["call"].startswith("위협 가능성"))
             or (r["reference"] == "LC" and r["call"].startswith("아마 LC"))]
    out["backtest"] = {"n": len(bt), "false_lc_for_threatened": false_lc, "threatened_detected": detected,
                       "evaluable_n": len(evaluable), "agree_n": len(agree), "agree": agree,
                       "pass_1_no_false_lc": not false_lc, "pass_2_detects_threatened": bool(detected),
                       "pass_3_evaluable_ge_8": len(evaluable) >= 8}
    out["backtest"]["passed"] = all(out["backtest"][k] for k in ("pass_1_no_false_lc", "pass_2_detects_threatened", "pass_3_evaluable_ge_8"))
    json.dump(out, open(os.path.join(HERE, "results_A_catch_v1.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for r in out["rows"]:
        g = r.get("global") or {}
        k = r.get("korea") or {}
        print(f'{r["korean_name"]:<8} {str(r["asfis"]):<4} ref={str(r["reference"]):<4} R={g.get("R")} ci={g.get("R_ci95")} '
              f'meanT={g.get("mean_capture_t")} aqmax={g.get("max_aq_share")} | KR R={k.get("R")} aq={k.get("max_aq_share")} mean={k.get("mean_capture_t")}\n    -> {r["call"]}  || KR참고: {r["call_korea_reference"]}')
    print(json.dumps(out["backtest"], ensure_ascii=False, indent=1))


if __name__ == "__main__":
    # self-check of the reduction formula with the guideline example (4.5.1, p.35):
    # exponential 20,000 -> 14,000 over 20 years scaled to 60 years = 65.7 %
    assert abs((1 - (14000 / 20000) ** (60 / 20)) - 0.657) < 0.001
    _y = list(range(2014, 2025)); _v = [1000 * 0.95 ** (y - 2014) + 1e-9 for y in _y]
    _v[3] *= 1.0000001  # avoid zero residual variance
    assert abs(ols_reduction(_y, _v)[0] - (1 - 0.95 ** 10)) < 1e-4
    main()
