"""Fit the entry-screen globe camera to the design image (1672x941).

1. The rim: per row, the strongest dark-to-bright step near the expected edge, in rows clear of the copy; a circle
   (cx, cy, R) is fitted to those points (algebraic fit, then the worst 10% dropped and refitted).
2. The camera: lon0, lat0 and P (vertical perspective, distance from the centre in radii) by least squares over
   landmarks read off the design by eye on 3-4x gridded crops (LANDMARKS below), the circle free within 2% of the
   rim fit. The design is a generated image whose geography is not one sphere (Japan is drawn about 1.5x too far
   north-east, Jeju twice as far off the coast as it is), so the fit is robust (soft L1, 10 px) and the tight group
   (Korea, Jeju, Shandong, Taiwan) weighs 5x: it puts Korea where the design has it rather than splitting the
   difference with Japan.

Run: python verification/2026-10-landing-globe-texture/fit_camera.py ../첫화면_디자인시안.png
Writes the result next to this file (fit_camera.json) and prints the README table.
"""
import json, math, sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from scipy.optimize import least_squares

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'scripts'))
from bake_globe import perspective  # one formula for the bake, this fit and (mirrored) intro.js

# (name, lon, lat, x, y, tight): x, y in design pixels; tight = the 15 px group of the prompt, else 30 px
LANDMARKS = [
    ('한반도 남단(땅끝)', 126.53, 34.30, 1097, 436, True),
    ('제주 중심', 126.55, 33.38, 1103, 465, True),
    ('산둥반도 끝', 122.70, 37.40, 1043, 367, True),
    ('대만 북단', 121.55, 25.30, 1003, 575, True),
    ('대만 남단', 120.85, 21.90, 983, 640, True),
    ('보하이만 안쪽', 117.70, 38.95, 982, 341, False),
    ('랴오둥반도 끝', 121.15, 38.72, 1026, 340, False),
    ('하이난 남단', 109.55, 18.20, 840, 651, False),
    ('루손 북단', 120.90, 18.55, 990, 683, False),
    ('홋카이도 동단', 145.82, 43.38, 1459, 211, False),
    ('규슈 남단', 130.66, 31.00, 1195, 502, False),
    ('사할린 남단', 142.08, 45.90, 1397, 152, False),
]
W, H = 1672, 941
COPY_ROWS = (225, 475)  # the title lines reach over the rim here
BAR_ROWS = [(70, 80), (843, 853)]


def rim_points(img):
    a = np.asarray(img.convert('RGB'), dtype=np.float32) / 255
    lum = gaussian_filter(a @ np.array([.2126, .7152, .0722], np.float32), 1.5)
    gx = np.zeros_like(lum)
    gx[:, 1:-1] = lum[:, 2:] - lum[:, :-2]
    cx0, cy0, r0 = .759 * W, .726 * H, .774 * H  # PR #177's circle, only to centre the search window
    pts = []
    for y in range(0, 842, 3):
        if COPY_ROWS[0] <= y <= COPY_ROWS[1] or any(a0 <= y <= b0 for a0, b0 in BAR_ROWS):
            continue
        d = r0 * r0 - (y - cy0) ** 2
        if d <= 0:
            continue
        x0 = int(cx0 - math.sqrt(d))
        lo, hi = max(2, x0 - 60), min(W - 2, x0 + 60)
        x = lo + int(np.argmax(gx[y, lo:hi]))
        if gx[y, x] > .03:
            pts.append((x, y))
    return np.array(pts, float)


def fit_circle(p):
    for _ in range(2):
        A = np.c_[2 * p[:, 0], 2 * p[:, 1], np.ones(len(p))]
        b = (p ** 2).sum(1)
        cx, cy, c = np.linalg.lstsq(A, b, rcond=None)[0]
        R = math.sqrt(c + cx * cx + cy * cy)
        res = np.abs(np.hypot(p[:, 0] - cx, p[:, 1] - cy) - R)
        p = p[res <= np.quantile(res, .9)]
    return cx, cy, R, float(np.median(res)), len(p)


def screen(lon, lat, cam, circle):
    q = perspective(lon, lat, cam[0], cam[1], cam[2])
    if q is None:
        return None
    cx, cy, R = circle
    return cx + q[0] * R, cy - q[1] * R


def fit_camera(circle):
    def res(v):
        out = []
        for _, lon, lat, x, y, tight in LANDMARKS:
            s = screen(lon, lat, v[:3], v[3:]) or (1e4, 1e4)
            w = 5 if tight else 1
            out += [(s[0] - x) * w, (s[1] - y) * w]
        return out
    lo, hi = [100, -30, 1.05] + [c * .98 for c in circle], [180, 70, 50] + [c * 1.02 for c in circle]
    best = None
    for lon0 in range(125, 156, 5):  # coarse grid, then refine
        for lat0 in range(0, 40, 5):
            for P in (1.3, 1.6, 2, 3, 5):
                v = least_squares(res, [lon0, lat0, P, *circle], bounds=(lo, hi), loss='soft_l1', f_scale=10)
                if best is None or v.cost < best.cost:
                    best = v
    return best.x


def main():
    design = Path(sys.argv[1] if len(sys.argv) > 1 else HERE.parents[2] / '첫화면_디자인시안.png')
    img = Image.open(design)
    assert img.size == (W, H), img.size
    pts = rim_points(img)
    rcx, rcy, rR, med, n = fit_circle(pts)
    lon0, lat0, P, cx, cy, R = fit_camera((rcx, rcy, rR))
    circle = (cx, cy, R)
    rows = []
    for name, lon, lat, x, y, tight in LANDMARKS:
        sx, sy = screen(lon, lat, (lon0, lat0, P), circle)
        e = math.hypot(sx - x, sy - y)
        rows.append({'name': name, 'lon': lon, 'lat': lat, 'design': [x, y], 'model': [round(sx, 1), round(sy, 1)],
                     'error_px': round(e, 1), 'limit_px': 15 if tight else 30, 'pass': e <= (15 if tight else 30)})
    horizon = math.degrees(math.acos(1 / P))
    ky = [screen(127.5, la, (lon0, lat0, P), circle)[1] for la in (33.5, 42.5)]
    out = {'rim': {'cx': round(rcx, 1), 'cy': round(rcy, 1), 'R': round(rR, 1), 'cx_w': round(rcx / W, 4),
                   'cy_h': round(rcy / H, 4), 'R_h': round(rR / H, 4), 'points': n, 'median_residual_px': round(med, 2)},
           'circle': {'cx': round(cx, 1), 'cy': round(cy, 1), 'R': round(R, 1), 'cx_w': round(cx / W, 4),
                      'cy_h': round(cy / H, 4), 'R_h': round(R / H, 4)},
           'camera': {'lon0': round(lon0, 3), 'lat0': round(lat0, 3), 'P': round(P, 4), 'horizon_deg': round(horizon, 2)},
           'korea_9deg_px': round(ky[0] - ky[1], 1), 'landmarks': rows}
    (HERE / 'fit_camera.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf8')
    print(json.dumps({k: out[k] for k in ('rim', 'circle', 'camera', 'korea_9deg_px')}, ensure_ascii=False))
    print('| 지점 | 경위도 | 시안(px) | 모델(px) | 오차 px | 합격선 | 결과 |\n|---|---|---|---|---|---|---|')
    for r in rows:
        print(f"| {r['name']} | {r['lat']}N {r['lon']}E | {r['design'][0]}, {r['design'][1]} | {r['model'][0]}, {r['model'][1]} | "
              f"{r['error_px']} | {r['limit_px']} | {'통과' if r['pass'] else '실패'} |")


if __name__ == '__main__':
    main()
