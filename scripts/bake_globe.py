"""Bake the entry-screen globe (dist/intro.js) from NASA imagery into dist/vendor/globe-v2/.

The view never turns, so everything costly (projection, tone, shelf glow, lights, shading, the air) is worked out here
once at full size and the screen only draws one picture, then the live data (public cells, the study frame, the point)
on top with the same projection.

  python scripts/bake_globe.py --src ../globe-src             bake globe-900/1600/2400.webp and SOURCE.txt
  python scripts/bake_globe.py --check                        outputs = SOURCE.txt (sha256, bytes, size limits); no sources
  python scripts/bake_globe.py --compare ../첫화면_디자인시안.png [--shot capture.png]
                                                              mean Lab and local contrast, design vs bake (or a screen capture)

Inputs (outside the repository, see SOURCE.txt): NASA Blue Marble Next Generation w/ Topography and Bathymetry, August
2004, the 2 km world and the 500 m tile D1 (90-180E, 0-90N); NASA Black Marble 2016 grayscale 3 km; and the repository's
own Natural Earth vectors (dist/vendor/globe-v1) for the land and shelf masks. Same inputs, same outputs (no randomness).
Memory: the PC this ran on had under 1 GB free, so the JPEGs are decoded with libjpeg's DCT scaling (D1 at 1/2 = 1 km,
cropped to Korea's 25 degrees; the world at 1/2 = 4 km) and the globe is sampled in strips.
"""
import argparse, hashlib, json, math, sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, maximum_filter, minimum_filter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist' / 'vendor' / 'globe-v2'
V1 = ROOT / 'dist' / 'vendor' / 'globe-v1'
Image.MAX_IMAGE_PIXELS = None

SOURCES = {
    'world': ('world.topo.bathy.200408.3x21600x10800.jpg',
              'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/august/world.topo.bathy.200408.3x21600x10800.jpg'),
    'd1': ('world.topo.bathy.200408.3x21600x21600.D1.jpg',
           'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/august/world.topo.bathy.200408.3x21600x21600.D1.jpg'),
    'lights': ('BlackMarble_2016_3km_gray.jpg',
               'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144897/BlackMarble_2016_3km_gray.jpg'),
}
LIT = {'land_px': 0}
LIMITS = {900: 250_000, 1600: 600_000, 2400: 1_100_000}  # bytes: phone, desktop 1x, desktop 2x
KOREA = (127.5, 36.0)
STUDY = ((124, 33), (132, 38.7))

# Every tuning knob of the recipe; README (verification/2026-10-landing-globe-texture) keeps the final values per round.
PARAMS = {
    'ss': 2,                      # supersampling per axis
    'd1_radius': 25.0,            # degrees around Korea taken from the 500 m tile (decoded at 1 km)
    'd1_feather': 3.0,            # degrees of linear blend into the world image
    'lc_sigma': .02,              # base | middle split blur (log luma), fraction of the diameter
    'fine_sigma': .003,           # middle | fine split
    # sea, in log luma: (base, middle, fine) gains; the broad range and the plateaus pressed, the fine relief raised
    'sea_luma': .016,            # linear luma of the median open sea after toning
    'sea_gains': (.3, .8, 2.6),
    'shelf_gains': (.3, 1.4, 3.0),   # the same within the 200 m shelf: its sand ridges and channels are mid-scale
    'sea_max': 3.0,               # soft ceiling, times sea_luma (plateaus, reefs)
    'sea_tint': (.005, .018, .031),  # hue of the open sea (started at #0A2032, linear)
    'sea_tint_w': .8,
    # land, the same way: darker, a blue-grey, the ranges and plains brought out
    'land_luma': .008,
    'land_gains': (.8, 1.4, 4.0),
    'land_max': 3.0,              # soft ceiling, times land_luma (snow, desert)
    'land_tint': (.011, .017, .026),  # blue-grey
    'land_sat': .35,              # saturation kept from the image before tinting
    'land_tint_w': .7,
    # the shelf glow: two Gaussian blurs of the 200 m shelf brighten and tint it teal; a little reaches the coast land
    'shelf_sigma': (.006, .018),  # fraction of the diameter (radius ~1.2% of it, and a wider one)
    'shelf_color': (.262, .686, .631),  # #8CD7D0 in linear light
    'shelf_gain': 3.2,            # the shelf is brightened by multiplying (1 + gain x glow), so its floor keeps its texture
    'shelf_tint': .85,            # and its hue moved toward the teal
    'shelf_amax': .1,             # plus a soft screened halo spreading past the shelf edge
    'shelf_wide_w': .5,
    'shelf_on_land': .7,         # share of the glow kept over land
    'coast_px': 2,                # shallow-water line: land grown seaward by this many px (at 2400)
    'coast_color': (.42, .80, .76),
    'coast_amax': .18,
    'korea_boost': 1.5,           # glow around Korea (the study frame grown 4 degrees)
    'lights_color': (.89, .79, .60),  # #F2E6CC in linear light
    'lights_gain': 1.0,
    'lights_gamma': 2.0,          # >1 keeps the bright cores, drops the dim sprawl
    'lights_amax': .12,           # lights: largest added value
    'lights_erode_px': 2,
    'light_dir': (-.45, .55, .7), # light from the upper left, in front
    'shade_lo': -.35, 'shade_hi': .8, 'shade_min': .3,
    'limb_r': .86, 'limb_min': .5,
    'air_color': (.275, .578, .807),  # #8FC8E8 in linear light
    'air_amax': 1.0,              # added (not screened, so the land under it keeps its relief)
    'air_exp': 2.5,               # (1 - n.v)^exp: half strength at r = .955, a band ~5-8% of the radius
    'air_back': .08,              # the side away from the light gets this share
    'air_r0': .82,                # no air inside this radius (the Fresnel tail would veil the whole disc)
    'exposure': 1.0,
    'quality': {900: 82, 1600: 82, 2400: 80},
}

# ---------- projection (the same formulas as dist/intro.js) ----------


def perspective(lon, lat, lon0, lat0, P):
    """Vertical perspective from P radii off the centre, in unit-disc coordinates (horizon r=1, x right, y up); None
    behind the horizon. The same formula as perspective() in dist/intro.js."""
    r = math.pi / 180
    f, f0, dl = lat * r, lat0 * r, (lon - lon0) * r
    cosc = math.sin(f0) * math.sin(f) + math.cos(f0) * math.cos(f) * math.cos(dl)
    if cosc < 1 / P:
        return None
    k = (P - 1) / (P - cosc) / math.sqrt((P - 1) / (P + 1))
    return (k * math.cos(f) * math.sin(dl), k * (math.cos(f0) * math.sin(f) - math.sin(f0) * math.cos(f) * math.cos(dl)))


def project_np(lon, lat, lon0, lat0, P):
    """perspective() on arrays, points behind the horizon pushed onto the rim (as intro.js toRim)."""
    r = np.pi / 180
    f, f0, dl = lat * r, lat0 * r, (lon - lon0) * r
    x = np.cos(f) * np.sin(dl)
    y = np.cos(f0) * np.sin(f) - np.sin(f0) * np.cos(f) * np.cos(dl)
    cosc = np.sin(f0) * np.sin(f) + np.cos(f0) * np.cos(f) * np.cos(dl)
    k = np.where(cosc >= 1 / P, (P - 1) / (P - cosc) / math.sqrt((P - 1) / (P + 1)), 1 / np.maximum(np.hypot(x, y), 1e-12))
    return x * k, y * k


def inverse_np(x, y, lon0, lat0, P):
    """Unit-disc points (r <= 1) to lon, lat and the surface point (X, Y, Z) in the camera frame (z to the viewer)."""
    r = np.pi / 180
    f0 = lat0 * r
    s = math.sqrt((P - 1) / (P + 1))
    X, Y = x * s, y * s
    rho = np.maximum(np.hypot(X, Y), 1e-15)
    sinc = (P - np.sqrt(np.maximum(0, 1 - rho * rho * (P + 1) / (P - 1)))) / ((P - 1) / rho + rho / (P - 1))
    cosc = np.sqrt(1 - sinc * sinc)
    lat = np.arcsin(np.clip(cosc * math.sin(f0) + Y * sinc * math.cos(f0) / rho, -1, 1)) / r
    lon = lon0 + np.arctan2(X * sinc, rho * math.cos(f0) * cosc - Y * math.sin(f0) * sinc) / r
    # the surface point: orthographic coordinates of (lon, lat), z = cos of the angle from the centre
    return lon, lat, X * sinc / rho, Y * sinc / rho, cosc

# ---------- colour ----------


def to_linear(v):
    v = np.asarray(v, np.float32)
    return np.where(v <= .04045, v / 12.92, ((v + .055) / 1.055) ** 2.4).astype(np.float32)


def to_srgb(v):
    v = np.clip(v, 0, 1)
    return np.where(v <= .0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - .055)


LUT = to_linear(np.arange(256) / 255)


def luma(a):
    return a[..., 0] * .2126 + a[..., 1] * .7152 + a[..., 2] * .0722


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def screen(base, color, amount):
    c = np.asarray(color, np.float32) * amount[..., None]
    return 1 - (1 - base) * (1 - c)


def lab(rgb8):
    """sRGB 0-255 (..., 3) to CIE Lab (D65)."""
    l = to_linear(np.asarray(rgb8, np.float32) / 255)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]], np.float32)
    xyz = l @ M.T / np.array([.95047, 1, 1.08883], np.float32)
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

# ---------- sources ----------


def load_sources(src):
    """D1 first (its 1/2 decode is the largest buffer), cropped right away; then the world and the lights."""
    R = PARAMS['d1_radius'] + PARAMS['d1_feather']
    lat_r = (KOREA[1] - R, KOREA[1] + R)
    dlon = math.degrees(math.asin(min(1, math.sin(math.radians(R)) / math.cos(math.radians(KOREA[1])))))  # widest point of the cap
    lon_r = (KOREA[0] - dlon, KOREA[0] + dlon)
    lon_r = (max(90, lon_r[0]), min(180, lon_r[1]))
    lat_r = (max(0, lat_r[0]), min(90, lat_r[1]))
    im = Image.open(src / SOURCES['d1'][0])
    im.draft('RGB', (10800, 10800))
    ppd = im.size[0] / 90  # pixels per degree after the DCT scaling
    box = (int((lon_r[0] - 90) * ppd), int((90 - lat_r[1]) * ppd), int(math.ceil((lon_r[1] - 90) * ppd)), int(math.ceil((90 - lat_r[0]) * ppd)))
    d1 = np.asarray(im.crop(box))
    d1_meta = {'decoded': im.size, 'ppd': ppd, 'lon0': 90 + box[0] / ppd, 'lat0': 90 - box[1] / ppd}
    del im
    im = Image.open(src / SOURCES['world'][0])
    im.draft('RGB', (10800, 5400))
    world = np.asarray(im.convert('RGB'))
    world_meta = {'decoded': im.size}
    del im
    im = Image.open(src / SOURCES['lights'][0])
    lights = np.asarray(im.convert('L'))
    return {'d1': d1, 'd1_meta': d1_meta, 'world': world, 'world_meta': world_meta, 'lights': lights}


def bilinear(img, fx, fy, wrap):
    """Sample an image (H, W[, 3] uint8, sRGB) at float pixel coordinates; returns linear light."""
    H, W = img.shape[:2]
    x0 = np.floor(fx).astype(np.int64)
    y0 = np.floor(fy).astype(np.int64)
    tx, ty = (fx - x0).astype(np.float32), (fy - y0).astype(np.float32)
    y0c, y1c = np.clip(y0, 0, H - 1), np.clip(y0 + 1, 0, H - 1)
    if wrap:
        x0c, x1c = x0 % W, (x0 + 1) % W
    else:
        x0c, x1c = np.clip(x0, 0, W - 1), np.clip(x0 + 1, 0, W - 1)
    a, b, c, d = (LUT[img[y0c, x0c]], LUT[img[y0c, x1c]], LUT[img[y1c, x0c]], LUT[img[y1c, x1c]])
    if img.ndim == 3:
        tx, ty = tx[..., None], ty[..., None]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def sample(S, lon, lat):
    w = S['world']
    H, W = w.shape[:2]
    lonw = (lon + 180) % 360 - 180
    col = bilinear(w, (lonw + 180) / 360 * W - .5, (90 - lat) / 180 * H - .5, True)
    # the 500 m tile around Korea, blended in over d1_feather degrees (great-circle distance)
    r = np.pi / 180
    dist = np.degrees(np.arccos(np.clip(np.sin(lat * r) * math.sin(KOREA[1] * r) + np.cos(lat * r) * math.cos(KOREA[1] * r) * np.cos((lon - KOREA[0]) * r), -1, 1)))
    wd = np.clip((PARAMS['d1_radius'] + PARAMS['d1_feather'] / 2 - dist) / PARAMS['d1_feather'], 0, 1).astype(np.float32)
    m = wd > 0
    if m.any():
        dm, d1 = S['d1_meta'], S['d1']
        sub = bilinear(d1, (lon[m] - dm['lon0']) * dm['ppd'] - .5, (dm['lat0'] - lat[m]) * dm['ppd'] - .5, False)
        col[m] = col[m] * (1 - wd[m, None]) + sub * wd[m, None]
    L = S['lights']
    lights = bilinear(L, (lonw + 180) / 360 * L.shape[1] - .5, (90 - lat) / 180 * L.shape[0] - .5, True)
    return col, lights

# ---------- masks from the Natural Earth vectors ----------


def decode(rings, scale):
    out = []
    for r in rings:
        a = np.cumsum(np.asarray(r, np.float64).reshape(-1, 2), 0) / scale
        out.append(a)
    return out


def raster(rings, cam, N, k=2):
    """Even-odd fill of lon/lat rings projected onto the N-px disc, drawn at k x N and box-reduced (soft 1 px edge)."""
    M = N * k
    acc = np.zeros((M, M), bool)
    for ring in rings:
        x, y = project_np(ring[:, 0], ring[:, 1], cam['lon0'], cam['lat0'], cam['P'])
        px, py = (x + 1) * M / 2, (1 - y) * M / 2
        x0, x1 = int(max(0, np.floor(px.min()))), int(min(M, np.ceil(px.max()) + 1))
        y0, y1 = int(max(0, np.floor(py.min()))), int(min(M, np.ceil(py.max()) + 1))
        if x1 - x0 < 1 or y1 - y0 < 1:
            continue
        im = Image.new('1', (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(im).polygon(list(zip(px - x0, py - y0)), fill=1)
        acc[y0:y1, x0:x1] ^= np.asarray(im, bool)
    return acc.reshape(N, k, N, k).mean((1, 3)).astype(np.float32)


def masks(cam, N):
    land = json.loads((V1 / 'land-50m.json').read_text(encoding='utf8'))
    bath = json.loads((V1 / 'bathymetry-10m.json').read_text(encoding='utf8'))
    L = raster(decode(land['land'], land['scale']), cam, N)
    deep200 = raster(decode(bath['depth']['200'], bath['scale']), cam, N)
    S = np.clip(1 - deep200 - L, 0, 1)  # sea shallower than 200 m
    return L, S

# ---------- the bake ----------


def bake(src, cam, N):
    """Sample the sources onto the N-px disc (2x2 per pixel): linear colour, city lights and the disc's coverage."""
    P = cam['P']
    ss = PARAMS['ss']
    Ssrc = load_sources(src)
    base = np.zeros((N, N, 3), np.float16)
    lights = np.zeros((N, N), np.float16)
    alpha = np.zeros((N, N), np.float16)
    strip = 96
    off = (np.arange(ss) + .5) / ss
    for y0 in range(0, N, strip):
        rows = min(strip, N - y0)
        py = (y0 + np.arange(rows)[:, None] + off[None, :]).reshape(-1)
        px = (np.arange(N)[:, None] + off[None, :]).reshape(-1)
        u, v = np.broadcast_arrays((px[None, :] - N / 2) / (N / 2), (N / 2 - py[:, None]) / (N / 2))
        inside = np.hypot(u, v) <= 1
        lon, lat = inverse_np(np.where(inside, u, 0), np.where(inside, v, 0), cam['lon0'], cam['lat0'], P)[:2]
        col, lit = sample(Ssrc, lon, lat)
        cov = inside.reshape(rows, ss, N, ss).mean((1, 3))
        w = np.maximum(cov, 1e-6)
        base[y0:y0 + rows] = np.where(inside[..., None], col, 0).reshape(rows, ss, N, ss, 3).mean((1, 3)) / w[..., None]
        lights[y0:y0 + rows] = np.where(inside, lit, 0).reshape(rows, ss, N, ss).mean((1, 3)) / w
        alpha[y0:y0 + rows] = cov
    return base, lights, alpha


def geometry(cam, N):
    """Per pixel centre: soft light, limb darkening, the air band's strength and the weight of Korea's surroundings."""
    p, P = PARAMS, cam['P']
    c = (np.arange(N) + .5 - N / 2) / (N / 2)
    u, v = np.meshgrid(c, -c)
    r = np.hypot(u, v)
    inside = r <= 1
    lon, lat, X, Y, Z = inverse_np(np.where(inside, u, 0), np.where(inside, v, 0), cam['lon0'], cam['lat0'], P)
    l = np.asarray(p['light_dir'], np.float64)
    l /= np.linalg.norm(l)
    l2 = l[:2] / np.linalg.norm(l[:2])
    shade = p['shade_min'] + (1 - p['shade_min']) * smoothstep(p['shade_lo'], p['shade_hi'], X * l[0] + Y * l[1] + Z * l[2])
    shade *= 1 - (1 - p['limb_min']) * smoothstep(p['limb_r'], 1, r)
    ndv = (P * Z - 1) / np.sqrt(X * X + Y * Y + (P - Z) ** 2)  # n.v: 1 facing the viewer, 0 on the horizon
    side = (u * l2[0] + v * l2[1]) / np.maximum(r, 1e-9)       # 1 toward the light, -1 away
    air = np.clip(1 - ndv, 0, 1) ** p['air_exp'] * smoothstep(p['air_r0'], 1, r) * (p['air_back'] + (1 - p['air_back']) * (side + 1) / 2)
    (a0, b0), (a1, b1) = STUDY
    g = 4  # the study frame grown 4 degrees, with a 2 degree soft edge
    korea = (smoothstep(a0 - g - 2, a0 - g, lon) * (1 - smoothstep(a1 + g, a1 + g + 2, lon))
             * smoothstep(b0 - g - 2, b0 - g, lat) * (1 - smoothstep(b1 + g, b1 + g + 2, lat)))
    return [a.astype(np.float32) for a in (shade, air, korea)]


def masked_blur(a, m, sigma):
    return gaussian_filter(a * m, sigma) / np.maximum(gaussian_filter(m, sigma), 1e-6)


def log_tone(Y, m, ref_mask, luma_to, gains, ceiling, N):
    """Log-luma tone within mask m, in three bands split by blurs taken within m only (no halo across the coast):
    the broad base (lc_sigma) around the median of ref_mask, the middle scales (down to fine_sigma: plateaus, basins)
    and the fine relief (ridges, valleys, trenches), each scaled by its gain; soft ceiling at ceiling x luma_to."""
    base_g, mid_g, fine_g = gains
    lY = np.log(Y)
    b = masked_blur(lY, m, PARAMS['lc_sigma'] * N)
    f = masked_blur(lY, m, PARAMS['fine_sigma'] * N)
    ref = float(np.median(lY[ref_mask])) if ref_mask.any() else float(lY[m > .5].mean())
    out = np.exp(base_g * (b - ref) + mid_g * (f - b) + fine_g * (lY - f)) * luma_to
    return ceiling * luma_to * np.tanh(out / (ceiling * luma_to))


def tone(base, lights, alpha, cam, N):
    p = PARAMS
    shade, air, korea = geometry(cam, N)
    L, S = masks(cam, N)
    inside = alpha > 0
    sea = (1 - L) * inside
    landm = L * inside
    Y = np.maximum(luma(base), 1e-5)
    chroma = base / Y[..., None]
    # sea: a night blue, the broad range pressed together, the sea-floor relief kept
    ref = (sea > .99) & (S < .01)
    Ysea = (log_tone(Y, sea, ref, p['sea_luma'], p['sea_gains'], p['sea_max'], N) * (1 - S)
            + log_tone(Y, sea, ref, p['sea_luma'], p['shelf_gains'], p['sea_max'], N) * S)
    tint = np.asarray(p['sea_tint'], np.float32)
    sea_rgb = Ysea[..., None] * (chroma * (1 - p['sea_tint_w']) + tint / luma(tint) * p['sea_tint_w'])
    # land: much darker, a blue-grey, ranges and plains brought out, snow and desert pressed down
    Yland = log_tone(Y, landm, landm > .99, p['land_luma'], p['land_gains'], p['land_max'], N)
    ltint = np.asarray(p['land_tint'], np.float32)
    land_rgb = Yland[..., None] * ((1 + p['land_sat'] * (chroma - 1)) * (1 - p['land_tint_w']) + ltint / luma(ltint) * p['land_tint_w'])
    out = sea_rgb * (1 - L[..., None]) + land_rgb * L[..., None]
    del sea_rgb, land_rgb, chroma
    # the shelf: brightened and turned teal (its floor keeps its texture), a soft halo past its edge, a little onto the
    # coast, all stronger around Korea; and a thin bright line of shallow water along every coast
    s1, s2 = (x * N for x in p['shelf_sigma'])
    G = (1 - p['shelf_wide_w']) * gaussian_filter(S, s1) + p['shelf_wide_w'] * gaussian_filter(S, s2)
    boost = 1 + (p['korea_boost'] - 1) * korea
    on = (1 - L) + L * p['shelf_on_land']
    m = np.clip(G * boost, 0, 1.5) * on
    teal = np.asarray(p['shelf_color'], np.float32)
    teal = teal / luma(teal)
    Yo = np.maximum(luma(out), 1e-6)[..., None]
    t = (np.clip(m, 0, 1) * p['shelf_tint'])[..., None]
    out = Yo * (1 + p['shelf_gain'] * m)[..., None] * (out / Yo * (1 - t) + teal * t)
    out = screen(out, p['shelf_color'], np.clip(G * p['shelf_amax'] * boost, 0, .95) * on)
    k = max(1, round(p['coast_px'] * N / 2400))
    band = np.clip(gaussian_filter(maximum_filter(L, size=2 * k + 1), max(.5, N / 2400)) - L, 0, 1)
    out = screen(out, p['coast_color'], np.clip(band * p['coast_amax'] * boost, 0, .95) * (1 - L))
    # lights on land only: the land mask eroded, then cut to whole land pixels (no fishing fleets, no glow over the sea)
    e = max(1, round(p['lights_erode_px'] * N / 2400))
    keep = (minimum_filter(L, size=2 * e + 1) > .5).astype(np.float32) * L
    lit = np.tanh((lights * p['lights_gain']) ** p['lights_gamma'] / p['lights_amax']) * p['lights_amax'] * keep
    out = out + np.asarray(p['lights_color'], np.float32) * lit[..., None]
    # light from the upper left, the limb, the air inside the rim
    out = out * shade[..., None] * p['exposure']
    out = out + np.asarray(p['air_color'], np.float32) * (air * p['air_amax'])[..., None]
    sea_lights = float(lit[sea > .5].max()) if (sea > .5).any() else 0.0
    return out, alpha, {'sea_lights_max': sea_lights, 'land_lit_px': int((lit > .01).sum())}


def encode(rgb, alpha, size, pad, q):
    """Linear RGB + alpha (N, N) to an sRGB WebP of size + 2 pad px (the disc keeps its diameter = size)."""
    N = rgb.shape[0]
    if size != N:
        ch = [np.asarray(Image.fromarray(np.ascontiguousarray(c)).resize((size, size), Image.LANCZOS)) for c in
              (rgb[..., 0] * alpha, rgb[..., 1] * alpha, rgb[..., 2] * alpha, alpha)]
        a = np.clip(ch[3], 0, 1)
        rgb = np.stack(ch[:3], -1) / np.maximum(a, 1e-6)[..., None]
        alpha = a
    img = np.zeros((size + 2 * pad, size + 2 * pad, 4), np.uint8)
    img[pad:pad + size, pad:pad + size, :3] = np.round(to_srgb(rgb) * 255)
    img[pad:pad + size, pad:pad + size, 3] = np.round(np.clip(alpha, 0, 1) * 255)
    im = Image.fromarray(img)
    return im, q


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_source(cam, src_info, outputs, d1_meta, world_meta):
    p = {k: v for k, v in PARAMS.items()}
    lines = [
        'Entry-screen globe (dist/intro.js), baked by scripts/bake_globe.py from NASA imagery. Background picture, not data.',
        '',
        'Sources (downloaded 2026-10-13 from the NASA Earth Observatory pages below; kept outside the repository):',
    ]
    for key, (name, url) in SOURCES.items():
        s = src_info[key]
        lines.append(f'  {name}  {s["size"][0]}x{s["size"][1]}  {s["bytes"]} bytes  sha256 {s["sha256"]}')
        lines.append(f'    {url}')
    lines += [
        '  Blue Marble Next Generation w/ Topography and Bathymetry, August 2004 (world 2 km and 500 m tile D1 = 90-180E, 0-90N):',
        '    https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/',
        '  Black Marble 2016 grayscale, 3 km: https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/',
        '  Land and 200 m shelf masks: dist/vendor/globe-v1/land-50m.json, bathymetry-10m.json (Natural Earth, public domain).',
        '',
        'Terms (https://www.nasa.gov/nasa-brand-center/images-and-media/, read 2026-10-13): NASA imagery is generally not',
        'subject to copyright in the United States and may be used on web pages for educational or informational purposes;',
        'factual use that does not imply endorsement needs no permission; NASA should be acknowledged as the source. The',
        'NASA insignia, logotype and identifiers are protected and are not used. Credited on the entry screen ("지구 영상:',
        'NASA Blue Marble·Black Marble") and in the app\'s 근거와 방법 source list.',
        '',
        'Processing: vertical perspective of camera.json, 2x2 supersampled; D1 decoded at '
        f'{d1_meta["decoded"][0]}x{d1_meta["decoded"][1]} (1 km, libjpeg DCT 1/2) within {PARAMS["d1_radius"]} degrees of Korea, '
        f'blended {PARAMS["d1_feather"]} degrees into the world decoded at {world_meta["decoded"][0]}x{world_meta["decoded"][1]} (4 km);',
        'worked in linear RGB: sea toned to a night blue with local contrast on the sea floor relief, land darkened to a',
        'blue-grey with local contrast, a teal glow from the Natural Earth 200 m shelf (stronger around Korea) and a thin',
        'shallow-water line along the coasts, Black Marble city lights added on land only (the land mask eroded 2 px, so the',
        f'fishing fleets in the East and Yellow Seas are dropped; checked: largest light over the sea = 0; {LIT["land_px"]} land px lit above 1%), soft light from the',
        'upper left, limb darkening and a Fresnel air band inside the rim. No outer glow (the screen draws it). sRGB WebP.',
        'PARAMS: ' + json.dumps(p, ensure_ascii=False),
        '',
        'Outputs (file  sha256  bytes  WxH):',
    ]
    for name, (h, b, wh) in outputs.items():
        lines.append(f'  {name}  {h}  {b}  {wh[0]}x{wh[1]}')
    lines.append('')
    (OUT / 'SOURCE.txt').write_text('\n'.join(lines), encoding='utf8', newline='\n')


def read_outputs():
    out = {}
    for line in (OUT / 'SOURCE.txt').read_text(encoding='utf8').splitlines():
        parts = line.split()
        if len(parts) == 4 and parts[0].startswith('globe-') and parts[0].endswith('.webp'):
            w, h = parts[3].split('x')
            out[parts[0]] = (parts[1], int(parts[2]), (int(w), int(h)))
    return out


def check():
    cam = json.loads((OUT / 'camera.json').read_text(encoding='utf8'))
    listed = read_outputs()
    bad = []
    for size in cam['bake']['sizes']:
        name = f'globe-{size}.webp'
        f = OUT / name
        if name not in listed:
            bad.append(f'{name}: not in SOURCE.txt')
            continue
        h, b, wh = listed[name]
        if not f.exists():
            bad.append(f'{name}: missing')
            continue
        if sha(f) != h or f.stat().st_size != b:
            bad.append(f'{name}: sha256/bytes differ from SOURCE.txt')
        if f.stat().st_size > LIMITS[size]:
            bad.append(f'{name}: {f.stat().st_size} bytes > {LIMITS[size]}')
        pad = cam['bake']['pad'][str(size)]
        if Image.open(f).size != (size + 2 * pad,) * 2 or wh != (size + 2 * pad,) * 2:
            bad.append(f'{name}: size {Image.open(f).size} != {size + 2 * pad}')
    for b_ in bad:
        print('FAIL', b_)
    if not bad:
        print('PASS: ' + ', '.join(f'{n} {listed[n][1]} B' for n in sorted(listed)) + ' match SOURCE.txt and the size limits')
    return not bad

# ---------- comparison with the design ----------

DW, DH = 1672, 941
# regions in design pixels (boxes clear of the copy, the cells' lines and the card)
REGIONS = {
    '중국 내륙 육지': (820, 330, 900, 400),
    '한반도 육지': (1112, 362, 1138, 398),
    '황해 대륙붕': (1066, 380, 1092, 420),  # between the design's cell lines
    '동해 깊은 바다': (1190, 300, 1240, 350),
    '필리핀 해 깊은 바다': (1100, 600, 1180, 680),
}
DESIGN_RIM = (1259.5, 695.7, 718.4)  # fit_camera.py
SECTOR = (112, 138)  # degrees (math, from +x anticlockwise): the upper-left rim, above the copy


def region_masks(circle):
    yy, xx = np.mgrid[0:DH, 0:DW]
    out = {}
    for k, (x0, y0, x1, y1) in REGIONS.items():
        m = np.zeros((DH, DW), bool)
        m[y0:y1, x0:x1] = True
        out[k] = m
    cx, cy, R = circle
    r = np.hypot(xx - cx, yy - cy) / R
    ang = np.degrees(np.arctan2(cy - yy, xx - cx))
    sec = (ang >= SECTOR[0]) & (ang <= SECTOR[1]) & (yy > 80)
    out['구 가장자리 대기 띠'] = sec & (r >= .93) & (r <= .99)
    out['글로 바깥'] = sec & (r >= 1.01) & (r <= 1.04)
    return out


def measure(img, circle):
    a = np.asarray(img.convert('RGB'), np.float32)
    L = lab(a)
    hp = L[..., 0] - gaussian_filter(L[..., 0], 3)
    res = {}
    for k, m in region_masks(circle).items():
        lum = L[..., 0][m]
        res[k] = {'lab': L[m].mean(0), 'lc': float(hp[m].std()), 'lc95': float(hp[m][lum <= np.percentile(lum, 95)].std())}
    return res


def place(cam, path_webp):
    """The bake as the screen puts it at the design size, over the screen's background (no outer glow, no overlays)."""
    f = cam['frame']
    cx, cy, R = f['cx'] * DW, f['cy'] * DH, f['R'] * DH
    im = Image.open(path_webp).convert('RGBA')
    size = cam['bake']['sizes'][-1]
    pad = cam['bake']['pad'][str(size)]
    k = 2 * R / size
    full = im.resize((round(im.size[0] * k), round(im.size[1] * k)), Image.LANCZOS)
    bg = Image.new('RGBA', (DW, DH), (4, 16, 27, 255))
    bg.alpha_composite(full, (round(cx - R - pad * k), round(cy - R - pad * k)))
    return bg, (cx, cy, R)


def compare(design_path, shot):
    cam = json.loads((OUT / 'camera.json').read_text(encoding='utf8'))
    d = measure(Image.open(design_path), DESIGN_RIM)
    if shot:
        img = Image.open(shot)
        if img.size != (DW, DH):
            img = img.resize((DW, DH), Image.LANCZOS)
        f = cam['frame']
        circle = (f['cx'] * DW, f['cy'] * DH, f['R'] * DH)
    else:
        img, circle = place(cam, OUT / f'globe-{cam["bake"]["sizes"][-1]}.webp')
    o = measure(img, circle)
    rows, ok = [], True
    print('| 영역 | 시안 L*a*b* | 결과 L*a*b* | ΔE76 | local contrast 시안 / 결과 (비율) | 결과 | 참고: 밝은 5% 뺀 local contrast (비율) |')
    print('|---|---|---|---|---|---|---|')
    for k in d:
        if k == '글로 바깥' and not shot:
            print('| 글로 바깥 | (화면이 그린다: --shot 캡처로만 잰다) | | | | | |')
            continue
        dE = float(np.linalg.norm(d[k]['lab'] - o[k]['lab']))
        ratio = o[k]['lc'] / max(d[k]['lc'], 1e-6)
        good = dE <= 12 and .7 <= ratio <= 1.4
        ok &= good
        fmt = lambda v: ', '.join(f'{x:.1f}' for x in v)
        print(f"| {k} | {fmt(d[k]['lab'])} | {fmt(o[k]['lab'])} | {dE:.1f} | {d[k]['lc']:.2f} / {o[k]['lc']:.2f} ({ratio:.2f}) | {'통과' if good else '실패'} | {d[k]['lc95']:.2f} / {o[k]['lc95']:.2f} ({o[k]['lc95'] / max(d[k]['lc95'], 1e-6):.2f}) |")
        rows.append({'region': k, 'design': d[k]['lab'].round(2).tolist(), 'result': o[k]['lab'].round(2).tolist(), 'dE': round(dE, 2),
                     'lc_design': round(d[k]['lc'], 3), 'lc_result': round(o[k]['lc'], 3), 'lc_ratio': round(ratio, 3), 'pass': bool(good),
                     'lc95_design': round(d[k]['lc95'], 3), 'lc95_result': round(o[k]['lc95'], 3)})
    print('PASS' if ok else 'FAIL', '(ΔE ≤ 12, local contrast ratio 0.7–1.4)')
    return ok, rows

def compare_shots(a_path, b_path):
    """Two captures of the start pose at the design size (A: the still picture, B: the WebGL globe): Lab per region and
    the mean ΔE76 over the whole disc on screen. Same overlays on both, so what differs is the globe."""
    cam = json.loads((OUT / 'camera.json').read_text(encoding='utf8'))
    f = cam['frame']
    circle = (f['cx'] * DW, f['cy'] * DH, f['R'] * DH)
    imgs = []
    for path in (a_path, b_path):
        im = Image.open(path).convert('RGB')
        imgs.append(im if im.size == (DW, DH) else im.resize((DW, DH), Image.LANCZOS))
    A, B = (measure(im, circle) for im in imgs)
    La, Lb = (lab(np.asarray(im, np.float32)) for im in imgs)
    yy, xx = np.mgrid[0:DH, 0:DW]
    disc = np.hypot(xx - circle[0], yy - circle[1]) <= circle[2] * .985
    dE = np.linalg.norm(La - Lb, axis=-1)
    rows = []
    print('| 영역 | 고정 그림 L*a*b* | WebGL L*a*b* | ΔE76 |')
    print('|---|---|---|---|')
    fmt = lambda v: ', '.join(f'{x:.1f}' for x in v)
    for k in A:
        d = float(np.linalg.norm(A[k]['lab'] - B[k]['lab']))
        rows.append({'region': k, 'still': A[k]['lab'].round(2).tolist(), 'webgl': B[k]['lab'].round(2).tolist(), 'dE': round(d, 2)})
        print(f'| {k} | {fmt(A[k]["lab"])} | {fmt(B[k]["lab"])} | {d:.2f} |')
    mean, p95 = float(dE[disc].mean()), float(np.percentile(dE[disc], 95))
    worst = max(r['dE'] for r in rows)
    rows.append({'region': '화면 안 구 전체 (픽셀별)', 'mean_dE': round(mean, 2), 'p95_dE': round(p95, 2)})
    print(f'| 화면 안 구 전체 (픽셀별) | | | 평균 {mean:.2f}, 95% {p95:.2f} |')
    ok = mean <= 3 and worst <= 3
    print('PASS' if ok else 'FAIL', '(mean ΔE76 over the disc ≤ 3 and every region ≤ 3: hard to tell apart side by side)')
    return ok, rows

# ---------- the turning globe (--equirect): position-free textures for the screen's WebGL shader ----------
# The screen (dist/intro.js) now turns the camera a little, so the picture can no longer be one projected view. Every
# step that belongs to a place on Earth (tone and sea-floor relief, the shelf glow, the coast line, the city lights)
# is worked out here on a longitude-latitude grid; the steps that belong to a place on the screen (the light from the
# upper left, the limb, the air band) move into the shader with the same formulas as geometry() above. Output:
# dist/vendor/globe-v3/ (textures.json, SOURCE.txt), globe-v2 stays as the picture for screens without WebGL.

OUT3 = ROOT / 'dist' / 'vendor' / 'globe-v3'
GRID_PPD = 30  # the grid: the 2 km world decoded at 1/2 (10800 x 5400), pixel centres on (i + .5) / 30 degrees
# textures: (file, lon range, lat range, size), the detail tile where the screen looks closely, the world for the rest
TEXTURES = {
    'full': {'detail': ('detail-2048.webp', (95, 180), (-5, 62), (2048, 1608)), 'world': ('world-2048.webp', (-180, 180), (-90, 90), (2048, 1024))},
    'small': {'detail': ('detail-1024.webp', (95, 180), (-5, 62), (1024, 804)), 'world': ('world-1024.webp', (-180, 180), (-90, 90), (1024, 512))},
}
FEATHER = 3.0  # degrees: the detail tile fades into the world inside its edges
LIMITS3 = {'full': 700_000, 'small': 260_000, 'detail-2048.webp': 480_000, 'world-2048.webp': 260_000,
           'detail-1024.webp': 160_000, 'world-1024.webp': 110_000}
QUALITY3 = {'detail-2048.webp': 80, 'world-2048.webp': 80, 'detail-1024.webp': 82, 'world-1024.webp': 82}
REF_LAT = 36.0  # the grid's longitude pixels are this much narrower on the ground at Korea's latitude


def v2_scale(cam):
    """Pixels per degree of the 2400 picture at Korea, north-south and east-west on the ground: the screen-space blurs
    and pixel widths of the recipe become degrees with these, so at the start pose the grid tone matches globe-v2."""
    N = cam['bake']['sizes'][-1]
    a = perspective(*KOREA, cam['lon0'], cam['lat0'], cam['P'])
    b = perspective(KOREA[0], KOREA[1] + .1, cam['lon0'], cam['lat0'], cam['P'])
    c = perspective(KOREA[0] + .1 / math.cos(math.radians(KOREA[1])), KOREA[1], cam['lon0'], cam['lat0'], cam['P'])
    return math.hypot(b[0] - a[0], b[1] - a[1]) * N / 2 * 10, math.hypot(c[0] - a[0], c[1] - a[1]) * N / 2 * 10


def grid_px(cam, v2px):
    """A length of v2px pixels on the 2400 picture as (rows, columns) of the grid."""
    ns, ew = v2_scale(cam)
    return v2px / ns * GRID_PPD, v2px / ew * GRID_PPD / math.cos(math.radians(REF_LAT))


def grid_base(src):
    """The world at 30 px/degree in linear light, the 500 m tile D1 averaged 4 x 4 onto the same pixels within
    d1_radius of Korea and blended over d1_feather (as sample() does for the picture), and the city lights."""
    im = Image.open(src / SOURCES['world'][0])
    im.draft('RGB', (10800, 5400))
    world = np.asarray(im.convert('RGB'))
    del im
    H, W = world.shape[:2]
    assert (W, H) == (360 * GRID_PPD, 180 * GRID_PPD), (W, H)
    base = np.empty((H, W, 3), np.float32)
    for y in range(0, H, 600):
        base[y:y + 600] = LUT[world[y:y + 600]]
    del world
    lat = 90 - (np.arange(H) + .5) / GRID_PPD
    lon = -180 + (np.arange(W) + .5) / GRID_PPD
    # D1 (90-180E, 0-90N) decoded at 1/2 = 120 px/degree: whole 4 x 4 blocks fall on grid pixels
    R = PARAMS['d1_radius'] + PARAMS['d1_feather']
    dlon = math.degrees(math.asin(min(1, math.sin(math.radians(R)) / math.cos(math.radians(KOREA[1])))))
    lon_r = (max(90, KOREA[0] - dlon), min(180, KOREA[0] + dlon))
    lat_r = (max(0, KOREA[1] - R), min(90, KOREA[1] + R))
    c0, c1 = int((lon_r[0] + 180) * GRID_PPD), int(math.ceil((lon_r[1] + 180) * GRID_PPD))
    r0, r1 = int((90 - lat_r[1]) * GRID_PPD), int(math.ceil((90 - lat_r[0]) * GRID_PPD))
    im = Image.open(src / SOURCES['d1'][0])
    im.draft('RGB', (10800, 10800))
    k = im.size[0] // (90 * GRID_PPD)
    assert k * 90 * GRID_PPD == im.size[0] == im.size[1], im.size
    x0 = (c0 - (90 + 180) * GRID_PPD) * k
    d1 = np.asarray(im.crop((x0, r0 * k, x0 + (c1 - c0) * k, r1 * k)))
    del im
    rad = np.pi / 180
    for y in range(r0, r1, 200):
        y1 = min(y + 200, r1)
        blk = LUT[d1[(y - r0) * k:(y1 - r0) * k]].reshape(y1 - y, k, c1 - c0, k, 3).mean((1, 3))
        la, lo = lat[y:y1, None], lon[None, c0:c1]
        dist = np.degrees(np.arccos(np.clip(np.sin(la * rad) * math.sin(KOREA[1] * rad) + np.cos(la * rad) * math.cos(KOREA[1] * rad) * np.cos((lo - KOREA[0]) * rad), -1, 1)))
        wd = np.clip((PARAMS['d1_radius'] + PARAMS['d1_feather'] / 2 - dist) / PARAMS['d1_feather'], 0, 1).astype(np.float32)[..., None]
        base[y:y1, c0:c1] = base[y:y1, c0:c1] * (1 - wd) + blk * wd
    del d1
    L = np.asarray(Image.open(src / SOURCES['lights'][0]).convert('L'))
    lights = np.empty((H, W), np.float32)
    fx = (lon + 180) / 360 * L.shape[1] - .5
    for y in range(0, H, 300):
        fy = (90 - lat[y:y + 300]) / 180 * L.shape[0] - .5
        gx, gy = np.broadcast_arrays(fx[None, :], fy[:, None])
        lights[y:y + 300] = bilinear(L, gx, gy, True)
    return base, lights, lon, lat


def grid_raster(rings, H, W, k=2):
    """Even-odd fill of lon/lat rings on the grid (drawn at k x and box-reduced, as raster() does on the disc). The
    globe-v1 rings run 28-254E split at 180, so a ring east of it is moved back by 360."""
    acc = np.zeros((H * k, W * k), bool)
    s = GRID_PPD * k
    for ring in rings:
        lon = ring[:, 0] - (360 if ring[:, 0].mean() > 180 else 0)
        px, py = (lon + 180) * s, (90 - ring[:, 1]) * s
        x0, x1 = int(max(0, np.floor(px.min()))), int(min(W * k, np.ceil(px.max()) + 1))
        y0, y1 = int(max(0, np.floor(py.min()))), int(min(H * k, np.ceil(py.max()) + 1))
        if x1 - x0 < 1 or y1 - y0 < 1:
            continue
        im = Image.new('1', (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(im).polygon(list(zip(px - x0, py - y0)), fill=1)
        acc[y0:y1, x0:x1] ^= np.asarray(im, bool)
    return acc.reshape(H, k, W, k).mean((1, 3), dtype=np.float32)


def disc_refs(cam, Y, L, S):
    """The medians globe-v2's tone started from (log luma of the open sea and of the land seen in its 2400 disc), read
    off the grid through the start camera, so the grid tone keeps globe-v2's brightness at the start pose."""
    N = cam['bake']['sizes'][-1]
    c = (np.arange(N) + .5 - N / 2) / (N / 2)
    u, v = np.meshgrid(c, -c)
    m = np.hypot(u, v) <= 1
    lon, lat = inverse_np(u[m], v[m], cam['lon0'], cam['lat0'], cam['P'])[:2]
    i = np.clip(((90 - lat) * GRID_PPD).astype(np.int64), 0, Y.shape[0] - 1)
    j = (((lon + 180) % 360) * GRID_PPD).astype(np.int64) % Y.shape[1]
    y, l, s = np.log(Y[i, j]), L[i, j], S[i, j]
    return float(np.median(y[(l < .01) & (s < .01)])), float(np.median(y[l > .99]))


def grid_tone(base, lights, lon, lat, cam):
    """tone() on the grid without the screen steps: the same recipe and PARAMS, the screen-pixel lengths turned into
    grid pixels at Korea (grid_px), the longitude axis wrapping round, the medians taken as globe-v2 took them."""
    p = PARAMS
    H, W = base.shape[:2]
    modes = ('reflect', 'wrap')
    land = json.loads((V1 / 'land-50m.json').read_text(encoding='utf8'))
    bath = json.loads((V1 / 'bathymetry-10m.json').read_text(encoding='utf8'))
    L = grid_raster(decode(land['land'], land['scale']), H, W)
    S = np.clip(1 - grid_raster(decode(bath['depth']['200'], bath['scale']), H, W) - L, 0, 1)
    # the globe-v1 vectors cover 28-254E, 62S-90N (everything the turning camera can show): outside it no mask
    bw, bs, be, bn = land['box']
    inbox = ((lat[:, None] >= bs) & (lat[:, None] <= bn) & (((lon[None, :] - bw) % 360) <= be - bw))
    (a0, b0), (a1, b1) = STUDY
    g = 4
    korea = (smoothstep(a0 - g - 2, a0 - g, lon)[None, :] * (1 - smoothstep(a1 + g, a1 + g + 2, lon))[None, :]
             * (smoothstep(b0 - g - 2, b0 - g, lat) * (1 - smoothstep(b1 + g, b1 + g + 2, lat)))[:, None]).astype(np.float32)
    Y = np.maximum(luma(base), 1e-5)
    ref_sea, ref_land = disc_refs(cam, Y, L, S)
    lc, fine = grid_px(cam, p['lc_sigma'] * 2400), grid_px(cam, p['fine_sigma'] * 2400)

    def blur(a, m, sigma):
        return gaussian_filter(a * m, sigma, mode=modes) / np.maximum(gaussian_filter(m, sigma, mode=modes), 1e-6)

    def tone_band(lY, m, ref, luma_to, gains, ceiling):
        bg, mg, fg = gains
        b, f = blur(lY, m, lc), blur(lY, m, fine)
        out = np.exp(bg * (b - ref) + mg * (f - b) + fg * (lY - f)) * luma_to
        return ceiling * luma_to * np.tanh(out / (ceiling * luma_to))

    lY = np.log(Y)
    sea = 1 - L
    Ysea = (tone_band(lY, sea, ref_sea, p['sea_luma'], p['sea_gains'], p['sea_max']) * (1 - S)
            + tone_band(lY, sea, ref_sea, p['sea_luma'], p['shelf_gains'], p['sea_max']) * S)
    Yland = tone_band(lY, L, ref_land, p['land_luma'], p['land_gains'], p['land_max'])
    del lY
    chroma = base / Y[..., None]
    del base
    tint = np.asarray(p['sea_tint'], np.float32)
    ltint = np.asarray(p['land_tint'], np.float32)
    out = (Ysea[..., None] * (chroma * (1 - p['sea_tint_w']) + tint / luma(tint) * p['sea_tint_w'])) * (1 - L[..., None])
    out += (Yland[..., None] * ((1 + p['land_sat'] * (chroma - 1)) * (1 - p['land_tint_w']) + ltint / luma(ltint) * p['land_tint_w'])) * L[..., None]
    del chroma, Ysea, Yland, Y
    s1, s2 = (grid_px(cam, x * 2400) for x in p['shelf_sigma'])
    G = (1 - p['shelf_wide_w']) * gaussian_filter(S, s1, mode=modes) + p['shelf_wide_w'] * gaussian_filter(S, s2, mode=modes)
    boost = 1 + (p['korea_boost'] - 1) * korea
    on = (1 - L) + L * p['shelf_on_land']
    m = np.clip(G * boost, 0, 1.5) * on
    teal = np.asarray(p['shelf_color'], np.float32)
    teal = teal / luma(teal)
    Yo = np.maximum(luma(out), 1e-6)[..., None]
    t = (np.clip(m, 0, 1) * p['shelf_tint'])[..., None]
    out = Yo * (1 + p['shelf_gain'] * m)[..., None] * (out / Yo * (1 - t) + teal * t)
    del Yo, t, m
    out = screen(out, p['shelf_color'], np.clip(G * p['shelf_amax'] * boost, 0, .95) * on)
    del G, on
    ky, kx = (max(1, round(v)) for v in grid_px(cam, p['coast_px']))
    by, bx = (max(.5, v) for v in grid_px(cam, 1))
    band = np.clip(gaussian_filter(maximum_filter(L, size=(2 * ky + 1, 2 * kx + 1), mode=modes), (by, bx), mode=modes) - L, 0, 1)
    out = screen(out, p['coast_color'], np.clip(band * p['coast_amax'] * boost, 0, .95) * (1 - L))
    del band
    ey, ex = (max(1, round(v)) for v in grid_px(cam, p['lights_erode_px']))
    keep = (minimum_filter(L, size=(2 * ey + 1, 2 * ex + 1), mode=modes) > .5).astype(np.float32) * L
    lit = np.tanh((lights * p['lights_gain']) ** p['lights_gamma'] / p['lights_amax']) * p['lights_amax'] * keep
    out += np.asarray(p['lights_color'], np.float32) * lit[..., None]
    out *= p['exposure']
    # outside the vectors' box nothing is masked or ever shown: one flat open-sea colour (it also packs small)
    flat = tint / luma(tint) * p['sea_luma']
    out[~inbox] = flat
    info = {'sea_lights_max': float(lit[(L < .5) & inbox].max()), 'land_lit_px': int((lit > .01).sum()),
            'ref_sea': ref_sea, 'ref_land': ref_land, 'max_value': float(out[inbox].max()),
            'over_1_px': int((out[inbox] > 1).any(-1).sum()), 'grid_px': {'lc': lc, 'fine': fine, 'shelf': (s1, s2), 'coast': (ky, kx), 'erode': (ey, ex)}}
    return out, info


def crop_resize(out, lon_r, lat_r, size):
    """The grid's lon/lat box resized (Lanczos, in linear light) to size, as sRGB uint8: the texture's edges are the
    box's edges (the shader maps the box onto 0..1)."""
    if lon_r == (-180, 180):
        a = out
    else:
        c0, c1 = round((lon_r[0] + 180) * GRID_PPD), round((lon_r[1] + 180) * GRID_PPD)
        r0, r1 = round((90 - lat_r[1]) * GRID_PPD), round((90 - lat_r[0]) * GRID_PPD)
        a = out[r0:r1, c0:c1]
    ch = [np.asarray(Image.fromarray(np.ascontiguousarray(a[..., i])).resize(size, Image.LANCZOS)) for i in range(3)]
    return Image.fromarray(np.round(to_srgb(np.stack(ch, -1)) * 255).astype(np.uint8), 'RGB')


def write_source3(src_info, files, info):
    p3 = {'grid_ppd': GRID_PPD, 'ref_lat': REF_LAT, 'feather': FEATHER, 'quality': QUALITY3}
    lines = [
        'Entry-screen turning globe (dist/intro.js WebGL shader), baked by scripts/bake_globe.py --equirect from NASA',
        'imagery. Background picture, not data. Without WebGL the screen draws the still picture in ../globe-v2 instead.',
        '',
        'Sources (the same files as ../globe-v2/SOURCE.txt, checked by sha256; kept outside the repository):',
    ]
    for key, (name, url) in SOURCES.items():
        s = src_info[key]
        lines.append(f'  {name}  {s["size"][0]}x{s["size"][1]}  {s["bytes"]} bytes  sha256 {s["sha256"]}')
        lines.append(f'    {url}')
    lines += [
        '  Land and 200 m shelf masks: dist/vendor/globe-v1/land-50m.json, bathymetry-10m.json (Natural Earth, public domain).',
        '',
        'Terms (https://www.nasa.gov/nasa-brand-center/images-and-media/, read 2026-10-13): NASA imagery is generally not',
        'subject to copyright in the United States and may be used on web pages for educational or informational purposes;',
        'factual use that does not imply endorsement needs no permission; NASA should be acknowledged as the source. The',
        'NASA insignia, logotype and identifiers are protected and are not used. Credited on the entry screen ("지구 영상:',
        'NASA Blue Marble·Black Marble") and in the app\'s 근거와 방법 source list.',
        '',
        'Processing: a longitude-latitude grid at 30 px/degree (the world decoded at 10800x5400, the 500 m tile D1 decoded',
        f'at 10800x10800 and averaged 4x4 onto it within {PARAMS["d1_radius"]} degrees of Korea, blended over {PARAMS["d1_feather"]} degrees);',
        'globe-v2\'s recipe and PARAMS in linear RGB, only the steps tied to a place on Earth: sea toned to a night blue with',
        'local contrast on the sea floor relief, land darkened to a blue-grey, the teal glow of the Natural Earth 200 m shelf',
        '(stronger around Korea), a thin shallow-water line along the coasts, Black Marble city lights on land only (land',
        f'mask eroded, so no fishing fleets; checked: largest light over the sea = {info["sea_lights_max"]:g}; {info["land_lit_px"]} grid px lit above 1%).',
        'Blurs and pixel widths that globe-v2 set in screen pixels are the same lengths on the ground at Korea',
        f'(grid px rows, columns: {json.dumps({k: (np.round(v, 2).tolist() if isinstance(v, tuple) else v) for k, v in info["grid_px"].items()})});',
        f'tone medians as globe-v2 read them in its start-pose disc (log luma sea {info["ref_sea"]:.4f}, land {info["ref_land"]:.4f}).',
        'Left to the shader (the place on the screen): the light from the upper left, limb darkening and the Fresnel air',
        'band (globe-v2 PARAMS light_dir, shade_*, limb_*, air_*). Outside the vectors\' box (28-254E, 62S-90N), never on',
        'screen, a flat open-sea colour. Each texture: the box resized with Lanczos in linear light, sRGB WebP without alpha.',
        'PARAMS: ' + json.dumps({k: v for k, v in PARAMS.items()}, ensure_ascii=False),
        'PARAMS3: ' + json.dumps(p3, ensure_ascii=False),
        '',
        'Outputs (file  sha256  bytes  WxH  lon  lat):',
    ]
    for name, (h, b, wh, lo, la) in files.items():
        lines.append(f'  {name}  {h}  {b}  {wh[0]}x{wh[1]}  {lo[0]}..{lo[1]}  {la[0]}..{la[1]}')
    lines.append('')
    (OUT3 / 'SOURCE.txt').write_text('\n'.join(lines), encoding='utf8', newline='\n')


def textures_json():
    return {'about': 'Textures of the entry-screen turning globe (dist/intro.js TEXTURES keeps the same numbers): longitude-'
                     'latitude boxes, row 0 at the north edge. The detail tile fades into the world over feather degrees '
                     'inside its edges. full for most screens, small for phones and slow connections.',
            'feather': FEATHER,
            'sets': {k: {t: {'file': f, 'lon': list(lo), 'lat': list(la), 'size': list(sz)} for t, (f, lo, la, sz) in v.items()} for k, v in TEXTURES.items()}}


def bake_equirect(src, cache):
    cam = json.loads((OUT / 'camera.json').read_text(encoding='utf8'))
    src_info = {}
    for key, (name, _) in SOURCES.items():
        f = src / name
        src_info[key] = {'sha256': sha(f), 'bytes': f.stat().st_size, 'size': Image.open(f).size}
    if cache and cache.exists():
        z = np.load(cache)
        out, info = z['out'], json.loads(str(z['info']))
    else:
        base, lights, lon, lat = grid_base(src)
        out, info = grid_tone(base, lights, lon, lat, cam)
        del base, lights
        if cache:
            np.savez(cache, out=out, info=json.dumps(info))
    assert info['sea_lights_max'] == 0, f'city lights over the sea: {info["sea_lights_max"]}'
    print('check: largest light over the sea =', info['sea_lights_max'], '; grid px lit above 1% =', info['land_lit_px'],
          '; tone medians', round(info['ref_sea'], 4), round(info['ref_land'], 4), '; max value', round(info['max_value'], 3), '(px over 1:', info['over_1_px'], ')')
    OUT3.mkdir(parents=True, exist_ok=True)
    files = {}
    for set_name, tex in TEXTURES.items():
        for _, (name, lo, la, size) in tex.items():
            im = crop_resize(out, lo, la, size)
            f = OUT3 / name
            q = QUALITY3[name]
            while True:
                im.save(f, 'WEBP', quality=q, method=6)
                if f.stat().st_size <= LIMITS3[name] or q <= 60:
                    break
                q -= 2
            QUALITY3[name] = q
            files[name] = (sha(f), f.stat().st_size, im.size, lo, la)
            print(name, im.size, f.stat().st_size, 'bytes, quality', q)
    (OUT3 / 'textures.json').write_text(json.dumps(textures_json(), ensure_ascii=False, indent=1) + '\n', encoding='utf8', newline='\n')
    write_source3(src_info, files, info)


def read_outputs3():
    out = {}
    for line in (OUT3 / 'SOURCE.txt').read_text(encoding='utf8').splitlines():
        parts = line.split()
        if len(parts) == 6 and parts[0].endswith('.webp'):
            w, h = parts[3].split('x')
            out[parts[0]] = (parts[1], int(parts[2]), (int(w), int(h)))
    return out


def check3():
    listed, bad = read_outputs3(), []
    tj = json.loads((OUT3 / 'textures.json').read_text(encoding='utf8'))
    if tj != json.loads(json.dumps(textures_json(), ensure_ascii=False)):
        bad.append('textures.json differs from TEXTURES in bake_globe.py')
    for set_name, tex in TEXTURES.items():
        total = 0
        for _, (name, lo, la, size) in tex.items():
            f = OUT3 / name
            if name not in listed or not f.exists():
                bad.append(f'{name}: missing (file or SOURCE.txt line)')
                continue
            h, b, wh = listed[name]
            if sha(f) != h or f.stat().st_size != b:
                bad.append(f'{name}: sha256/bytes differ from SOURCE.txt')
            if Image.open(f).size != tuple(size) or wh != tuple(size):
                bad.append(f'{name}: size {Image.open(f).size} != {size}')
            if f.stat().st_size > LIMITS3[name]:
                bad.append(f'{name}: {f.stat().st_size} bytes > {LIMITS3[name]}')
            total += f.stat().st_size
        if total > LIMITS3[set_name]:
            bad.append(f'{set_name} set: {total} bytes > {LIMITS3[set_name]}')
    for b_ in bad:
        print('FAIL', b_)
    if not bad:
        print('PASS: ' + ', '.join(f'{n} {listed[n][1]} B' for n in sorted(listed)) + ' match SOURCE.txt, textures.json and the size limits')
    return not bad

# ---------- main ----------


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', type=Path, default=ROOT.parent / 'globe-src')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--compare', type=Path)
    ap.add_argument('--shot', type=Path)
    ap.add_argument('--json', type=Path, help='write the comparison rows here')
    ap.add_argument('--cache', type=Path, help='keep the sampled sources here (outside the repository) between tone rounds')
    ap.add_argument('--equirect', action='store_true', help='bake the turning globe\'s textures (globe-v3) instead of the still picture')
    ap.add_argument('--compare-shots', nargs=2, type=Path, metavar=('A', 'B'), help='two screen captures of the start pose (still picture, WebGL)')
    a = ap.parse_args()
    if a.check:
        ok2 = check()
        ok3 = check3()
        sys.exit(0 if ok2 and ok3 else 1)
    if a.compare_shots:
        ok, rows = compare_shots(*a.compare_shots)
        if a.json:
            a.json.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding='utf8')
        sys.exit(0 if ok else 1)
    if a.equirect:
        return bake_equirect(a.src, a.cache)
    if a.compare:
        ok, rows = compare(a.compare, a.shot)
        if a.json:
            a.json.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding='utf8')
        sys.exit(0 if ok else 1)
    cam = json.loads((OUT / 'camera.json').read_text(encoding='utf8'))
    sizes = cam['bake']['sizes']
    N = sizes[-1]
    src_info = {}
    for key, (name, _) in SOURCES.items():
        f = a.src / name
        im = Image.open(f)
        src_info[key] = {'sha256': sha(f), 'bytes': f.stat().st_size, 'size': im.size}
    if a.cache and a.cache.exists():
        z = np.load(a.cache)
        base, lights, alpha = z['base'], z['lights'], z['alpha']
    else:
        base, lights, alpha = bake(a.src, cam, N)
        if a.cache:
            np.savez(a.cache, base=base, lights=lights, alpha=alpha)
    rgb, alpha, info = tone(base.astype(np.float32), lights.astype(np.float32), alpha.astype(np.float32), cam, N)
    del base, lights
    assert info['sea_lights_max'] == 0, f'city lights over the sea: {info["sea_lights_max"]}'
    print('check: largest light over the sea =', info['sea_lights_max'], '; land pixels lit above 1% =', info['land_lit_px'])
    LIT['land_px'] = info['land_lit_px']
    outputs = {}
    d1_meta = {'decoded': (10800, 10800)}
    world_meta = {'decoded': (10800, 5400)}
    for size in sizes:
        pad = cam['bake']['pad'][str(size)]
        im, q = encode(rgb, alpha, size, pad, PARAMS['quality'][size])
        f = OUT / f'globe-{size}.webp'
        while True:
            im.save(f, 'WEBP', quality=q, method=6, exact=False)
            if f.stat().st_size <= LIMITS[size] or q <= 60:
                break
            q -= 2
        PARAMS['quality'][size] = q
        outputs[f.name] = (sha(f), f.stat().st_size, im.size)
        print(f.name, im.size, f.stat().st_size, 'bytes, quality', q)
    write_source(cam, src_info, outputs, d1_meta, world_meta)


if __name__ == '__main__':
    main()
