"""Cross-pipeline regression: missing inputs never become zero or a real point."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_matrix_readiness import build  # noqa: E402


class MatrixReadinessTests(unittest.TestCase):
    def setUp(self):
        self.assessments = json.loads((ROOT / "dist/assessments.json").read_text())
        self.catalog = json.loads((ROOT / "dist/candidate-catalog.json").read_text())
        self.expansion = json.loads((ROOT / "dist/expansion-evidence.json").read_text())

    def test_30_species_missing_remains_missing(self):
        report = build(self.assessments, self.catalog, self.expansion)
        self.assertEqual(len(report["species"]), 30)
        self.assertEqual(report["matrix_points"], 0)
        self.assertTrue(all(r["scores"]["MBPI"] is None and r["scores"]["BBVI"] is None
                            and not r["matrix_eligible"] for r in report["species"]))
        self.assertEqual(sum(r["scores"]["MFPI"] is not None for r in report["species"]), 3)
        self.assertEqual(sum(r["scores"]["MCUI"] is not None for r in report["species"]), 2)
        published = json.loads((ROOT / "dist/matrix-readiness.json").read_text())
        self.assertEqual(report, published)

    def test_candidate_checklist_is_not_an_original_iucn_assessment(self):
        rows = build(self.assessments, self.catalog, self.expansion)["species"]
        self.assertTrue(all(row["scores"]["MCUI"] is None for row in rows if row["scope"] == "expansion_22"))

    def test_source_mismatch_and_unearned_bbvi_are_rejected(self):
        mismatched = copy.deepcopy(self.expansion)
        mismatched["species"][0]["name"] = "another species"
        with self.assertRaises(ValueError):
            build(self.assessments, self.catalog, mismatched)
        counterfeit = copy.deepcopy(self.assessments)
        counterfeit["species"][0]["scores"]["BBVI"] = 50
        with self.assertRaises(ValueError):
            build(counterfeit, self.catalog, self.expansion)


if __name__ == "__main__":
    unittest.main()
