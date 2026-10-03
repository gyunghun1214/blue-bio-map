"""Post-hoc validation of the published indices (team-lead decision 2026-10-01: relabel each axis by its validation result).

The criteria are fixed before any result is read and nothing is tuned to pass:
  MFPI  cross-table check. For every species scored from its own RDA DB 10.4 row, the nutrient part of MFPI (mean cohort
        percentile of the components the row reports itself, substitutes excluded) is recomputed with the same species' raw
        item of the Japanese Standard Tables of Food Composition 2020 (MEXT, linked by the WoRMS Japanese name as in 3.6),
        against the same fixed RDA cohort. Pass: Spearman rho >= 0.6 between the two, one-sided permutation p < 0.05.
  MCUI  back-test of the preliminary Rapid LC step on the species that already have an IUCN or Korean national category.
        Pass: no species assessed VU, EN or CR is called likely Least Concern (a false LC would understate urgency).
  MBPI  the config's drug-origin cases (ziconotide, halichondrin B, trabectedin); not computable without their species ->
        compound -> assay chains, which are not collected here.
Writes research/verified-indices/posthoc-validation-<date>.json; the config copies each result into posthoc.validation_sets.
"""
from __future__ import annotations

import argparse
import json
import random
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENTS = {"protein_g": "PROT-", "iron_mg": "FE", "zinc_mg": "ZN", "calcium_mg": "CA"}
CRITERIA = {"MFPI": {"min_rho": 0.6, "max_p": 0.05, "min_species": 8, "min_shared_components": 2},
            "MCUI": {"threatened": ["VU", "EN", "CR"]}}


def kata_to_hira(s: str) -> str:
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def number(v):
    """Printed analytical or calculated values only: estimates in parentheses, Tr, '-' and '*' are never used (3.6 rule)."""
    if isinstance(v, (int, float)):
        return float(v)
    return None


def mext_items(path: Path) -> list[dict]:
    import openpyxl
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True)["表全体"]
    rows = list(ws.iter_rows(values_only=True))
    ident = next(r for r in rows if r and r[3] == "成分識別子")
    col = {k: ident.index(v) for k, v in {**COMPONENTS, "refuse": "REFUSE"}.items()}
    out = []
    for r in rows:  # food groups 09 (algae) and 10 (fish and shellfish) only
        if not r or r[0] not in ("09", "10") or not (isinstance(r[1], str) and r[1].isdigit()) or not isinstance(r[3], str):
            continue
        name = unicodedata.normalize("NFKC", r[3])
        out.append({"food_item_id": r[1], "food_name": r[3], "tokens": name.replace("<", " ").replace(">", " ").split(),
                    "values": {k: number(r[i]) for k, i in col.items()}})
    return out


def worms_japanese(aphia: int) -> list[str]:
    req = urllib.request.Request(f"https://www.marinespecies.org/rest/AphiaVernacularsByAphiaID/{aphia}",
                                 headers={"User-Agent": "blue-bio-map research (research@example.org)"})
    try:
        body = urllib.request.urlopen(req, timeout=60).read()
    except OSError:
        return []
    return [v["vernacular"] for v in (json.loads(body) if body else []) if v.get("language_code") == "jpn"]


def percentile(value: float, peers: list[float]) -> float:
    return 100 * (sum(p < value for p in peers) + 0.5 * sum(p == value for p in peers)) / len(peers)


def spearman(x: list[float], y: list[float]) -> float:
    def ranks(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(v):
            j = i
            while j + 1 < len(v) and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2 + 1
            i = j + 1
        return r
    rx, ry = ranks(x), ranks(y)
    mx, my = sum(rx) / len(rx), sum(ry) / len(ry)
    cov = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    sx = sum((a - mx) ** 2 for a in rx) ** 0.5
    sy = sum((b - my) ** 2 for b in ry) ** 0.5
    return cov / (sx * sy)


def mfpi_check(report: dict, items: list[dict]) -> dict:
    rows = []
    for s in report["species"] + report["candidate_species"]:
        f = s.get("food_trace") or {}
        if s["scores"]["MFPI"] is None or f.get("row_table"):  # only species scored from their own RDA row
            continue
        names = [kata_to_hira(n) for n in worms_japanese(s["aphia_id"])]
        # the whole raw food: after the name only state words (no roe, milt, liver or other organ items)
        plain = {"生", "天然", "養殖", "成魚", "皮つき", "皮なし", "原藻"}
        hits = [i for i in items if i["tokens"][-1] == "生" and any(n in i["tokens"] and set(i["tokens"][i["tokens"].index(n) + 1:]) <= plain
                                                                     for n in names)]
        wild = [i for i in hits if "養殖" not in i["tokens"]]
        item = (wild or hits or [None])[0]
        if not item:
            rows.append({"aphia_id": s["aphia_id"], "korean_name": s["korean_name"], "worms_japanese": names, "mext_item": None})
            continue
        shared = [k for k, n in f["nutrients"].items() if not n.get("substitute") and item["values"].get(k) is not None]
        peers = {k: [p["value"] for p in f["nutrients"][k]["peer_values"] if p["food_item_id"] != f["source_food_item_id"]] for k in shared}
        if len(shared) < CRITERIA["MFPI"]["min_shared_components"]:
            rows.append({"aphia_id": s["aphia_id"], "korean_name": s["korean_name"], "mext_item": item["food_item_id"], "shared": shared})
            continue
        rda = sum(percentile(f["nutrients"][k]["value"], peers[k]) for k in shared) / len(shared)
        mext = sum(percentile(item["values"][k], peers[k]) for k in shared) / len(shared)
        rows.append({"aphia_id": s["aphia_id"], "korean_name": s["korean_name"], "rda_food_item_id": f["source_food_item_id"],
                     "mext_item": item["food_item_id"], "mext_name": item["food_name"], "shared": shared,
                     "rda_values": {k: f["nutrients"][k]["value"] for k in shared}, "mext_values": {k: item["values"][k] for k in shared},
                     "nutrient_score_rda": round(rda, 2), "nutrient_score_mext": round(mext, 2), "difference": round(mext - rda, 2)})
    paired = [r for r in rows if "nutrient_score_rda" in r]
    x, y = [r["nutrient_score_rda"] for r in paired], [r["nutrient_score_mext"] for r in paired]
    c = CRITERIA["MFPI"]
    if len(paired) < c["min_species"]:
        return {"result": "not_computable", "n": len(paired), "rows": rows, "criterion": c}
    rho = spearman(x, y)
    rng = random.Random(20261002)
    perms, hits = 20000, 0
    for _ in range(perms):
        z = y[:]
        rng.shuffle(z)
        hits += spearman(x, z) >= rho
    p = (hits + 1) / (perms + 1)
    mad = sum(abs(a - b) for a, b in zip(x, y)) / len(x)
    return {"result": "passed" if rho >= c["min_rho"] and p < c["max_p"] else "failed", "n": len(paired), "spearman_rho": round(rho, 3),
            "permutation_p_one_sided": round(p, 4), "mean_absolute_difference": round(mad, 2), "criterion": c, "rows": rows}


def mcui_check(report: dict, rapid: dict) -> dict:
    rows = []
    for s in report["species"] + report["candidate_species"]:
        basis = s.get("mcui_basis")
        if basis not in ("iucn", "national") or str(s["aphia_id"]) not in rapid["species"]:
            continue
        cat = (s.get("national_assessment") or {}).get("category") if basis == "national" else (s.get("conservation_trace") or {}).get("category")
        lc = rapid["species"][str(s["aphia_id"])]
        rows.append({"aphia_id": s["aphia_id"], "korean_name": s["korean_name"], "basis": basis, "category": cat,
                     "rapid_lc": lc["likely_least_concern"], "eoo_km2": lc["eoo_km2"], "aoo_km2": lc["aoo_km2"], "records": lc["records"],
                     "agrees": (cat == "LC") == lc["likely_least_concern"],
                     "false_lc_for_threatened": cat in CRITERIA["MCUI"]["threatened"] and lc["likely_least_concern"]})
    if not rows:
        return {"result": "not_computable", "rows": rows, "criterion": CRITERIA["MCUI"]}
    false_lc = [r for r in rows if r["false_lc_for_threatened"]]
    return {"result": "failed" if false_lc else "passed", "n": len(rows), "agreement": sum(r["agrees"] for r in rows),
            "false_lc_for_threatened": [r["korean_name"] for r in false_lc], "criterion": CRITERIA["MCUI"], "rows": rows}


MBPI_CASES = ROOT / "research" / "verified-indices" / "posthoc-3.27" / "mbpi-drug-origin"


def mbpi_check(report: dict, config: dict, cases: Path = MBPI_CASES) -> dict:
    """3.27: the drug-origin cases scored offline with the published ChEMBL rule (build_verified_indices.chembl_items, the
    report's commonness fence, the same filters, the 3.20 comment exclusion) from the stored case snapshot, collected with
    collect_mbpi_links.py's own functions (cases/collect_cases.py, ChEMBL_37). Criterion as registered: a case species ranks
    above the operating candidates, read literally as above every operating species that has an MBPI."""
    import sys
    sys.path.insert(0, str(ROOT / "scripts"))
    import build_verified_indices as B
    snap = json.loads((cases / "cases-snapshot.json").read_text(encoding="utf-8"))
    review = json.loads((cases / "link-review.json").read_text(encoding="utf-8"))
    drop = set(config["chembl_bioactivity"]["excluded_activity_comments"])
    snap = {**snap, "sources": {"chembl_mbpi": {"version": snap["chembl_version"]}}, "link_review": review,
            "activities": [a for a in snap["activities"] if (snap["activity_comments"][str(a["activity_id"])] or "").lower() not in drop]}
    items, summary = B.chembl_items({"chembl_links": snap}, config, limit=report["chembl_common_taxon_limit"])
    operating = {s["korean_name"]: s["scores"]["MBPI"] for s in report["species"] if s["scores"]["MBPI"] is not None}
    rows = []
    for s in snap["species"]:
        own = [i for a, i in items if a == s["aphia_id"]]
        best = max(own, key=lambda i: i["adjusted"], default=None)
        mbpi = best and B.round1(best["adjusted"])
        rows.append({"aphia_id": s["aphia_id"], "scientific_name": s["scientific_name"], "mbpi": mbpi,
                     "counts": summary["species"][s["aphia_id"]]["counts"],
                     "best": best and {k: best[k] for k in ("compound_id", "compound_name", "target_chembl_id", "target_name", "standard_type",
                                                            "median_pchembl", "cohort_records", "percentile", "link_factor", "activity_factor",
                                                            "original_paper_dois", "document_chembl_ids")},
                     "above_every_operating_species": mbpi is not None and all(mbpi > v for v in operating.values()),
                     "operating_species_below": sorted(k for k, v in operating.items() if mbpi is not None and v < mbpi)})
    computed = [r for r in rows if r["mbpi"] is not None]
    return {"result": ("passed" if all(r["above_every_operating_species"] for r in computed) else "failed") if computed else "not_computable",
            "n": len(rows), "computed": len(computed), "operating_mbpi": operating, "rows": rows}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, default=ROOT / "dist" / "assessments.json")
    parser.add_argument("--mext", type=Path, required=True, help="MEXT 2020 chapter 2 workbook (20201225-mxt_kagsei-mext_01110_012.xlsx)")
    parser.add_argument("--rapid-lc", type=Path, required=True, help="Rapid LC back-test snapshot of the assessed species")
    parser.add_argument("--out", type=Path, default=ROOT / "research" / "verified-indices" / f"posthoc-validation-{date.today()}.json")
    args = parser.parse_args()
    report = json.loads(args.report.read_text(encoding="utf-8"))
    out = {"generated_on": str(date.today()), "report_version": report["method_version"], "criteria": CRITERIA,
           "MFPI": mfpi_check(report, mext_items(args.mext)),
           "MCUI": mcui_check(report, json.loads(args.rapid_lc.read_text(encoding="utf-8"))),
           "MBPI": mbpi_check(report, report["method"])}  # 3.27: from the stored case snapshot (before: not computable)
    args.out.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print({k: out[k]["result"] for k in ("MFPI", "MCUI", "MBPI")}, {k: out["MFPI"].get(k) for k in ("n", "spearman_rho", "permutation_p_one_sided")})


if __name__ == "__main__":
    main()
