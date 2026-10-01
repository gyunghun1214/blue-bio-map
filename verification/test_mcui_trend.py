"""verified-pilot-3.4 OBIS reporting-rate check on synthetic counts: classes, thresholds, the dominant-dataset check."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_verified_indices import occurrence_trend  # noqa: E402

RULE = json.loads((ROOT / "config" / "verified-indices-v3.4.json").read_text(encoding="utf-8"))["conservation"]["trend"]


def snap(n1, n2, e1, e2, cells=1, a1=None, a2=None, dataset=None):
    """One species of class C spread evenly over `cells` cells; class effort e1/e2 and all-taxa effort a1/a2 in total.
    `dataset` = (n1, n2, e1, e2) inside the dominant dataset; by default the whole record set is one dataset."""
    keys = [f"{35 + i}/{125 + i}" for i in range(cells)]
    per = lambda total: {k: total // cells + (1 if i < total % cells else 0) for i, k in enumerate(keys)}
    sp1, sp2, g1, g2 = per(n1), per(n2), per(e1), per(e2)
    b1, b2 = per(a1 or 10 * e1), per(a2 or 10 * e2)
    d1, d2, de1, de2 = map(per, dataset or (n1, n2, e1, e2))
    nonzero = lambda d: {k: v for k, v in d.items() if v}
    return {"species": {"1": {"class": "C", "records_all_years": n1 + n2, "yearrange": [1990, 2025],
                              "past": {"records": n1, "outside_grid": 0, "cells": nonzero(sp1), "datasets": {"d": n1}},
                              "recent": {"records": n2, "outside_grid": 0, "cells": nonzero(sp2), "datasets": {"d": n2}},
                              "dominant_dataset": {"dataset_id": "d", "past_share": 1.0, "past": nonzero(d1), "recent": nonzero(d2),
                                                   "class_effort": {k: {"past": de1[k], "recent": de2[k]} for k in keys}}}},
            "group_effort": {"C": {"cells": {k: {"past": g1[k], "recent": g2[k]} for k in keys}}},
            "effort": {k: {"past": b1[k], "recent": b2[k]} for k in keys}}


def trend(*args, **kw):
    return occurrence_trend(1, snap(*args, **kw), RULE)


class TrendClasses(unittest.TestCase):
    def test_rule_is_the_published_one(self):
        self.assertEqual((RULE["min_past_records"], RULE["decline_ratio"], RULE["z"], RULE["continuity"]), (20, 0.7, 1.96, 0.5))
        self.assertEqual(set(RULE["labels"]), {"decline_signal", "decline_below_threshold", "survey_gap", "no_clear_decline", "undetermined"})

    def test_too_few_past_records_is_undetermined(self):
        t = trend(19, 0, 1000, 1000)
        self.assertEqual((t["class"], t["reason"]), ("undetermined", "past_records_below_minimum"))
        self.assertNotIn("reporting_rate_ratio", t)

    def test_no_comparable_cell_says_so(self):
        s = snap(100, 20, 1000, 1000)
        s["group_effort"]["C"]["cells"]["35/125"]["recent"] = 0
        self.assertEqual(occurrence_trend(1, s, RULE)["reason"], "no_comparable_cells")

    def test_a_clear_30_percent_fall_confirmed_in_the_dataset_is_a_decline_signal(self):
        self.assertEqual(trend(400, 100, 1000, 1000)["class"], "decline_signal")          # rate x0.25
        self.assertEqual(trend(400, 100, 1000, 500)["class"], "decline_signal")           # effort halved, rate still x0.5

    def test_a_fall_that_is_only_a_dataset_ending_is_undetermined(self):
        # overall the rate falls x0.25, but inside the dominant dataset it does not fall
        t = trend(400, 100, 1000, 1000, dataset=(300, 300, 800, 800))
        self.assertEqual((t["class"], t["reason"]), ("undetermined", "decline_not_confirmed_within_dominant_dataset"))
        self.assertFalse(t["dataset_check"]["confirms_decline"])
        # the dominant dataset is absent in the recent period: nothing to confirm with
        t = trend(400, 100, 1000, 1000, dataset=(300, 0, 800, 0))
        self.assertEqual((t["class"], t["dataset_check"]["cells_compared"]), ("undetermined", 0))

    def test_the_same_fall_with_wide_uncertainty_is_undetermined(self):
        t = trend(20, 12, 1000, 1000)   # rate x0.61, interval about 0.30-1.23
        self.assertLessEqual(t["reporting_rate_ratio"], 0.7)
        self.assertGreaterEqual(t["ci"][1], 1)
        self.assertEqual((t["class"], t["reason"]), ("undetermined", "decline_uncertain"))

    def test_fewer_records_explained_by_less_effort_is_a_survey_gap(self):
        t = trend(400, 200, 1000, 500)              # records and effort both halve
        self.assertEqual((t["class"], t["effort_ratio"]), ("survey_gap", 0.5))

    def test_a_clear_fall_below_the_threshold_is_its_own_class(self):
        # the rate itself fell (x0.8, interval below 1): neither a decline signal nor 'no decline', never a survey gap
        t = trend(2000, 800, 1000, 500)
        self.assertEqual((t["class"], RULE["labels"][t["class"]]), ("decline_below_threshold", "감소 경향(30% 미만)"))

    def test_stable_or_rising_rate_is_no_clear_decline(self):
        self.assertEqual(trend(100, 100, 1000, 1000)["class"], "no_clear_decline")
        self.assertEqual(trend(100, 300, 1000, 1000)["class"], "no_clear_decline")

    def test_only_cells_with_class_effort_in_both_periods_count(self):
        s = snap(100, 20, 1000, 1000, cells=2)
        s["group_effort"]["C"]["cells"]["36/126"]["recent"] = 0
        t = occurrence_trend(1, s, RULE)
        self.assertEqual((t["cells_compared"], t["species_records"]["past"]), (1, 50))
        self.assertEqual(t["records_in_map_extent"], {"past": 100, "recent": 20})

    def test_recency_counts_cells_seen_in_one_period_only(self):
        s = snap(100, 20, 1000, 1000, cells=2)
        s["species"]["1"]["recent"]["cells"] = {"35/125": 20}
        t = occurrence_trend(1, s, RULE)
        self.assertEqual((t["cells_past_only"], t["cells_recent_only"]), (1, 0))

    def test_all_taxa_effort_is_a_sensitivity_only(self):
        a = trend(400, 200, 1000, 500, a1=10000, a2=10000)
        b = trend(400, 200, 1000, 500, a1=10000, a2=2000)
        self.assertEqual((a["class"], b["class"]), ("survey_gap", "survey_gap"))
        self.assertNotEqual(a["all_taxa_sensitivity"]["reporting_rate_ratio"], b["all_taxa_sensitivity"]["reporting_rate_ratio"])

    def test_a_species_without_a_trend_record_stops_the_build(self):
        with self.assertRaisesRegex(ValueError, "no OBIS trend record"):
            occurrence_trend(2, snap(100, 100, 1000, 1000), RULE)


if __name__ == "__main__":
    unittest.main()
