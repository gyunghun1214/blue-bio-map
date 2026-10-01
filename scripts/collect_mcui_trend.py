"""Collect OBIS counts for the MCUI occurrence-trend check (verified-pilot-3.4; network).

For the 30 species (8 operating + the catalog's research candidates) and two 10-year periods, count per 1-degree
cell in the map extent: the species' OBIS records, the records of its WoRMS class (target-group survey effort) and
all-taxa records (sensitivity). For the dataset holding most of a species' past records, the species and class
counts within that dataset are kept too (dataset-turnover check). Effort counts come from the statistics endpoint
with a cell polygon, which counts a record on a cell edge in both cells; species records are assigned the same way.
Only per-cell counts, dataset IDs and year ranges are stored: no coordinates or record IDs.

Usage: PYTHONUTF8=1 python scripts/collect_mcui_trend.py [--cache DIR]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.obis.org/v3/"
UA = {"User-Agent": "BlueBioValueMap-research/1.0 (research@example.org)", "Accept": "application/json"}
LON = range(122, 136)  # cell west edges, same grid as scripts/build_effort.py
LAT = range(30, 43)    # cell south edges
BOX = "POLYGON((122 30,136 30,136 43,122 43,122 30))"
# Two 10-year windows: IUCN criterion A reads a reduction over 10 years or three generations.
PERIODS = {"past": ("2006-01-01", "2015-12-31"), "recent": ("2016-01-01", "2025-12-31")}
FIELDS = "id,decimalLatitude,decimalLongitude,date_year,dataset_id"


def get(cache: Path, path: str, **query) -> dict:
    url = API + path + "?" + urllib.parse.urlencode(query)
    hit = cache / (hashlib.sha256(url.encode()).hexdigest() + ".json")
    if hit.exists():
        return json.loads(hit.read_text(encoding="utf-8"))
    for wait in (10, 60, 300, None):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as response:
                data = json.load(response)
            break
        except (OSError, ValueError):
            if wait is None:
                raise
            time.sleep(wait)
    hit.write_text(json.dumps(data), encoding="utf-8")
    time.sleep(0.2)  # be gentle with the public API
    return data


def cell_ring(lat0: int, lon0: int) -> str:
    return f"POLYGON(({lon0} {lat0},{lon0 + 1} {lat0},{lon0 + 1} {lat0 + 1},{lon0} {lat0 + 1},{lon0} {lat0}))"


def cells_of(lat: float, lon: float) -> list[str]:
    """Every grid cell whose closed polygon holds the point, as the statistics endpoint counts it."""
    edge = lambda v: {math.floor(v)} | ({int(v) - 1} if v == int(v) else set())
    return [f"{a}/{b}" for a in sorted(edge(lat)) for b in sorted(edge(lon)) if a in LAT and b in LON]


def species_rows(cache: Path, aphia: int, start: str, end: str) -> list[tuple[list[str], str]]:
    query = {"taxonid": aphia, "geometry": BOX, "startdate": start, "enddate": end}
    expected = int(get(cache, "statistics", **query).get("records", 0))
    rows, after = [], None
    while len(rows) < expected:
        page = {**query, "size": 5000, "fields": FIELDS, **({"after": after} if after else {})}
        got = get(cache, "occurrence", **page)["results"]
        if not got:
            break
        rows += [(cells_of(r["decimalLatitude"], r["decimalLongitude"]), r.get("dataset_id") or "unknown") for r in got]
        after = got[-1]["id"]
    # the occurrence endpoint must return exactly the statistics count, or a filter was silently ignored
    assert len(rows) == expected, (aphia, start, len(rows), expected)
    return rows


def tally(rows: list[tuple[list[str], str]], dataset: str | None = None) -> dict:
    cells = Counter(c for cs, d in rows if dataset in (None, d) for c in cs)
    return {"records": sum(1 for cs, d in rows if cs and dataset in (None, d)),
            "outside_grid": sum(1 for cs, d in rows if not cs and dataset in (None, d)),
            "cells": dict(sorted(cells.items()))}


def worms_class_id(cache: Path, name: str) -> int:
    hit = cache / ("worms-" + hashlib.sha256(name.encode()).hexdigest() + ".json")
    if not hit.exists():
        url = "https://www.marinespecies.org/rest/AphiaIDByName/" + urllib.parse.quote(name) + "?marine_only=false"
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as response:
            hit.write_text(response.read().decode(), encoding="utf-8")
    return int(json.loads(hit.read_text(encoding="utf-8")))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", type=Path, default=Path("C:/bbvm-wf3/obis-trend-cache"))
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    stat = lambda **q: int(get(args.cache, "statistics", **q).get("records", 0))
    operating = json.loads((ROOT / "research/verified-indices/candidates.json").read_text(encoding="utf-8"))["candidates"]
    catalog = json.loads((ROOT / "dist/candidate-catalog.json").read_text(encoding="utf-8"))["species"]
    names = {c["aphia_id"]: c["scientific_name"] for c in operating} | {s["aphiaID"]: s["name"] for s in catalog}
    effort = {}
    for lat0 in LAT:
        for lon0 in LON:
            counts = {p: stat(geometry=cell_ring(lat0, lon0), startdate=s, enddate=e) for p, (s, e) in PERIODS.items()}
            if any(counts.values()):
                effort[f"{lat0}/{lon0}"] = counts
    classes = {a: c["class"] for a, c in json.loads((ROOT / "research/verified-indices/taxonomy.json").read_text(encoding="utf-8"))["species"].items()}
    class_ids = {c: worms_class_id(args.cache, c) for c in sorted(set(classes[str(a)] for a in names))}
    species = {}
    for aphia, name in names.items():
        whole = get(args.cache, "statistics", taxonid=aphia, geometry=BOX)
        rows = {p: species_rows(args.cache, aphia, s, e) for p, (s, e) in PERIODS.items()}
        entry = {"scientific_name": name, "class": classes[str(aphia)], "records_all_years": int(whole.get("records", 0)),
                 "yearrange": whole.get("yearrange"),
                 **{p: {**tally(rows[p]), "datasets": dict(sorted(Counter(d for _, d in rows[p]).items()))} for p in PERIODS}}
        past = Counter(d for _, d in rows["past"])
        if past:  # dataset-turnover check: the dataset with most past records, species and class counted within it
            top = max(sorted(past), key=past.get)
            mine = {p: tally(rows[p], top) for p in PERIODS}
            for p, (s, e) in PERIODS.items():
                assert stat(taxonid=aphia, datasetid=top, geometry=BOX, startdate=s, enddate=e) == mine[p]["records"] + mine[p]["outside_grid"], (aphia, top, p)
            cells = sorted({c for p in PERIODS for c in mine[p]["cells"]})
            entry["dominant_dataset"] = {
                "dataset_id": top, "past_share": round(past[top] / sum(past.values()), 3),
                **{p: mine[p]["cells"] for p in PERIODS},
                "class_effort": {c: {p: stat(taxonid=class_ids[entry["class"]], datasetid=top, geometry=cell_ring(*map(int, c.split("/"))),
                                             startdate=s, enddate=e) for p, (s, e) in PERIODS.items()} for c in cells}}
        species[str(aphia)] = entry
        print(aphia, name, {p: entry[p]["records"] for p in PERIODS}, entry.get("dominant_dataset", {}).get("past_share"), flush=True)
    group_effort = {}  # target-group effort: records of the species' WoRMS class in the same cell and period
    for cls, class_id in class_ids.items():
        cells = sorted({c for s in species.values() if s["class"] == cls for p in PERIODS for c in s[p]["cells"]})
        group_effort[cls] = {"aphia_id": class_id, "cells": {
            c: {p: stat(taxonid=class_id, geometry=cell_ring(*map(int, c.split("/"))), startdate=s, enddate=e) for p, (s, e) in PERIODS.items()}
            for c in cells}}
        print(cls, class_id, len(cells), "cells", flush=True)
    today = date.today().isoformat()
    out = {"snapshot_date": today,
           "query": {"api": API, "endpoints": ["statistics", "occurrence"], "box": BOX, "periods": PERIODS,
                     "grid": "1-degree cells keyed 'south/west' edge, lat 30-42, lon 122-135 (scripts/build_effort.py grid)",
                     "cell_rule": "a record on a cell edge counts in every cell whose closed polygon holds it, as the statistics "
                                  "endpoint counts effort; cell sums therefore exceed the box total by the edge records",
                     "taxon": "OBIS taxonid = WoRMS AphiaID of the accepted name; OBIS files synonyms under it and includes child taxa",
                     "effort": "all-taxa OBIS records in the same cell and period (statistics endpoint; sensitivity only)",
                     "group_effort": "OBIS records of the species' WoRMS class (AphiaIDByName) in the same cell and period, "
                                     "for every cell where a species of that class has a record (primary effort)",
                     "dominant_dataset": "the dataset with most past records of the species; its species and class counts per cell "
                                         "(statistics with datasetid, checked against the paged records)",
                     "check": "paged occurrence count equals the statistics count for every species and period, and within the dominant dataset"},
           "sources": {"obis_trend": {
               "title": "OBIS occurrence and statistics API: per-cell record counts for 30 species, their WoRMS classes and all taxa, 2006-2015 and 2016-2025",
               "provider": "Ocean Biodiversity Information System (OBIS), IOC-UNESCO", "url": API,
               "version": f"queried {today}", "accessed": today,
               "license": "Per-dataset licences (CC0, CC BY, CC BY-NC); only aggregate per-cell counts and dataset IDs are stored",
               "license_url": "https://manual.obis.org/policy.html",
               "terms": "OBIS data policy: datasets carry CC0, CC BY or CC BY-NC, and use should be cited as 'OBIS (2026) Ocean "
                        "Biodiversity Information System. Intergovernmental Oceanographic Commission of UNESCO. obis.org.' with "
                        "the underlying datasets, respecting each dataset's licence. The dataset IDs behind each species' counts are "
                        "listed per period in the repository snapshot research/verified-indices/snapshots/obis-trend-<date>.json; "
                        "no record, coordinate or media is redistributed."}},
           "effort": effort, "group_effort": group_effort, "species": species}
    target = ROOT / "research" / "verified-indices" / "snapshots" / f"obis-trend-{today}.json"
    target.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote {target}: {len(effort)} effort cells, {len(species)} species")


if __name__ == "__main__":
    main()
