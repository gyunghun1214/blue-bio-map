"""Checks that approved facts, immutable cohorts and UI report agree."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_indices import build, collect_snapshot, normalize, verify_links  # noqa: E402
from evaluate_candidates import scores  # noqa: E402
from verification.test_evaluate_candidates import fixture  # noqa: E402


class CuratedIndicesTests(unittest.TestCase):
    def test_frozen_report_and_only_historical_mcui(self):
        one, two = build(), build()
        self.assertEqual(one, two)
        published = json.loads((ROOT / "dist/assessments.json").read_text())
        self.assertEqual(one, published)
        cucumber = next(s for s in one["species"] if s["aphia_id"] == 241776)
        self.assertEqual(cucumber["scores"], {"MFPI": None, "MBPI": None, "MCUI": 80, "BBVI": None})
        self.assertEqual(cucumber["conservation_trace"]["assessment_year"], 2010)
        self.assertEqual(cucumber["conservation_trace"]["publication_year"], 2013)
        self.assertTrue(cucumber["iucn_review_older_than_10y"])
        self.assertEqual(one["cohort"]["eligible_assay_compounds"], 0)
        self.assertEqual(sum(s["scores"]["MCUI"] is not None for s in one["species"]), 1)

    def test_taxon_and_assay_link_must_be_explicit(self):
        original = collect_snapshot()
        method = json.loads((ROOT / "config/pilot-method.json").read_text())
        changed = copy.deepcopy(original)
        changed["species"][2]["aphia_id"] = 123
        with self.assertRaisesRegex(ValueError, "taxon/source/date/scope mismatch"):
            verify_links(changed, normalize(changed), method)
        changed = copy.deepcopy(original)
        changed["species"][2]["bioassays"] = [{"assay_organism": "Candida albicans", "pchembl": 9}]
        with self.assertRaisesRegex(ValueError, "incomplete species"):
            verify_links(changed, normalize(changed), method)

    def test_weight_and_aggregation_sensitivity_with_synthetic_evidence(self):
        payload = fixture()
        first = scores(payload, food_weight=0, method={"mbpi_aggregation": "max"})["species"][0]
        last = scores(payload, food_weight=1, method={"mbpi_aggregation": "top_two_mean"})["species"][0]
        self.assertEqual(first["scores"]["BBVI"], first["scores"]["MBPI"])
        self.assertEqual(last["scores"]["BBVI"], last["scores"]["MFPI"])
        self.assertEqual(first["scores"]["MCUI"], last["scores"]["MCUI"])
        # Two databases referencing the same DOI must not imply replication.
        payload["sources"]["ref-1"]["doi"] = "10.1/original"
        payload["sources"]["ref-2"]["doi"] = "10.1/original"
        duplicated = copy.deepcopy(payload["species"][0]["bioassays"][0])
        duplicated["reference_id"] = "ref-2"
        payload["species"][0]["bioassays"].append(duplicated)
        self.assertEqual(scores(payload)["species"][0]["bioactivity_trace"][0]["independent_references"], 1)
        payload["species"][1]["bioassays"][0]["test_system"] = "different cells"
        self.assertIsNone(scores(payload)["species"][0]["scores"]["MBPI"])


if __name__ == "__main__":
    unittest.main()
