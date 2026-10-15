"""Compound origin (origin-class-rule-2026-10-15): the committed dist/origin-review.json and its tables are reproducible from
the research record and the published report; every scored MBPI item gets exactly one class by the fixed order; the reference
value uses confirmed items only and is never above MBPI; the indicator build reads neither file."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_origin_review import (CLASSES, DEFAULT_OUTPUT, DEFAULT_RECORD, DEFAULT_REPORT, DEFAULT_TABLES, ORDER, build,  # noqa: E402
                                 classify, item_key, render, tables)

read = lambda p: json.loads(p.read_text(encoding="utf-8"))
RECORD, REPORT = read(DEFAULT_RECORD), read(DEFAULT_REPORT)
SPECIES = {s["aphia_id"]: s for s in REPORT["species"] + REPORT["candidate_species"]}


class OriginReview(unittest.TestCase):
    def setUp(self):
        self.out = build(RECORD, REPORT)
        self.rows = {r["aphia_id"]: r for r in self.out["species"]}

    def test_committed_output_is_reproducible(self):
        self.assertEqual(DEFAULT_OUTPUT.read_text(encoding="utf-8"), render(self.out))
        self.assertEqual(DEFAULT_TABLES.read_text(encoding="utf-8"), tables(self.out))
        self.assertEqual(self.out["report_version"], REPORT["method_version"])
        self.assertTrue(self.out["display_only"])
        self.assertEqual(set(self.rows), set(SPECIES))

    def test_every_scored_item_has_one_class(self):
        for aphia, s in SPECIES.items():
            r = self.rows[aphia]
            self.assertEqual([i["key"] for i in r["items"]], [item_key(x) for x in s["bioactivity_trace"]])
            for i in r["items"]:
                self.assertIn(i["origin_class"], CLASSES)
                self.assertEqual(i["confirmed"], i["origin_class"] == "producer_confirmed")
                self.assertTrue(i["reason_ko"])
        self.assertEqual(self.out["summary"]["items"], sum(len(s["bioactivity_trace"]) for s in SPECIES.values()))

    def test_order_and_unknown(self):
        self.assertEqual(classify([]), "unknown")
        everything = [{"fact": f} for f, _ in ORDER]
        self.assertEqual(classify(everything), "sample_mismatch")
        self.assertEqual(classify([{"fact": "own_production"}, {"fact": "other_producer"}]), "associated_possible")
        self.assertEqual(classify([{"fact": "own_production"}, {"fact": "processing_product"}]), "artifact_possible")
        # an item whose paper or compound is not in the record is unknown, never confirmed
        rec = copy.deepcopy(RECORD)
        del rec["papers"]["10.1021/jf020482t"]
        wakame = {r["aphia_id"]: r for r in build(rec, REPORT)["species"]}[145721]
        self.assertEqual({i["origin_class"] for i in wakame["items"] if i["key"].endswith(":VW")}, {"unknown"})
        self.assertEqual(wakame["top_origin"], "suspect")

    def test_reference_value_uses_confirmed_items_only(self):
        for aphia, r in self.rows.items():
            s = SPECIES[aphia]
            self.assertEqual(r["mbpi"], s["scores"]["MBPI"])
            kept = [x["adjusted"] for x, i in zip(s["bioactivity_trace"], r["items"]) if i["confirmed"]]
            self.assertEqual(r["mbpi_origin_strict"], float(f"{max(kept):.1f}") if kept else None)
            if r["mbpi_origin_strict"] is not None:
                self.assertLessEqual(r["mbpi_origin_strict"], r["mbpi"])
            if r["top_origin"] == "confirmed":
                self.assertEqual(r["mbpi_origin_strict"], r["mbpi"])

    def test_known_cases(self):
        by = {r["korean_name"]: r for r in self.out["species"]}
        self.assertEqual(by["다시마"]["top_origin_class"], "artifact_possible")     # saringosterol: fucosterol oxidation
        self.assertEqual(by["멍게"]["top_origin_class"], "associated_possible")     # halocynthiaxanthin: dietary carotenoid
        self.assertEqual(by["우뭇가사리"]["top_origin_class"], "sample_mismatch")   # pheophorbide a measured on Vatica cinerea
        self.assertEqual(by["감태"]["top_origin"], "confirmed")
        cases = {c["scientific_name"]: c["origin_class"] for c in self.out["posthoc_cases"]}
        self.assertEqual(cases["Halichondria okadai"], "associated_possible")
        self.assertEqual(cases["Ecteinascidia turbinata"], "sample_mismatch")

    def test_record_rows_must_be_used_and_sourced(self):
        rec = copy.deepcopy(RECORD)
        rec["papers"]["10.0000/not-used"] = {"facts": []}
        with self.assertRaisesRegex(ValueError, "not used by any item"):
            build(rec, REPORT)
        rec = copy.deepcopy(RECORD)
        rec["compounds"][0]["facts"][0]["sources"] = []
        with self.assertRaisesRegex(ValueError, "needs a source"):
            build(rec, REPORT)

    def test_scores_untouched_and_indicator_build_does_not_read_it(self):
        for name in ("build_verified_indices.py", "build_matrix_readiness.py"):
            text = (ROOT / "scripts" / name).read_text(encoding="utf-8")
            self.assertNotIn("origin-review", text)
            self.assertNotIn("origin_class", text)
        self.assertNotIn("origin_class", (ROOT / "dist/assessments.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
