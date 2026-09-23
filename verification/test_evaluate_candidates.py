"""Scientific guardrails for the provisional offline scoring pipeline."""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from evaluate_candidates import scores


def fixture():
    sources = {f"ref-{i}": {"url": f"https://example.org/{i}", "license": "test fixture", "accessed": "2026-09-23"} for i in range(1, 5)}
    species = []
    for i, potency in enumerate((5, 7, 9), start=1):
        species.append({
            "aphia_id": i, "scientific_name": f"Synthetic species {i}",
            "bioassays": [{"compound_id": f"CID:{i}", "target_id": "target-A", "assay_type": "binding",
                           "pchembl": potency, "reference_id": "ref-1", "reviewed": True}],
            "nutrition": {k: {"per_100g": v * i, "grade": "measured", "source_id": "ref-2", "reviewed": True}
                          for k, v in (("protein_g", 10), ("iron_mg", 1), ("zinc_mg", .5))},
            "edible_fraction": i / 4, "edible_fraction_source": "ref-2",
            "aquaculture": True, "aquaculture_source": "ref-3",
            "conservation": {"category": ("CR", "LC", "DD")[i-1], "assessment_year": 2025,
                             "source_id": "ref-4", "reviewed": True}
        })
    return {"schema_version": 1, "sources": sources, "species": species}


class PilotScoringTests(unittest.TestCase):
    def test_strata_and_conservation_are_independent(self):
        payload = fixture()
        # A spectacular potency in an incomparable target must not lift species 1.
        payload["species"][0]["bioassays"].append({"compound_id": "CID:10", "target_id": "other-target",
            "assay_type": "binding", "pchembl": 14, "reference_id": "ref-1", "reviewed": True})
        a, b, c = scores(payload)["species"]
        self.assertLess(a["scores"]["MBPI"], b["scores"]["MBPI"])
        self.assertEqual(len(a["bioactivity_trace"]), 1)
        self.assertEqual(a["scores"]["MCUI"], 100)
        self.assertLess(a["scores"]["BBVI"], b["scores"]["BBVI"])
        self.assertIsNone(c["scores"]["MCUI"])  # Data Deficient is not zero urgency.
        self.assertIsNotNone(c["scores"]["BBVI"])

    def test_missing_data_not_imputed_and_weights_only_affect_value_axis(self):
        payload = fixture()
        del payload["species"][1]["nutrition"]["iron_mg"]
        a = scores(payload, food_weight=.2)["species"]
        b = scores(payload, food_weight=.8)["species"]
        self.assertIsNone(a[1]["scores"]["MFPI"])
        self.assertIsNone(a[1]["scores"]["BBVI"])
        self.assertEqual(a[0]["scores"]["MCUI"], b[0]["scores"]["MCUI"])
        # A missing third comparator withholds the whole cohort, too.
        self.assertIsNone(a[0]["scores"]["MFPI"])
        complete = fixture()
        low = scores(complete, food_weight=.2)["species"][0]["scores"]
        high = scores(complete, food_weight=.8)["species"][0]["scores"]
        self.assertEqual(low["MCUI"], high["MCUI"])
        self.assertNotEqual(low["BBVI"], high["BBVI"])

    def test_unreviewed_assay_or_uncontrolled_trend_rejected(self):
        payload = fixture()
        payload["species"][0]["bioassays"][0]["reviewed"] = False
        with self.assertRaisesRegex(ValueError, "unreviewed bioassay"):
            scores(payload)
        payload = fixture()
        payload["species"][0]["conservation"]["obis_trend"] = {"direction": "declining",
            "source_id": "ref-4", "reviewed": True, "effort_adjusted": False}
        with self.assertRaisesRegex(ValueError, "sampling effort"):
            scores(payload)

    def test_literature_replication_does_not_add_comparator(self):
        payload = fixture()
        first = payload["species"][0]["bioassays"][0]
        baseline = scores(payload)["species"][0]["scores"]["MBPI"]
        repeat = copy.deepcopy(first)
        repeat["reference_id"] = "ref-2"
        payload["species"][0]["bioassays"].append(repeat)
        result = scores(payload)["species"][0]
        self.assertEqual(result["bioactivity_trace"][0]["peer_count"], 3)
        self.assertGreater(result["scores"]["MBPI"], baseline)


if __name__ == "__main__":
    unittest.main()
