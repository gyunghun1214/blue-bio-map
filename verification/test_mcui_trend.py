"""verified-pilot-3.4 OBIS reporting-rate check on synthetic counts: classes, thresholds and the MCUI effect."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_verified_indices import occurrence_trend  # noqa: E402

RULE = json.loads((ROOT / "config" / "verified-indices-v3.4.json").read_text(encoding="utf-8"))["conservation"]["trend"]


def snap(n1, n2, e1, e2, cells=1, a1=None, a2=None):
    """One species of class C spread evenly over `cells` cells; group effort e1/e2 and all-taxa effort a1/a2 in total."""
    keys = [f"{35 + i}/{125 + i}" for i in range(cells)]
    per = lambda total: {k: total // cells + (1 if i < total % cells else 0) for i, k in enumerate(keys)}
    sp1, sp2, g1, g2 = per(n1), per(n2), per(e1), per(e2)
    b1, b2 = per(a1 or 10 * e1), per(a2 or 10 * e2)
    return {"species": {"1": {"class": "C", "records_all_years": n1 + n2, "yearrange": [1990, 2025],
                              "past": {"records": n1, "outside_grid": 0, "cells": {k: v for k, v in sp1.items() if v}, "datasets": {"d": n1}},
                              "recent": {"records": n2, "outside_grid": 0, "cells": {k: v for k, v in sp2.items() if v}, "datasets": {"d": n2}}}},
            "group_effort": {"C": {"cells": {k: {"past": g1[k], "recent": g2[k]} for k in keys}}},
            "effort": {k: {"past": b1[k], "recent": b2[k]} for k in keys}}


def cls(*args, **kw):
    return occurrence_trend(1, snap(*args, **kw), RULE)["class"]


class TrendClasses(unittest.TestCase):
    def test_rule_is_the_published_one(self):
        self.assertEqual((RULE["min_past_records"], RULE["decline_ratio"], RULE["z"], RULE["continuity"]), (20, 0.7, 1.96, 0.5))

    def test_too_few_past_records_is_undetermined(self):
        t = occurrence_trend(1, snap(19, 0, 1000, 1000), RULE)
        self.assertEqual((t["class"], t["reason"]), ("undetermined", "past_records_below_minimum"))
        self.assertNotIn("reporting_rate_ratio", t)

    def test_a_clear_30_percent_fall_is_a_decline_signal(self):
        self.assertEqual(cls(400, 100, 1000, 1000), "decline_signal")          # rate x0.25
        self.assertEqual(cls(400, 100, 1000, 500), "decline_signal")           # effort halved, rate still x0.5

    def test_the_same_fall_with_wide_uncertainty_is_undetermined(self):
        t = occurrence_trend(1, snap(20, 12, 1000, 1000), RULE)   # rate x0.61, interval about 0.30-1.23
        self.assertLessEqual(t["reporting_rate_ratio"], 0.7)
        self.assertGreaterEqual(t["ci"][1], 1)
        self.assertEqual((t["class"], t["reason"]), ("undetermined", "decline_uncertain"))

    def test_fewer_records_explained_by_less_effort_is_a_survey_gap(self):
        t = occurrence_trend(1, snap(400, 200, 1000, 500), RULE)              # records and effort both halve
        self.assertEqual((t["class"], t["effort_ratio"]), ("survey_gap", 0.5))

    def test_a_fall_below_the_threshold_is_not_called_a_survey_gap(self):
        # the rate itself fell (x0.8, interval below 1) while effort fell: effort does not explain it
        self.assertEqual(cls(2000, 800, 1000, 500), "no_clear_decline")

    def test_stable_or_rising_rate_is_no_clear_decline(self):
        self.assertEqual(cls(100, 100, 1000, 1000), "no_clear_decline")
        self.assertEqual(cls(100, 300, 1000, 1000), "no_clear_decline")

    def test_only_cells_with_group_effort_in_both_periods_count(self):
        s = snap(100, 20, 1000, 1000, cells=2)
        s["group_effort"]["C"]["cells"]["36/126"]["recent"] = 0
        t = occurrence_trend(1, s, RULE)
        self.assertEqual((t["cells_compared"], t["species_records"]["past"]), (1, 50))
        self.assertEqual(t["records_outside_compared_cells"], {"past": 50, "recent": 10})

    def test_all_taxa_effort_is_a_sensitivity_only(self):
        a = occurrence_trend(1, snap(400, 200, 1000, 500, a1=10000, a2=10000), RULE)
        b = occurrence_trend(1, snap(400, 200, 1000, 500, a1=10000, a2=2000), RULE)
        self.assertEqual((a["class"], b["class"]), ("survey_gap", "survey_gap"))
        self.assertNotEqual(a["all_taxa_sensitivity"]["reporting_rate_ratio"], b["all_taxa_sensitivity"]["reporting_rate_ratio"])

    def test_a_species_without_a_trend_record_stops_the_build(self):
        with self.assertRaisesRegex(ValueError, "no OBIS trend record"):
            occurrence_trend(2, snap(100, 100, 1000, 1000), RULE)


if __name__ == "__main__":
    unittest.main()
