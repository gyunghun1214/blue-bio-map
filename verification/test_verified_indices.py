"""Regression checks for the reviewed snapshot and the scorer's admission rules."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_verified_indices import build, render  # noqa: E402


def inputs():
    folder = ROOT / "research" / "verified-indices"
    return (json.loads((folder / "evidence.json").read_text(encoding="utf-8")),
            json.loads((folder / "candidates.json").read_text(encoding="utf-8")),
            json.loads((ROOT / "config" / "verified-indices-v1.json").read_text(encoding="utf-8")))


def species(report, aphia):
    return next(item for item in report["species"] if item["aphia_id"] == aphia)


def synthetic_assays(evidence):
    activities = []
    for n, nm in enumerate((100, 1000, 10000), 1):
        activities.append({"status": "approved_for_score", "reviewed": True,
            "origin_reviewed": True, "compound_structure_reviewed": True,
            "compound_id": f"CID:{n}", "source_id": "chembl_37",
            "origin_aphia_id": 836033, "origin_scientific_name": "Magallana gigas",
            "original_paper_doi": f"10.0000/synthetic{n}", "activity_id": f"SYN{n}",
            "assay_id": "same-assay", "target_id": "same-target",
            "assay_type": "B", "test_system": "cell-line-Z", "conditions_key": "48h",
            "endpoint": "IC50", "standard_relation": "=", "standard_units": "nM",
            "standard_value": nm, "pchembl_value": 9 - len(str(nm)) + 1,
            "data_validity_comment": None, "material_kind": "single_compound"})
    # 100/1000/10000 nM correspond to pChEMBL 7/6/5.
    for n, row in enumerate(activities):
        row["pchembl_value"] = 7 - n
    evidence["bioactivity"].extend(activities)
    evidence["bioactivity_cohorts"] = [{"id": "synthetic-fixed-assay", "activity_ids":
                                        [row["activity_id"] for row in activities]}]


class VerifiedIndicesTests(unittest.TestCase):
    def setUp(self):
        self.evidence, self.candidates, self.config = inputs()

    def test_real_snapshot_one_food_axis_and_independent_raw_values(self):
        report = build(self.evidence, self.candidates, self.config)
        oyster = species(report, 836033)
        mussel = species(report, 506159)
        cucumber = species(report, 241776)
        self.assertEqual(oyster["scores"], {"MFPI": 65.6, "MBPI": None, "MCUI": None, "BBVI": None})
        self.assertEqual(oyster["food_trace"]["sample_year_range"], [2010, 2011])
        self.assertEqual(oyster["food_trace"]["nutrients"]["protein_g"]["value"], 10.8)
        self.assertEqual(report["comparison_cohort"]["species_count"], 3)
        self.assertEqual(len(mussel["food_trace"]["supplemental_nutrition"]), 2)
        self.assertEqual(mussel["score_status"]["MFPI"], "산출 보류")
        self.assertEqual(cucumber["conservation_trace"]["category"], "EN")
        self.assertEqual(cucumber["withheld_reasons"]["MCUI"], "current_status_unverified")
        self.assertTrue(all(s["scores"]["MBPI"] is None for s in report["species"]))
        self.assertEqual(render(report), (ROOT / "dist" / "assessments.json").read_text(encoding="utf-8"))

    def test_unit_state_and_missing_not_zero(self):
        for change in (lambda r: r["nutrients"]["iron_mg"].update(unit="g"),
                       lambda r: r.update(sample_state="dried")):
            evidence = copy.deepcopy(self.evidence)
            change(evidence["nutrition_rows"][1])
            with self.assertRaises(ValueError):
                build(evidence, self.candidates, self.config)
        evidence = copy.deepcopy(self.evidence)
        evidence["food_support"] = [x for x in evidence["food_support"] if x["kind"] != "aquaculture"]
        oyster = species(build(evidence, self.candidates, self.config), 836033)
        self.assertIsNone(oyster["scores"]["MFPI"])
        self.assertIsNone(oyster["scores"]["BBVI"])
        self.assertEqual(oyster["food_trace"]["nutrients"]["iron_mg"]["value"], 4.43)

    def test_fixed_cohort_and_yield_sensitivity(self):
        baseline = species(build(self.evidence, self.candidates, self.config), 836033)
        evidence = copy.deepcopy(self.evidence)
        evidence["nutrition_rows"].append({"food_item_id": "outside-fixed-cohort"})
        changed = species(build(evidence, self.candidates, self.config), 836033)
        self.assertEqual(changed["scores"]["MFPI"], baseline["scores"]["MFPI"])
        scenarios = baseline["food_trace"]["yield_sensitivity"]
        self.assertEqual([s["mfpi_at_same_nutrients"] for s in scenarios], [66.0, 66.8])
        self.assertEqual([s["fraction"] for s in scenarios], [.1527, .237])

    def test_bioactivity_cohort_and_deduplicated_papers(self):
        synthetic_assays(self.evidence)
        oyster = species(build(self.evidence, self.candidates, self.config), 836033)
        self.assertEqual(oyster["scores"]["MBPI"], 62.5)
        self.assertEqual(oyster["scores"]["BBVI"], 64.1)
        duplicate = copy.deepcopy(self.evidence["bioactivity"][-3])
        duplicate["activity_id"] = "SYN1-duplicate-database-row"
        self.evidence["bioactivity"].append(duplicate)
        self.evidence["bioactivity_cohorts"][0]["activity_ids"].append(duplicate["activity_id"])
        same = species(build(self.evidence, self.candidates, self.config), 836033)
        self.assertEqual(same["scores"]["MBPI"], 62.5)
        self.assertEqual(same["bioactivity_trace"][0]["evidence_factor"], .75)
        self.config["bbvi"]["default_food_weight"] = .75
        weighted = species(build(self.evidence, self.candidates, self.config), 836033)
        self.assertEqual(weighted["scores"]["BBVI"], 64.8)
        self.evidence["bioactivity"][-1]["standard_units"] = "µg/mL"
        with self.assertRaises(ValueError):
            build(self.evidence, self.candidates, self.config)

    def test_current_iucn_check_is_independent_and_dated(self):
        assessment = next(x for x in self.evidence["conservation"] if x["aphia_id"] == 241776)
        assessment["current_status_check"] = {"is_current": True,
                                               "source_id": "iucn_japonicus_2013", "checked_on": "2026-09-25"}
        report = build(self.evidence, self.candidates, self.config)
        cucumber = species(report, 241776)
        self.assertEqual(cucumber["scores"]["MCUI"], 80)
        self.assertIsNone(cucumber["scores"]["MFPI"])
        self.assertIsNone(cucumber["scores"]["BBVI"])
        assessment["current_status_check"]["checked_on"] = "2026-02-30"
        with self.assertRaises(ValueError):
            build(self.evidence, self.candidates, self.config)
        assessment["current_status_check"] = {"is_current": False,
                                               "source_id": "iucn_japonicus_2013", "checked_on": "2026-09-25"}
        self.assertIsNone(species(build(self.evidence, self.candidates, self.config), 241776)["scores"]["MCUI"])


if __name__ == "__main__":
    unittest.main()
