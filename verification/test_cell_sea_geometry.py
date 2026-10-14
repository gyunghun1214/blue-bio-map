"""dist/cell-sea-geometry.json: the sea part of every public 1° cell (scripts/build_cell_sea_geometry.py).

Reads the committed file, so CI needs no shapely; the rebuild comparison runs only where shapely is installed.
"""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import build_cell_sea_geometry as b  # noqa: E402

FILE = json.loads((ROOT / 'dist' / 'cell-sea-geometry.json').read_text(encoding='utf-8'))


def rings(g):
    return [r for p in ([g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']) for r in p]


class CellSeaGeometry(unittest.TestCase):
    def test_schema(self):
        self.assertEqual(FILE['schemaVersion'], 'cell-sea-geometry-1')
        self.assertIn('countries.json', FILE['landSource'])

    def test_every_public_1deg_cell_has_a_key(self):
        keys = {f'{la},{lo},1' for la, lo in b.public_cells()}
        self.assertTrue(keys)
        self.assertEqual(keys, set(FILE['cells']))

    def test_cells(self):
        for key, c in FILE['cells'].items():
            lat0, lon0, size = map(int, key.split(','))
            self.assertEqual(size, 1, key)
            f = c['seaFraction']
            self.assertTrue(0 <= f <= 1, key)
            if f in (0, 1) and 'type' not in c:
                continue
            # only coastal cells carry coordinates, and every point stays inside the cell
            self.assertTrue(0 < f < 1, key)
            self.assertIn(c['type'], ('Polygon', 'MultiPolygon'), key)
            for r in rings(c):
                self.assertGreaterEqual(len(r), 4, key)
                self.assertEqual(r[0], r[-1], key)
                for x, y in r:
                    self.assertTrue(lon0 - 1e-9 <= x <= lon0 + 1 + 1e-9 and lat0 - 1e-9 <= y <= lat0 + 1 + 1e-9, key)
                    self.assertEqual(round(x, 4), x, key)

    @unittest.skipUnless(__import__('importlib').util.find_spec('shapely'), 'shapely not installed')
    def test_committed_output_is_reproducible(self):
        self.assertEqual({**FILE, 'generatedOn': None}, {**b.build(), 'generatedOn': None})


if __name__ == '__main__':
    unittest.main()
