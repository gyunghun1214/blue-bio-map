"""Save dist/live-snapshot.json: a copy of the public species_profiles and
species_map_cells rows, shown only when the operational API cannot be reached
(e.g. offline demo, paused project). Same public columns and key as
dist/live-data.js; no private tables, coordinates or record IDs.

Usage: python scripts/snapshot_live.py [--out dist/live-snapshot.json]
"""
from __future__ import annotations

import argparse
import json
import re
import urllib.request
from datetime import date
from pathlib import Path

LOADER = Path(__file__).resolve().parent.parent / "dist" / "live-data.js"


def loader_value(src: str, pattern: str) -> str:
    m = re.search(pattern, src)
    if not m:
        raise SystemExit(f"live-data.js: {pattern} not found")
    return m.group(1)


def get(url: str, key: str) -> list:
    req = urllib.request.Request(url, headers={"apikey": key})
    with urllib.request.urlopen(req, timeout=30) as r:
        rows = json.load(r)
    if not isinstance(rows, list):
        raise SystemExit(f"unexpected response: {url}")
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(LOADER.parent / "live-snapshot.json"))
    args = ap.parse_args()
    src = LOADER.read_text(encoding="utf-8")
    base = loader_value(src, r"url:\s*'([^']+)'")
    key = loader_value(src, r"key:\s*'([^']+)'")
    cols = loader_value(src, r"const columns='([^']+)'")
    cell_cols = loader_value(src, r"const cellColumns='([^']+)'")
    profiles = get(f"{base}/rest/v1/species_profiles?select={cols}&order=aphia_id.desc", key)
    cells = get(f"{base}/rest/v1/species_map_cells?select={cell_cols}&order=cell_code", key)
    if not profiles:
        raise SystemExit("no published profiles; snapshot not written")
    out = {"fetched_at": date.today().isoformat(), "profiles": profiles, "cells": cells}
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{args.out}: {len(profiles)} profiles, {len(cells)} cells")


if __name__ == "__main__":
    main()
