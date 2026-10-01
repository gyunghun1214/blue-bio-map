"""Preliminary Rapid Least Concern check for candidates with no IUCN, Korean or range-state assessment (MCUI substitute).

For each species the GBIF occurrence API (accepted backbone key; geospatial issues, absences, fossil and living specimens
excluded) and the OBIS API (WoRMS AphiaID) are read inside a reviewed native-range box: records from 1990, coordinate
uncertainty unknown or at most 10 km, one point per rounded coordinate (4 decimals) and year across both services. From the
points it computes, on the Lambert cylindrical equal-area projection:
  - EOO: area of the minimum convex polygon (km2)
  - AOO: occupied 10 km x 10 km cells x 100 km2 (Bachman et al. 2020 use 10 km cells for georeference error)
  - records: unique coordinate records; countries: GBIF country codes
Thresholds follow Bachman et al. 2020 (Biodiversity Data Journal 8:e47018), citing the IUCN guidelines: EOO > 30,000 km2 and
AOO > 3,000 km2 are unlikely to trigger a threatened or Near Threatened category; 75 records are the data-adequacy floor.
Only counts and areas are written; raw coordinates are not stored. Network access lives here; the builder reads the snapshot.
"""
from __future__ import annotations

import argparse
import json
import math
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.gbif.org/v1"
OBIS = "https://api.obis.org/v3"
R = 6371.0088  # mean Earth radius, km
NW_PACIFIC = {"lat": [0, 60], "lon": [105, 165]}
# Native range boxes (reviewed): the northwest Pacific for every species, except kelp, whose populations south of
# Wonsan Bay (39 N) and in China are introduced and farmed (Hwang et al. 2018, ALGAE 33:101).
SPECIES = {
    145721: ("Undaria pinnatifida", NW_PACIFIC), 250680: ("Halocynthia roretzi", NW_PACIFIC),
    372119: ("Gelidium elegans", NW_PACIFIC), 494972: ("Sargassum fusiforme", NW_PACIFIC),
    377084: ("Saccharina japonica", {"lat": [38.5, 60], "lon": [128, 165]}), 371986: ("Ecklonia cava", NW_PACIFIC),
    234476: ("Ulva prolifera", NW_PACIFIC), 494853: ("Sargassum horneri", NW_PACIFIC),
    236157: ("Gracilaria vermiculophylla", NW_PACIFIC), 145086: ("Codium fragile", NW_PACIFIC),
    275816: ("Paralichthys olivaceus", NW_PACIFIC), 274849: ("Sebastes schlegelii", NW_PACIFIC),
    254538: ("Gadus macrocephalus", NW_PACIFIC), 1061762: ("Portunus trituberculatus", NW_PACIFIC),
}
# Back-test set: species that already have an IUCN or Korean national category (post-hoc validation of the method only;
# their MCUI never comes from this check).
BACKTEST = {
    241776: ("Apostichopus japonicus", NW_PACIFIC), 342067: ("Todarodes pacificus", NW_PACIFIC), 506159: ("Mytilus coruscus", NW_PACIFIC),
    836033: ("Magallana gigas", NW_PACIFIC), 231750: ("Ruditapes philippinarum", NW_PACIFIC), 397082: ("Haliotis discus", NW_PACIFIC),
    393716: ("Mizuhopecten yessoensis", NW_PACIFIC), 504357: ("Anadara broughtonii", NW_PACIFIC), 413600: ("Sinonovacula constricta", NW_PACIFIC),
    127022: ("Scomber japonicus", NW_PACIFIC), 219984: ("Engraulis japonicus", NW_PACIFIC), 281273: ("Larimichthys polyactis", NW_PACIFIC),
    276651: ("Seriola quinqueradiata", NW_PACIFIC), 1666974: ("Acanthosepion esculentum", NW_PACIFIC),
}
THRESHOLDS = {"eoo_km2": 30000, "aoo_km2": 3000, "aoo_cell_km": 10, "records": 75}
CAP = 20000  # GBIF paging stops near 100,000; 20,000 points bound the run and exceed every threshold by far


def get(url: str) -> dict:
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "blue-bio-map research (research@example.org)"})
            return json.load(urllib.request.urlopen(req, timeout=120))
        except OSError:
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"failed: {url}")


def project(lat: float, lon: float) -> tuple[float, float]:
    """Lambert cylindrical equal-area (km): areas are preserved, so hull and cell areas are true areas."""
    return R * math.radians(lon), R * math.sin(math.radians(lat))


def hull_area(points: list[tuple[float, float]]) -> float:
    pts = sorted(set(points))
    if len(pts) < 3:
        return 0.0
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]
    return abs(sum(hull[i][0] * hull[i - 1][1] - hull[i - 1][0] * hull[i][1] for i in range(len(hull)))) / 2


def keep(lat, lon, unc) -> bool:
    return lat is not None and lon is not None and (unc is None or unc <= 10000)


def gbif_points(name: str, box: dict) -> tuple[dict, set]:
    match = get(f"{API}/species/match?" + urllib.parse.urlencode({"name": name, "strict": "true"}))
    key = match.get("acceptedUsageKey") or match.get("usageKey")
    meta = {"name": match.get("scientificName"), "status": match.get("status"), "type": match.get("matchType"), "taxon_key": key}
    if not key:  # e.g. Ecklonia cava is not in the GBIF backbone; OBIS (WoRMS-based) still covers it
        return {**meta, "count": 0, "read": 0}, set()
    query = {"taxonKey": key, "hasCoordinate": "true", "hasGeospatialIssue": "false", "occurrenceStatus": "PRESENT",
             "year": "1990,2026", "decimalLatitude": f"{box['lat'][0]},{box['lat'][1]}",
             "decimalLongitude": f"{box['lon'][0]},{box['lon'][1]}"}
    points, total, offset = set(), 0, 0
    while offset < CAP:
        page = get(f"{API}/occurrence/search?" + urllib.parse.urlencode({**query, "limit": 300, "offset": offset}))
        total = page["count"]
        for r in page["results"]:
            if r.get("basisOfRecord") not in ("FOSSIL_SPECIMEN", "LIVING_SPECIMEN") and \
                    keep(r.get("decimalLatitude"), r.get("decimalLongitude"), r.get("coordinateUncertaintyInMeters")):
                points.add((round(r["decimalLatitude"], 4), round(r["decimalLongitude"], 4), r.get("year"), r.get("countryCode")))
        offset += 300
        if page.get("endOfRecords"):
            break
    return {**meta, "query": query, "count": total, "read": min(offset, total)}, points


def obis_points(aphia: int, box: dict) -> tuple[dict, set]:
    (s, n), (w, e) = box["lat"], box["lon"]
    query = {"taxonid": aphia, "startdate": "1990-01-01", "geometry": f"POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))",
             "size": 5000, "fields": "id,decimalLatitude,decimalLongitude,date_year,coordinateUncertaintyInMeters,country"}
    points, total, after = set(), 0, None
    while True:
        page = get(OBIS + "/occurrence?" + urllib.parse.urlencode({**query, **({"after": after} if after else {})}))
        total = page.get("total", total)
        rows = page.get("results", [])
        for r in rows:
            if keep(r.get("decimalLatitude"), r.get("decimalLongitude"), r.get("coordinateUncertaintyInMeters")):
                points.add((round(r["decimalLatitude"], 4), round(r["decimalLongitude"], 4), r.get("date_year"), None))
        if len(rows) < query["size"] or len(points) >= CAP:
            break
        after = rows[-1]["id"]
    return {"query": {k: v for k, v in query.items() if k != "fields"}, "count": total}, points


def collect(aphia: int, name: str, box: dict) -> dict:
    gbif, g = gbif_points(name, box)
    obis, o = obis_points(aphia, box)
    # one record per rounded coordinate and year across both services (OBIS holds many datasets also served by GBIF)
    merged = {(lat, lon, year) for lat, lon, year, _ in g | o}
    countries = sorted({c for *_, c in g if c})
    xy = [project(lat, lon) for lat, lon, _ in merged]
    cells = {(math.floor(x / THRESHOLDS["aoo_cell_km"]), math.floor(y / THRESHOLDS["aoo_cell_km"])) for x, y in xy}
    eoo, aoo = hull_area(xy), len(cells) * THRESHOLDS["aoo_cell_km"] ** 2
    return {"native_box": box, "gbif": gbif, "obis": obis, "records": len(merged), "countries_gbif": countries,
            "eoo_km2": round(eoo), "aoo_cells": len(cells), "aoo_km2": aoo,
            "likely_least_concern": eoo > THRESHOLDS["eoo_km2"] and aoo > THRESHOLDS["aoo_km2"] and len(merged) >= THRESHOLDS["records"]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "research" / "verified-indices" / "snapshots" / f"mcui-rapid-lc-{date.today()}.json")
    parser.add_argument("--only", type=int, nargs="*", help="AphiaIDs to collect (default: all)")
    parser.add_argument("--backtest", action="store_true", help="collect the assessed species for the post-hoc back-test instead")
    args = parser.parse_args()
    prior = json.loads(args.out.read_text(encoding="utf-8")) if args.out.exists() else {"species": {}}
    for aphia, (name, box) in (BACKTEST if args.backtest else SPECIES).items():
        if args.only and aphia not in args.only:
            continue
        prior["species"][str(aphia)] = {"scientific_name": name, **collect(aphia, name, box)}
        print(aphia, name, {k: prior["species"][str(aphia)][k] for k in ("records", "eoo_km2", "aoo_km2", "likely_least_concern")}, flush=True)
        args.out.write_text(json.dumps({**prior, "snapshot_date": str(date.today()), "thresholds": THRESHOLDS,
                                        "projection": "Lambert cylindrical equal-area, R = 6371.0088 km", "cap_records": CAP,
                                        "sources": {"gbif_rapid_lc": {
                                            "provider": "GBIF.org occurrence search API and OBIS API v3 (counts and areas derived for the Rapid LC check)",
                                            "url": f"{API}/occurrence/search ; {OBIS}/occurrence",
                                            "version": f"queried {date.today()}", "accessed": str(date.today()),
                                            "license": "records are CC0, CC BY 4.0 or CC BY-NC 4.0 per dataset; only counts and areas are stored",
                                            "terms": "GBIF data user agreement and OBIS data policy; derived counts only, cite GBIF.org and OBIS with the query"}}},
                                       ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
