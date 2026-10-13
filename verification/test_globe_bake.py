"""The baked entry-screen globe (dist/vendor/globe-v2, scripts/bake_globe.py): outputs as SOURCE.txt lists them, size
limits, the camera in range. Standard library only (no numpy/Pillow), so it runs without the NASA sources."""
import hashlib
import json
import math
import struct
import unittest
from pathlib import Path

V2 = Path(__file__).resolve().parents[1] / 'dist' / 'vendor' / 'globe-v2'
LIMITS = {900: 250_000, 1600: 600_000, 2400: 1_100_000}  # phone, desktop 1x, desktop 2x


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


if __name__ == '__main__':
    unittest.main()
