"""Collect raw marine rows from the RDA Korean Food Composition Database (stage 1: retrieval).

Network access happens only here. The output is a dated snapshot that the offline
build (`build_verified_indices.py`) reads, so scores never change silently when the
website updates. Blanks stay None: the RDA English site states "Blanks mean missing
values", so a blank is never converted to zero.

Usage: python scripts/collect_rda_nutrition.py [--out PATH]
Licence: KOGL Type 1 (attribution) for the 'National Standard Food Composition DB' data.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

BASE = "https://www.nics.go.kr/food"
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "research" / "verified-indices" / "snapshots" / f"rda-db-10.4-marine-raw-{date.today()}.json"
FIELDS = {"단백질 (g)": "protein_g", "철 (㎎)": "iron_mg", "아연 (㎎)": "zinc_mg",
          "수분 (g)": "water_g", "폐기율 (%)": "refuse_pct", "출처": "row_source"}
GROUPS = ("어패류 및 기타 수산물", "해조류")


def _get(url: str, data: dict | None = None) -> str:
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers={"User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest"})
    for attempt in range(3):
        try:
            return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
        except OSError:
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"failed: {url}")


def catalog(lang: str = "kor") -> list[dict]:
    path = "/kfi/fct/fctFoodSrch/list/grid" if lang == "kor" else "/eng/fctFoodSrchEng/list/grid"
    rows = []
    for page in range(1, 40):
        t = _get(BASE + path, {"searchDetail": "N", "search_Dtlbtn": "base", "page": page, "rows": 200, "sectionRows": 200})
        found = re.findall(r'btnViewIrdnt">\s*\[([^\]]+)\]([^<]*)</a>\s*<span>\s*<input[^>]*value="([^"]+)"', t)
        if not found:
            found = [(g, n, c) for g, n, c in re.findall(r'>\s*\[([^\]]+)\]([^<]*)</a>\s*<span>\s*<input[^>]*value="([^"]+)"', t)]
        if not found:
            break
        rows += [{"group": g.strip(), "name": html.unescape(re.sub(r"\s+", " ", n)).strip(), "code": c} for g, n, c in found]
    return rows


def detail(code: str) -> dict:
    q = urllib.parse.urlencode({"foodCodes": code, "fdNms": "x", "fdNm": "x", "reformNo": "-1", "customQnt": "100", "onCuntNtkQntAt": ""})
    t = re.sub(r"<script.*?</script>", "", _get(f"{BASE}/kfi/fct/fctFoodSrch/detailOne?{q}"), flags=re.S)
    values: dict[str, str | None] = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S):
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()
                 for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]
        if len(cells) == 2 and cells[0] in FIELDS and FIELDS[cells[0]] not in values:
            values[FIELDS[cells[0]]] = cells[1] if cells[1] not in ("", "-") else None
    return values


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    english = {r["code"]: r["name"] for r in catalog("eng")}
    rows = [r for r in catalog("kor") if r["group"] in GROUPS and r["name"].endswith("생것")]
    out = []
    for r in rows:
        out.append({**r, "english_name": english.get(r["code"]), "values": detail(r["code"])})
        time.sleep(0.3)
    snapshot = {"provider": "Rural Development Administration, National Institute of Crop and Food Science",
                "database": "National Standard Food Composition DB (국가표준식품성분 DB)", "version": "10.4 (2026)",
                "retrieved": str(date.today()), "detail_endpoint": f"{BASE}/kfi/fct/fctFoodSrch/detailOne?foodCodes=<code>",
                "licence": "KOGL Type 1 (attribution) for the DB; the printed 10th-revision book is KOGL Type 2",
                "blank_rule": "Blank = missing value (RDA English site). '-' is treated as missing; never zero.",
                "rows": out}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {len(out)} rows to {args.out}")


if __name__ == "__main__":
    main()
