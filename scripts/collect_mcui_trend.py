"""Collect OBIS counts for the MCUI occurrence-trend check (verified-pilot-3.4; network).

For the 30 species (8 operating + the catalog's research candidates) and two 10-year periods, count OBIS
records per 1-degree cell in the map extent, and count all-taxa OBIS records (survey effort) in the same
cells and periods. Only per-cell counts, dataset IDs and year ranges are stored: no coordinates or record
IDs. The builder reads only the written snapshot.

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


def species_period(cache: Path, aphia: int, start: str, end: str) -> dict:
    query = {"taxonid": aphia, "geometry": BOX, "startdate": start, "enddate": end}
    expected = int(get(cache, "statistics", **query).get("records", 0))
    cells, datasets, outside, after, seen = Counter(), Counter(), 0, None, 0
    while seen < expected:
        page = {**query, "size": 5000, "fields": FIELDS, **({"after": after} if after else {})}
        rows = get(cache, "occurrence", **page)["results"]
        if not rows:
            break
        for r in rows:
            lat, lon = math.floor(r["decimalLatitude"]), math.floor(r["decimalLongitude"])
            if lat in LAT and lon in LON:
                cells[f"{lat}/{lon}"] += 1
            else:
                outside += 1  # on the box's north or east edge
            datasets[r.get("dataset_id") or "unknown"] += 1
        seen += len(rows)
        after = rows[-1]["id"]
    # the occurrence endpoint must return exactly the statistics count, or a filter was silently ignored
    assert seen == expected, (aphia, start, seen, expected)
    return {"records": sum(cells.values()), "outside_grid": outside, "cells": dict(sorted(cells.items())),
            "datasets": dict(sorted(datasets.items()))}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", type=Path, default=Path("C:/bbvm-wf3/obis-trend-cache"))
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    operating = json.loads((ROOT / "research/verified-indices/candidates.json").read_text(encoding="utf-8"))["candidates"]
    catalog = json.loads((ROOT / "dist/candidate-catalog.json").read_text(encoding="utf-8"))["species"]
    names = {c["aphia_id"]: c["scientific_name"] for c in operating} | {s["aphiaID"]: s["name"] for s in catalog}
    effort = {}
    for lat0 in LAT:
        for lon0 in LON:
            counts = {p: int(get(args.cache, "statistics", geometry=cell_ring(lat0, lon0), startdate=s, enddate=e).get("records", 0))
                      for p, (s, e) in PERIODS.items()}
            if any(counts.values()):
                effort[f"{lat0}/{lon0}"] = counts
    classes = {a: c["class"] for a, c in json.loads((ROOT / "research/verified-indices/taxonomy.json").read_text(encoding="utf-8"))["species"].items()}
    species = {}
    for aphia, name in names.items():
        whole = get(args.cache, "statistics", taxonid=aphia, geometry=BOX)
        species[str(aphia)] = {"scientific_name": name, "class": classes[str(aphia)], "records_all_years": int(whole.get("records", 0)),
                               "yearrange": whole.get("yearrange"),
                               **{p: species_period(args.cache, aphia, s, e) for p, (s, e) in PERIODS.items()}}
        print(aphia, name, {p: species[str(aphia)][p]["records"] for p in PERIODS}, flush=True)
    # target-group effort: records of the species' WoRMS class in the same cell and period
    group_effort = {}
    for cls in sorted(set(classes[a] for a in species)):
        worms = urllib.request.Request("https://www.marinespecies.org/rest/AphiaIDByName/" + urllib.parse.quote(cls) + "?marine_only=false", headers=UA)
        hit = args.cache / ("worms-" + hashlib.sha256(cls.encode()).hexdigest() + ".json")
        if not hit.exists():
            with urllib.request.urlopen(worms, timeout=60) as response:
                hit.write_text(response.read().decode(), encoding="utf-8")
        class_id = int(json.loads(hit.read_text(encoding="utf-8")))
        cells = sorted({c for a, s in species.items() if s["class"] == cls for p in PERIODS for c in s[p]["cells"]})
        group_effort[cls] = {"aphia_id": class_id, "cells": {
            c: {p: int(get(args.cache, "statistics", taxonid=class_id, geometry=cell_ring(*map(int, c.split("/"))), startdate=s, enddate=e).get("records", 0))
                for p, (s, e) in PERIODS.items()} for c in cells}}
        print(cls, class_id, len(cells), "cells", flush=True)
    today = date.today().isoformat()
    out = {"snapshot_date": today,
           "query": {"api": API, "endpoints": ["statistics", "occurrence"], "box": BOX, "periods": PERIODS,
                     "grid": "1-degree cells keyed 'south/west' edge, lat 30-42, lon 122-135 (scripts/build_effort.py grid)",
                     "taxon": "OBIS taxonid = WoRMS AphiaID of the accepted name; OBIS files synonyms under it and includes child taxa",
                     "effort": "all-taxa OBIS records in the same cell and period (statistics endpoint)",
                     "group_effort": "OBIS records of the species' WoRMS class (AphiaIDByName) in the same cell and period, "
                                     "for every cell where a species of that class has a record",
                     "check": "paged occurrence count equals the statistics count for every species and period"},
           "sources": {"obis_trend": {
               "title": "OBIS occurrence and statistics API: per-cell record counts for 30 species and all taxa, 2006-2015 and 2016-2025",
               "provider": "Ocean Biodiversity Information System (OBIS), IOC-UNESCO", "url": API,
               "version": f"queried {today}", "accessed": today,
               "license": "Per-dataset licences (CC0, CC BY, CC BY-NC); only aggregate per-cell counts and dataset IDs are stored",
               "license_url": "https://manual.obis.org/policy.html",
               "terms": "OBIS data policy: datasets carry CC0, CC BY or CC BY-NC, and use should be cited as 'OBIS (2026) Ocean "
                        "Biodiversity Information System. Intergovernmental Oceanographic Commission of UNESCO. obis.org.' with "
                        "the underlying datasets, respecting each dataset's licence. Dataset IDs are listed per species and "
                        "period; no record, coordinate or media is redistributed."}},
           "effort": effort, "group_effort": group_effort, "species": species}
    target = ROOT / "research" / "verified-indices" / "snapshots" / f"obis-trend-{today}.json"
    target.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote {target}: {len(effort)} effort cells, {len(species)} species")


if __name__ == "__main__":
    main()
