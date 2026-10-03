"""Out-of-panel validation of the MCUI OBIS occurrence-trend element (method: 01_method_fixed_before_data.md, sha256 in
locked.sha256). Collector/builder logic copied from C:/bbvm-327 (read-only) at 3194e2b; nothing is written there.

Usage: PYTHONUTF8=1 python validate.py select|implcheck|trend|analyse
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = Path("C:/bbvm-327")
CACHE = HERE / "cache"
CACHE.mkdir(exist_ok=True)
API = "https://api.obis.org/v3/"
UA = {"User-Agent": "BlueBioValueMap-research/1.0 (research@example.org)", "Accept": "application/json"}
LON = range(122, 136)
LAT = range(30, 43)
BOX = "POLYGON((122 30,136 30,136 43,122 43,122 30))"
PERIODS = {"past": ("2006-01-01", "2015-12-31"), "recent": ("2016-01-01", "2025-12-31")}
FIELDS = "id,decimalLatitude,decimalLongitude,date_year,dataset_id"
RULE = json.loads((REPO / "config/verified-indices-v3.25.json").read_text(encoding="utf-8"))["conservation"]["trend"]
PRIMARY = {"Ascidiacea": 1839, "Bivalvia": 105, "Cephalopoda": 11707, "Florideophyceae": 368670, "Gastropoda": 101,
           "Holothuroidea": 123083, "Malacostraca": 1071, "Phaeophyceae": 830, "Teleostei": 293496, "Ulvophyceae": 146216}
SECONDARY = {"Elasmobranchii": 10193}
COMPUTE = {"CR", "EN", "VU", "NT", "LC", "DD"}


class CheckFailed(Exception):
    pass


def fetch(url: str, headers=UA):
    for wait in (10, 60, 300, None):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as response:
                body = response.read()
                return json.loads(body) if body.strip() else {}
        except urllib.error.HTTPError as err:
            if 400 <= err.code < 500 and err.code != 429:
                return {"_http_error": err.code}
            if wait is None:
                raise
            time.sleep(wait)
        except (OSError, ValueError):
            if wait is None:
                raise
            time.sleep(wait)


def get(path: str, fresh: bool = False, base: str = API, **query) -> dict:
    url = base + path + "?" + urllib.parse.urlencode(query)
    hit = CACHE / (hashlib.sha256(url.encode()).hexdigest() + ".json")
    if hit.exists() and not fresh:
        return json.loads(hit.read_text(encoding="utf-8"))
    data = fetch(url)
    hit.write_text(json.dumps(data), encoding="utf-8")
    time.sleep(0.2)  # be gentle with the public API
    return data


def stat(fresh=False, **q) -> int:
    d = get("statistics", fresh=fresh, **q)
    if "_http_error" in d:
        raise CheckFailed(f"statistics HTTP {d['_http_error']} {q}")
    return int(d.get("records", 0))


# ---- copied from scripts/collect_mcui_trend.py (3194e2b) ----
def cell_ring(lat0: int, lon0: int) -> str:
    return f"POLYGON(({lon0} {lat0},{lon0 + 1} {lat0},{lon0 + 1} {lat0 + 1},{lon0} {lat0 + 1},{lon0} {lat0}))"


def cells_of(lat: float, lon: float) -> list[str]:
    edge = lambda v: {math.floor(v)} | ({int(v) - 1} if v == int(v) else set())
    return [f"{a}/{b}" for a in sorted(edge(lat)) for b in sorted(edge(lon)) if a in LAT and b in LON]


def species_rows(aphia: int, start: str, end: str, fresh: bool = False) -> list[tuple[list[str], str]]:
    query = {"taxonid": aphia, "geometry": BOX, "startdate": start, "enddate": end}
    expected = int(get("statistics", fresh=fresh, **query).get("records", 0))
    rows, after = [], None
    while len(rows) < expected:
        page = {**query, "size": 5000, "fields": FIELDS, **({"after": after} if after else {})}
        got = get("occurrence", fresh=fresh, **page)["results"]
        if not got:
            break
        rows += [(cells_of(r["decimalLatitude"], r["decimalLongitude"]), r.get("dataset_id") or "unknown") for r in got]
        after = got[-1]["id"]
    if len(rows) != expected:  # collector asserts; here a species is retried once, then excluded (method 3(a))
        raise CheckFailed(f"paged {len(rows)} != statistics {expected} ({aphia} {start})")
    return rows


def tally(rows, dataset=None) -> dict:
    cells = Counter(c for cs, d in rows if dataset in (None, d) for c in cs)
    return {"records": sum(1 for cs, d in rows if cs and dataset in (None, d)),
            "outside_grid": sum(1 for cs, d in rows if not cs and dataset in (None, d)),
            "cells": dict(sorted(cells.items()))}


# ---- copied from scripts/build_verified_indices.py (3194e2b) ----
def require(cond, msg):
    if not cond:
        raise SystemExit(msg)


def _rate_ratio(n1, n2, e1, e2, rule):
    k = rule["continuity"]
    ratio = ((n2 + k) / e2) / ((n1 + k) / e1)
    spread = math.exp(rule["z"] * math.sqrt(1 / (n1 + k) + 1 / (n2 + k)))
    return ratio, ratio / spread, ratio * spread


def occurrence_trend(aphia: int, snap: dict, rule: dict) -> dict:
    sp = snap["species"].get(str(aphia))
    require(sp is not None, f"{aphia}: no OBIS trend record")
    group = snap["group_effort"][sp["class"]]["cells"]
    past, recent = sp["past"]["cells"], sp["recent"]["cells"]
    both = lambda effort, c: all(effort.get(c, {}).get(p, 0) > 0 for p in ("past", "recent"))
    cells = sorted(c for c in set(past) | set(recent) if both(group, c))
    n1, n2 = sum(past.get(c, 0) for c in cells), sum(recent.get(c, 0) for c in cells)
    e1, e2 = sum(group[c]["past"] for c in cells), sum(group[c]["recent"] for c in cells)
    out = {"source_id": rule["source_id"], "periods": rule["periods"], "effort_group": sp["class"], "cells_compared": len(cells),
           "species_records": {"past": n1, "recent": n2}, "effort_records": {"past": e1, "recent": e2},
           "records_in_map_extent": {p: sp[p]["records"] + sp[p]["outside_grid"] for p in ("past", "recent")},
           "cells_past_only": sum(1 for c in past if c not in recent), "cells_recent_only": sum(1 for c in recent if c not in past),
           "latest_record_year": (sp.get("yearrange") or [None, None])[1], "records_all_years": sp["records_all_years"],
           "datasets": {p: len(sp[p]["datasets"]) for p in ("past", "recent")}}
    if not cells:
        return {**out, "class": "undetermined", "reason": "no_comparable_cells"}
    if n1 < rule["min_past_records"]:
        return {**out, "class": "undetermined", "reason": "past_records_below_minimum"}
    ratio, low, high = _rate_ratio(n1, n2, e1, e2, rule)
    a1, a2 = sum(snap["effort"][c]["past"] for c in cells), sum(snap["effort"][c]["recent"] for c in cells)
    out.update({"reporting_rate_ratio": round(ratio, 3), "ci": [round(low, 3), round(high, 3)], "effort_ratio": round(e2 / e1, 3),
                "all_taxa_sensitivity": {"effort_records": {"past": a1, "recent": a2},
                                         "reporting_rate_ratio": round(_rate_ratio(n1, n2, a1, a2, rule)[0], 3)}})
    top = sp.get("dominant_dataset")
    if top:
        ce = top["class_effort"]
        dcells = sorted(c for c in set(top["past"]) | set(top["recent"]) if both(ce, c))
        d = [sum(top[p].get(c, 0) for c in dcells) for p in ("past", "recent")] + [sum(ce[c][p] for c in dcells) for p in ("past", "recent")]
        check = {"dataset_id": top["dataset_id"], "past_share": top["past_share"], "cells_compared": len(dcells),
                 "species_records": {"past": d[0], "recent": d[1]}, "effort_records": {"past": d[2], "recent": d[3]}}
        if dcells and d[0] >= rule["min_past_records"]:
            r, lo, hi = _rate_ratio(*d, rule)
            check.update({"reporting_rate_ratio": round(r, 3), "ci": [round(lo, 3), round(hi, 3)]})
            check["confirms_decline"] = r <= rule["decline_ratio"] and hi < 1
        else:
            check["confirms_decline"] = False
        out["dataset_check"] = check
    if ratio <= rule["decline_ratio"] and high < 1:
        if out.get("dataset_check", {}).get("confirms_decline"):
            return {**out, "class": "decline_signal", "reason": "reporting_rate_fell_beyond_threshold_within_dominant_dataset_too"}
        return {**out, "class": "undetermined", "reason": "decline_not_confirmed_within_dominant_dataset"}
    if ratio <= rule["decline_ratio"]:
        return {**out, "class": "undetermined", "reason": "decline_uncertain"}
    if high < 1:
        return {**out, "class": "decline_below_threshold", "reason": "reporting_rate_fell_less_than_threshold"}
    if n2 < n1 and e2 < e1:
        return {**out, "class": "survey_gap", "reason": "fewer_records_explained_by_less_effort"}
    return {**out, "class": "no_clear_decline", "reason": "reporting_rate_not_lower"}


# ---- snapshot pieces built on demand (same queries as the collector) ----
EFFORT: dict = {}   # all-taxa effort per cell (sensitivity only)
GROUP: dict = {}    # class -> cell -> {past, recent}


def all_taxa(cell: str) -> dict:
    if cell not in EFFORT:
        lat0, lon0 = map(int, cell.split("/"))
        EFFORT[cell] = {p: stat(geometry=cell_ring(lat0, lon0), startdate=s, enddate=e) for p, (s, e) in PERIODS.items()}
    return EFFORT[cell]


def class_cell(cls: str, class_id: int, cell: str) -> dict:
    g = GROUP.setdefault(cls, {})
    if cell not in g:
        lat0, lon0 = map(int, cell.split("/"))
        g[cell] = {p: stat(taxonid=class_id, geometry=cell_ring(lat0, lon0), startdate=s, enddate=e) for p, (s, e) in PERIODS.items()}
    return g[cell]


def species_entry(aphia: int, cls: str, fresh: bool = False) -> tuple[dict, dict]:
    whole = get("statistics", fresh=fresh, taxonid=aphia, geometry=BOX)
    rows = {p: species_rows(aphia, s, e, fresh) for p, (s, e) in PERIODS.items()}
    entry = {"class": cls, "records_all_years": int(whole.get("records", 0)), "yearrange": whole.get("yearrange"),
             **{p: {**tally(rows[p]), "datasets": dict(sorted(Counter(d for _, d in rows[p]).items()))} for p in PERIODS}}
    return entry, rows


def add_dominant(aphia: int, entry: dict, rows: dict, class_id: int, fresh: bool = False) -> None:
    past = Counter(d for _, d in rows["past"])
    top = max(sorted(past), key=past.get)
    mine = {p: tally(rows[p], top) for p in PERIODS}
    for p, (s, e) in PERIODS.items():
        if stat(fresh=fresh, taxonid=aphia, datasetid=top, geometry=BOX, startdate=s, enddate=e) != mine[p]["records"] + mine[p]["outside_grid"]:
            raise CheckFailed(f"datasetid count mismatch ({aphia} {top} {p})")
    cells = sorted({c for p in PERIODS for c in mine[p]["cells"]})
    entry["dominant_dataset"] = {
        "dataset_id": top, "past_share": round(past[top] / sum(past.values()), 3), **{p: mine[p]["cells"] for p in PERIODS},
        "class_effort": {c: {p: stat(taxonid=class_id, datasetid=top, geometry=cell_ring(*map(int, c.split("/"))), startdate=s, enddate=e)
                             for p, (s, e) in PERIODS.items()} for c in cells}}


def trend_for(aphia: int, cls: str, class_id: int) -> dict:
    for fresh in (False, True):
        try:
            entry, rows = species_entry(aphia, cls, fresh)
            cells = sorted({c for p in PERIODS for c in entry[p]["cells"]})
            snap = {"species": {str(aphia): entry}, "group_effort": {cls: {"cells": {c: class_cell(cls, class_id, c) for c in cells}}},
                    "effort": {c: all_taxa(c) for c in cells}}
            t = occurrence_trend(aphia, snap, RULE)
            if t["reason"] == "decline_not_confirmed_within_dominant_dataset":  # only case where the dataset check decides
                add_dominant(aphia, entry, rows, class_id, fresh)
                t = occurrence_trend(aphia, snap, RULE)
            return t
        except CheckFailed as err:
            last = str(err)
    return {"class": "data_check_failed", "reason": last}


# ---- stages ----
def panel() -> tuple[set, set]:
    operating = json.loads((REPO / "research/verified-indices/candidates.json").read_text(encoding="utf-8"))["candidates"]
    catalog = json.loads((REPO / "dist/candidate-catalog.json").read_text(encoding="utf-8"))["species"]
    names = {c["aphia_id"]: c["scientific_name"] for c in operating} | {s["aphiaID"]: s["name"] for s in catalog}
    return set(names), {" ".join(n.split()[:2]) for n in names.values()}


def select() -> None:
    ids, binomials = panel()
    require(len(ids) == 30, f"panel size {len(ids)}")
    out = []
    for group, classes in (("P", PRIMARY), ("S2", SECONDARY)):
        for cls, cid in classes.items():
            rows, skip = [], 0
            while True:
                d = get("checklist", taxonid=cid, geometry=BOX, startdate=PERIODS["past"][0], enddate=PERIODS["past"][1], size=5000, skip=skip)
                rows += d["results"]
                skip += len(d["results"])
                if len(d["results"]) < 5000:  # 'total' is an approximate distinct count, so page until a short page
                    break
            require(len({r["taxonID"] for r in rows}) == len(rows), f"{cls}: duplicate checklist rows")
            keep = [r for r in rows if r.get("taxonRank") == "Species" and r.get("class") == cls and r["records"] >= 20
                    and r["taxonID"] not in ids and " ".join(r["scientificName"].split()[:2]) not in binomials]
            print(cls, len(rows), "taxa,", len(keep), "kept", flush=True)
            out += [{"group": group, "class": cls, "class_id": cid, "aphia_id": r["taxonID"], "name": r["scientificName"],
                     "kingdom": r.get("kingdom"), "past_records_box": r["records"]} for r in keep]
    for i, s in enumerate(out):
        m = get("species/match", base="https://api.gbif.org/v1/", name=s["name"], kingdom=s["kingdom"] or "", strict="true")
        s["gbif_match"] = {k: m.get(k) for k in ("matchType", "rank", "usageKey", "acceptedUsageKey", "status", "scientificName")}
        if m.get("matchType") == "EXACT" and m.get("rank") == "SPECIES":
            key = m.get("acceptedUsageKey") or m["usageKey"]
            r = get(f"species/{key}/iucnRedListCategory", base="https://api.gbif.org/v1/")
            s["iucn"] = r.get("code") or "NE"
            s["iucn_taxon_id"] = r.get("iucnTaxonID")
        else:
            s["iucn"] = "unmatched"
        if i % 100 == 0:
            print(i, len(out), flush=True)
    (HERE / "candidates.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(Counter((s["group"], s["iucn"]) for s in out))


def implcheck() -> None:
    require(stat(taxonid=219984, datasetid="00000000-0000-0000-0000-000000000000", geometry=BOX) == 0, "datasetid filter ignored")
    a = json.loads((REPO / "dist/assessments.json").read_text(encoding="utf-8"))
    pub = {s["aphia_id"]: s for s in a["species"] + a["candidate_species"]}
    res = {}
    for aphia, cls in ((219984, "Teleostei"), (241776, "Holothuroidea")):
        t = trend_for(aphia, cls, PRIMARY[cls])
        p = pub[aphia]["occurrence_trend"]
        res[aphia] = {"new": {k: t.get(k) for k in ("class", "reporting_rate_ratio", "ci", "species_records", "effort_records")},
                      "published": {k: p.get(k) for k in ("class", "reporting_rate_ratio", "ci", "species_records", "effort_records")}}
        ok = t["class"] == p["class"] and abs(t["reporting_rate_ratio"] - p["reporting_rate_ratio"]) <= 0.05
        res[aphia]["pass"] = ok
    (HERE / "implcheck.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(res, ensure_ascii=False, indent=1))


def trend() -> None:
    cands = json.loads((HERE / "candidates.json").read_text(encoding="utf-8"))
    path = HERE / "trend_results.json"
    done = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    todo = [s for s in cands if s["iucn"] in COMPUTE and str(s["aphia_id"]) not in done]
    print(len(todo), "species to compute", flush=True)
    for i, s in enumerate(todo):
        done[str(s["aphia_id"])] = {**s, "trend": trend_for(s["aphia_id"], s["class"], s["class_id"])}
        if i % 10 == 0 or i == len(todo) - 1:
            path.write_text(json.dumps(done, ensure_ascii=False, indent=1), encoding="utf-8")
            print(i, s["name"], done[str(s["aphia_id"])]["trend"]["class"], flush=True)


SCR = HERE.parent
JP_FILES = ["mcui-algae-ascidian/jp/redlist2017kaiyo_gyorui.csv", "mcui-algae-ascidian/jp/redlist2017kaiyo_koukakurui.csv",
            "mcui-algae-ascidian/jp/redlist2017kaiyo_nantai.csv", "mcui-algae-ascidian/jp/redlist2017kaiyo_sangorui.csv",
            "mcui-algae-ascidian/jp/redlist2017kaiyo_sonotamusekitsui.csv", "mcui-algae-ascidian/jp/redlist2020_invertebrate.csv",
            "mcui-algae-ascidian/jp/redlist2025_sorui.csv"]


def jp() -> None:
    import csv, io, re
    out = {}
    for f in JP_FILES:
        for row in csv.DictReader(io.StringIO((SCR / f).read_bytes().decode("cp932", errors="replace"))):
            words = (row["学名"] or "").replace("　", " ").split()
            if len(words) < 2 or not re.fullmatch(r"[a-z-]+", words[1]):
                continue
            name = " ".join(words[:2])
            cat = row["カテゴリー"]
            threatened = any(t in cat for t in ("（CR）", "（EN）", "（VU）", "（CR+EN）", "(CR)", "(EN)", "(VU)", "(CR+EN)"))
            recs = get("AphiaRecordsByName/" + urllib.parse.quote(name), base="https://www.marinespecies.org/rest/", like="false", marine_only="false")
            valid = recs[0].get("valid_AphiaID") if isinstance(recs, list) and recs else None
            if valid is None:
                continue
            prev = out.get(str(valid))
            if prev is None or (threatened and not prev["threatened"]):
                out[str(valid)] = {"name": name, "category": cat.strip(), "threatened": threatened, "file": f.split("/")[-1]}
    (HERE / "jp_lists.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(out), "JP-listed taxa resolved;", sum(v["threatened"] for v in out.values()), "threatened")


def analyse() -> None:
    from scipy.stats import binomtest, fisher_exact, mannwhitneyu
    res = json.loads((HERE / "trend_results.json").read_text(encoding="utf-8"))
    jpl = json.loads((HERE / "jp_lists.json").read_text(encoding="utf-8"))
    excluded_reasons = {"no_comparable_cells", "past_records_below_minimum"}
    rows = list(res.values())
    comp = [r for r in rows if r["trend"]["class"] != "data_check_failed" and r["trend"].get("reason") not in excluded_reasons]
    sig = lambda r: r["trend"]["class"] == "decline_signal"

    def rate(group):
        k, n = sum(map(sig, group)), len(group)
        ci = binomtest(k, n).proportion_ci(method="exact") if n else None
        return {"signal": k, "n": n, "share": round(k / n, 3) if n else None, "ci95": [round(ci.low, 3), round(ci.high, 3)] if ci else None}

    def test(t, l):
        table = [[sum(map(sig, t)), len(t) - sum(map(sig, t))], [sum(map(sig, l)), len(l) - sum(map(sig, l))]]
        odds, p = fisher_exact(table, alternative="greater") if t and l else (None, None)
        return {"table_[[T_sig,T_none],[L_sig,L_none]]": table, "odds_ratio": odds if odds is None or math.isfinite(odds) else "inf",
                "p_one_sided": p, "sensitivity_T": rate(t), "false_alarm_L": rate(l)}

    T = {"CR", "EN", "VU"}
    P = [r for r in comp if r["group"] == "P"]
    PT, PL = [r for r in P if r["iucn"] in T], [r for r in P if r["iucn"] == "LC"]
    primary = test(PT, PL)
    primary["n_threatened_computable"] = len(PT)
    primary["verdict"] = "PASS" if len(PT) >= 10 and primary["p_one_sided"] is not None and primary["p_one_sided"] < 0.05 else (
        "FAIL (not testable: fewer than 10 threatened)" if len(PT) < 10 else "FAIL (p >= 0.05)")
    ratios = lambda g: [r["trend"]["reporting_rate_ratio"] for r in g]
    s1 = mannwhitneyu(ratios(PT), ratios(PL), alternative="less") if PT and PL else None
    A = comp
    AT, AL = [r for r in A if r["iucn"] in T], [r for r in A if r["iucn"] == "LC"]
    jt = [r for r in A if jpl.get(str(r["aphia_id"]), {}).get("threatened")]
    jn = [r for r in A if str(r["aphia_id"]) not in jpl]
    out = {"counts": {"candidates_computed": len(rows), "computable": len(comp),
                      "by_group_iucn_all": dict(Counter(f"{r['group']}:{r['iucn']}" for r in rows)),
                      "by_group_iucn_computable": dict(Counter(f"{r['group']}:{r['iucn']}" for r in comp)),
                      "not_computable_reasons": dict(Counter(r["trend"].get("reason") for r in rows if r not in comp)),
                      "data_check_failed": [r["name"] for r in rows if r["trend"]["class"] == "data_check_failed"],
                      "class_by_group": dict(Counter(f"{r['group']}:{r['trend']['class']}" for r in comp))},
           "primary_P": primary,
           "S1_mannwhitney_P_T_less_than_L": {"U": s1.statistic, "p": s1.pvalue, "median_T": sorted(ratios(PT))[len(PT)//2] if PT else None,
                                               "median_L": sorted(ratios(PL))[len(PL)//2] if PL else None} if s1 else None,
           "S2_P_plus_Elasmobranchii": test(AT, AL),
           "S3_japan_moe": test(jt, jn),
           "S4_NT_DD": {c: rate([r for r in A if r["iucn"] == c]) for c in ("NT", "DD")}}
    (HERE / "results.json").write_text(json.dumps(out, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False, indent=1, default=str))
    cols = ["group", "class", "name", "aphia_id", "iucn", "jp", "cells", "past", "recent", "E_past", "E_recent", "ratio", "ci_low", "ci_high",
            "dataset_check_ratio", "dataset_past_share", "trend_class", "reason"]
    lines = ["\t".join(cols)]
    for r in sorted(rows, key=lambda r: (r["group"], r["iucn"] not in T, r["iucn"], r["name"])):
        t = r["trend"]
        dc = t.get("dataset_check", {})
        lines.append("\t".join(map(str, [r["group"], r["class"], r["name"], r["aphia_id"], r["iucn"],
                                          jpl.get(str(r["aphia_id"]), {}).get("category", ""), t.get("cells_compared"),
                                          t.get("species_records", {}).get("past"), t.get("species_records", {}).get("recent"),
                                          t.get("effort_records", {}).get("past"), t.get("effort_records", {}).get("recent"),
                                          t.get("reporting_rate_ratio"), *(t.get("ci") or [None, None]), dc.get("reporting_rate_ratio"),
                                          dc.get("past_share"), t["class"], t.get("reason")])))
    (HERE / "results_table.tsv").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    {"select": select, "implcheck": implcheck, "trend": trend, "jp": jp, "analyse": analyse}[sys.argv[1]]()
