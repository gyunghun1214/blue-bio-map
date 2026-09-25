"""Build dist/effort.json: OBIS survey-effort background per 1-degree cell.

For each 1° cell in the map extent, ask the public OBIS statistics API how many
records (all marine taxa, 2000 onward) exist. This is a proxy for sampling
effort, not for any species' presence or abundance. Only cell-level counts are
stored; no coordinates or record IDs.

Usage: python scripts/build_effort.py [--out dist/effort.json]
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

API = "https://api.obis.org/v3/statistics"
LON = range(122, 136)  # cell west edges, matches the demo extent 122–136°E
LAT = range(30, 43)    # cell south edges, 30–43°N
START = "2000-01-01"   # same period floor as the published GBIF cells


def cell_stats(lat0: int, lon0: int) -> dict:
    ring = f"{lon0} {lat0},{lon0 + 1} {lat0},{lon0 + 1} {lat0 + 1},{lon0} {lat0 + 1},{lon0} {lat0}"
    query = urllib.parse.urlencode({"geometry": f"POLYGON(({ring}))", "startdate": START})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(f"{API}?{query}", timeout=60) as response:
                data = json.load(response)
            return {"lat0": lat0, "lon0": lon0, "records": int(data.get("records", 0)),
                    "species": int(data.get("species", 0)), "datasets": int(data.get("datasets", 0))}
        except (OSError, ValueError):
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    raise AssertionError("unreachable")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=Path("dist/effort.json"))
    args = parser.parse_args()
    cells = []
    for lat0 in LAT:
        for lon0 in LON:
            cells.append(cell_stats(lat0, lon0))
            time.sleep(0.2)  # be gentle with the public API
    out = {"source": "OBIS statistics API (api.obis.org/v3/statistics)",
           "source_url": "https://obis.org/", "license_note": "OBIS aggregate counts; cite OBIS and the underlying datasets",
           "retrieved": date.today().isoformat(), "startdate": START, "cell_deg": 1,
           "meaning": "all marine taxa records per 1-degree cell since 2000; a sampling-effort proxy, not presence or abundance",
           "cells": [c for c in cells if c["records"] > 0]}
    args.out.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(out['cells'])} cells with records -> {args.out}")


if __name__ == "__main__":
    main()
