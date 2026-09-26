"""Regression checks for the reviewed snapshot and the scorer's admission rules (verified-pilot-2)."""
import copy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_verified_indices import build, load_inputs, render  # noqa: E402


def species(report, aphia):
    return next(item for item in report["species"] if item["aphia_id"] == aphia)


def synthetic_assays(evidence):
    activities = []
    for n in range(3):
        activities.append({"status": "approved_for_score", "reviewed": True,
            "origin_reviewed": True, "compound_structure_reviewed": True,
            "compound_id": f"CID:{n + 1}", "source_id": "chembl_37",
            "origin_aphia_id": 836033, "origin_scientific_name": "Magallana gigas",
            "original_paper_doi": f"10.0000/synthetic{n + 1}", "activity_id": f"SYN{n + 1}",
            "assay_id": "same-assay", "target_id": "same-target",
            "assay_type": "B", "test_system": "cell-line-Z", "conditions_key": "48h",
            "endpoint": "IC50", "standard_relation": "=", "standard_units": "nM",
            "standard_value": 10 ** (n + 2), "pchembl_value": 7 - n,
            "data_validity_comment": None, "material_kind": "single_compound"})
    evidence["bioactivity"].extend(activities)
    evidence["bioactivity_cohorts"] = [{"id": "synthetic-fixed-assay", "activity_ids": [a["activity_id"] for a in activities]}]


class VerifiedIndicesTests(unittest.TestCase):
    def setUp(self):
        self.evidence, self.candidates, self.config, self.snapshot, self.taxonomy = load_inputs()

    def run_build(self, evidence=None, config=None, snapshot=None):
        return build(evidence or self.evidence, self.candidates, config or self.config,
                     snapshot or self.snapshot, self.taxonomy)

    def test_real_snapshot_scores_and_committed_output(self):
        report = self.run_build()
        got = {s["aphia_id"]: s["scores"] for s in report["species"]}
        self.assertEqual(got[836033], {"MFPI": 65.5, "MBPI": None, "MCUI": None, "BBVI": None})
        self.assertEqual(got[250680]["MFPI"], 54.2)
        self.assertEqual(got[145721]["MFPI"], 42.2)
        self.assertEqual(got[241776]["MCUI"], 80.0)
        self.assertEqual(got[342067]["MCUI"], 10.0)
        self.assertTrue(all(v["MBPI"] is None and v["BBVI"] is None for v in got.values()))
        self.assertEqual(render(report), (ROOT / "dist" / "assessments.json").read_text(encoding="utf-8"))

    def test_hand_calculation_and_cross_check(self):
        oyster = species(self.run_build(), 836033)
        f = oyster["food_trace"]
        mean = sum(n["percentile_unrounded"] * n["evidence_factor"] for n in f["nutrients"].values()) / 3
        self.assertAlmostEqual(f["unrounded"], 0.8 * mean + 10 * 0.16 + 10, places=9)
        self.assertEqual([c["mfpi"] for c in f["cross_checks"]], [65.6])  # verified-pilot-1 AFCD result kept separate
        self.assertEqual(f["edible_fraction"]["value"], 0.16)             # RDA refuse 84 %
        self.assertEqual([y["fraction"] for y in f["yield_sensitivity"]], [0.1157, 0.1527, 0.237])

    def test_blank_is_missing_not_zero(self):
        mussel = species(self.run_build(), 506159)
        row = next(r for r in mussel["food_trace"]["observed_rows"] if r["linked"])
        self.assertIsNone(row["values"]["zinc_mg"])
        self.assertEqual(row["missing"], ["zinc_mg"])
        self.assertIsNone(mussel["scores"]["MFPI"])
        self.assertEqual(mussel["withheld_reasons"]["MFPI"], "component_missing_in_source")
        self.assertEqual(mussel["score_status"]["MFPI"], "일부 근거 확인")

    def test_unlinked_generic_rows_are_not_species_scores(self):
        report = self.run_build()
        cucumber, agar = species(report, 241776), species(report, 372119)
        self.assertEqual(cucumber["withheld_reasons"]["MFPI"], "food_row_not_species_specific")
        self.assertFalse(any(r["linked"] for r in agar["food_trace"]["observed_rows"]))
        cohort = next(c for c in report["comparison_cohorts"] if c["cohort_id"] == "rda-10.4-raw-marine-animals")
        self.assertIn("K6230000000a", cohort["food_item_ids"])       # generic squid is a reference food
        self.assertNotIn(342067, cohort["operating_candidates"])    # ... but not Todarodes pacificus

    def test_frozen_cohort_rejects_snapshot_drift_and_state_mixing(self):
        snapshot = copy.deepcopy(self.snapshot)
        row = next(r for r in snapshot["rows"] if r["code"] == "K4060010000a")
        row["values"]["zinc_mg"] = None
        with self.assertRaises(ValueError):
            self.run_build(snapshot=snapshot)
        evidence = copy.deepcopy(self.evidence)
        evidence["nutrition_rows"][1]["sample_state"] = "dried"
        with self.assertRaises(ValueError):
            self.run_build(evidence=evidence)
        evidence = copy.deepcopy(self.evidence)
        evidence["nutrition_rows"][1]["nutrients"]["iron_mg"]["unit"] = "g"
        with self.assertRaises(ValueError):
            self.run_build(evidence=evidence)

    def test_missing_aquaculture_withholds_only_food_axis(self):
        evidence = copy.deepcopy(self.evidence)
        evidence["food_support"] = [x for x in evidence["food_support"] if not (x["kind"] == "aquaculture" and x["aphia_id"] == 250680)]
        squirt = species(self.run_build(evidence=evidence), 250680)
        self.assertIsNone(squirt["scores"]["MFPI"])
        self.assertEqual(squirt["withheld_reasons"]["MFPI"], "aquaculture_method_unverified")

    def test_iucn_states_are_distinct(self):
        report = self.run_build()
        self.assertEqual(species(report, 145721)["withheld_reasons"]["MCUI"], "not_in_red_list")
        cucumber = species(report, 241776)["conservation_trace"]
        self.assertEqual((cucumber["category"], cucumber["assessment_year"], cucumber["publication_year"]), ("EN", 2025, 2026))
        self.assertTrue(species(report, 342067)["conservation_trace"]["assessment_older_than_10y"])
        evidence = copy.deepcopy(self.evidence)
        record = next(x for x in evidence["conservation"] if x["aphia_id"] == 241776)
        record["iucn_state"], record["category"] = "data_deficient", "DD"
        dd = species(self.run_build(evidence=evidence), 241776)
        self.assertIsNone(dd["scores"]["MCUI"])
        self.assertEqual(dd["withheld_reasons"]["MCUI"], "category_not_numeric")
        record["iucn_state"] = "lookup_failed"
        self.assertEqual(species(self.run_build(evidence=evidence), 241776)["withheld_reasons"]["MCUI"], "assessment_lookup_failed")
        evidence = copy.deepcopy(self.evidence)
        next(x for x in evidence["conservation"] if x["aphia_id"] == 241776)["current_status_check"]["checked_on"] = "2026-02-30"
        with self.assertRaises(ValueError):
            self.run_build(evidence=evidence)

    def test_bioactivity_cohort_dedup_weights_and_unit_guard(self):
        synthetic_assays(self.evidence)
        oyster = species(self.run_build(), 836033)
        self.assertEqual(oyster["scores"]["MBPI"], 62.5)
        self.assertEqual(oyster["scores"]["BBVI"], 64.0)
        duplicate = copy.deepcopy(self.evidence["bioactivity"][-3])
        duplicate["activity_id"] = "SYN1-duplicate-database-row"
        self.evidence["bioactivity"].append(duplicate)
        self.evidence["bioactivity_cohorts"][0]["activity_ids"].append(duplicate["activity_id"])
        same = species(self.run_build(), 836033)
        self.assertEqual(same["scores"]["MBPI"], 62.5)          # same DOI twice is still one paper
        self.assertEqual(same["bioactivity_trace"][0]["evidence_factor"], .75)
        config = copy.deepcopy(self.config)
        config["bbvi"]["default_food_weight"] = .75
        self.assertEqual(species(self.run_build(config=config), 836033)["scores"]["BBVI"], 64.8)
        self.evidence["bioactivity"][-1]["standard_units"] = "µg/mL"
        with self.assertRaises(ValueError):
            self.run_build()

    def test_mic_and_test_organism_never_enter_mbpi(self):
        evidence = copy.deepcopy(self.evidence)
        holotoxin = next(b for b in evidence["bioactivity"] if b["origin_aphia_id"] == 241776)
        holotoxin.update(status="approved_for_score", endpoint="MIC")
        with self.assertRaises(ValueError):
            self.run_build(evidence=evidence)

    def test_tots_cell_assay_stays_partial_without_exact_identity(self):
        report = self.run_build()
        row = species(report, 494972)
        lead = next(x for x in row["bioactivity_partial"] if x["record_id"].startswith("PMID:34997687"))
        self.assertEqual(lead["reported_origin_scientific_name"], "Sargassum fusiformis")
        self.assertEqual((lead["values"][0]["value"], lead["values"][0]["uncertainty"], lead["values"][0]["unit"]),
                         (63.16, 3.6, "µg/mL"))
        self.assertEqual(lead["chain"], {"origin": False, "structure_id": False,
                                         "quantitative_endpoint": True, "comparable_cohort": False})
        self.assertIsNone(row["scores"]["MBPI"])
        self.assertIsNone(row["scores"]["BBVI"])
        unreviewed = copy.deepcopy(self.evidence)
        next(x for x in unreviewed["bioactivity"] if x["record_id"] == lead["record_id"])["status"] = "approved_for_score"
        with self.assertRaises(ValueError):
            self.run_build(evidence=unreviewed)

    def test_research_candidates_stay_separate_from_operating_species(self):
        report = self.run_build()
        self.assertEqual(len(report["species"]), 8)
        rows = {s["aphia_id"]: s for s in report["candidate_species"]}
        self.assertEqual(len(rows), 22)
        self.assertTrue(all(s["candidate_label"] == "조사 후보" for s in rows.values()))
        self.assertEqual(rows[231750]["scores"]["MFPI"], 52.1)                       # 바지락, same frozen cohort
        self.assertEqual(rows[397082]["scores"]["MCUI"], 80.0)                       # Haliotis discus EN
        self.assertIsNone(rows[275816]["scores"]["MCUI"])                            # not in Red List is not low
        self.assertEqual(rows[275816]["withheld_reasons"]["MCUI"], "not_in_red_list")
        self.assertEqual(rows[1666974]["withheld_reasons"]["MCUI"], "category_not_numeric")
        cohort = next(c for c in report["comparison_cohorts"] if c["cohort_id"] == "rda-10.4-raw-marine-animals")
        self.assertEqual(cohort["operating_candidates"], [250680, 836033])
        self.assertIn(231750, cohort["research_candidates"])

    def test_unexplored_flag_never_copies_scores(self):
        synthetic_assays(self.evidence)
        report = self.run_build()
        self.assertTrue(all(s["unexplored_candidate"] is None for s in report["species"]))  # no relative shares genus/family
        taxonomy = copy.deepcopy(self.taxonomy)
        taxonomy["species"]["506159"]["family"] = "Ostreidae"
        flagged = species(build(self.evidence, self.candidates, self.config, self.snapshot, taxonomy), 506159)
        self.assertEqual(flagged["unexplored_candidate"]["relatives"], ["Magallana gigas"])
        self.assertIsNone(flagged["scores"]["BBVI"])


if __name__ == "__main__":
    unittest.main()
