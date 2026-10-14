"""Sea part of every public 1° cell: the cell square minus the land of dist/countries.json (dist/cell-sea-geometry.json).

The map fills a 1° cell over its sea part only, so a coastal cell no longer paints the land beside it. The land is the same
Natural Earth 1:10m outline the site draws and masks its schematic dots with (scripts/prepare_basemap.py), read from
dist/countries.json, so the cut follows the drawn coastline exactly. Only how a cell is painted changes: no cell, count,
type or score is added or removed.

Cells: every 1° cell in the operational snapshot (dist/live-snapshot.json), the candidate release
(dist/expansion-public-cells.json), the outside candidates (dist/unexplored-candidates.json) and the survey-effort layer
(dist/effort.json). 4° cells are drawn as an outline only and need no geometry.

Per cell (key "lat0,lon0,1", as in dist/cell-sea-areas.json):
  {"seaFraction": 1}                     the whole square is sea: the app fills the square itself
  {"seaFraction": 0}                     the whole square is land: the app draws the edge only, no fill
  {"type": ..., "coordinates": ..., "seaFraction": f}   the sea part, a GeoJSON Polygon or MultiPolygon

Coordinates are [lon, lat] rounded to 4 decimals; sea pieces under 0.0005 deg² are dropped; seaFraction is the planar
share of the square in degrees, rounded to 3 decimals.

Needs shapely (python -m pip install shapely). The committed JSON is what the site and the tests read, so CI does not need
shapely; --check rebuilds it and fails on any difference (generatedOn aside).
"""
import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

DIST = Path(__file__).resolve().parents[1] / 'dist'
OUT = DIST / 'cell-sea-geometry.json'
SCHEMA = 'cell-sea-geometry-1'
MIN_PIECE = 0.0005  # deg², smaller sea pieces are dropped
DIGITS = 4


def public_cells(dist=DIST):
    """Every published 1° cell key (lat0, lon0) the map can draw, from the four files the app reads."""
    read = lambda name: json.loads((dist / name).read_text(encoding='utf-8'))
    keys = set()
    for c in read('live-snapshot.json')['cells']:
        m = re.match(r'deg(\d+):N(\d+)E(\d+)', c['cell_code'])
        if m and int(m[1]) == 1:
            keys.add((int(m[2]), int(m[3])))
    for name in ('expansion-public-cells.json', 'unexplored-candidates.json'):
        for s in read(name)['species']:
            keys |= {(c['lat0'], c['lon0']) for c in s.get('cells', []) if c.get('sizeDeg') == 1}
    effort = read('effort.json')
    if effort.get('cell_deg', 1) == 1:
        keys |= {(c['lat0'], c['lon0']) for c in effort['cells']}
    return sorted(keys)


def _round(geom):
    def ring(coords):
        out = []
        for x, y in coords:
            p = [round(x, DIGITS), round(y, DIGITS)]
            if not out or p != out[-1]:
                out.append(p)
        return out
    polys = list(geom.geoms) if geom.geom_type == 'MultiPolygon' else [geom]
    parts = [[ring(p.exterior.coords)] + [ring(h.coords) for h in p.interiors] for p in polys]
    return ({'type': 'Polygon', 'coordinates': parts[0]} if len(parts) == 1
            else {'type': 'MultiPolygon', 'coordinates': parts})


def build(dist=DIST):
    from shapely.geometry import box, shape
    from shapely.ops import unary_union
    from shapely.validation import make_valid

    countries = json.loads((dist / 'countries.json').read_text(encoding='utf-8'))
    land = unary_union([make_valid(shape(f['geometry'])) for f in countries['features']])
    cells = {}
    for lat0, lon0 in public_cells(dist):
        square = box(lon0, lat0, lon0 + 1, lat0 + 1)
        sea = square.difference(land)
        polys = [g for g in getattr(sea, 'geoms', [sea]) if g.geom_type == 'Polygon' and g.area >= MIN_PIECE]
        frac = round(sum(p.area for p in polys) / square.area, 3)
        key = f'{lat0},{lon0},1'
        if not polys:
            cells[key] = {'seaFraction': 0}
        elif not square.intersects(land) or frac >= 1:
            cells[key] = {'seaFraction': 1}
        else:
            from shapely.geometry import MultiPolygon
            cells[key] = {**_round(polys[0] if len(polys) == 1 else MultiPolygon(polys)), 'seaFraction': frac}
    return {'schemaVersion': SCHEMA,
            'landSource': 'Natural Earth 1:10m admin 0 (dist/countries.json와 동일)',
            'generatedOn': date.today().isoformat(),
            'rule': 'Public 1° cell square minus the land of dist/countries.json (scripts/build_cell_sea_geometry.py). '
                    'Display only: the sea part a cell is filled over, not a record location or a distribution.',
            'cells': cells}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--check', action='store_true', help='rebuild and compare with the committed file')
    args = ap.parse_args()
    new = build()
    if args.check:
        old = json.loads(OUT.read_text(encoding='utf-8'))
        same = {**old, 'generatedOn': None} == {**new, 'generatedOn': None}
        print('cell-sea-geometry.json', 'matches' if same else 'DIFFERS from a rebuild')
        return 0 if same else 1
    OUT.write_text(json.dumps(new, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    fr = [c['seaFraction'] for c in new['cells'].values()]
    print(len(fr), 'cells ·', sum(f == 1 for f in fr), 'all sea ·', sum(f == 0 for f in fr), 'all land ·',
          sum(0 < f < 1 for f in fr), 'coastal ·', OUT.stat().st_size, 'bytes')
    return 0


if __name__ == '__main__':
    sys.exit(main())
