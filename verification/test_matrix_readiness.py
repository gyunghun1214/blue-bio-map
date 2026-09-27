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
        self.assertTrue(all(r["scores"]["BBVI"] is None and not r["matrix_eligible"]
                            for r in report["species"]))
        self.assertEqual([(r["aphia_id"], r["scores"]["MBPI"]) for r in report["species"]
                          if r["scores"]["MBPI"] is not None], [(145721, 19.6), (836033, 72.2), (371986, 67.5)])
        # verified-pilot-2.2: 미역·참굴 peptide MBPI rest on one paper each, so BBVI and the matrix stay empty.
        # Operating MFPI 3 + MCUI 2 (main), plus the #39 reviewed candidates: MFPI 4 (바지락·참가리비·조피볼락·방어),
        # MCUI 5 (전복·고등어·멸치·참조기·방어). Every matrix score must equal the reviewed report, species by species.
        self.assertEqual(sum(r["scores"]["MFPI"] is not None for r in report["species"]), 7)
        # verified-pilot-2.1 adds 7 Korean national-assessment MCUI, kept apart by mcui_basis and out of the matrix.
        self.assertEqual(sum(r["scores"]["MCUI"] is not None and r["mcui_basis"] == "iucn" for r in report["species"]), 7)
        self.assertEqual(sum(r["scores"]["MCUI"] is not None and r["mcui_basis"] == "national" for r in report["species"]), 7)
        reviewed = {s["aphia_id"]: s["scores"] for s in
                    self.assessments["species"] + self.assessments["candidate_species"]}
        for row in report["species"]:
            for axis in ("MFPI", "MBPI", "MCUI"):
                self.assertEqual(row["scores"][axis], reviewed.get(row["aphia_id"], {}).get(axis), (row["aphia_id"], axis))
        published = json.loads((ROOT / "dist/matrix-readiness.json").read_text())
        self.assertEqual(report, published)

    def test_candidate_checklist_is_not_an_original_iucn_assessment(self):
        rows = build(self.assessments, self.catalog, self.expansion)["species"]
        reviewed = {s["aphia_id"]: s for s in self.assessments["candidate_species"]}
        for row in rows:
            if row["scope"] != "expansion_22" or row["scores"]["MCUI"] is None:
                continue
            # A candidate MCUI must come from a reviewed original assessment, never from the catalog checklist line.
            if row["mcui_basis"] == "national":
                national = reviewed[row["aphia_id"]]["national_assessment"]
                self.assertTrue(national["source_id"] and national["category"], row["aphia_id"])
                continue
            trace = reviewed[row["aphia_id"]]["conservation_trace"]
            self.assertTrue(trace["assessment_date"] and trace["criteria_version"], row["aphia_id"])
            self.assertTrue(trace["current_status_check"]["is_current"], row["aphia_id"])
        stripped = copy.deepcopy(self.assessments)
        for s in stripped["candidate_species"]:
            s["scores"]["MCUI"] = None
        self.assertTrue(all(r["scores"]["MCUI"] is None for r in build(stripped, self.catalog, self.expansion)["species"]
                            if r["scope"] == "expansion_22"))

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
