"""Entry-screen globe (dist/intro.js): Natural Earth land, borders and depth areas around the globe's visible side.

Natural Earth (public domain) v5.1.2 GeoJSON, clipped to a lon/lat box that holds everything within ~80° of the globe
centre (141°E, 14°N), simplified for the screen and written as compact rings. No extra dependencies, like
prepare_basemap.py. Run: python scripts/prepare_globe.py [folder with the GeoJSON files, else they are downloaded]

The box crosses the antimeridian (28°E → 254°E = 106°W): rings west of it are shifted by +360°. Every edge longer than
1° is split, so the cut edges (box sides, the 180° split Natural Earth makes) bend with the sphere and the browser can
lay hidden parts along the rim; it never strokes a cut edge (intro.js cutEdge). Coordinates are integers in 1/100
degree, delta-encoded after the first point.
"""
import hashlib
import json
import sys
from pathlib import Path
from urllib.request import urlopen

BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/'
OUT = Path(__file__).resolve().parents[1] / 'dist' / 'vendor' / 'globe-v1'
W, S, E, N = 28, -62, 254, 90  # everything within ~80° of the centre; what is left out sits on the darkened rim
SCALE = 100  # 1/100 degree


def load(name, src):
    if src:
        raw = (Path(src) / f'{name}.geojson').read_bytes()
    else:
        raw = urlopen(BASE + f'{name}.geojson', timeout=180).read()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def simplify(pts, tol):
    """Douglas-Peucker in degrees (iterative; keeps both ends)."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay
        n = (dx * dx + dy * dy) ** .5
        best, idx = -1, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * (px - ax) - dx * (py - ay)) / n if n else ((px - ax) ** 2 + (py - ay) ** 2) ** .5
            if d > best:
                best, idx = d, i
        if best > tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def clip_ring(ring):
    """Sutherland-Hodgman against the box; returns a closed ring or []."""
    for inside, cut in [(lambda p: p[0] >= W, lambda a, b: (W, a[1] + (b[1] - a[1]) * (W - a[0]) / (b[0] - a[0]))),
                        (lambda p: p[0] <= E, lambda a, b: (E, a[1] + (b[1] - a[1]) * (E - a[0]) / (b[0] - a[0]))),
                        (lambda p: p[1] >= S, lambda a, b: (a[0] + (b[0] - a[0]) * (S - a[1]) / (b[1] - a[1]), S)),
                        (lambda p: p[1] <= N, lambda a, b: (a[0] + (b[0] - a[0]) * (N - a[1]) / (b[1] - a[1]), N))]:
        out = []
        for i, b in enumerate(ring):
            a = ring[i - 1]
            if inside(b):
                if not inside(a):
                    out.append(cut(a, b))
                out.append(b)
            elif inside(a):
                out.append(cut(a, b))
        ring = out
        if not ring:
            return []
    return ring + [ring[0]]


def clip_line(line):
    """Liang-Barsky per segment; returns the parts inside the box."""
    parts, cur = [], []
    for a, b in zip(line, line[1:]):
        t0, t1, dx, dy = 0.0, 1.0, b[0] - a[0], b[1] - a[1]
        for p, q in [(-dx, a[0] - W), (dx, E - a[0]), (-dy, a[1] - S), (dy, N - a[1])]:
            if p == 0:
                if q < 0:
                    t0, t1 = 1, 0
                continue
            t = q / p
            if p < 0:
                t0 = max(t0, t)
            else:
                t1 = min(t1, t)
        if t0 > t1:
            if cur:
                parts.append(cur)
                cur = []
            continue
        p0, p1 = (a[0] + t0 * dx, a[1] + t0 * dy), (a[0] + t1 * dx, a[1] + t1 * dy)
        if not cur:
            cur = [p0]
        cur.append(p1)
        if t1 < 1:
            parts.append(cur)
            cur = []
    if cur:
        parts.append(cur)
    return parts


def densify(pts, step=1.0):
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1])) // step)
        out += [(a[0] + (b[0] - a[0]) * k / (n + 1), a[1] + (b[1] - a[1]) * k / (n + 1)) for k in range(1, n + 1)]
        out.append(b)
    return out


def encode(pts):
    """Integers in 1/100 degree: first point absolute, then deltas; repeated points dropped."""
    q = []
    for x, y in pts:
        p = (round(x * SCALE), round(y * SCALE))
        if not q or p != q[-1]:
            q.append(p)
    flat, last = [], (0, 0)
    for p in q:
        flat += [p[0] - last[0], p[1] - last[1]]
        last = p
    return flat, len(q)


def shifted(pts):
    return [pts, [(x + 360, y) for x, y in pts]]


def extent(pts):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return max(max(xs) - min(xs), max(ys) - min(ys))


def polygons(geo):
    for f in geo['features']:
        g = f['geometry']
        if g['type'] == 'Polygon':
            yield g['coordinates']
        elif g['type'] == 'MultiPolygon':
            yield from g['coordinates']


def lines(geo):
    for f in geo['features']:
        g = f['geometry']
        if g['type'] == 'LineString':
            yield g['coordinates']
        elif g['type'] == 'MultiLineString':
            yield from g['coordinates']


def area_rings(geo, tol, min_extent):
    """Every ring (outer and holes alike: the browser fills with even-odd) clipped, simplified, densified."""
    rings, verts = [], 0
    for poly in polygons(geo):
        for ring in poly:
            ring = simplify([tuple(p[:2]) for p in ring], tol)
            for copy in shifted(ring):
                c = clip_ring(copy[:-1] if copy[0] == copy[-1] else copy)
                if len(c) < 4 or extent(c) < min_extent:
                    continue
                flat, n = encode(densify(c))
                if n >= 4:
                    rings.append(flat)
                    verts += n
    return rings, verts


def line_parts(geo, tol):
    out, verts = [], 0
    for line in lines(geo):
        line = simplify([tuple(p[:2]) for p in line], tol)
        for copy in shifted(line):
            for part in clip_line(copy):
                flat, n = encode(densify(part))
                if n >= 2:
                    out.append(flat)
                    verts += n
    return out, verts


def write(name, body, sources):
    path = OUT / name
    path.write_text(json.dumps(body, separators=(',', ':')), encoding='utf-8', newline='\n')
    data = path.read_bytes()
    print(f'{name}: {len(data):,} bytes', ' '.join(f'{k}={v}' for k, v in sources.items()))
    return hashlib.sha256(data).hexdigest(), len(data)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {'scale': SCALE, 'box': [W, S, E, N], 'cut': {'lon': [W, 180, E], 'lat': [S, N]}}
    inputs, made = {}, {}

    land, h = load('ne_50m_land', src)
    inputs['ne_50m_land'] = h
    borders, h = load('ne_50m_admin_0_boundary_lines_land', src)
    inputs['ne_50m_admin_0_boundary_lines_land'] = h
    land_rings, lv = area_rings(land, .04, .25)
    border_lines, bv = line_parts(borders, .04)
    made['land-50m.json'] = write('land-50m.json', {
        'source': 'Natural Earth 1:50m land + admin 0 boundary lines (public domain) v5.1.2, clipped and simplified',
        **meta, 'land': land_rings, 'borders': border_lines}, {'land_vertices': lv, 'border_vertices': bv})

    depth = {}
    for key, name in [('200', 'ne_10m_bathymetry_K_200'), ('2000', 'ne_10m_bathymetry_I_2000')]:
        geo, h = load(name, src)
        inputs[name] = h
        depth[key], dv = area_rings(geo, .05, .4)
        print(f'  depth {key} m: {len(depth[key])} rings, {dv} vertices')
    made['bathymetry-10m.json'] = write('bathymetry-10m.json', {
        'source': 'Natural Earth 1:10m bathymetry K_200 and I_2000 (public domain) v5.1.2, clipped and simplified; '
                  'each layer is the sea deeper than its depth',
        **meta, 'depth': depth}, {})

    (OUT / 'SOURCE.txt').write_text('\n'.join([
        'Natural Earth (https://www.naturalearthdata.com/), public domain. Release v5.1.2 GeoJSON from',
        BASE,
        '',
        'Made by scripts/prepare_globe.py for the entry-screen globe (dist/intro.js) only:',
        f'clipped to {W}..{E} degrees E (west of the antimeridian shifted +360) and {S}..{N} degrees N, which holds',
        'everything within about 80 degrees of the globe centre 141E 14N; Douglas-Peucker simplified (land and borders',
        '0.04 degree, depth areas 0.05 degree); rings smaller than 0.25 degree (land) or 0.4 degree (depth) dropped;',
        'every edge longer than 1 degree split (so the cut edges bend with the sphere); integers in 1/100 degree,',
        'delta-encoded.',
        '',
        'Inputs (sha256):',
        *[f'  {k}.geojson {v}' for k, v in inputs.items()],
        'Outputs (sha256, bytes):',
        *[f'  {k} {v[0]} {v[1]}' for k, v in made.items()],
        '',
        'Not for navigation or for judging jurisdiction.',
        ''
    ]), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
