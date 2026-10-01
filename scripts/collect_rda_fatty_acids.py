"""EPA/DHA per 100 g for the same 425 RDA DB 10.4 marine rows (display-only chip).

Reuses scripts/collect_rda_nutrition.py's endpoint and parsing; only FIELDS differs.
Codes come from the existing snapshot, so no catalogue re-crawl.
Blank/'-' -> null (never 0). A literal '0' printed by the DB is kept as 0.
"""
import html, json, re, time, urllib.parse, urllib.request
from pathlib import Path

BASE = "https://www.nics.go.kr/food"
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "research/verified-indices/snapshots/rda-db-10.4-marine-raw-2026-10-01.json"
OUT = ROOT / "research/verified-indices/snapshots/rda-epa-dha-2026-10-02.json"
FIELDS = {"에이코사펜타에노산(20:5(n-3)) (㎎)": "epa_mg",
          "도코사헥사에노산(22:6(n-3)) (㎎)": "dha_mg",
          "출처": "row_source"}


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest"})
    for attempt in range(3):
        try:
            return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
        except OSError:
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"failed: {url}")


def detail(code):
    q = urllib.parse.urlencode({"foodCodes": code, "fdNms": "x", "fdNm": "x", "reformNo": "-1",
                                "customQnt": "100", "onCuntNtkQntAt": ""})
    t = re.sub(r"<script.*?</script>", "", _get(f"{BASE}/kfi/fct/fctFoodSrch/detailOne?{q}"), flags=re.S)
    values = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S):
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()
                 for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]
        if len(cells) == 2 and cells[0] in FIELDS and FIELDS[cells[0]] not in values:
            values[FIELDS[cells[0]]] = cells[1] if cells[1] not in ("", "-") else None
    return values


def num(s):
    return None if s is None else float(s)


def main():
    src = json.loads(SRC.read_text(encoding="utf-8"))
    rows = []
    for i, r in enumerate(src["rows"], 1):
        v = detail(r["code"])
        rows.append({"code": r["code"], "name": r["name"], "epa_mg": num(v.get("epa_mg")),
                     "dha_mg": num(v.get("dha_mg")), "row_source": v.get("row_source")})
        if v.get("row_source") != (r["values"].get("row_source")):
            print(f"  ! row_source mismatch {r['code']}: {v.get('row_source')} vs {r['values'].get('row_source')}")
        if i % 50 == 0:
            print(f"{i}/{len(src['rows'])}", flush=True)
        time.sleep(0.3)
    snap = {
        "provider": "Rural Development Administration, National Institute of Crop and Food Science",
        "database": "National Standard Food Composition DB (국가표준식품성분 DB)",
        "version": "10.4 (2026)",
        "retrieved": "2026-10-02",
        "endpoint": f"{BASE}/kfi/fct/fctFoodSrch/detailOne?foodCodes=<code>&customQnt=100&reformNo=-1",
        "licence": "공공누리 제1유형 (KOGL Type 1, attribution)",
        "fields": {"epa_mg": "에이코사펜타에노산(20:5(n-3)) (㎎) per 100 g edible portion",
                   "dha_mg": "도코사헥사에노산(22:6(n-3)) (㎎) per 100 g edible portion"},
        "blank_rule": "Blank or '-' = missing value -> null, never 0. A literal 0 printed by the DB is kept as 0.",
        "use": "Display only (omega-3 chip). Not an MFPI input.",
        "codes_from": SRC.name,
        "rows": rows,
    }
    OUT.write_text(json.dumps(snap, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    have = sum(1 for r in rows if r["epa_mg"] is not None or r["dha_mg"] is not None)
    print(f"Wrote {len(rows)} rows ({have} with EPA or DHA) to {OUT}")


if __name__ == "__main__":
    main()
