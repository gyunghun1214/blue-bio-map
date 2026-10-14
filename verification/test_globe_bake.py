"""The baked entry-screen globe (dist/vendor/globe-v2, scripts/bake_globe.py): outputs as SOURCE.txt lists them, size
limits, the camera in range. Standard library only (no numpy/Pillow), so it runs without the NASA sources."""
import hashlib
import json
import math
import struct
import unittest
from pathlib import Path

V2 = Path(__file__).resolve().parents[1] / 'dist' / 'vendor' / 'globe-v2'
V3 = V2.parent / 'globe-v3'
LIMITS = {900: 250_000, 1600: 600_000, 2400: 1_100_000}  # phone, desktop 1x, desktop 2x
# the turning globe's textures (scripts/bake_globe.py LIMITS3): each file, and each set as the screen fetches it
LIMITS3 = {'full': 700_000, 'small': 260_000, 'detail-2048.webp': 480_000, 'world-2048.webp': 260_000,
           'detail-1024.webp': 160_000, 'world-1024.webp': 110_000}


def webp_size(path):
    """Canvas size from a WebP header (VP8X, VP8 or VP8L)."""
    b = path.read_bytes()[:64]
    assert b[:4] == b'RIFF' and b[8:12] == b'WEBP', path
    kind = b[12:16]
    if kind == b'VP8X':
        return (int.from_bytes(b[24:27], 'little') + 1, int.from_bytes(b[27:30], 'little') + 1)
    if kind == b'VP8 ':
        w, h = struct.unpack('<HH', b[26:30])
        return (w & 0x3FFF, h & 0x3FFF)
    if kind == b'VP8L':
        v = int.from_bytes(b[21:25], 'little')
        return ((v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1)
    raise ValueError(kind)


def listed():
    out = {}
    for line in (V2 / 'SOURCE.txt').read_text(encoding='utf8').splitlines():
        p = line.split()
        if len(p) == 4 and p[0].startswith('globe-') and p[0].endswith('.webp'):
            w, h = map(int, p[3].split('x'))
            out[p[0]] = (p[1], int(p[2]), (w, h))
    return out


class GlobeBake(unittest.TestCase):
    def setUp(self):
        self.cam = json.loads((V2 / 'camera.json').read_text(encoding='utf8'))
        self.files = listed()

    def test_outputs_match_source_txt(self):
        self.assertEqual(sorted(self.files), sorted(f'globe-{n}.webp' for n in self.cam['bake']['sizes']))
        for name, (sha, size, wh) in self.files.items():
            f = V2 / name
            self.assertEqual(hashlib.sha256(f.read_bytes()).hexdigest(), sha, name)
            self.assertEqual(f.stat().st_size, size, name)
            self.assertEqual(webp_size(f), wh, name)

    def test_size_limits_and_pad(self):
        for n in self.cam['bake']['sizes']:
            f = V2 / f'globe-{n}.webp'
            self.assertLessEqual(f.stat().st_size, LIMITS[n], f.name)
            pad = self.cam['bake']['pad'][str(n)]
            self.assertEqual(webp_size(f), (n + 2 * pad, n + 2 * pad), f.name)

    def test_camera_in_range(self):
        c = self.cam
        self.assertTrue(100 <= c['lon0'] <= 160 and 0 <= c['lat0'] <= 45, c)
        self.assertTrue(30 <= math.degrees(math.acos(1 / c['P'])) <= 80, 'horizon between 30 and 80 degrees')
        f = c['frame']
        self.assertTrue(.6 <= f['cx'] <= .9 and .6 <= f['cy'] <= .85 and .6 <= f['R'] <= .9, f)

    def test_source_txt_names_sources_and_terms(self):
        t = (V2 / 'SOURCE.txt').read_text(encoding='utf8')
        for s in ('world.topo.bathy.200408.3x21600x10800.jpg', 'world.topo.bathy.200408.3x21600x21600.D1.jpg',
                  'BlackMarble_2016_3km_gray.jpg', 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
                  'insignia', 'largest light over the sea = 0'):
            self.assertIn(s, t)
        self.assertEqual(t.count(' bytes  sha256 '), 3, 'a sha256 for each NASA source')


class TurningGlobeTextures(unittest.TestCase):
    """dist/vendor/globe-v3 (bake_globe.py --equirect): files as SOURCE.txt lists them, sizes and boxes as textures.json
    says, size limits per file and per set, the same NASA sources as globe-v2, no lights over the sea."""

    def setUp(self):
        self.tex = json.loads((V3 / 'textures.json').read_text(encoding='utf8'))
        self.src = (V3 / 'SOURCE.txt').read_text(encoding='utf8')
        self.listed = {}
        for line in self.src.splitlines():
            p = line.split()
            if len(p) == 6 and p[0].endswith('.webp'):
                self.listed[p[0]] = (p[1], int(p[2]), tuple(map(int, p[3].split('x'))), p[4], p[5])

    def test_files_match_source_txt_and_textures_json(self):
        files = [t for s in self.tex['sets'].values() for t in s.values()]
        self.assertEqual(sorted(self.listed), sorted(t['file'] for t in files))
        for t in files:
            f = V3 / t['file']
            sha, size, wh, lon, lat = self.listed[t['file']]
            self.assertEqual(hashlib.sha256(f.read_bytes()).hexdigest(), sha, f.name)
            self.assertEqual(f.stat().st_size, size, f.name)
            self.assertEqual(webp_size(f), tuple(t['size']), f.name)
            self.assertEqual(wh, tuple(t['size']), f.name)
            self.assertEqual((lon, lat), ('{}..{}'.format(*t['lon']), '{}..{}'.format(*t['lat'])), f.name)

    def test_size_limits(self):
        for name, s in self.tex['sets'].items():
            total = 0
            for t in s.values():
                n = (V3 / t['file']).stat().st_size
                self.assertLessEqual(n, LIMITS3[t['file']], t['file'])
                total += n
            self.assertLessEqual(total, LIMITS3[name], f'{name} set: {total} bytes')

    def test_boxes(self):
        for s in self.tex['sets'].values():
            d, w = s['detail'], s['world']
            self.assertEqual((w['lon'], w['lat']), ([-180, 180], [-90, 90]), 'the world texture is the whole globe')
            self.assertTrue(d['lon'][0] <= 120 and d['lon'][1] >= 150 and d['lat'][0] <= 20 and d['lat'][1] >= 50, 'the detail tile holds Korea and its seas with room')
            # square-ish pixels on the ground at Korea's latitude, the same density in both sets' ratio
            ppd_lat, ppd_lon = d['size'][1] / (d['lat'][1] - d['lat'][0]), d['size'][0] / (d['lon'][1] - d['lon'][0])
            self.assertLess(abs(ppd_lon / ppd_lat - 1), .2, (ppd_lon, ppd_lat))
        full, small = self.tex['sets']['full']['detail'], self.tex['sets']['small']['detail']
        self.assertEqual((full['lon'], full['lat']), (small['lon'], small['lat']))
        self.assertGreaterEqual(full['size'][1] / (full['lat'][1] - full['lat'][0]), 22, 'the full detail tile: at least 22 px a degree (the 2400 picture had 28 at Korea)')

    def test_sources_and_recipe(self):
        v2 = (V2 / 'SOURCE.txt').read_text(encoding='utf8')
        shas = [l.split('sha256 ')[1].strip() for l in v2.splitlines() if ' bytes  sha256 ' in l]
        self.assertEqual(len(shas), 3)
        for h in shas:
            self.assertIn(h, self.src, 'the same NASA sources as globe-v2')
        for s in ('https://www.nasa.gov/nasa-brand-center/images-and-media/', 'insignia', 'largest light over the sea = 0;',
                  'Left to the shader', 'PARAMS: ', 'PARAMS3: '):
            self.assertIn(s, self.src)
        p2 = json.loads(next(l for l in v2.splitlines() if l.startswith('PARAMS: '))[8:])
        p3 = json.loads(next(l for l in self.src.splitlines() if l.startswith('PARAMS: '))[8:])
        p2.pop('quality'), p3.pop('quality')
        self.assertEqual(p2, p3, 'the textures use globe-v2\'s recipe unchanged')


if __name__ == '__main__':
    unittest.main()
