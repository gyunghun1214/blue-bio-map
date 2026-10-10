"""Build dist/expedition-stops.json for the sea expedition page from the released public files.

Values are copied, never computed: scores, labels and evidence come from dist/assessments.json (`species` = the 8
released species, `candidate_species` = the 22 survey candidates), the matrix type from dist/matrix-readiness.json and
the observation cell from dist/live-snapshot.json (released species) or dist/expansion-public-cells.json (candidates).
A missing value stays None with its reason; it is never written as zero. --check rebuilds and compares without writing.

A stop sits on the centre of one published cell (1 deg or 4 deg extent, never a record coordinate): a cell inside the
Korean test box whose centre is at sea; candidate cells must also be from 2000 on (not `historical`) and inside the
Korean EEZ (not `outsideKoreanEEZ`). Cells are handed out one species at a time, best cell (most records) first:
1. the 8 released species, as before: the three v1 stops, then the others by the record count of their top cell; a
   centre already taken goes to the species' next cell (released stops never share a centre);
2. then the candidates by the record count of their top cell: the species' best cell whose centre is still free (an
   empty centre wins over a larger record count, so stops show different seas; team-lead decision 2026-10-10), and
   only when every centre of the species is taken, its top cell, shared (`shared_with` lists the other stops there).
A species with no eligible cell stays a stop off the route: cell None with `cell_missing_reason`, scores and evidence
kept, and a map link that selects the species without a position. Adding a species = adding its AphiaID to STOPS.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist/expedition-stops.json"
# Every species in assessments.json (released and candidates), in sailing order (west -> south -> east), the stop
# off the route last. Reasons: docs/expedition/design.md.
STOPS = (219984, 1061762, 231750, 275816, 274849, 281273, 145086, 127022, 494972, 504357,
         836033, 234476, 836041, 413600, 342067, 1666974, 145721, 506159, 241776, 254538,
         250680, 276651, 236157, 393716, 377084, 397082, 371986, 494853, 372119, 534443)
# The three v1 stops pick their cell first so they keep the place they had.
FIRST_PICK = (836033, 145721, 241776)
AXES = ("MFPI", "MBPI", "MCUI", "BBVI")
NUTRIENTS = (("protein_g", "단백질"), ("iron_mg", "철"), ("zinc_mg", "아연"), ("calcium_mg", "칼슘"))
# Same box as the page's public cell rule (live-data.js validCell).
BOX = {"lat_min": 33, "lat_max": 38.7, "lon_min": 124, "lon_max": 132}
MCUI_BASIS = {"iucn": "IUCN 전 지구 평가", "national": "한국 국가 평가", "sub_national": "지방 목록 참고값",
              "range_state": "서식국 국가 평가", "preliminary": "자체 예비평가"}
MBPI_NOTE = "보고된 화합물의 공개 생리활성(잠재력) · 종 추출물의 효능 아님"
CELL_NOTE = "공개 집계 셀 · 관측 기록이며 현재 서식을 뜻하지 않음 · 정확한 좌표 아님"
SCORE_NOTE = "종 전체 값 · 이 해역 값 아님"
NO_CELL = "셀 중심이 바다인 공개 셀 없음"
CELL_RE = re.compile(r"^deg(1|4):N(-?\d+)E(-?\d+):")


def _read(name):
    return json.loads((ROOT / "dist" / name).read_text(encoding="utf-8"))


def _rings(countries):
    for f in countries["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            yield poly[0]  # outer ring; lakes do not matter for a sea test


def _inside(lon, lat, ring):
    hit = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > lat) != (y2 > lat) and lon < x1 + (lat - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def _cell(row, sea_names):
    m = CELL_RE.match(row["cell_code"])
    if not m:
        return None
    size, lat0, lon0 = int(m[1]), int(m[2]), int(m[3])
    seas = row.get("sea_areas") or sea_names.get(f"{lat0},{lon0},{size}") or []
    return {"code": row["cell_code"], "size_deg": size, "lat0": lat0, "lon0": lon0,
            "center": [lat0 + size / 2, lon0 + size / 2],
            "period": f"{str(row['period_start'])[:4]}–{str(row['period_end'])[:4]}",
            "year_start": row["year_start"], "year_end": row["year_end"],
            "records": row["record_count"], "sites": row["site_count"], "sea_areas": seas,
            "citations": [{"title": c["title"], "url": c["url"], "licenses": c.get("licenses") or []}
                          for c in row.get("citations") or []]}


def _exp_cell(c):
    """A candidate cell from expansion-public-cells.json in the same shape as _cell()."""
    s = c["sizeDeg"]
    # made code (not in the source file): same shape as live-snapshot cell_code, ending in the period's first 4
    # characters; only non-historical cells become stops, so the "2000년 이전" period never gets one
    return {"code": f"deg{s}:N{c['lat0']}E{c['lon0']}:{c['period'][:4]}", "size_deg": s, "lat0": c["lat0"],
            "lon0": c["lon0"], "center": [c["lat0"] + s / 2, c["lon0"] + s / 2], "period": c["period"],
            "year_start": c["yearStart"], "year_end": c["yearEnd"], "records": c["records"], "sites": c["sites"],
            "sea_areas": c.get("seaAreas") or [],
            "citations": [{"title": x["title"], "url": x["url"], "licenses": x.get("licenses") or []}
                          for x in c.get("citations") or []]}


def _in_box(c):
    s = c["size_deg"]
    return (c["lat0"] + s > BOX["lat_min"] and c["lat0"] <= BOX["lat_max"]
            and c["lon0"] + s > BOX["lon_min"] and c["lon0"] <= BOX["lon_max"])


def _source(sources, sid):
    s = sources.get(sid)
    if not s:
        return {"id": sid, "title": None, "url": None, "license": None}
    return {"id": sid, "title": s.get("title"), "url": s.get("url"), "license": s.get("license")}


def _mcui(sp, sources):
    basis = sp.get("mcui_basis")
    out = {"basis": basis, "basis_label": MCUI_BASIS.get(basis), "category": None, "assessment_year": None,
           "criteria": None, "scope": None, "mapping": None, "label": None, "source": None}
    if basis == "iucn":
        t = sp["conservation_trace"]
        out.update(category=t.get("category"), assessment_year=t.get("assessment_year"), criteria=t.get("criteria"),
                   scope=t.get("scope"), mapping=t.get("pilot_mapping"), source=_source(sources, t.get("source_id")))
    elif basis == "national":
        t = sp["national_assessment"]
        out.update(category=t.get("category"), scope=t.get("scope"), mapping=t.get("pilot_mapping"),
                   label=t.get("label"), source=_source(sources, t.get("source_id")))
    elif sp.get("mcui_substitute"):
        t = sp["mcui_substitute"]
        record = t.get("record") or {}
        region = (record.get("regions") or [{}])[0]
        # sub_national: the regional list; range_state: the range country's national list (record.source_id);
        # preliminary: the method paper (record.method_source_id). The GBIF/OBIS data source in t["source_ids"] is
        # left out: it has no title and its url holds two endpoints in one string.
        sid = region.get("source_id") or record.get("source_id") or record.get("method_source_id")
        out.update(category=t.get("category"), mapping=t.get("pilot_mapping"), label=t.get("label"),
                   scope=region.get("region_ko"), source=_source(sources, sid) if sid else None)
    return out


def _food(sp, sources):
    f = sp.get("food_trace") or {}
    nut = f.get("nutrients") or {}
    rows = []
    for key, label in NUTRIENTS:
        n = nut.get(key)
        rows.append({"key": key, "label": label, "value": n["value"], "unit": n["unit"], "percentile": n["percentile"]}
                    if n else {"key": key, "label": label, "value": None, "unit": None, "percentile": None})
    aq = f.get("aquaculture") or {}
    return {"food_name": f.get("reported_food_name"), "basis": f.get("basis"), "cohort_species": f.get("cohort_species"),
            "nutrients": rows, "edible_fraction": (f.get("edible_fraction") or {}).get("value"),
            "aquaculture": {"feasible": aq.get("feasible"), "method": aq.get("method")} if aq else None,
            "source": _source(sources, f.get("source_id")) if f.get("source_id") else None}


def _bio(sp):
    trace = sp.get("bioactivity_trace") or []
    if not trace:
        return None
    b = max(trace, key=lambda x: x["adjusted"])  # app.js bestBio: the top item sets MBPI
    m = (b.get("measurements") or [{}])[0]
    subject = b.get("peptide_name") or b.get("peptide_sequence") or b.get("compound_name") or b.get("compound_id")
    dois = b.get("original_paper_dois") or []
    return {"stratum_kind": b.get("stratum_kind"), "subject": subject,
            "target": b.get("target_name") or m.get("target") or b.get("target_species"),
            "endpoint": b.get("standard_type") or m.get("endpoint"), "relation": m.get("relation"),
            "value": m.get("value") if b.get("stratum_kind") != "chembl" else None, "unit": m.get("unit"),
            "median_pchembl": b.get("median_pchembl"), "percentile": b.get("percentile"),
            "evidence_factor": b.get("evidence_factor"), "dois": dois,
            "links": [f"https://doi.org/{d}" for d in dois]}


def build():
    report, readiness = _read("assessments.json"), _read("matrix-readiness.json")
    snap, sea = _read("live-snapshot.json"), _read("cell-sea-areas.json")
    exp_file = _read("expansion-public-cells.json")
    expansion = {s["aphiaID"]: s for s in exp_file["species"]}
    rings = list(_rings(_read("countries.json")))
    sea_names = sea["cells"] if sea.get("schemaVersion") == "cell-sea-areas-1" else {}
    released = {s["aphia_id"] for s in report["species"]}
    species = {s["aphia_id"]: s for s in report["species"] + (report.get("candidate_species") or [])}
    types = {t["id"]: t["label"] for t in report["method"]["matrix"]["types"].values()}
    mx = {s["aphia_id"]: s for s in readiness["species"]}
    sets = report["method"]["posthoc"]["validation_sets"]
    check = {k: sets.get(k, {}).get("result") if sets.get(k, {}).get("result") in ("passed", "failed") else None
             for k in ("MFPI", "MBPI")}
    check["BBVI"] = ("passed" if check["MFPI"] == check["MBPI"] == "passed"
                     else "failed" if "failed" in (check["MFPI"], check["MBPI"]) else None)
    profile = {p["aphia_id"]: p["species_id"] for p in snap["profiles"]}
    rank = lambda c: (c["records"], c["year_end"], c["code"])
    at_sea = lambda c: _in_box(c) and not any(_inside(c["center"][1], c["center"][0], r) for r in rings)
    cells, candidates = {}, {}
    for aphia in STOPS:
        if aphia in released:
            cells[aphia] = [c for c in (_cell(r, sea_names) for r in snap["cells"] if r["species_id"] == profile[aphia]) if c]
            eligible = [c for c in cells[aphia] if at_sea(c)]
            if not eligible:
                raise ValueError(f"{aphia}: no public cell with its centre at sea")
        else:
            rows = expansion[aphia]["cells"]
            cells[aphia] = [_exp_cell(r) for r in rows]
            eligible = [c for r, c in zip(rows, cells[aphia]) if not r["historical"] and not r["outsideKoreanEEZ"] and at_sea(c)]
        candidates[aphia] = sorted(eligible, key=rank, reverse=True)
    ops = [a for a in STOPS if a in released]
    rest = sorted((a for a in ops if a not in FIRST_PICK), key=lambda a: rank(candidates[a][0]), reverse=True)
    # AphiaID breaks a tie of two top cells with the same records, year and code (the order of a shared cell)
    survey = sorted((a for a in STOPS if a not in released and candidates[a]),
                    key=lambda a: (rank(candidates[a][0]), a), reverse=True)
    chosen, holders = {}, {}
    for aphia in FIRST_PICK + tuple(rest) + tuple(survey):
        free = [c for c in candidates[aphia] if tuple(c["center"]) not in holders]
        if not free and aphia in released:
            raise ValueError(f"{aphia}: every public cell centre at sea is already another stop")
        chosen[aphia] = free[0] if free else candidates[aphia][0]
        holders.setdefault(tuple(chosen[aphia]["center"]), []).append(aphia)
    stops = []
    for order, aphia in enumerate(STOPS, 1):
        sp = species[aphia]
        cell = chosen.get(aphia)
        if cell:
            lat, lon = cell["center"]
            link = f"index.html#s={aphia}&v=explore&m={8 if cell['size_deg'] == 1 else 6}/{lat:.2f}/{lon:.2f}"
        else:
            link = f"index.html#s={aphia}&v=explore"  # app.js applyHash selects the species without a position
        sources = [_source(report["sources"], sid) for sid in sp.get("source_ids") or []]
        stops.append({
            "order": order, "aphia_id": aphia, "korean_name": sp["korean_name"], "scientific_name": sp["scientific_name"],
            "group": "operational" if aphia in released else "candidate", "candidate_label": sp.get("candidate_label"),
            "matrix_type": {"id": mx[aphia]["matrix_type"], "label": types.get(mx[aphia]["matrix_type"])},
            "scores": {k: sp["scores"].get(k) for k in AXES},
            "score_status": sp.get("score_status"), "withheld_reasons": sp.get("withheld_reasons"),
            "bbvi_label": sp.get("bbvi_label"), "information_sufficiency": (sp.get("information_sufficiency") or {}).get("mean_ratio"),
            "mcui": _mcui(sp, report["sources"]), "food": _food(sp, report["sources"]), "bio": _bio(sp),
            "on_route": cell is not None, "cell": cell, "cell_missing_reason": None if cell else NO_CELL,
            "shared_with": [a for a in holders[tuple(cell["center"])] if a != aphia] if cell else [],
            "public_cells": len(cells[aphia]), "public_records": sum(c["records"] for c in cells[aphia]),
            "map_link": link, "sources": sources})
    off = [s["order"] for s in stops if not s["on_route"]]
    if off and off != list(range(len(stops) - len(off) + 1, len(stops) + 1)):
        raise ValueError(f"stops off the route must come last in STOPS: {off}")
    return {"schema_version": "expedition-stops-2", "method_version": report["method_version"], "status": report["status"],
            "assessments_snapshot": report["snapshot_date"], "candidate_snapshot": report.get("candidate_snapshot_date"),
            "cells_snapshot": snap["fetched_at"], "candidate_cells_reviewed": exp_file.get("reviewedOn"),
            "axis_checks": check, "mfpi_check_n": sets.get("MFPI", {}).get("n"), "food_weight": report.get("food_weight"),
            "notes": {"mbpi": MBPI_NOTE, "cell": CELL_NOTE, "score": SCORE_NOTE},
            "inputs": ["dist/assessments.json", "dist/matrix-readiness.json", "dist/live-snapshot.json",
                       "dist/expansion-public-cells.json", "dist/cell-sea-areas.json", "dist/countries.json"],
            "stops": stops}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="compare the committed file without writing")
    args = parser.parse_args()
    result = build()
    serialized = json.dumps(result, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
    if args.check:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != serialized:
            raise SystemExit("expedition-stops.json differs from the public inputs; run scripts/build_expedition_stops.py")
        print(f"Expedition stops match the public inputs: {len(result['stops'])} stops")
    else:
        OUT.write_text(serialized, encoding="utf-8")
        print(f"Wrote {OUT}: {len(result['stops'])} stops")


if __name__ == "__main__":
    main()
