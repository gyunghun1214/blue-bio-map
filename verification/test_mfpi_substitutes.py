"""verified-pilot-3.3 MFPI substitutes on synthetic uFiSh items: level order, grades, consumed part, ties."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_verified_indices import substitute  # noqa: E402

SETTINGS = json.loads((ROOT / "config" / "verified-indices-v3.3.json").read_text(encoding="utf-8"))["nutrition"]


def item(fid, level, value, doc="a", n=1, part="flesh"):
    return {"food_item_id": fid, "food_name": fid, "taxon_label": fid, "part": part, "matches": {"1": level},
            "components": {"zinc_mg": {"value": value, "doc": doc, "n": n}}}


def pick(*items):
    found = substitute(1, "zinc_mg", {"mfpi_substitutes": {"items": list(items)}}, SETTINGS)
    return found and (found["substitute"]["food_item_id"], found["substitute"]["taxon_level"], found["grade"])


class SubstituteOrder(unittest.TestCase):
    def test_species_before_genus_before_family(self):
        self.assertEqual(pick(item("F", "family", 1), item("G", "genus", 2), item("S", "species", 3, doc="ar")), ("S", "species", "calculated"))
        self.assertEqual(pick(item("F", "family", 1), item("G", "genus", 2, doc="a")), ("G", "genus", "proxy"))
        self.assertEqual(pick(item("F", "family", 1)), ("F", "family", "proxy"))

    def test_species_grade_follows_the_documentation_code(self):
        self.assertEqual(pick(item("A", "species", 1, doc="a"), item("R", "species", 2, doc="r", n=99)), ("A", "species", "measured"))
        self.assertEqual(pick(item("E", "species", 1, doc="e")), ("E", "species", "proxy"))
        self.assertEqual(pick(item("X", "species", 1, doc=None)), ("X", "species", "proxy"))

    def test_ties_go_to_larger_n_then_lower_id(self):
        self.assertEqual(pick(item("B", "genus", 1, n=2), item("A", "genus", 1, n=5)), ("A", "genus", "proxy"))
        self.assertEqual(pick(item("B", "genus", 1, n=3), item("A", "genus", 1, n=3)), ("A", "genus", "proxy"))
        self.assertEqual(pick(item("B", "genus", 1, n=3), item("A", "genus", 1, n=None)), ("B", "genus", "proxy"))

    def test_consumed_part_missing_value_and_other_levels_are_never_used(self):
        self.assertIsNone(pick(item("W", "species", 1, part="whole"), item("O", "species", 1, part=None)))
        self.assertIsNone(pick(item("M", "species", None)))
        self.assertIsNone(pick(item("Q", "above_family", 1)))
        self.assertIsNone(substitute(2, "zinc_mg", {"mfpi_substitutes": {"items": [item("S", "species", 1)]}}, SETTINGS))

    def test_the_trace_names_source_label_and_value(self):
        s = substitute(1, "zinc_mg", {"mfpi_substitutes": {"items": [item("G", "genus", 1.5, n=4)]}}, SETTINGS)
        self.assertEqual((s["value"], s["unit"], s["substitute"]["source_id"], s["substitute"]["label"]),
                         (1.5, "mg", "ufish_1_workbook", "유사종 대체치(같은 속)"))


if __name__ == "__main__":
    unittest.main()
