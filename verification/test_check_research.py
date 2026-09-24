"""The research intake checker flags each synthetic mistake and nothing else."""
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from check_research import check_file  # noqa: E402

EXAMPLES = ROOT / "research" / "examples"


def errors(name):
    return [(line, msg.split(" ")[0]) for line, level, msg in check_file(EXAMPLES / name) if level == "ERROR"]


class CheckResearchTests(unittest.TestCase):
    def test_templates_are_empty_and_valid(self):
        for kind in ("bioactivity", "food", "species"):
            self.assertEqual(check_file(ROOT / "research" / "templates" / f"{kind}.csv"), [])

    def test_bioactivity_needs_target_assay_and_id_formats(self):
        self.assertEqual(errors("bioactivity_synthetic.csv"), [
            (4, "target"), (4, "assay"),
            (5, "aphia_id='AphiaID:900000001':"), (5, "doi='https://doi.org/10.0000/synthetic.1':"),
            (5, "compound_id='exemplamide':")])

    def test_food_needs_unit_basis_and_keeps_missing_empty(self):
        self.assertEqual(errors("food_synthetic.csv"),
                         [(4, "unit"), (4, "basis"), (5, "data_status=no_data인데")])

    def test_species_date_and_occurrence_scope(self):
        self.assertEqual(errors("species_synthetic.csv"),
                         [(4, "accessed='2026-9-20':"), (4, "region"), (4, "period")])

    def test_extra_columns_such_as_coordinates_are_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "species_extra.csv"
            header = (ROOT / "research" / "templates" / "species.csv").read_text(encoding="utf-8-sig").strip()
            path.write_text(header + ",latitude,longitude\n", encoding="utf-8")
            [(line, level, msg)] = check_file(path)
            self.assertEqual((line, level), (1, "ERROR"))
            self.assertIn("latitude", msg)


if __name__ == "__main__":
    unittest.main()
