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

    def test_bioactivity_full_link_needs_assay_partial_link_needs_no_value(self):
        # Row 6 is a partial link (species -> compound only) with no invented assay data: it passes.
        # Rows 8-10: text value on an assay row, license_unclear assay row without experiment info,
        # and a compound row that fills experiment info it did not confirm.
        self.assertEqual(errors("bioactivity_synthetic.csv"), [
            (4, "target"), (4, "assay"),
            (5, "aphia_id='AphiaID:900000001':"), (5, "doi='https://doi.org/10.0000/synthetic.1':"),
            (5, "compound_id='exemplamide':"),
            (7, "link_level=compound인데"),
            (8, "link_level=assay인데"),
            (9, "experiment_type"), (9, "target"), (9, "assay"),
            (10, "link_level=compound인데")])

    def test_submissions_have_no_errors(self):
        for path in (ROOT / "research" / "submissions").glob("*.csv"):
            self.assertEqual([i for i in check_file(path) if i[1] == "ERROR"], [], path.name)

    def test_food_needs_unit_basis_and_keeps_missing_empty(self):
        # Row 6 is no_data with the searched name and scope in claim: it passes.
        self.assertEqual(errors("food_synthetic.csv"),
                         [(4, "unit"), (4, "basis"), (5, "data_status=no_data인데"), (5, "claim")])

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
