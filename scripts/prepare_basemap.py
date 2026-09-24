"""Basemap outline: Natural Earth 1:10m countries (public domain), clipped to the map's max bounds.

Replaces the 1:110m outline (coastlines were too coarse next to 1° cells). No extra dependencies:
Sutherland-Hodgman clipping against the bounding box, coordinates rounded to 0.005° (~500 m).
"""
import json
from pathlib import Path
from urllib.request import urlopen

URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson'
OUT = Path(__file__).resolve().parents[1] / 'dist' / 'countries.json'
W, S, E, N = 105, 20, 150, 53  # same as the Leaflet maxBounds in app.js
KEEP = {'KOR', 'PRK', 'JPN', 'CHN', 'RUS', 'TWN', 'MNG'}
STEP = 0.005


def clip(ring):
    for inside, cut in [(lambda p: p[0] >= W, lambda a, b: (W, a[1] + (b[1] - a[1]) * (W - a[0]) / (b[0] - a[0]))),
                        (lambda p: p[0] <= E, lambda a, b: (E, a[1] + (b[1] - a[1]) * (E - a[0]) / (b[0] - a[0]))),
                        (lambda p: p[1] >= S, lambda a, b: (a[0] + (b[0] - a[0]) * (S - a[1]) / (b[1] - a[1]), S)),
                        (lambda p: p[1] <= N, lambda a, b: (a[0] + (b[0] - a[0]) * (N - a[1]) / (b[1] - a[1]), N))]:
        out = []
        for i, b in enumerate(ring):
            a = ring[i - 1]
            if inside(b):
                if not inside(a): out.append(cut(a, b))
                out.append(b)
            elif inside(a):
                out.append(cut(a, b))
        ring = out
        if not ring: return []
    pts = []
    for x, y in ring:
        p = [round(round(x / STEP) * STEP, 3), round(round(y / STEP) * STEP, 3)]
        if not pts or p != pts[-1]: pts.append(p)
    return pts + [pts[0]] if len(pts) >= 3 else []


def main():
    geo = json.load(urlopen(URL, timeout=120))
    feats = []
    for f in geo['features']:
        code = f['properties'].get('ADM0_A3')
        if code not in KEEP: continue
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        parts = [[r for r in (clip(ring) for ring in poly) if r] for poly in polys]
        parts = [p for p in parts if p]
        if parts:
            feats.append({'type': 'Feature', 'properties': {'name': f['properties']['NAME'], 'code': code},
                          'geometry': {'type': 'MultiPolygon', 'coordinates': parts}})
    assert {'KOR', 'PRK', 'JPN'} <= {f['properties']['code'] for f in feats}
    OUT.write_text(json.dumps({'type': 'FeatureCollection', 'source': 'Natural Earth 1:10m admin 0 countries (public domain), clipped',
                               'features': feats}, separators=(',', ':')), encoding='utf-8')
    print(len(feats), 'features', OUT.stat().st_size, 'bytes')


if __name__ == '__main__':
    main()
