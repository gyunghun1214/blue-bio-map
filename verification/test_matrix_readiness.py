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
        # verified-pilot-3.2: a national MCUI is placed too (marked apart), so a point is any species with both BBVI and MCUI.
        placed = [r["aphia_id"] for r in report["species"] if r["matrix_eligible"]]
        self.assertEqual(placed, [r["aphia_id"] for r in report["species"]
                                  if r["scores"]["BBVI"] is not None and r["scores"]["MCUI"] is not None])
        self.assertEqual(report["matrix_points"], len(placed))
        self.assertEqual([(r["aphia_id"], r["scores"]["BBVI"]) for r in report["species"]
                          if r["scores"]["BBVI"] is not None], [(836033, 83.9)])
        self.assertEqual([(r["aphia_id"], r["scores"]["MBPI"]) for r in report["species"]
                          if r["scores"]["MBPI"] is not None],
                         [(145721, 71.5), (241776, 8.7), (250680, 13.5), (494972, 65.0), (506159, 10.1), (836033, 96.3),
                          (371986, 67.5), (234476, 73.3), (494853, 21.6), (145086, 0.4), (231750, 39.5), (393716, 27.3), (413600, 56.9),
                          (275816, 29.2)])
        # verified-pilot-3.5 adds single-paper peptide MBPI (해삼, 가시파래, 큰가리비, 가리맛조개, 넙치; 미역 19.6 -> 71.5 after the
        # Sato 2002 full text) and three aquaculture records (참조기, 넙치, 꽃게 MFPI). Every new MBPI rests on one paper: no new BBVI.
        # verified-pilot-2.3: 참굴 LQP potency is replicated across origins, so its BBVI exists, but its MCUI is a
        # national assessment and stays off the matrix; 미역 MBPI still rests on one paper, so the matrix stays empty.
        # verified-pilot-3.1 adds five ChEMBL MBPI values after the link review; each rests on one linking paper, so BBVI stays withheld.
        # Operating MFPI 3 + MCUI 2 (main), plus the #39 reviewed candidates: MFPI 4 (바지락·참가리비·조피볼락·방어),
        # MCUI 5 (전복·고등어·멸치·참조기·방어). Every matrix score must equal the reviewed report, species by species.
        # verified-pilot-3.3 fills a missing RDA zinc value from uFiSh: 홍합(species), 전복(genus), 대구(species), 갑오징어(family).
        # verified-pilot-3.6 fills 피조개 zinc from the MEXT 2020 same-species raw item (あかがい 10279): MFPI 14 -> 15.
        # verified-pilot-3.7 adds calcium (3 of 4 components) and three aquaculture records: 톳·청각·멸치 MFPI, 참굴 BBVI 80.9 -> 83.9.
        # verified-pilot-3.8 adds the reviewed 바지락 peptide rows (single paper): 바지락 MBPI 39.5, BBVI withheld.
        # verified-pilot-3.9 uses a MEXT same-species raw item as the own row where RDA has none: 맛조개·고등어·참문어 MFPI, 18 -> 21.
        # verified-pilot-3.10 adds the reviewed 톳 peptide rows (Suetsuna 1998, single paper): 톳 MBPI 45.3 -> 65.0, BBVI withheld.
        self.assertEqual(sum(r["scores"]["MFPI"] is not None for r in report["species"]), 21)
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

    def test_matrix_type_and_sufficiency_layers(self):
        report = build(self.assessments, self.catalog, self.expansion)
        rule = self.assessments["method"]["matrix"]
        self.assertEqual(report["matrix_rule"], rule)
        reviewed = {s["aphia_id"]: s for s in self.assessments["species"] + self.assessments["candidate_species"]}
        for row in report["species"]:
            s = reviewed[row["aphia_id"]]
            self.assertEqual((row["priority_survey"], row["unexplored_candidate"]),
                             (s["priority_survey"], s["unexplored_candidate"]), row["aphia_id"])
            if not row["matrix_eligible"]:
                self.assertIsNone(row["matrix_type"], row["aphia_id"])
                continue
            key = ("high" if row["scores"]["BBVI"] >= 50 else "low") + "_bbvi_" + ("high" if row["scores"]["MCUI"] >= 50 else "low") + "_mcui"
            self.assertEqual(row["matrix_type"], rule["types"][key]["id"], row["aphia_id"])
        # the national stratum leaves the matrix again when the rule says so; nothing else moves
        off = copy.deepcopy(self.assessments)
        off["method"]["matrix"]["include_national_mcui"] = False
        rows = build(off, self.catalog, self.expansion)["species"]
        self.assertFalse(any(r["matrix_eligible"] or r["matrix_type"] for r in rows if r["mcui_basis"] == "national"))
        self.assertEqual([r["scores"] for r in rows], [r["scores"] for r in report["species"]])
        # an older report without a matrix rule publishes no type fields
        older = copy.deepcopy(self.assessments)
        del older["method"]["matrix"]
        self.assertFalse(any("matrix_type" in r for r in build(older, self.catalog, self.expansion)["species"]))

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
