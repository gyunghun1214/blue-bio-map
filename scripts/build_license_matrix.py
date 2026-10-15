"""Build dist/license-matrix.json: the licence of every source the method tab lists, whether its stated licence allows
commercial use, where it is used, and how much of the site a commercial layer built only from CC0 / CC BY data would keep.

The rows are read from the same files the method tab reads (assessments.json report sources and each species' source
ids, the live snapshot's public citations and occurrence-cell datasets, the candidate cell release) plus the fixed
base-map lines of the method tab. A licence text is sorted into one of four groups by the ordered rules below; a text
no rule names stops the build, so a new source is never sorted silently. The groups read the licence as stated: they
are not a legal opinion, and anything not plainly open or plainly restricted is 'review' (확인 필요).

The commercial-layer count is a calculation only. It never changes a score, a matrix type or a map colour, and the
indicator build does not read this file. An indicator of a species counts as rebuildable in a scenario when every
source linked to that indicator in the report (its trace, plus the config cohorts the build adds) passes the scenario;
this is conservative, since a linked source that was only checked also counts. A map cell counts when at least one of
its accepted records carries a licence that passes. Offline.

Usage: python scripts/build_license_matrix.py [--check]
"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
DEFAULT_OUTPUT = DIST / "license-matrix.json"
SCHEMA = "license-matrix-1"
AXES = ("MFPI", "MBPI", "MCUI")
GROUPS = {
    "commercial_ok": "상업 이용 가능",
    "noncommercial": "상업 이용 불가",
    "permission": "허가 필요",
    "review": "확인 필요",
}
GROUP_NOTES = {
    "commercial_ok": "표시된 라이선스가 출처 표시 조건으로 상업 이용을 허락합니다(CC0·CC BY 계열, 퍼블릭 도메인, 공공누리 제1유형 등). CC BY-SA는 같은 조건(동일조건 변경허락)을 붙여야 합니다.",
    "noncommercial": "표시된 라이선스가 비상업 이용만 허락합니다(CC BY-NC 계열). 상업 서비스에 쓰려면 권리자의 별도 허락이 필요합니다.",
    "permission": "이용약관이 상업 이용에 기관의 별도 허가를 요구합니다(IUCN 적색목록, FAO 자료).",
    "review": "라이선스가 표시되지 않았거나 조건이 섞여 있어 상업 이용 범위를 확인해야 합니다(논문 수치·사실 인용, 정부·지자체 간행물 등).",
}
# Scenarios for the commercial-layer count, each a superset of the one before.
SCENARIOS = {
    "open": ("CC0·CC BY만", "CC0·CC BY 계열 출처만"),
    "open_sa": ("+ CC BY-SA", "CC0·CC BY + CC BY-SA(동일조건)"),
    "upper": ("+ 확인 필요(상한)", "위 + 확인 필요 출처 전부(확인 결과가 모두 '가능'일 때의 상한)"),
}

# Ordered (pattern, group, share_alike, basis). First match wins; patterns are matched case-insensitively.
RULES = [
    (r"IUCN Red List", "permission", False, "IUCN 적색목록 이용약관: 비상업 이용 허락, 상업 이용은 IUCN 사전 허가"),
    (r"^FAO ", "permission", False, "FAO 저작권 정책: 비상업 이용 허락, 상업 이용은 FAO 허가 요청"),
    (r"Per-dataset licences|records are CC0, CC BY 4\.0 or CC BY-NC", "noncommercial", False,
     "데이터셋별 CC0·CC BY·CC BY-NC 기록을 함께 집계(CC BY-NC 포함)"),
    (r"OBIS aggregate counts", "review", False, "OBIS 전체 기록 집계 수(데이터셋별 라이선스 혼합)"),
    (r"FSANZ AFCD data user licence", "review", False, "CC BY-SA 3.0 AU와 FSANZ 데이터 이용 약정이 함께 적용"),
    (r"ChEMBL CC BY-SA 3\.0 for the extracted values", "review", False, "논문은 출판사 저작권, 추출값은 ChEMBL CC BY-SA 3.0"),
    (r"CC BY-NC|non-?commercial|비영리", "noncommercial", False, "CC BY-NC 계열 라이선스"),
    (r"^CC BY-SA|ChEMBL data terms", "commercial_ok", True, "CC BY-SA: 출처 표시·동일조건 변경허락"),
    (r"^CC0|^CC BY(\b| 3\.0| 4\.0| ·)|^WoRMS attribution|^CC BY$", "commercial_ok", False, "CC0·CC BY 계열 라이선스"),
    (r"INSDC \(public domain\)|^Public INSDC", "commercial_ok", False, "INSDC 서열 기록: 퍼블릭 도메인"),
    (r"public domain|^BSD|SIL OFL", "commercial_ok", False, "퍼블릭 도메인 또는 상업 이용을 허락하는 공개 라이선스"),
    (r"KOGL Type 1|공공누리 제1유형", "commercial_ok", False, "공공누리 제1유형: 출처 표시"),
    (r"이용허락범위 제한 없음", "commercial_ok", False, "공공데이터포털: 이용허락범위 제한 없음"),
    (r"政府標準利用規約", "commercial_ok", False, "일본 정부 표준 이용약관(CC BY 4.0 호환)"),
    (r"NASA", "commercial_ok", False, "NASA 영상: 출처 표시, NASA 보증 암시 금지"),
    (r"GEBCO", "commercial_ok", False, "GEBCO 격자: 출처 표시, 항해용 사용 금지"),
    (r"공공누리 제3유형", "review", False, "공공누리 제3유형: 출처 표시·변경 금지(셀 집계가 변경에 해당하는지 확인)"),
    (r"Publisher|출판사|Open Access|University repository|Patent|SPC information|Bibliographic|No open licence", "review", False,
     "논문·간행물: 공개 라이선스 표시 없음, 수치·짧은 사실만 기록"),
    (r"지방정부|공식 공보|Government|Russian|MEXT|KOSIS", "review", False, "정부·지자체 자료: 재이용 조건 표시 없음 또는 확인 전"),
    (r"email|이메일|DBAASP|Europe PMC|NCBI", "review", False, "데이터베이스 자체 이용 정책 또는 담당자 회신(공개 라이선스 아님)"),
    (r".", "review", False, "라이선스 표시 없음 또는 조건 혼합"),
]
# The method tab's fixed base-map line (dist/index.html, '배경 지도'): these do not come from a data file.
BASE_LAYERS = [
    {"id": "natural-earth-10m", "title": "Natural Earth 1:10m 국가 경계", "provider": "Natural Earth",
     "license": "Natural Earth public domain", "license_url": "https://www.naturalearthdata.com/about/terms-of-use/",
     "uses": ["육지 경계·셀 바다 부분"]},
    {"id": "nasa-gibs-blue-marble", "title": "NASA GIBS Blue Marble 위성 타일", "provider": "NASA GIBS",
     "license": "NASA imagery (acknowledgement requested)", "license_url": "https://nasa-gibs.github.io/gibs-api-docs/",
     "uses": ["배경 지도(위성)"]},
    {"id": "gebco-2026-wms", "title": "GEBCO_2026 Grid WMS 수심", "provider": "GEBCO Compilation Group",
     "license": "GEBCO Grid terms (attribution; not for navigation)", "license_url": "https://www.gebco.net/data-products/gebco-web-services/web-map-service",
     "uses": ["배경 지도(수심)"]},
    {"id": "nasa-eo-blue-black-marble", "title": "NASA Earth Observatory Blue Marble NG · Black Marble 2016", "provider": "NASA Earth Observatory",
     "license": "NASA imagery (acknowledgement requested)", "license_url": "https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/",
     "uses": ["첫 화면 지구 영상"]},
    {"id": "leaflet", "title": "Leaflet 지도 도구", "provider": "Leaflet", "license": "BSD-2-Clause",
     "license_url": "https://github.com/Leaflet/Leaflet/blob/main/LICENSE", "uses": ["화면 도구"]},
    {"id": "pretendard", "title": "Pretendard 글꼴", "provider": "Pretendard", "license": "SIL OFL 1.1",
     "license_url": "https://github.com/orioncactus/pretendard/blob/main/LICENSE", "uses": ["화면 글꼴"]},
]
LICENCE_URL = {"CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
               "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
               "CC BY-NC 4.0": "https://creativecommons.org/licenses/by-nc/4.0/"}
# Report keys whose subtree feeds each indicator (dist/assessments.json species rows).
AXIS_KEYS = {
    "MFPI": ("food_trace",),
    "MBPI": ("bioactivity_partial", "bioactivity_trace", "chembl_links", "evidence_profile", "mbpi_breadth", "mbpi_floor",
             "mbpi_rx", "mbpi_stratum"),
    "MCUI": ("conservation_status", "conservation_trace", "mcui_driver", "mcui_extinction_risk", "mcui_substitute",
             "national_assessment", "national_red_list_fact", "occurrence_trend", "stock_decline"),
}
# Config sections whose source ids the indicator build adds to a species without naming them in its trace.
CONFIG_AXIS = {"nutrition": "MFPI", "chembl_bioactivity": "MBPI", "peptide_bioactivity": "MBPI", "amp_bioactivity": "MBPI",
               "anticancer_bioactivity": "MBPI", "xo_bioactivity": "MBPI", "relaxed_bioactivity": "MBPI"}
# build_verified_indices.py adds this one by AphiaID (감태 compound origin).
FIXED_AXIS = {"worms_ecklonia": "MBPI"}
IUCN_TERMS_URL = "https://www.iucnredlist.org/terms/terms-of-use"


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def classify(licence: str) -> dict:
    for pattern, group, sa, basis in RULES:
        if re.search(pattern, licence or "", re.I):
            tier = ("open_sa" if sa else "open") if group == "commercial_ok" else None
            return {"group": group, "share_alike": sa, "tier": tier, "basis": basis}
    raise ValueError(f"no licence rule for {licence!r}")


def passes(row: dict, scenario: str) -> bool:
    if scenario == "open":
        return row["tier"] == "open"
    if scenario == "open_sa":
        return row["tier"] in ("open", "open_sa")
    return row["group"] in ("commercial_ok", "review")


def strings(node):
    if isinstance(node, dict):
        for v in node.values():
            yield from strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from strings(v)
    elif isinstance(node, str):
        yield node


def config_axes(config: dict) -> dict:
    out = dict(FIXED_AXIS)
    for section, axis in CONFIG_AXIS.items():
        for text in strings(config.get(section, {})):
            out.setdefault(text, axis)
    return out


def axis_links(species: dict, known: set, from_config: dict) -> dict:
    """Source ids linked to each indicator of one species."""
    links = {axis: set() for axis in AXES}
    for axis, keys in AXIS_KEYS.items():
        for key in keys:
            links[axis] |= {t for t in strings(species.get(key)) if t in known}
    traced = set().union(*links.values())
    other = set()
    for sid in species["source_ids"]:
        if sid in traced:
            continue
        axis = from_config.get(sid)
        if axis:
            links[axis].add(sid)
        else:
            other.add(sid)
    links["other"] = other
    return links


def blocker_list(bucket: dict) -> list:
    """Sources that keep an indicator out of a scenario, one entry per provider (several FAO pages are one FAO line), with
    the number of distinct species they hold out."""
    out = [{"name": name, "species": len({a for a, _ in pairs}), "sources": sorted({sid for _, sid in pairs})}
           for name, pairs in bucket.items()]
    return sorted(out, key=lambda x: (-x["species"], x["name"]))


def spatial(cell_code: str) -> str:
    return ":".join(cell_code.split(":")[:2])


def build(report: dict, config: dict, live: dict, release: dict, readiness: dict) -> dict:
    sources = report["sources"]
    species = report["species"] + report["candidate_species"]
    require(len({s["aphia_id"] for s in species}) == len(species), "duplicate species in the report")
    from_config = config_axes(config)
    links = {s["aphia_id"]: axis_links(s, set(sources), from_config) for s in species}
    unplaced = sorted({sid for l in links.values() for sid in l["other"]})
    require(not unplaced, f"report source ids with no indicator: {unplaced}")
    names = {s["aphia_id"]: s["korean_name"] for s in species}

    rows = {}

    def add(key, title, provider, licence, url, licence_url, origin, uses, sp=()):
        row = rows.get(key)
        if row is None:
            row = rows[key] = {"id": key, "title": title, "provider": provider, "license": licence, "url": url,
                               "license_url": licence_url, "origin": origin, **classify(licence), "uses": set(), "species": set()}
        row["uses"] |= set(uses)
        row["species"] |= set(sp)

    # 1. Indicator sources: the report registry, used through each species' indicator links.
    for aphia, l in links.items():
        for axis in AXES:
            for sid in l[axis]:
                src = sources[sid]
                add(f"report:{sid}", src.get("title") or src.get("provider") or sid, src.get("provider"), src.get("license") or "",
                    src.get("url"), src.get("license_url"), "지표 보고서 출처", [axis], [aphia])
    # 2. Scientific names (WoRMS), one row for every species.
    add("worms-taxonomy", "WoRMS 종별 학명", "World Register of Marine Species", "CC BY 4.0", "https://www.marinespecies.org/",
        "https://www.marinespecies.org/about.php", "종별 학명", ["학명"], names)
    # 3. Live snapshot: profile citations (species detail summaries) and occurrence-cell datasets.
    by_species_id = {p["species_id"]: int(p["aphia_id"]) for p in live["profiles"]}
    for p in live["profiles"]:
        for c in p["public_citations"]:
            if c["id"] == "worms-taxonomy":
                continue
            add(f"live:{c['id']}:{c.get('license')}", c.get("title"), None, c.get("license") or "", c.get("url"), c.get("licenseUrl"),
                "운영 종 공개 인용", ["종 상세 요약(운영 종)"], [int(p["aphia_id"])])
    cells = []  # (aphia, spatial cell, licences)
    for c in live["cells"]:
        aphia = by_species_id[c["species_id"]]
        lic = set()
        for x in c["citations"]:
            lic |= set(x["licenses"])
            for one in x["licenses"]:
                add(f"cells:{x['url']}:{one}", x["title"], "GBIF·OBIS 데이터셋", one, x["url"], LICENCE_URL.get(one),
                    "출현 기록 데이터셋", ["출현 지도 셀"], [aphia])
        cells.append((aphia, spatial(c["cell_code"]), lic))
    for e in release["species"]:
        for c in e["cells"]:
            cells.append((e["aphiaID"], f"deg{c['sizeDeg']}:N{c['lat0']}E{c['lon0']}", set(c["licenses"])))
            for x in c["citations"]:
                for one in x["licenses"]:
                    add(f"cells:{x['url']}:{one}", x["title"], x.get("source"), one, x["url"], LICENCE_URL.get(one),
                        "출현 기록 데이터셋", ["출현 지도 셀"], [e["aphiaID"]])
    # 4. Map overlays and the fixed base-map line.
    effort = read(DIST / "effort.json")
    add("effort-obis", "조사량 음영(OBIS 1° 칸별 전체 기록 수)", effort["source"], effort["license_note"], effort["source_url"], None,
        "지도 레이어", ["조사량 음영"])
    for b in BASE_LAYERS:
        add(b["id"], b["title"], b["provider"], b["license"], None, b["license_url"], "배경 지도·화면 도구", b["uses"])

    # Rows: CC BY-NC records of the cell datasets show as their own rows, so a dataset with mixed records appears twice.
    out_rows = []
    for row in rows.values():
        out_rows.append({**{k: v for k, v in row.items() if k not in ("uses", "species")},
                         "group_label": GROUPS[row["group"]], "uses": sorted(row["uses"]), "species_count": len(row["species"])})
    order = list(GROUPS)
    out_rows.sort(key=lambda r: (order.index(r["group"]), r["origin"], r["title"] or "", r["id"]))

    # Commercial-layer count.
    by_key = {r["id"]: r for r in out_rows}
    types = {s["aphia_id"]: s.get("matrix_type") for s in readiness["species"]}
    layer = {"scenarios": [{"id": k, "label": v[0], "detail": v[1]} for k, v in SCENARIOS.items()], "species_total": len(species), "indicators": {}}
    ok = {sc: {} for sc in SCENARIOS}
    for axis in AXES + ("BBVI", "matrix_type"):
        entry = {"published": 0, **{sc: 0 for sc in SCENARIOS}}
        blockers, hard = defaultdict(set), defaultdict(set)
        for s in species:
            aphia = s["aphia_id"]
            published = types.get(aphia) is not None if axis == "matrix_type" else s["scores"].get(axis) is not None
            if not published:
                continue
            entry["published"] += 1
            for sc in SCENARIOS:
                if axis in AXES:
                    good = all(passes(by_key[f"report:{sid}"], sc) for sid in links[aphia][axis])
                elif axis == "BBVI":
                    good = ok[sc][(aphia, "MFPI")] and ok[sc][(aphia, "MBPI")]
                else:
                    good = ok[sc][(aphia, "BBVI")] and ok[sc][(aphia, "MCUI")]
                ok[sc][(aphia, axis)] = good
                entry[sc] += good
            if axis in AXES:
                for sid in links[aphia][axis]:
                    row = by_key[f"report:{sid}"]
                    for scenario, bucket in (("open", blockers), ("upper", hard)):
                        if not passes(row, scenario):
                            bucket[row["provider"] or row["title"] or sid].add((aphia, f"report:{sid}"))
        if axis in AXES:
            entry["open_blockers"] = blocker_list(blockers)
            # what still blocks when every 'review' source turns out usable: the non-commercial and permission sources
            entry["upper_blockers"] = blocker_list(hard)
        layer["indicators"][axis] = entry

    def cell_summary(rows_):
        out = {}
        for sc in ("all",) + tuple(SCENARIOS):
            keep = [(a, c) for a, c, lic in rows_ if sc == "all" or any(
                classify(x)["tier"] in (("open",) if sc == "open" else ("open", "open_sa")) for x in lic)]
            out[sc] = {"species": len({a for a, _ in keep}), "species_cells": len(set(keep)), "grid_cells": len({c for _, c in keep})}
        return out

    layer["map_cells"] = {"by_resolution": {f"{d}°": cell_summary([r for r in cells if r[1].startswith(f"deg{d}:")]) for d in (1, 4)},
                          "total": cell_summary(cells)}
    # '활용 × 보전' colour layer: a cell keeps a colour only through a species whose matrix type is rebuildable.
    typed = {}
    for sc in SCENARIOS:
        keep = {c for a, c, lic in cells if ok[sc].get((a, "matrix_type")) and any(
            classify(x)["tier"] in (("open",) if sc == "open" else ("open", "open_sa")) for x in lic)}
        typed[sc] = len(keep)
    typed["all"] = len({c for a, c, _ in cells if types.get(a)})
    layer["value_layer_cells"] = typed

    groups = {g: {"label": GROUPS[g], "note": GROUP_NOTES[g], "rows": sum(r["group"] == g for r in out_rows)} for g in GROUPS}
    review_items = [{
        "id": "iucn-redisplay", "title": "IUCN 적색목록 범주를 공개 사이트에 다시 게시할 수 있는 범위",
        "status": "확인 필요", "url": IUCN_TERMS_URL,
        "detail": "MCUI와 종 상세에 IUCN 범주(예: EN·VU·LC)와 평가 연도를 적고 있습니다. 이용약관이 비상업 공개 사이트의 범주 재게시를 어디까지 허락하는지, 상업 서비스에는 어떤 허가가 필요한지 원문으로 확인해야 합니다.",
        "sources": sorted(r["id"] for r in out_rows if r["group"] == "permission" and "IUCN" in r["license"])}]
    review_items += [{"id": r["id"], "title": r["title"], "status": "확인 필요", "url": r["license_url"] or r["url"],
                      "detail": r["basis"], "license": r["license"]} for r in out_rows if r["group"] == "review"]
    return {
        "schema": SCHEMA,
        "generated_from": {"assessments": report["method_version"], "assessments_generated_at": report["generated_at"],
                           "live_snapshot": live["fetched_at"], "candidate_cells": release["reviewedOn"],
                           "config": f"verified-indices-v{report['method_version'].removeprefix('verified-')}.json"},
        "scope_note": "출처마다 표시된 라이선스를 읽은 분류입니다. 법률 판단이 아니며, 불확실한 항목은 '확인 필요'로 둡니다. 계산만 하고 공개 점수·유형·지도 색은 바꾸지 않습니다.",
        "groups": groups,
        "rows": out_rows,
        "commercial_layer": layer,
        "review_items": review_items,
    }


def render(doc: dict) -> str:
    return json.dumps(doc, ensure_ascii=False, indent=1, sort_keys=False) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="compare existing output without writing")
    args = parser.parse_args()
    report = read(DIST / "assessments.json")
    config = read(ROOT / "config" / f"verified-indices-v{report['method_version'].removeprefix('verified-')}.json")
    content = render(build(report, config, read(DIST / "live-snapshot.json"), read(DIST / "expansion-public-cells.json"),
                           read(DIST / "matrix-readiness.json")))
    if args.check:
        require(args.out.read_text(encoding="utf-8") == content, "licence matrix differs from reproducible build")
        print("Reproducible licence matrix matches committed output")
    else:
        args.out.write_text(content, encoding="utf-8")
        doc = json.loads(content)
        print(f"Wrote {args.out}: {len(doc['rows'])} rows, " + ", ".join(f"{g['label']} {g['rows']}" for g in doc["groups"].values()))


if __name__ == "__main__":
    main()
