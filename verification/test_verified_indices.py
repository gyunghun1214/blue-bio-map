"""Regression checks for the reviewed snapshot and the scorer's admission rules (verified-pilot-2)."""
import copy
import math
import json
import sys
import unittest
from statistics import median
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_verified_indices import (DEFAULT_CONFIG, build, independent_sources, load_inputs, render, round1,  # noqa: E402
                                    subnational_backtest, subnational_category, unexplored_flag)


def species(report, aphia):
    # Research candidates such as 감태 (371986) live in candidate_species, not among the 8 operating species.
    return next(item for item in report["species"] + report.get("candidate_species", []) if item["aphia_id"] == aphia)


def synthetic_assays(evidence):
    activities = []
    for n in range(3):
        cid = f"CID:{n + 1}"
        doi = f"10.0000/synthetic{n + 1}"
        evidence["reviewed_compound_structures"][cid] = {
            "name": f"fixture-{n}", "formula": "C2H6", "source_id": "pubchem_pugrest",
            "url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{n + 1}"}
        evidence["reviewed_assay_protocols"][f"synthetic-assay-{n}"] = {
            "original_paper_doi": doi, "origin_aphia_id": 836033,
            "origin_scientific_name": "Magallana gigas", "target_id": "same-target",
            "endpoint": "IC50", "assay_type": "B", "test_system": "cell-line-Z",
            "conditions_key": "48h"}
        activities.append({"status": "approved_for_score", "reviewed": True,
            "origin_reviewed": True, "compound_structure_reviewed": True,
            "compound_id": cid, "compound_name": f"fixture-{n}", "molecular_formula": "C2H6",
            "paper_structure_label": "fixture", "paper_species_name": "Magallana gigas",
            "source_id": "chembl_37", "original_paper_url": evidence["sources"]["chembl_37"]["url"],
            "origin_aphia_id": 836033, "origin_scientific_name": "Magallana gigas",
            "original_paper_doi": doi, "activity_id": f"SYN{n + 1}",
            "assay_id": f"synthetic-assay-{n}", "target_id": "same-target",
            "assay_type": "B", "test_system": "cell-line-Z", "conditions_key": "48h",
            "endpoint": "IC50", "standard_relation": "=", "standard_units": "nM",
            "standard_value": 10 ** (n + 2), "pchembl_value": 7 - n,
            "raw_value": 10 ** (n + 2), "raw_unit": "nM",
            "data_validity_comment": None, "material_kind": "single_compound"})
    evidence["bioactivity"].extend(activities)
    evidence["bioactivity_cohorts"].append({"id": "synthetic-fixed-assay", "activity_ids": [a["activity_id"] for a in activities]})


V2 = ROOT / "config" / "verified-indices-v2.json"  # superseded public method; its rules stay tested
V21 = ROOT / "config" / "verified-indices-v2.1.json"  # superseded by 2.2 (peptide stratum); its rules stay tested
V22 = ROOT / "config" / "verified-indices-v2.2.json"  # superseded by 2.3 (cross-origin potency); its rules stay tested
V23 = ROOT / "config" / "verified-indices-v2.3.json"  # superseded by 3.1 (ChEMBL stratum); its rules stay tested
NATIONAL_MCUI = {506159, 836033, 231750, 393716, 504357, 413600, 1666974}


class VerifiedIndicesTests(unittest.TestCase):
    def setUp(self):
        self.evidence, self.candidates, self.config, self.snapshot, self.taxonomy = load_inputs(config=V2)

    def run_build(self, evidence=None, config=None, snapshot=None):
        return build(evidence or self.evidence, self.candidates, config or self.config,
                     snapshot or self.snapshot, self.taxonomy)

    def test_real_snapshot_scores_and_committed_output(self):
        report = self.run_build()
        got = {s["aphia_id"]: s["scores"] for s in report["species"] + report["candidate_species"]}
        self.assertEqual(got[836033], {"MFPI": 65.5, "MBPI": None, "MCUI": None, "BBVI": None})
        self.assertEqual(got[250680]["MFPI"], 54.2)
        self.assertEqual(got[145721]["MFPI"], 42.2)
        self.assertEqual(got[241776]["MCUI"], 80.0)
        self.assertEqual(got[342067]["MCUI"], 10.0)
        self.assertEqual(got[371986], {"MFPI": None, "MBPI": 67.5, "MCUI": None, "BBVI": None})
        self.assertTrue(all(v["BBVI"] is None for v in got.values()))
        self.assertTrue(all(v["MBPI"] is None for k, v in got.items() if k != 371986))

    def test_ecklonia_original_measurements_and_fixed_cohort(self):
        item = species(self.run_build(), 371986)
        self.assertEqual(len(item["bioactivity_trace"]), 5)
        self.assertEqual({r["peer_compounds"] for r in item["bioactivity_trace"]}, {5})
        self.assertEqual({d for r in item["bioactivity_trace"] for d in r["original_paper_dois"]},
                         {"10.4162/nrp.2011.5.2.93"})
        self.assertEqual(item["scores"], {"MFPI": None, "MBPI": 67.5, "MCUI": None, "BBVI": None})
        self.assertEqual(item["sensitivity"]["median_compound_sensitivity"], 37.5)
        self.assertEqual(item["sensitivity"]["mean_compound_sensitivity"], 37.5)

    def test_ecklonia_wrong_structure_paper_target_conditions_and_unit_rejected(self):
        cases = (("compound_id", "CID:145937"), ("molecular_formula", "C18H10O9"),
                 ("original_paper_doi", "10.0000/wrong"), ("target_id", "BACE1"),
                 ("conditions_key", "different-time"), ("raw_unit", "µM"),
                 ("origin_aphia_id", 836033), ("paper_species_name", "Ecklonia stolonifera"))
        for field, bad in cases:
            with self.subTest(field=field):
                changed = copy.deepcopy(self.evidence)
                next(a for a in changed["bioactivity"] if a.get("activity_id") ==
                     "Wijesinghe2011:Table2:3008868")[field] = bad
                with self.assertRaises(ValueError):
                    self.run_build(evidence=changed)

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

    def test_rejected_refuse_row_withholds_mfpi(self):
        yellowtail = next(s for s in self.run_build()["candidate_species"] if s["aphia_id"] == 276651)
        self.assertEqual(yellowtail["food_trace"]["edible_fraction"]["source_id"], "mext_sfct_2020")  # fillet row refuse 0 rejected
        self.assertEqual(yellowtail["scores"]["MFPI"], 56.3)
        evidence = copy.deepcopy(self.evidence)
        evidence["rda_refuse_not_accepted"].append({**evidence["rda_refuse_not_accepted"][0], "food_item_id": "K4130000000a"})
        clam = next(s for s in self.run_build(evidence=evidence)["candidate_species"] if s["aphia_id"] == 231750)
        self.assertIsNone(clam["scores"]["MFPI"])
        self.assertEqual(clam["withheld_reasons"]["MFPI"], "species_edible_yield_unverified")
        row = next(r for r in clam["food_trace"]["observed_rows"] if r["linked"])
        self.assertEqual((row["refuse_pct"], row["refuse_not_accepted"]["refuse_pct"]), (None, 68.0))
        del evidence["rda_refuse_not_accepted"][0]["checked_on"]
        with self.assertRaises(ValueError):
            self.run_build(evidence=evidence)

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
        self.evidence["bioactivity_cohorts"][-1]["activity_ids"].append(duplicate["activity_id"])
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

    def test_mislinked_origin_compound_and_assay_are_rejected(self):
        for field, wrong in (("origin_scientific_name", "Apostichopus japonicus"),
                             ("origin_aphia_id", 241776), ("compound_id", "unconfirmed"),
                             ("target_id", "different-target"), ("conditions_key", "72h")):
            with self.subTest(field=field):
                evidence = copy.deepcopy(self.evidence)
                synthetic_assays(evidence)  # arithmetic fixture, never a real-scored record
                evidence["bioactivity"][-1][field] = wrong
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


    def test_national_fact_never_becomes_mcui(self):
        report = self.run_build()
        facts = [s for s in report["species"] + report["candidate_species"] if s.get("national_red_list_fact")]
        self.assertEqual(len(facts), 8)
        for s in facts:
            self.assertFalse(s["national_red_list_fact"]["used_for_score"])
            self.assertIn(s["national_red_list_fact"]["source_id"], s["source_ids"])
        self.assertIsNone(species(report, 836033)["scores"]["MCUI"])  # 참굴: national LC only, IUCN not assessed
        stripped = {k: v for k, v in self.config.items() if k != "national_fact_supplement"}
        plain = self.run_build(config=stripped)
        self.assertEqual({s["aphia_id"]: s["scores"] for s in plain["species"] + plain["candidate_species"]},
                         {s["aphia_id"]: s["scores"] for s in report["species"] + report["candidate_species"]})
        self.assertNotIn("ahtpdb", " ".join(report["sources"]).lower())


class VerifiedPilot21Tests(unittest.TestCase):
    """The 2.1 method: v2 plus a separately labelled national MCUI and paper-only peptide raw values."""

    def setUp(self):
        self.report = build(*load_inputs(config=V21))
        self.v2 = build(*load_inputs(config=V2))

    def test_method_version(self):
        self.assertEqual(self.report["method_version"], "verified-pilot-2.1")

    def test_only_national_mcui_is_added_and_labelled(self):
        for old in self.v2["species"] + self.v2["candidate_species"]:
            new = species(self.report, old["aphia_id"])
            for axis in ("MFPI", "MBPI", "BBVI"):
                self.assertEqual(new["scores"][axis], old["scores"][axis], (old["aphia_id"], axis))
            if new.get("mcui_basis") == "national":
                self.assertIsNone(old["scores"]["MCUI"], "national MCUI only fills an IUCN gap")
                self.assertEqual(new["national_assessment"]["category"], "LC")
                self.assertEqual(new["scores"]["MCUI"], 10.0)
            else:
                self.assertEqual(new["scores"]["MCUI"], old["scores"]["MCUI"], old["aphia_id"])
        got = {s["aphia_id"] for s in self.report["species"] + self.report["candidate_species"] if s.get("mcui_basis") == "national"}
        self.assertEqual(got, NATIONAL_MCUI)
        recheck = self.report["method"]["national_red_list"]["page_recheck"]
        self.assertEqual(recheck["checked_on"], "2026-09-27")
        self.assertEqual({int(k) for k in recheck["rows"]}, NATIONAL_MCUI)

    def test_peptide_raw_values_never_score_or_rank(self):
        raw = {s["aphia_id"]: s.get("peptide_raw_values") for s in self.report["species"] + self.report["candidate_species"]
               if s.get("peptide_raw_values")}
        self.assertEqual({k: [r["sequence"] for r in v] for k, v in raw.items()}, {145721: ["KNFL"], 836033: ["AEYLCEAC", "LQP"]})
        licences = {"feng_2021_knfl": "CC BY 4.0", "chen_2022_oyster": "CC BY 4.0",
                    "do_2012_oyster_lqp": "Publisher copyright (KoreaScience/KISTI terms; no CC licence stated)"}
        for rows in raw.values():
            for r in rows:
                self.assertIs(r["used_for_score"], False)
                self.assertEqual(r["label"], "원값·출처")
                self.assertNotIn("percentile", r)
                self.assertEqual(self.report["sources"][r["source_id"]]["license"], licences[r["source_id"]])
                self.assertIn("numeric values only", self.report["sources"][r["source_id"]]["terms"])
        self.assertEqual({(k, r["sequence"]): r["value"] for k, v in raw.items() for r in v},
                         {(145721, "KNFL"): 225.87, (836033, "AEYLCEAC"): 4287, (836033, "LQP"): 1.18})
        # the 2.1-only raw value never reaches the v3 research supplement or its AHTPDB peptide stratum
        v3 = json.loads((ROOT / "research" / "verified-indices" / "evidence-v3.json").read_text(encoding="utf-8"))
        self.assertNotIn("do_2012_oyster_lqp", v3["sources"])
        self.assertNotIn("ahtpdb_ic50_2026", self.report["sources"])
        self.assertTrue(all(s["scores"]["BBVI"] is None for s in self.report["species"] + self.report["candidate_species"]))


    def test_reference_combination_is_never_a_score(self):
        rows = self.report["species"] + self.report["candidate_species"]
        self.assertTrue(all(s["reference_combination"] is None for s in rows), "no species has both MFPI and MBPI today")
        evidence, candidates, config, snapshot, taxonomy = load_inputs(config=V21)
        synthetic_assays(evidence)   # oyster gets a one-paper-per-compound MBPI beside its MFPI
        report = build(evidence, candidates, config, snapshot, taxonomy)
        oyster = species(report, 836033)
        self.assertEqual((oyster["scores"]["MBPI"], oyster["scores"]["BBVI"]), (62.5, None))
        ref = oyster["reference_combination"]
        self.assertEqual((ref["value"], ref["inputs"], ref["used_for_score"]), (64.0, {"MFPI": 65.5, "MBPI": 62.5}, False))
        self.assertEqual((ref["label"], ref["formula"], ref["food_weight"]), ("참고 통합값 · 독립 재현 미확인", "w×MFPI+(1−w)×MBPI", 0.5))
        self.assertEqual(set(ref["sensitivity"]), {"0.25", "0.5", "0.75"})
        self.assertEqual(ref["mfpi_cohort"], "rda-10.4-raw-marine-animals")
        for aphia in (250680, 371986):   # a single axis never yields a combination
            self.assertIsNone(species(report, aphia)["reference_combination"])
        config = copy.deepcopy(config)
        config["bbvi"]["minimum_independent_mbpi_dois"] = 1   # once replication is met it is a real BBVI, not a reference
        oyster = species(build(evidence, candidates, config, snapshot, taxonomy), 836033)
        self.assertEqual((oyster["scores"]["BBVI"], oyster["reference_combination"]), (64.0, None))


class VerifiedPilot3Tests(unittest.TestCase):
    V3 = ROOT / "config" / "verified-indices-v3.json"

    def setUp(self):
        self.evidence, self.candidates, self.config, self.snapshot, self.taxonomy = load_inputs(config=self.V3)

    def run_build(self, evidence=None):
        return build(evidence or self.evidence, self.candidates, self.config, self.snapshot, self.taxonomy)

    def test_committed_v3_output_is_reproducible_and_v2_scores_unchanged(self):
        report = self.run_build()
        self.assertEqual((ROOT / "research" / "verified-indices" / "assessments-v3.json").read_text(encoding="utf-8"), render(report))
        v2 = build(*load_inputs(config=V32))  # 3.3 adds substituted MFPI values that the research v3 config does not use
        for old in v2["species"]:
            new = species(report, old["aphia_id"])
            for axis in ("MFPI", "MCUI"):
                if old["scores"][axis] is not None:
                    self.assertEqual(new["scores"][axis], old["scores"][axis])

    def test_peptides_never_join_the_small_molecule_stratum(self):
        report = self.run_build()
        undaria = species(report, 145721)
        self.assertEqual(undaria["mbpi_stratum"], "peptide")
        self.assertFalse(undaria["bbvi_mbpi_from_peptide_stratum"])   # single-paper MBPI never reaches BBVI
        self.assertTrue(all(i["stratum_kind"] == "peptide" and "compound_id" not in i for i in undaria["bioactivity_trace"]))
        peptide = copy.deepcopy(next(r for r in self.evidence["peptide_bioactivity"] if r["status"] == "approved_for_score"))
        evidence = copy.deepcopy(self.evidence)
        evidence["bioactivity"].append({**peptide, "activity_id": "PEP1"})     # a peptide row offered as a ChEMBL compound
        with self.assertRaisesRegex(ValueError, "compound-origin/ChEMBL chain"):
            self.run_build(evidence)

    def test_single_source_mbpi_is_reference_only(self):
        undaria = species(self.run_build(), 145721)
        self.assertEqual((undaria["scores"]["MBPI"], undaria["scores"]["BBVI"]), (19.6, None))
        self.assertEqual((undaria["withheld_reasons"]["BBVI"], undaria["mbpi_label"]), ("mbpi_single_source", "참고값(단일 논문)"))
        knfl = next(r for r in self.evidence["peptide_bioactivity"] if r["sequence"] == "KNFL")
        for doi, computed in ((knfl["original_paper_doi"].upper(), False),           # same DOI again counts once
                              ("10.9999/synthetic-independent-replicate", True)):
            evidence = copy.deepcopy(self.evidence)
            evidence["peptide_bioactivity"].append({**knfl, "record_id": "replicate", "original_paper_doi": doi})
            undaria = species(self.run_build(evidence), 145721)
            self.assertEqual(undaria["scores"]["BBVI"] is not None, computed)
            self.assertEqual(undaria["mbpi_label"] is None, computed)
        self.assertNotIn("mbpi_label", species(build(*load_inputs(config=V2)), 145721))   # v2 has no such rule

    def test_national_assessment_is_labelled_apart_from_iucn(self):
        report = self.run_build()
        oyster, squid = species(report, 836033), species(report, 342067)
        self.assertEqual((oyster["mcui_basis"], oyster["national_assessment"]["label"]), ("national", "국가 평가"))
        self.assertEqual(oyster["conservation_trace"]["iucn_state"], "not_in_red_list")   # IUCN trace untouched
        self.assertEqual(squid["mcui_basis"], "iucn")                                     # IUCN number wins when present
        self.assertIsNone(squid["national_assessment"])
        evidence = copy.deepcopy(self.evidence)
        evidence["national_red_list"] = [r for r in evidence["national_red_list"] if r["aphia_id"] != 836033]
        evidence["legal_protection_facts"] = [{"aphia_id": 836033, "designation": "synthetic legal designation"}]
        oyster = species(self.run_build(evidence), 836033)
        self.assertIsNone(oyster["scores"]["MCUI"])                                      # a designation is a fact, never a score
        self.assertEqual(oyster["national_assessment"]["legal_protection_facts"][0]["designation"], "synthetic legal designation")

    def test_peptide_without_origin_or_from_hydrolysate_is_rejected(self):
        for change, message in (({"origin_aphia_id": None}, "origin species required"),
                                ({"material_kind": "hydrolysate"}, "hydrolysates")):
            evidence = copy.deepcopy(self.evidence)
            evidence["peptide_bioactivity"][0].update(change)
            with self.assertRaisesRegex(ValueError, message):
                self.run_build(evidence)

    def test_oyster_peptide_rows_outside_the_rules_are_rejected(self):
        aeylceac = next(i for i, r in enumerate(self.evidence["peptide_bioactivity"]) if r["sequence"] == "AEYLCEAC")
        for change, message in (({"material_kind": "extract"}, "hydrolysates"),
                                ({"material_kind": "fraction"}, "hydrolysates"),
                                ({"substrate": "FAPGG"}, "incomplete peptide"),          # non-HHL substrate
                                ({"value_in_text": False}, "incomplete peptide"),        # figure-only IC50
                                ({"unit": "mg/mL"}, "incomplete peptide"),               # unit not converted to µM
                                ({"unit": "mM"}, "incomplete peptide"),
                                ({"target": "Escherichia coli", "endpoint": "MIC"}, "incomplete peptide")):  # test organism
            evidence = copy.deepcopy(self.evidence)
            evidence["peptide_bioactivity"][aeylceac].update(change)
            with self.assertRaisesRegex(ValueError, message):
                self.run_build(evidence)
        evidence = copy.deepcopy(self.evidence)   # another oyster species (Magallana rivularis) never scores for 참굴
        evidence["peptide_bioactivity"][aeylceac].update({"origin_aphia_id": 836040, "origin_scientific_name": "Magallana rivularis"})
        self.assertIsNone(species(self.run_build(evidence), 836033)["scores"]["MBPI"])


class OysterLqpResearchScenarioTests(unittest.TestCase):
    """Research config: v3 rules plus the Do 2012 LQP row; public 2.2 adopted the same peptide rows (decisions 2026-09-27)."""
    CONFIG = ROOT / "config" / "verified-indices-v3-oyster-lqp.json"
    OUT = ROOT / "research" / "verified-indices" / "assessments-v3-oyster-lqp.json"

    def test_only_oyster_changes_and_stays_out_of_bbvi_and_matrix(self):
        report = build(*load_inputs(config=self.CONFIG))
        self.assertEqual(self.OUT.read_text(encoding="utf-8"), render(report))
        v3 = build(*load_inputs(config=VerifiedPilot3Tests.V3))
        others = lambda r: {s["aphia_id"]: json.dumps(s, sort_keys=True).replace(r["method_version"], "")
                            for s in r["species"] + r["candidate_species"] if s["aphia_id"] != 836033}
        self.assertEqual(others(report), others(v3))   # the 29 other species are identical
        oyster = species(report, 836033)
        self.assertEqual([(i["peptide_sequence"], i["percentile"], i["evidence_factor"]) for i in oyster["bioactivity_trace"]],
                         [("AEYLCEAC", 1.42, 0.75), ("LQP", 96.31, 0.75)])
        self.assertEqual((oyster["scores"]["MBPI"], oyster["scores"]["BBVI"], oyster["withheld_reasons"]["BBVI"]),
                         (72.2, None, "mbpi_single_source"))   # two peptides from two papers are not a reproduction
        self.assertEqual(oyster["mbpi_label"], "참고값(단일 논문)")
        self.assertEqual(oyster["sensitivity"]["median_compound_sensitivity"], 36.6)
        self.assertEqual(species(v3, 836033)["scores"]["MBPI"], 1.1)
        sys.path.insert(0, str(ROOT / "scripts"))
        from build_matrix_readiness import build as matrix
        dist = lambda name: json.loads((ROOT / "dist" / name).read_text(encoding="utf-8"))
        rows = matrix(report, dist("candidate-catalog.json"), dist("expansion-evidence.json"))["species"]
        self.assertFalse(next(r for r in rows if r["aphia_id"] == 836033)["matrix_eligible"])
        old = species(build(*load_inputs(config=V21)), 836033)   # 2.1 kept the withhold code
        self.assertEqual((old["scores"]["MBPI"], old["withheld_reasons"]["MBPI"]),
                         (None, "compound_origin_assay_chain_or_fixed_cohort_missing"))


class CrossOriginPotencyResearchTests(unittest.TestCase):
    """Research rule adopted as public 2.3: a synthetic peptide re-measured from another origin counts as an independent DOI."""
    CONFIG = ROOT / "config" / "verified-indices-research-xo-potency.json"
    OUT = ROOT / "research" / "verified-indices" / "assessments-research-xo-potency.json"

    def setUp(self):
        self.inputs = load_inputs(config=self.CONFIG)
        self.report = build(*self.inputs)

    def with_replication(self, **changes):
        evidence = copy.deepcopy(self.inputs[0])
        evidence["potency_replications"][0].update(changes)
        return build(evidence, *self.inputs[1:])

    def test_only_oyster_changes_and_its_value_stays_its_own(self):
        self.assertEqual(self.OUT.read_text(encoding="utf-8"), render(self.report))
        public = build(*load_inputs(config=V22))
        research_keys = ("independent_dois", "potency_replications")   # present on every research peptide item
        plain = lambda s: {**s, "bioactivity_trace": [{k: v for k, v in i.items() if k not in research_keys} for i in s["bioactivity_trace"]]}
        others = lambda r: {s["aphia_id"]: json.dumps(plain(s), sort_keys=True).replace(r["method_version"], "")
                            for s in r["species"] + r["candidate_species"] if s["aphia_id"] != 836033}
        self.assertEqual(others(self.report), others(public))   # 미역 KNFL and 감태 have no cross-origin replication
        self.assertEqual(species(self.report, 145721)["bioactivity_trace"][0]["potency_replications"], [])
        oyster = species(self.report, 836033)
        lqp = max(oyster["bioactivity_trace"], key=lambda i: i["adjusted"])
        self.assertEqual((lqp["peptide_sequence"], lqp["pIC50"], lqp["percentile"], lqp["evidence_factor"]), ("LQP", 5.928, 96.31, 1.0))
        self.assertEqual(lqp["original_paper_dois"], ["10.5352/jls.2012.22.2.220"])   # origin claim is still one paper
        self.assertEqual(lqp["independent_dois"], ["10.1271/bbb1961.55.1313", "10.5352/jls.2012.22.2.220"])
        self.assertEqual((oyster["scores"]["MBPI"], oyster["scores"]["BBVI"], oyster["mbpi_label"]), (96.3, 80.9, None))
        self.assertIn("miyoshi_1991_zein", oyster["source_ids"])
        self.assertEqual(species(public, 836033)["scores"]["BBVI"], None)   # 2.2 without the rule withholds it
        from build_matrix_readiness import build as matrix
        dist = lambda name: json.loads((ROOT / "dist" / name).read_text(encoding="utf-8"))
        rows = matrix(self.report, dist("candidate-catalog.json"), dist("expansion-evidence.json"))["species"]
        self.assertFalse(next(r for r in rows if r["aphia_id"] == 836033)["matrix_eligible"])   # MCUI is national, not IUCN

    def test_disagreeing_or_same_paper_replication_is_not_counted(self):
        for changes, reason in (({"value": 200.0}, "pIC50 gap above 1.0"),
                                ({"original_paper_doi": "10.5352/JLS.2012.22.2.220"}, "same paper as the origin measurement")):
            oyster = species(self.with_replication(**changes), 836033)
            lqp = max(oyster["bioactivity_trace"], key=lambda i: i["adjusted"])
            self.assertEqual((lqp["potency_replications"][0]["used"], lqp["potency_replications"][0]["reason"]), (False, reason))
            self.assertEqual((oyster["scores"]["MBPI"], oyster["scores"]["BBVI"]), (72.2, None))

    def test_other_assays_and_unmatched_sequences_are_rejected_or_ignored(self):
        for changes in ({"substrate": "FAPGG"}, {"synthetic": False}, {"unit": "ug/mL"}, {"value_in_text": False}):
            with self.assertRaises(ValueError):
                self.with_replication(**changes)
        report = self.with_replication(sequence="VW")   # a replication never creates an item or a species row
        self.assertEqual(species(report, 836033)["scores"]["BBVI"], None)
        self.assertEqual(len(report["species"]) + len(report["candidate_species"]),
                         len(self.report["species"]) + len(self.report["candidate_species"]))


class VerifiedPilot22Tests(unittest.TestCase):
    """Superseded by 2.3: 2.1 with the v3 AHTPDB peptide stratum in place of display-only raw values."""

    def setUp(self):
        self.report = build(*load_inputs(config=V22))
        self.v21 = build(*load_inputs(config=V21))

    def test_method_version(self):
        self.assertEqual(self.report["method_version"], "verified-pilot-2.2")

    def test_only_undaria_and_oyster_gain_a_single_source_mbpi(self):
        changed = {}
        for old in self.v21["species"] + self.v21["candidate_species"]:
            new = species(self.report, old["aphia_id"])
            self.assertEqual({k: v for k, v in new["scores"].items() if k != "MBPI"}, {k: v for k, v in old["scores"].items() if k != "MBPI"})
            self.assertEqual(new.get("national_red_list_fact"), old.get("national_red_list_fact"))
            if new["scores"]["MBPI"] != old["scores"]["MBPI"]:
                changed[old["aphia_id"]] = (old["scores"]["MBPI"], new["scores"]["MBPI"], new["withheld_reasons"]["BBVI"], new["mbpi_label"])
        self.assertEqual(changed, {145721: (None, 19.6, "mbpi_single_source", "참고값(단일 논문)"),
                                   836033: (None, 72.2, "mbpi_single_source", "참고값(단일 논문)")})
        research = build(*load_inputs(config=OysterLqpResearchScenarioTests.CONFIG))
        for aphia in changed:   # same peptide rows and rules as the research scenario
            self.assertEqual(species(self.report, aphia)["bioactivity_trace"], species(research, aphia)["bioactivity_trace"])
        self.assertTrue(all(s["scores"]["BBVI"] is None for s in self.report["species"] + self.report["candidate_species"]))

    def test_paper_values_and_ahtpdb_attribution_are_published(self):
        values = {(s["aphia_id"], i["peptide_sequence"]): [(m["value"], m["unit"], m["substrate"], m["source_id"]) for m in i["measurements"]]
                  for s in self.report["species"] for i in s["bioactivity_trace"] if i.get("stratum_kind") == "peptide"}
        self.assertEqual(values, {(145721, "KNFL"): [(225.87, "uM", "HHL", "feng_2021_knfl")],
                                  (836033, "AEYLCEAC"): [(4287, "uM", "HHL", "chen_2022_oyster")],
                                  (836033, "LQP"): [(1.18, "uM", "HHL", "do_2012_oyster_lqp")]})
        ahtpdb = self.report["sources"]["ahtpdb_ic50_2026"]
        self.assertEqual(ahtpdb["license"], "공개 DB · 개발자 이메일 확인(2026-09-27): 누구나 사용 가능")
        self.assertEqual(ahtpdb["permission"]["date"], "2026-09-27")
        self.assertIn("10.1093/nar/gku1141", ahtpdb["citation"])
        for aphia in (145721, 836033):
            self.assertIn("ahtpdb_ic50_2026", species(self.report, aphia)["source_ids"])
        cohort = json.loads((ROOT / "research" / "verified-indices" / "peptide-cohort-ahtpdb-ace-hhl.json").read_text(encoding="utf-8"))
        self.assertIn("CC BY-NC 4.0", cohort["source"]["licence"])
        self.assertIn("10.1093/nar/gku1141", cohort["source"]["citation"])

    def test_reference_combination_sits_beside_withheld_bbvi(self):
        oyster = species(self.report, 836033)
        ref = oyster["reference_combination"]
        self.assertEqual((ref["inputs"], ref["used_for_score"], oyster["scores"]["BBVI"]), ({"MFPI": 65.5, "MBPI": 72.2}, False, None))
        self.assertEqual((ref["mbpi_stratum"], ref["mbpi_original_paper_dois"]), ("ahtpdb-ace-ic50-hhl-cushman-cheung", ["10.5352/jls.2012.22.2.220"]))


class VerifiedPilot23Tests(unittest.TestCase):
    """Superseded by 3.1: 2.2 plus the cross-origin potency rule, with the research config's values."""

    def setUp(self):
        self.report = build(*load_inputs(config=V23))
        self.v22 = build(*load_inputs(config=V22))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-2.3", "provisional_unvalidated"))
        # the published 2.3 report is archived as it was; only the evidence snapshot date moved on (2026-09-27 -> 2026-09-30)
        dated = lambda text: {k: v for k, v in json.loads(text).items() if k not in ("snapshot_date", "generated_at")}
        archived = (ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-2.3.json").read_text(encoding="utf-8")
        self.assertEqual(dated(render(self.report)), dated(archived))
        self.assertEqual(json.loads(archived)["snapshot_date"], "2026-09-27")

    def test_only_oyster_scores_differ_from_22(self):
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        new, old = rows(self.report), rows(self.v22)
        self.assertEqual(set(new), set(old))
        self.assertEqual(len(new), 30)
        view = lambda s: (s["scores"], s["withheld_reasons"], s.get("mbpi_label"), s["reference_combination"], s["sensitivity"])
        changed = {a for a in new if view(new[a]) != view(old[a])}
        self.assertEqual(changed, {836033})   # the other 29 species keep their 2.2 scores, labels and withhold codes
        oyster, before = new[836033], old[836033]
        self.assertEqual({k: v for k, v in oyster["scores"].items() if k not in ("MBPI", "BBVI")},
                         {k: v for k, v in before["scores"].items() if k not in ("MBPI", "BBVI")})
        self.assertEqual((before["scores"]["MBPI"], before["scores"]["BBVI"], before["mbpi_label"]), (72.2, None, "참고값(단일 논문)"))
        self.assertEqual((oyster["scores"]["MBPI"], oyster["scores"]["BBVI"], oyster["mbpi_label"]), (96.3, 80.9, None))
        self.assertEqual((oyster["withheld_reasons"]["BBVI"], oyster["reference_combination"]), (None, None))
        self.assertEqual(oyster["sensitivity"]["food_weights"], {"0.25": 88.6, "0.5": 80.9, "0.75": 73.2})

    def test_public_rule_matches_research_config(self):
        research = build(*load_inputs(config=CrossOriginPotencyResearchTests.CONFIG))
        body = lambda r: json.dumps(r["species"] + r["candidate_species"], sort_keys=True).replace(r["method_version"], "")
        self.assertEqual(body(self.report), body(research))
        load = lambda p: json.loads(p.read_text(encoding="utf-8"))
        public_cfg, research_cfg = load(ROOT / "config" / "verified-indices-v2.3.json"), load(CrossOriginPotencyResearchTests.CONFIG)
        self.assertEqual(public_cfg["peptide_bioactivity"]["cross_origin_potency"], research_cfg["peptide_bioactivity"]["cross_origin_potency"])
        v22_cfg = load(V22)
        strip = lambda c: {k: v for k, v in c.items() if k not in ("method_version", "status", "changes_from")}
        pep = lambda c: {k: v for k, v in c["peptide_bioactivity"].items() if k != "cross_origin_potency"}
        self.assertEqual({**strip(public_cfg), "peptide_bioactivity": pep(public_cfg)}, {**strip(v22_cfg), "peptide_bioactivity": pep(v22_cfg)})

    def test_oyster_trace_keeps_one_origin_paper(self):
        oyster = species(self.report, 836033)
        lqp = max(oyster["bioactivity_trace"], key=lambda i: i["adjusted"])
        self.assertEqual(lqp["original_paper_dois"], ["10.5352/jls.2012.22.2.220"])
        [rep] = lqp["potency_replications"]
        self.assertEqual((rep["used"], rep["value"], rep["origin_label"], rep["source_id"]),
                         (True, 2.0, "옥수수 α-제인 (합성 펩타이드로 측정)", "miyoshi_1991_zein"))
        self.assertIn("miyoshi_1991_zein", self.report["sources"])


V31 = ROOT / "config" / "verified-indices-v3.1.json"  # superseded by 3.2 (matrix types and map layers); its rules stay tested
# 3.1 adds ChEMBL MBPI to these species: aphia -> (2.3 MBPI, 3.1 MBPI, 2.3 BBVI, 3.1 BBVI).
# Every new value rests on one linking paper, so each is a single-source reference value and BBVI stays withheld.
# The link review (mbpi-link-review-2026-09-30.json) removed the contaminant, drug-metabolite and ubiquitous links,
# so 다시마·바지락·큰가리비·피조개·고등어 have no ChEMBL item left and 멍게·홍합·청각 drop.
CHANGED_31 = {250680: (None, 13.5, None, None), 494972: (None, 45.3, None, None), 506159: (None, 10.1, None, None),
              494853: (None, 21.6, None, None), 145086: (None, 0.4, None, None)}


class VerifiedPilot31Tests(unittest.TestCase):
    """Superseded by 3.2: 2.3 plus the automatic ChEMBL stratum (species -> P703 compound -> pChEMBL cohort percentile)."""

    def setUp(self):
        self.report = build(*load_inputs(config=V31))
        self.v23 = build(*load_inputs(config=V23))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.v23)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.1", "provisional_unvalidated"))
        # the published 3.1 report is archived as it was
        archived = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.1.json"
        self.assertEqual(render(self.report), archived.read_text(encoding="utf-8"))

    def test_only_mbpi_moves_and_the_changed_species_are_listed(self):
        self.assertEqual(set(self.new), set(self.old))
        for aphia, s in self.new.items():
            before = self.old[aphia]
            for axis in ("MFPI", "MCUI"):
                self.assertEqual(s["scores"][axis], before["scores"][axis], (aphia, axis))
            strip = lambda t: {k: v for k, v in t.items() if k != "method_version"}
            self.assertEqual((strip(s["food_trace"]), strip(s["conservation_trace"])), (strip(before["food_trace"]), strip(before["conservation_trace"])))
        changed = {a: (self.old[a]["scores"]["MBPI"], s["scores"]["MBPI"], self.old[a]["scores"]["BBVI"], s["scores"]["BBVI"])
                   for a, s in self.new.items()
                   if (s["scores"]["MBPI"], s["scores"]["BBVI"]) != (self.old[a]["scores"]["MBPI"], self.old[a]["scores"]["BBVI"])}
        self.assertEqual(changed, CHANGED_31)

    def test_reviewed_strata_are_kept(self):
        # the peptide and Ecklonia paper strata stay as they were; ChEMBL items are added beside them
        for aphia, s in self.new.items():
            kept = [i for i in s["bioactivity_trace"] if i.get("stratum_kind") != "chembl"]
            self.assertEqual(kept, self.old[aphia]["bioactivity_trace"], aphia)

    def test_species_mbpi_is_the_max_over_strata(self):
        for aphia, s in self.new.items():
            trace = s["bioactivity_trace"]
            if not trace:
                self.assertIsNone(s["scores"]["MBPI"], aphia)
                continue
            adjusted = [i["adjusted"] for i in trace]
            self.assertEqual(s["scores"]["MBPI"], round1(max(adjusted)), aphia)
            self.assertEqual(s["sensitivity"]["median_compound_sensitivity"], round1(median(adjusted)), aphia)

    def test_chembl_items_follow_the_rule(self):
        rule = self.report["method"]["chembl_bioactivity"]
        items = [i for s in self.new.values() for i in s["bioactivity_trace"] if i.get("stratum_kind") == "chembl"]
        self.assertTrue(items)
        for i in items:
            self.assertGreaterEqual(i["cohort_records"], rule["minimum_cohort_records"])
            self.assertIn(i["chembl_stratum"], rule["strata"])
            self.assertEqual(i["label"], "이 종에서 보고된 화합물의 공개 생리활성(잠재력) · 종 추출물의 효능 아님")
            self.assertEqual(i["link_factor"], 0.75 if len(i["original_paper_dois"]) == 1 else 1.0)
            self.assertEqual(i["activity_factor"], 0.75 if len(i["document_chembl_ids"]) == 1 else 1.0)
            self.assertAlmostEqual(i["adjusted"], i["percentile"] * i["link_factor"] * i["activity_factor"], places=1)
            self.assertEqual(i["independent_sources"], min(len(i["original_paper_dois"]), len(i["document_chembl_ids"])))
        # one item per species, compound and stratum (the compound's best target x endpoint cohort in that stratum)
        keys = [(a, i["compound_id"], i["chembl_stratum"]) for a, s in self.new.items() for i in s["bioactivity_trace"] if i.get("stratum_kind") == "chembl"]
        self.assertEqual(len(keys), len(set(keys)))

    def test_bbvi_needs_two_independent_papers(self):
        for aphia, s in self.new.items():
            if s["scores"]["MBPI"] is None:
                continue
            best = max(s["bioactivity_trace"], key=lambda i: i["adjusted"])
            single = independent_sources(best) < 2
            self.assertEqual(s["mbpi_label"], "참고값(단일 논문)" if single else None, aphia)
            if single:
                self.assertIsNone(s["scores"]["BBVI"], aphia)

    def test_primary_item_needs_a_review_entry(self):
        evidence, *rest = load_inputs()
        top = max((i for s in self.new.values() for i in s["bioactivity_trace"] if i.get("stratum_kind") == "chembl"),
                  key=lambda i: i["adjusted"])
        links = evidence["chembl_links"]
        evidence = {**evidence, "chembl_links": {**links, "link_review": [r for r in links["link_review"]
                                                                            if r["inchikey"] not in top["inchikeys"]]}}
        with self.assertRaisesRegex(ValueError, "without a review entry"):
            build(evidence, *rest)

    def test_species_left_without_links_are_low_information(self):
        # no P703 link and no accepted original-paper link, or every link rejected by the review
        low = {a for a, s in self.new.items() if s["score_status"]["MBPI"] == "정보충분도 낮음"}
        self.assertEqual(low, {397082, 836041, 413600, 219984, 281273, 275816, 274849, 276651, 1061762, 534443, 1666974})
        for a in low:
            counts = self.new[a]["chembl_links"]["counts"]
            self.assertEqual(counts.get("linked", 0), counts.get("rejected_by_review", 0), a)
            self.assertFalse(self.new[a]["bioactivity_partial"], a)


V32 = ROOT / "config" / "verified-indices-v3.2.json"  # superseded by 3.3 (MFPI substitutes); its rules stay tested


class VerifiedPilot32Tests(unittest.TestCase):
    """Superseded by 3.3. 3.2 (diagram stages 4-5): information sufficiency and matrix labels only; every axis equals 3.1."""

    def setUp(self):
        self.report = build(*load_inputs(config=V32))
        self.v31 = build(*load_inputs(config=V31))
        self.rows = {s["aphia_id"]: s for s in self.report["species"] + self.report["candidate_species"]}
        self.taxonomy = json.loads((ROOT / "research" / "verified-indices" / "taxonomy.json").read_text(encoding="utf-8"))["species"]

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.2", "provisional_unvalidated"))
        archived32 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.2.json"
        self.assertEqual(archived32.read_text(encoding="utf-8"), render(self.report))
        # the published 3.1 report is archived as it was
        archived = (ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.1.json").read_text(encoding="utf-8")
        self.assertEqual(render(self.v31), archived)

    def test_no_axis_moves_from_31(self):
        old = {s["aphia_id"]: s for s in self.v31["species"] + self.v31["candidate_species"]}
        self.assertEqual(set(self.rows), set(old))
        self.assertEqual(len(self.rows), 30)
        view = lambda s: (s["scores"], s["withheld_reasons"], s.get("mbpi_label"), s["reference_combination"], s["sensitivity"],
                          {k: v for k, v in s["information_sufficiency"].items() if k not in ("MCUI", "mean_ratio")})
        self.assertEqual({a: view(s) for a, s in self.rows.items()}, {a: view(s) for a, s in old.items()})
        # 3.2 changes information sufficiency in one place only: a national-basis MCUI counts its national assessment
        moved = {a for a, s in self.rows.items() if s["information_sufficiency"] != old[a]["information_sufficiency"]}
        self.assertEqual(moved, {a for a, s in self.rows.items() if s["mcui_basis"] == "national"})
        self.assertEqual(moved, {506159, 836033, 231750, 393716, 504357, 413600, 1666974})

    def test_national_mcui_counts_its_national_assessment(self):
        rechecked = self.report["method"]["national_red_list"]["page_recheck"]["rows"]
        for aphia, s in self.rows.items():
            mcui = s["information_sufficiency"]["MCUI"]
            if s["mcui_basis"] != "national":
                self.assertNotIn("basis", mcui, aphia)
                continue
            steps = [s["national_assessment"]["reviewed"] is True,
                     s["national_assessment"]["category"] in self.report["method"]["conservation"]["category_scores"],
                     str(aphia) in rechecked]
            self.assertEqual((mcui["basis"], mcui["ratio"]), ("national", round(sum(steps) / 3, 2)), aphia)
        # the three species whose priority-survey label depended on the IUCN-only count
        old = {s["aphia_id"]: s for s in self.v31["species"] + self.v31["candidate_species"]}
        for aphia in (231750, 504357, 1666974):
            self.assertLess(old[aphia]["information_sufficiency"]["mean_ratio"], 0.5)
            self.assertFalse(self.rows[aphia]["priority_survey"], aphia)
        self.assertEqual(sum(s["priority_survey"] for s in self.rows.values()), 14)
        self.assertTrue(self.rows[413600]["priority_survey"])  # 맛조개: MFPI and MBPI inputs are still missing

    def test_priority_survey_is_the_sufficiency_label(self):
        threshold = self.report["method"]["unexplored_threshold"]
        for aphia, s in self.rows.items():
            self.assertIs(s["priority_survey"], s["information_sufficiency"]["mean_ratio"] < threshold, aphia)
        self.assertTrue(any(s["priority_survey"] for s in self.rows.values()))

    def test_unexplored_candidate_needs_a_high_bbvi_relative(self):
        rule = self.report["method"]["unexplored_candidates"]
        self.assertEqual((rule["relative_min_bbvi"], rule["ranks"]), (50, ["genus", "family"]))
        high = [s for s in self.rows.values() if s["scores"]["BBVI"] is not None and s["scores"]["BBVI"] >= rule["relative_min_bbvi"]]
        for aphia, s in self.rows.items():
            mine = self.taxonomy.get(str(aphia), {})
            relatives = {rank: [r["scientific_name"] for r in high if r["aphia_id"] != aphia and mine.get(rank)
                                and self.taxonomy.get(str(r["aphia_id"]), {}).get(rank) == mine[rank]] for rank in rule["ranks"]}
            flag = s["unexplored_candidate"]
            if not s["priority_survey"] or not any(relatives.values()):
                self.assertIsNone(flag, aphia)
                continue
            rank = next(r for r in rule["ranks"] if relatives[r])  # genus first, else family
            self.assertEqual((flag["rank"], flag["taxon"], flag["relatives"]), (rank, mine[rank], relatives[rank]), aphia)
            self.assertIsNone(s["scores"]["BBVI"], aphia)  # the relative's score is never copied

    def test_every_species_has_a_classification(self):
        for aphia in self.rows:
            self.assertTrue(self.taxonomy[str(aphia)].get("family"), aphia)

    def test_matrix_rule_is_published(self):
        rule = self.report["method"]["matrix"]
        self.assertEqual((rule["bbvi_threshold"], rule["mcui_threshold"], rule["include_national_mcui"]), (50, 50, True))
        self.assertEqual(sorted(rule["cell_colour_precedence"]), sorted(t["id"] for t in rule["types"].values()))
        self.assertEqual(rule["cell_colour_precedence"][0], rule["types"]["low_bbvi_high_mcui"]["id"])  # conservation first
        # no unread knob: the boundary rule is stated as text and the builders compare with >=
        self.assertNotIn("at_threshold", rule)
        self.assertIn("one decimal", rule["threshold_rule"])

    def test_unexplored_threshold_is_the_matrix_threshold(self):
        evidence, candidates, config, snapshot, taxonomy = load_inputs()
        config = {**config, "unexplored_candidates": {**config["unexplored_candidates"], "relative_min_bbvi": 40}}
        with self.assertRaisesRegex(ValueError, "matrix threshold"):
            build(evidence, candidates, config, snapshot, taxonomy)

    def test_classification_source_is_registered(self):
        reg = self.report["method"]["unexplored_candidates"]["source"]
        src = self.report["sources"][reg["id"]]
        self.assertEqual((src["accessed"], src["license"]), (self.taxonomy_retrieved(), "CC BY 4.0"))
        for s in self.rows.values():
            self.assertIs(reg["id"] in s["source_ids"], s["unexplored_candidate"] is not None, s["aphia_id"])
        evidence, candidates, config, snapshot, taxonomy = load_inputs()
        with self.assertRaisesRegex(ValueError, "taxonomy source registration"):
            build(evidence, candidates, config, snapshot, {**taxonomy, "retrieved": "2026-10-01"})

    def taxonomy_retrieved(self):
        return json.loads((ROOT / "research" / "verified-indices" / "taxonomy.json").read_text(encoding="utf-8"))["retrieved"]

    def test_unexplored_flag_falls_back_to_family(self):
        # synthetic: no same-genus relative, a same-family relative at the threshold flags at family; 49.9 does not
        row = lambda aphia, bbvi, ratio: {"aphia_id": aphia, "scientific_name": f"S{aphia}", "scores": {"BBVI": bbvi},
                                          "information_sufficiency": {"mean_ratio": ratio}}
        taxonomy = {"1": {"genus": "G1", "family": "F"}, "2": {"genus": "G2", "family": "F"}, "3": {"genus": "G3", "family": "X"}}
        flag = unexplored_flag(1, [row(1, None, 0.2), row(2, 50.0, 1.0), row(3, 90.0, 1.0)], taxonomy, 0.5, 50)
        self.assertEqual((flag["rank"], flag["taxon"], flag["relatives"]), ("family", "F", ["S2"]))
        self.assertIsNone(unexplored_flag(1, [row(1, None, 0.2), row(2, 49.9, 1.0)], taxonomy, 0.5, 50))
        self.assertIsNone(unexplored_flag(1, [row(1, None, 0.5), row(2, 80.0, 1.0)], taxonomy, 0.5, 50))  # 0.5 is not low


# 3.3 fills a missing RDA zinc value from uFiSh: aphia -> (3.2 MFPI, 3.3 MFPI, uFiSh item, level, grade).
# 대구 zinc comes from the mean of its two RDA sex sub-sample rows before any uFiSh value (independent review, wf_649e5916-f04).
CHANGED_33 = {506159: (None, 60.1, "093015", "species", "measured"), 397082: (None, 48.0, "093001", "genus", "proxy"),
              254538: (None, 34.0, "K0440002570a+K0440002580a", "subsample", "domestic_table"),
              1666974: (None, 45.9, "093035", "family", "proxy")}


V33 = ROOT / "config" / "verified-indices-v3.3.json"  # superseded by 3.4 (MCUI occurrence trend); its rules stay tested


class VerifiedPilot33Tests(unittest.TestCase):
    """Superseded by 3.4. 3.3: 3.2 plus uFiSh substitutes for missing RDA components and five reviewed aquaculture records."""

    def setUp(self):
        self.evidence, *self.rest = load_inputs(config=V33)
        self.report = build(self.evidence, *self.rest)
        self.v32 = build(*load_inputs(config=V32))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.v32)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.3", "provisional_unvalidated"))
        # the published 3.3 report is archived as it was
        archived33 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.3.json"
        self.assertEqual(render(self.report), archived33.read_text(encoding="utf-8"))

    def test_only_mfpi_moves_and_the_cohorts_stay_fixed(self):
        self.assertEqual(self.report["comparison_cohorts"], self.v32["comparison_cohorts"])
        changed = {}
        for aphia, s in self.new.items():
            before = self.old[aphia]
            for axis in ("MBPI", "MCUI", "BBVI"):
                self.assertEqual(s["scores"][axis], before["scores"][axis], (aphia, axis))
            if s["scores"]["MFPI"] != before["scores"]["MFPI"]:
                subs = [(n["substitute"]["food_item_id"], n["substitute"]["taxon_level"], n["grade"])
                        for n in s["food_trace"]["nutrients"].values() if n.get("substitute")]
                changed[aphia] = (before["scores"]["MFPI"], s["scores"]["MFPI"], *subs[0])
                self.assertEqual(len(subs), 1, aphia)
        self.assertEqual(changed, CHANGED_33)

    def test_substitutes_follow_the_rule(self):
        rule = self.report["method"]["nutrition"]["substitutes"]
        items = {i["food_item_id"]: i for i in self.evidence["mfpi_substitutes"]["items"]}
        for aphia, s in self.new.items():
            f = s["food_trace"]
            subs = {k: n for k, n in (f.get("nutrients") or {}).items() if n.get("substitute")}
            self.assertEqual(bool(subs), bool(f.get("outside_cohort")), aphia)
            if not subs:
                continue
            self.assertNotIn(f["source_food_item_id"], f["cohort_food_item_ids"], aphia)   # never joins the cohort
            self.assertLess(len(subs), len(f["nutrients"]), aphia)                          # at least one own RDA value
            for name, n in subs.items():
                self.assertIsNone(next(o for o in f["observed_rows"] if o["food_item_id"] == f["source_food_item_id"])["values"][name], aphia)
                if n["substitute"]["taxon_level"] == "subsample":  # same-species rows of the same RDA table, checked below
                    continue
                src = items[n["substitute"]["food_item_id"]]
                level = src["matches"][str(aphia)]
                self.assertEqual((n["value"], n["substitute"]["taxon_level"], n["substitute"]["part"] in rule["parts"]),
                                 (src["components"][name]["value"], level, True), aphia)
                self.assertEqual(n["grade"], rule["species_grade_by_doc"].get(src["components"][name]["doc"], "proxy")
                                 if level == "species" else "proxy", aphia)
                self.assertEqual(n["substitute"]["label"], rule["labels"][level])
                # ranked against the cohort plus itself
                self.assertEqual([p["food_item_id"] for p in n["peer_values"]], f["cohort_food_item_ids"] + [f["source_food_item_id"]])

    def test_aquaculture_records_are_reviewed_and_cod_is_not_feasible(self):
        added = [r for r in self.evidence["food_support"] if r["source_id"] in self.evidence["sources"] and r.get("quote")]
        self.assertEqual({r["aphia_id"]: r["feasible"] for r in added},
                         {506159: True, 504357: True, 397082: True, 1666974: True, 254538: False})
        self.assertEqual(self.new[254538]["food_trace"]["components"]["aquaculture_contribution"], 0)

    def test_withheld_reason_names_what_still_holds_the_score(self):
        # a substitute that fills every missing component leaves the next blocker as the reason; otherwise the component stays missing
        for aphia, s in self.new.items():
            search = s["food_trace"].get("substitute_search")
            if s["scores"]["MFPI"] is not None or not search:
                continue
            expected = "component_missing_in_source" if not all(search.values()) else s["withheld_reasons"]["MFPI"]
            self.assertEqual(s["withheld_reasons"]["MFPI"], expected, aphia)
            self.assertNotEqual(s["withheld_reasons"]["MFPI"] == "component_missing_in_source", all(search.values()), aphia)
        self.assertEqual((self.new[342067]["food_trace"]["substitute_search"], self.new[342067]["withheld_reasons"]["MFPI"]),
                         ({"zinc_mg": "093033"}, "aquaculture_method_unverified"))  # 살오징어: zinc found, no aquaculture record
        self.assertEqual(self.old[342067]["withheld_reasons"]["MFPI"], "component_missing_in_source")

    def test_substituted_components_do_not_count_as_own_information(self):
        # information sufficiency counts the species' own RDA values; a substitute enables the score but fills no gap
        for aphia, s in self.new.items():
            subs = [k for k, n in (s["food_trace"].get("nutrients") or {}).items() if n.get("substitute")]
            for k in subs:
                self.assertNotIn(k, s["food_trace"]["sufficiency"]["present"], aphia)
        self.assertTrue(self.new[254538]["priority_survey"])  # 대구: MFPI 34.0 from a substituted zinc, still low information

    def test_same_species_subsample_comes_first(self):
        # 대구: the RDA sex sub-sample rows (zinc 0.55 and 0.47) come before uFiSh 091053 (NE Pacific, 0.384)
        zinc = self.new[254538]["food_trace"]["nutrients"]["zinc_mg"]
        self.assertEqual((zinc["value"], zinc["grade"], zinc["substitute"]["values"]),
                         (0.51, "domestic_table", {"K0440002570a": 0.55, "K0440002580a": 0.47}))
        rule = self.report["method"]["nutrition"]["substitutes"]
        excluded = self.report["method"]["nutrition"]["primary_cohorts"][0]["rule"]["exclude_food_item_ids"]
        for link in rule["subsample_links"]:
            self.assertIn(link["food_item_id"], excluded)          # a linked sub-sample never joins the cohort
            self.assertNotIn(link["food_item_id"], self.new[254538]["food_trace"]["cohort_food_item_ids"])
        # without the reviewed links the uFiSh species value is used, as before
        evidence, candidates, config, snapshot, taxonomy = load_inputs(config=V33)
        sub = {**config["nutrition"]["substitutes"], "subsample_links": []}
        alt = build(evidence, candidates, {**config, "nutrition": {**config["nutrition"], "substitutes": sub}}, snapshot, taxonomy)
        cod = next(s for s in alt["candidate_species"] if s["aphia_id"] == 254538)
        self.assertEqual((cod["scores"]["MFPI"], cod["food_trace"]["nutrients"]["zinc_mg"]["substitute"]["food_item_id"]), (28.9, "091053"))

    def test_rows_the_cohort_rule_excludes_are_never_ranked_outside_it(self):
        # link a cohort-excluded complete row (은어 양식) and an organ row to a species: neither may score through completed()
        evidence, candidates, config, snapshot, taxonomy = load_inputs(config=V33)
        rda = {r["code"]: r for r in snapshot["rows"]}
        organ = next(c for c, r in rda.items() if r["group"] == "어패류 및 기타 수산물" and "내장" in r["name"])
        # 전복 has a reviewed aquaculture record and edible fraction, so only the row rule can stop a score
        for code in ("K1440010000a", organ):
            links = [l for l in evidence["rda_taxon_links"] if l.get("aphia_id") != 397082] + [
                {"food_item_id": code, "reported_food_name": rda[code]["name"], "english_name": rda[code]["english_name"],
                 "aphia_id": 397082, "scientific_name": "Haliotis discus", "reviewed": True, "link_evidence": "synthetic"}]
            report = build({**evidence, "rda_taxon_links": links}, candidates, config, snapshot, taxonomy)
            abalone = next(s for s in report["candidate_species"] if s["aphia_id"] == 397082)
            self.assertIsNone(abalone["scores"]["MFPI"], code)
            self.assertNotIn("substitute_row", abalone["food_trace"], code)

    def test_substitute_sources_are_registered_on_the_species(self):
        for aphia, s in self.new.items():
            for n in (s["food_trace"].get("nutrients") or {}).values():
                if n.get("substitute"):
                    self.assertIn(n["substitute"]["source_id"], s["source_ids"], aphia)
        mussel = [r for r in self.new[506159]["food_trace"]["supplemental_nutrition"] if r["record_id"] == "uFiSh1.0:093015"]
        self.assertIn("zinc_mg is used as a verified-pilot-3.3 substitute", mussel[0]["substitute_use"])


# 3.4: a decline signal (OBIS reporting rate against the same WoRMS class, 2006-15 vs 2016-25) adds 10 to a computed MCUI.
CHANGED_34 = {342067: ("decline_signal", 20.0), 413600: ("decline_signal", 20.0), 219984: ("decline_signal", 20.0),
              281273: ("decline_signal", 20.0)}


V34 = ROOT / "config" / "verified-indices-v3.4.json"  # superseded by 3.5 (evidence rows only); its rules stay tested


class VerifiedPilot34Tests(unittest.TestCase):
    """Superseded by 3.5. 3.4: 3.3 plus the OBIS occurrence-trend element of MCUI and the no-assessment priority label."""

    def setUp(self):
        self.evidence, *self.rest = load_inputs(config=V34)
        self.report = build(self.evidence, *self.rest)
        self.v33 = build(*load_inputs(config=V33))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.v33)
        self.rule = self.report["method"]["conservation"]

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.4", "provisional_unvalidated"))
        # the published 3.4 report is archived as it was
        archived34 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.4.json"
        self.assertEqual(render(self.report), archived34.read_text(encoding="utf-8"))

    def test_only_mcui_moves_and_only_by_a_decline_signal(self):
        for aphia, s in self.new.items():
            before, t = self.old[aphia], s["occurrence_trend"]
            for axis in ("MFPI", "MBPI", "BBVI"):
                self.assertEqual(s["scores"][axis], before["scores"][axis], (aphia, axis))
            self.assertEqual(t["mcui_base"], before["scores"]["MCUI"], aphia)
            expected = None if before["scores"]["MCUI"] is None else (
                min(100.0, before["scores"]["MCUI"] + self.rule["effort_adjustment"]) if t["class"] == "decline_signal" else before["scores"]["MCUI"])
            self.assertEqual(s["scores"]["MCUI"], expected, aphia)
            self.assertEqual(t["mcui_adjustment"], 0 if expected == before["scores"]["MCUI"] else self.rule["effort_adjustment"], aphia)
        self.assertEqual({a: (s["occurrence_trend"]["class"], s["scores"]["MCUI"]) for a, s in self.new.items()
                          if s["occurrence_trend"]["mcui_adjustment"]}, CHANGED_34)

    def test_trend_follows_the_snapshot(self):
        snap = self.evidence["obis_trend"]
        self.assertEqual(snap["query"]["periods"], self.rule["trend"]["periods"])
        for aphia, s in self.new.items():
            t, sp = s["occurrence_trend"], snap["species"][str(aphia)]
            self.assertEqual(t["effort_group"], sp["class"], aphia)
            self.assertEqual(t["records_in_map_extent"], {p: sp[p]["records"] + sp[p]["outside_grid"] for p in ("past", "recent")}, aphia)
            # numerator and denominator count the same compared cells (edge records in every cell that holds them)
            group = snap["group_effort"][sp["class"]]["cells"]
            cells = [c for c in set(sp["past"]["cells"]) | set(sp["recent"]["cells"]) if all(group.get(c, {}).get(p, 0) for p in ("past", "recent"))]
            self.assertEqual((t["cells_compared"], t["species_records"]["past"]), (len(cells), sum(sp["past"]["cells"].get(c, 0) for c in cells)), aphia)
            if t["class"] == "decline_signal":  # a decline signal is confirmed inside the dominant dataset
                self.assertTrue(t["dataset_check"]["confirms_decline"], aphia)
            self.assertEqual(t["label"], self.rule["trend"]["labels"][t["class"]])
            self.assertIn("obis_trend", s["source_ids"], aphia)

    def test_no_assessment_is_a_priority_survey_reason(self):
        for aphia, s in self.new.items():
            why = s["priority_survey_reasons"]
            self.assertIs(s["priority_survey"], bool(why), aphia)
            self.assertIs("no_conservation_assessment" in why, s["scores"]["MCUI"] is None and s["withheld_reasons"]["MCUI"] == "not_in_red_list", aphia)
            self.assertIs("low_information_sufficiency" in why, s["information_sufficiency"]["mean_ratio"] < 0.5, aphia)
        added = {a for a, s in self.new.items() if s["priority_survey"] and not self.old[a]["priority_survey"]}
        self.assertEqual(added, {145721, 250680, 494972, 145086})  # 미역·멍게·톳·청각: no IUCN or national category
        self.assertFalse({a for a, s in self.old.items() if s["priority_survey"] and not self.new[a]["priority_survey"]})

    def test_only_a_missing_or_dd_assessment_is_a_priority_reason(self):
        # a failed IUCN lookup is a data problem, a DD category is 'IUCN 자료 부족', neither is 'no assessment'
        evidence, candidates, config, snapshot, taxonomy = load_inputs(config=V34)
        rows = [r for r in evidence["conservation"] if r["aphia_id"] == 145721]
        for state, reason in (("lookup_failed", None), ("data_deficient", "conservation_data_deficient")):
            changed = [{**r, "iucn_state": state, "reviewed": True, "category": "DD"} if r["aphia_id"] == 145721 else r for r in evidence["conservation"]]
            report = build({**evidence, "conservation": changed}, candidates, config, snapshot, taxonomy)
            s = next(x for x in report["species"] if x["aphia_id"] == 145721)
            self.assertIsNone(s["scores"]["MCUI"], state)
            self.assertNotIn("no_conservation_assessment", s["priority_survey_reasons"], state)
            self.assertIs(reason in s["priority_survey_reasons"] if reason else True, True, state)
        self.assertTrue(rows)

    def test_trend_snapshot_guards(self):
        evidence, candidates, config, snapshot, taxonomy = load_inputs(config=V34)
        broken = {**evidence, "obis_trend": {**evidence["obis_trend"], "species": {}}}
        with self.assertRaisesRegex(ValueError, "no OBIS trend record"):
            build(broken, candidates, config, snapshot, taxonomy)


# verified-pilot-3.5: reviewed evidence rows only (rules unchanged). (aphia, axis) -> new value; every other value stays.
CHANGED_35 = {(145721, "MBPI"): 71.5, (241776, "MBPI"): 8.7, (234476, "MBPI"): 73.3, (393716, "MBPI"): 27.3,
              (413600, "MBPI"): 56.9, (275816, "MBPI"): 29.2, (281273, "MFPI"): 39.8, (275816, "MFPI"): 53.3,
              (1061762, "MFPI"): 53.5}


V35 = ROOT / "config" / "verified-indices-v3.5.json"  # superseded by 3.6 (MEXT zinc substitute); its rows stay tested


class VerifiedPilot35Tests(unittest.TestCase):
    """Superseded by 3.6. 3.5: 3.4 rules with the reviewed rows of sunny/bbvm-0928-pr2-evidence and PR #65, in 3.5-only files."""

    def setUp(self):
        self.report = build(*load_inputs(config=V35))
        self.v34 = build(*load_inputs(config=V34))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.v34)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.5", "provisional_unvalidated"))
        # the published 3.5 report is archived as it was
        archived35 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.5.json"
        self.assertEqual(render(self.report), archived35.read_text(encoding="utf-8"))
        self.assertEqual(self.report["generated_at"], "2026-10-01T00:00:00Z")

    def test_only_the_reviewed_rows_move(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, CHANGED_35)
        self.assertEqual(self.report["comparison_cohorts"], self.v34["comparison_cohorts"])

    def test_new_mbpi_rests_on_one_paper_so_no_new_bbvi(self):
        for (aphia, axis) in CHANGED_35:
            s = self.new[aphia]
            self.assertIsNone(s["scores"]["BBVI"], aphia)
            if axis == "MBPI":
                self.assertEqual(s["mbpi_label"], "참고값(단일 논문)", aphia)
            if s["scores"]["MFPI"] is not None and s["scores"]["MBPI"] is not None:
                self.assertEqual(s["withheld_reasons"]["BBVI"], "mbpi_single_source", aphia)
        self.assertEqual([a for a, s in self.new.items() if s["scores"]["BBVI"] is not None], [836033])

    def test_new_inputs_are_read_by_3_5_only(self):
        cfg = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
        for old in (V33, V34):
            c = cfg(old)
            self.assertNotIn("research/verified-indices/evidence-v3.5.json", c["peptide_supplements"])
            self.assertNotEqual(c["nutrition"]["substitutes"]["aquaculture_supplement"], "research/verified-indices/mfpi-aquaculture-2026-10-01.json")



V36 = ROOT / "config" / "verified-indices-v3.6.json"  # superseded by 3.7 (MFPI calcium); its rules stay tested


class VerifiedPilot36Tests(unittest.TestCase):
    """Superseded by 3.7. 3.6: 3.5 plus a MEXT 2020 same-species raw item for zinc missing from a species' own RDA row."""

    def setUp(self):
        self.evidence, *self.rest = load_inputs(config=V36)
        self.report = build(self.evidence, *self.rest)
        self.v35 = build(*load_inputs(config=V35))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.v35)
        self.rule = self.report["method"]["nutrition"]["substitutes"]

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.6", "provisional_unvalidated"))
        # the published 3.6 report is archived as it was
        archived36 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.6.json"
        self.assertEqual(render(self.report), archived36.read_text(encoding="utf-8"))

    def test_only_ark_shell_mfpi_moves(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(504357, "MFPI"): 57.7})
        self.assertEqual(self.report["comparison_cohorts"], self.v35["comparison_cohorts"])
        zinc = self.new[504357]["food_trace"]["nutrients"]["zinc_mg"]
        self.assertEqual((zinc["value"], zinc["grade"], zinc["evidence_factor"], zinc["substitute"]["taxon_level"], zinc["substitute"]["food_item_id"]),
                         (1.5, "foreign_table_cited", 0.85, "mext", "10279"))
        self.assertIn("mext_sfct_2020_zinc", self.new[504357]["source_ids"])

    def test_mext_ranks_after_species_and_before_proxies(self):
        self.assertEqual(self.rule["levels"], ["subsample", "species", "mext", "genus", "family"])
        # 살오징어: a family-level uFiSh proxy (3.3) gives way to the same-species MEXT item; 멸치 had no candidate at all
        self.assertEqual(self.old[342067]["food_trace"]["substitute_search"], {"zinc_mg": "093033"})
        self.assertEqual(self.new[342067]["food_trace"]["substitute_search"], {"zinc_mg": "MEXT:10345"})
        self.assertEqual(self.new[219984]["food_trace"]["substitute_search"], {"zinc_mg": "MEXT:10044"})
        for aphia in (342067, 219984):  # zinc can be filled; aquaculture is still missing, so MFPI stays withheld
            self.assertIsNone(self.new[aphia]["scores"]["MFPI"])
            self.assertEqual(self.new[aphia]["withheld_reasons"]["MFPI"], "aquaculture_method_unverified")
        for aphia in (494972, 145086):  # 톳, 청각: no raw MEXT item, nothing substituted
            self.assertEqual(self.new[aphia]["food_trace"]["substitute_search"], {"zinc_mg": None})

    def test_mext_items_are_raw_species_values(self):
        snap = self.evidence["mfpi_mext"]
        self.assertEqual({i["aphia_id"] for i in snap["items"]}, {504357, 219984, 342067})
        for item in snap["items"]:
            self.assertEqual((item["sample_state"], item["basis"], item["part"]), ("raw", "100 g edible portion", "edible portion"))
            self.assertEqual(set(item["components"]), set(self.rule["mext"]["components"]))
        for name in ("protein_g", "iron_mg"):  # only the listed component is ever taken from MEXT
            evidence, candidates, config, snapshot, taxonomy = load_inputs(config=V36)
            config["nutrition"]["substitutes"]["mext"]["components"] = [name]
            report = build(evidence, candidates, config, snapshot, taxonomy)
            self.assertIsNone(next(s for s in report["candidate_species"] if s["aphia_id"] == 504357)["scores"]["MFPI"], name)


# verified-pilot-3.7: calcium joins the MFPI components and a row reporting 3 of 4 scores; three aquaculture records.
# (aphia, axis) -> new value; every other value of 3.6 stays.
CHANGED_37 = {(145721, "MFPI"): 46.7, (250680, "MFPI"): 52.8, (494972, "MFPI"): 63.3, (506159, "MFPI"): 60.9,
              (836033, "MFPI"): 71.6, (836033, "BBVI"): 83.9, (145086, "MFPI"): 36.7, (231750, "MFPI"): 60.4,
              (397082, "MFPI"): 54.7, (393716, "MFPI"): 55.8, (504357, "MFPI"): 61.9, (219984, "MFPI"): 74.1,
              (281273, "MFPI"): 39.4, (275816, "MFPI"): 59.4, (274849, "MFPI"): 48.5, (276651, "MFPI"): 51.0,
              (254538, "MFPI"): 38.3, (1061762, "MFPI"): 62.0, (1666974, "MFPI"): 42.5}


V37 = ROOT / "config" / "verified-indices-v3.7.json"  # superseded by 3.8 (바지락 peptide rows); its rules stay tested


class VerifiedPilot37Tests(unittest.TestCase):
    """Superseded by 3.8. 3.7: 3.6 plus calcium as a fourth MFPI component (3 of 4 required) and three aquaculture records."""

    def setUp(self):
        self.report = build(*load_inputs(config=V37))
        self.v36 = build(*load_inputs(config=V36))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.v36)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.7", "provisional_unvalidated"))
        # the published 3.7 report is archived as it was
        archived37 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.7.json"
        self.assertEqual(render(self.report), archived37.read_text(encoding="utf-8"))

    def test_only_mfpi_and_its_bbvi_move(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, CHANGED_37)
        self.assertEqual(sum(s["scores"]["MFPI"] is not None for s in self.new.values()), 18)
        self.assertEqual([a for a, s in self.new.items() if s["scores"]["BBVI"] is not None], [836033])

    def test_cohorts_keep_their_members(self):
        ids = lambda r: {c["cohort_id"]: c.get("food_item_ids") for c in r["comparison_cohorts"] if c.get("role") == "primary"}
        self.assertEqual(ids(self.report), ids(self.v36))

    def test_a_missing_component_is_omitted_never_zero(self):
        components = self.report["method"]["nutrition"]["components"]
        for aphia, s in self.new.items():
            if s["scores"]["MFPI"] is None:
                continue
            f = s["food_trace"]
            used, omitted = set(f["nutrients"]), set(f.get("omitted_components", []))
            self.assertEqual(used | omitted, set(components), aphia)
            self.assertGreaterEqual(len(used), self.report["method"]["nutrition"]["minimum_components"], aphia)
            self.assertIs(f.get("outside_cohort") is True, bool(omitted) or bool(f.get("substituted_components")), aphia)
            for k in omitted:  # the species' own linked row really leaves it blank
                own = next(o for o in f["observed_rows"] if o["food_item_id"] == f["source_food_item_id"])
                self.assertIsNone(own["values"][k], (aphia, k))
        self.assertEqual({a for a, s in self.new.items() if s["food_trace"].get("omitted_components")},
                         {494972, 145086})  # 톳·청각: zinc blank, no uFiSh or raw MEXT item (피조개·멸치 take MEXT zinc, 3.6)

    def test_two_of_four_does_not_score(self):
        evidence, candidates, config, snapshot, taxonomy = load_inputs(config=V37)
        rows = copy.deepcopy(snapshot)
        for r in rows["rows"]:
            if r["code"] == "L0260000000a":  # 톳: zinc blank with no substitute, drop calcium too
                r["values"]["calcium_mg"] = None
        s = species(build(evidence, candidates, config, rows, taxonomy), 494972)
        self.assertIsNone(s["scores"]["MFPI"])
        self.assertEqual(s["withheld_reasons"]["MFPI"], "component_missing_in_source")

    def test_new_inputs_are_read_by_3_7_only(self):
        cfg = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
        for old in (V33, V34, V35, V36):
            n = cfg(old)["nutrition"]
            self.assertNotIn("calcium_mg", n["components"])
            self.assertNotEqual(n["substitutes"]["aquaculture_supplement"], "research/verified-indices/mfpi-aquaculture-3.7-2026-10-01.json")


CLAM = "research/verified-indices/evidence-clam-2026-10-01.json"
V38 = ROOT / "config" / "verified-indices-v3.8.json"  # superseded by 3.9 (MEXT species rows); its rows stay tested


class VerifiedPilot38Tests(unittest.TestCase):
    """Superseded by 3.9. 3.8: 3.7 plus the reviewed 바지락 peptide rows (research/verified-indices/evidence-clam-2026-10-01.md).
    Evidence rows only: rules, coefficients and cohorts are 3.7's."""

    def setUp(self):
        self.report = build(*load_inputs(config=V38))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V37)))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.8", "provisional_unvalidated"))
        # the published 3.8 report is archived as it was
        archived38 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.8.json"
        self.assertEqual(render(self.report), archived38.read_text(encoding="utf-8"))

    def test_only_clam_mbpi_moves(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(231750, "MBPI"): 39.5})
        self.assertEqual(sum(s["scores"]["MBPI"] is not None for s in self.new.values()), 14)

    def test_clam_rows(self):
        clam = self.new[231750]
        self.assertEqual([(i["peptide_sequence"], i["percentile"]) for i in clam["bioactivity_trace"]],
                         [("IAE", 52.7), ("IVE", 35.23), ("LLP", 30.68)])
        # one paper per item, so BBVI stays withheld; the same-author Spirulina IAE value (2001) is not a replication
        self.assertEqual(clam["withheld_reasons"]["BBVI"], "mbpi_single_source")
        # origin ambiguous in the paper (clam vs pearl oyster): shown, never scored
        self.assertEqual(sorted(p["sequence"] for p in clam["bioactivity_partial"]), ["AEL", "IELPLG", "LVE"])

    def test_rows_are_read_by_3_8_only(self):
        cfg = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
        for old in (V33, V34, V35, V36, V37):
            self.assertNotIn(CLAM, cfg(old)["peptide_supplements"])


MEXT_ROWS = {413600: ("MEXT:10280", 0.65, True), 127022: ("MEXT:10154", 0.5, True), 534443: ("MEXT:10361", 0.85, False)}


class VerifiedPilot39Tests(unittest.TestCase):
    """Superseded by 3.10. 3.9: 3.8 plus MEXT 2020 same-species raw items as the species' own nutrition row where RDA DB 10.4 has
    no row linked to the species, MEXT components widened to all four, and three aquaculture records
    (research/verified-indices/mext-rows-2026-10-01.md)."""

    def setUp(self):
        self.report = build(*load_inputs(config=V39))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V38)))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.9", "provisional_unvalidated"))
        # the published 3.9 report is archived as it was
        archived39 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.9.json"
        self.assertEqual(render(self.report), archived39.read_text(encoding="utf-8"))

    def test_only_three_mfpi_move(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(413600, "MFPI"): 57.7, (127022, "MFPI"): 48.0, (534443, "MFPI"): 36.9})
        self.assertEqual(sum(s["scores"]["MFPI"] is not None for s in self.new.values()), 21)
        self.assertEqual(self.new[413600]["withheld_reasons"]["BBVI"], "mbpi_single_source")  # 맛조개 MBPI rests on one paper

    def test_mext_row_is_the_species_own_row(self):
        cohort = next(c for c in self.report["comparison_cohorts"] if c["cohort_id"] == "rda-10.4-raw-marine-animals")
        for aphia, (item, fraction, feasible) in MEXT_ROWS.items():
            f = self.new[aphia]["food_trace"]
            self.assertEqual((f["source_food_item_id"], f["row_table"], f["outside_cohort"], f["cohort_id"]),
                             (item, "mext", True, "rda-10.4-raw-marine-animals"), aphia)
            self.assertNotIn(item, cohort["food_item_ids"])
            self.assertEqual((f["edible_fraction"]["value"], f["edible_fraction"]["source_id"]), (fraction, "mext_sfct_2020_items"))
            self.assertEqual({k: (n["grade"], "substitute" in n) for k, n in f["nutrients"].items()},
                             {k: ("foreign_table_cited", False) for k in self.report["method"]["nutrition"]["components"]})
            self.assertFalse(f["substituted_components"])
            own = [o for o in f["observed_rows"] if o["linked"]]
            self.assertEqual([o["food_item_id"] for o in own], [item])  # no RDA row is linked to these species
            self.assertIs(f["aquaculture"]["feasible"], feasible)
        self.assertEqual(self.new[534443]["food_trace"]["components"]["aquaculture_contribution"], 0)  # 참문어: settlement only

    def test_species_with_an_rda_row_never_take_a_mext_row(self):
        for aphia in (504357, 219984, 342067):  # 피조개·멸치·살오징어 keep their RDA rows (MEXT fills blanks only)
            f = self.new[aphia]["food_trace"]
            self.assertNotIn("row_table", f, aphia)
            self.assertFalse(any(o["food_item_id"].startswith("MEXT:") for o in f["observed_rows"]), aphia)
        # a generic MEXT name (なまこ) is never linked: 해삼 stays withheld
        self.assertEqual(self.new[241776]["withheld_reasons"]["MFPI"], "food_row_not_species_specific")

    def test_new_inputs_are_read_by_3_9_only(self):
        cfg = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
        for old in (V36, V37, V38):
            m = cfg(old)["nutrition"]["substitutes"]["mext"]
            self.assertNotIn("species_row_groups", m)
            self.assertEqual(m["components"], ["zinc_mg"])


V39 = ROOT / "config" / "verified-indices-v3.9.json"  # superseded by 3.10 (톳 peptide rows); its rows stay tested
HIJIKI = "research/verified-indices/evidence-hijiki-2026-10-01.json"


class VerifiedPilot310Tests(unittest.TestCase):
    """Superseded by 3.11. 3.10: 3.9 plus the reviewed 톳 peptide rows (research/verified-indices/evidence-hijiki-2026-10-01.md).
    Evidence rows only: rules, coefficients and cohorts are 3.9's."""

    def setUp(self):
        self.report = build(*load_inputs(config=V310))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V39)))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.10", "provisional_unvalidated"))
        # the published 3.10 report is archived as it was
        archived310 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.10.json"
        self.assertEqual(render(self.report), archived310.read_text(encoding="utf-8"))

    def test_only_hijiki_mbpi_moves(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(494972, "MBPI"): 65.0})
        self.assertEqual(sum(s["scores"]["MBPI"] is not None for s in self.new.values()), 14)

    def test_hijiki_rows(self):
        h = self.new[494972]
        peptides = [(i["peptide_sequence"], i["percentile"]) for i in h["bioactivity_trace"] if i["stratum_kind"] == "peptide"]
        self.assertEqual(sorted(peptides), [("GKY", 86.65), ("SKTY", 73.58), ("SVY", 78.12)])
        # the synthetic GKY (65.0) now outranks the ChEMBL LXR-alpha item (45.3), which stays in the trace
        self.assertEqual(h["mbpi_stratum"], "peptide")
        self.assertIn(45.27, [round(i["adjusted"], 2) for i in h["bioactivity_trace"] if i["stratum_kind"] == "chembl"])
        # one paper behind every item, so BBVI stays withheld
        self.assertEqual(h["withheld_reasons"]["BBVI"], "mbpi_single_source")

    def test_rows_are_read_from_3_10_on(self):
        cfg = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
        for old in (V33, V34, V35, V36, V37, V38, V39):
            self.assertNotIn(HIJIKI, cfg(old)["peptide_supplements"])



V310 = ROOT / "config" / "verified-indices-v3.10.json"  # superseded by 3.11 (고등어 peptide rows); its rows stay tested
MACKEREL = "research/verified-indices/evidence-mackerel-2026-10-01.json"


class VerifiedPilot311Tests(unittest.TestCase):
    """Superseded by 3.12. 3.11: 3.10 plus the reviewed 고등어 peptide rows (research/verified-indices/evidence-mackerel-2026-10-01.md).
    Evidence rows only: rules, coefficients and cohorts are 3.10's."""

    def setUp(self):
        self.report = build(*load_inputs(config=V311))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V310)))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.11", "provisional_unvalidated"))
        # the published 3.11 report is archived as it was
        archived311 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.11.json"
        self.assertEqual(render(self.report), archived311.read_text(encoding="utf-8"))

    def test_only_mackerel_mbpi_moves(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(127022, "MBPI"): 34.9})
        self.assertEqual(sum(s["scores"]["MBPI"] is not None for s in self.new.values()), 15)

    def test_mackerel_rows(self):
        m = self.new[127022]
        peptides = [(i["peptide_sequence"], i["percentile"], i["original_paper_dois"]) for i in m["bioactivity_trace"]
                    if i["stratum_kind"] == "peptide"]
        self.assertEqual(sorted(peptides), [("APFLAG", 41.19, ["10.1111/1750-3841.70767"]),
                                            ("FDHKKFF", 27.56, ["10.1111/1750-3841.70767"]),
                                            ("LFPKFA", 25.0, ["10.1111/1750-3841.70767"]),
                                            ("PLITT", 46.59, ["10.1016/j.foodchem.2024.138873"])])
        # PLITT (48.73 uM) is the top item; two papers exist but each sequence rests on one, so BBVI stays withheld
        self.assertEqual((m["mbpi_stratum"], m["mbpi_label"]), ("peptide", "참고값(단일 논문)"))
        self.assertEqual(m["withheld_reasons"]["BBVI"], "mbpi_single_source")

    def test_rows_are_read_from_3_11_on(self):
        cfg = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
        for old in (V33, V34, V35, V36, V37, V38, V39, V310):
            self.assertNotIn(MACKEREL, cfg(old)["peptide_supplements"])



V311 = ROOT / "config" / "verified-indices-v3.11.json"  # superseded by 3.12 (미역 IY potency replication); its rows stay tested
XO312 = "research/verified-indices/evidence-xo-potency-3.12.json"


class VerifiedPilot312Tests(unittest.TestCase):
    """Superseded by 3.13. 3.12: 3.11 with the cross-origin potency supplement widened to Suetsuna 2000's synthetic IY
    (research/verified-indices/evidence-wakame-iy-2026-10-01.md). Rules, coefficients and cohorts are 3.11's."""

    def setUp(self):
        self.report = build(*load_inputs(config=V312))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V311)))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.12", "provisional_unvalidated"))
        # the published 3.12 report is archived as it was
        archived312 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.12.json"
        self.assertEqual(render(self.report), archived312.read_text(encoding="utf-8"))

    def test_only_wakame_moves(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(145721, "MBPI"): 81.0, (145721, "BBVI"): 63.9})

    def test_iy_replication(self):
        w = self.new[145721]
        iy = [i for i in w["bioactivity_trace"] if i.get("peptide_sequence") == "IY"][0]
        self.assertEqual(iy["independent_dois"], ["10.1016/s0955-2863(00)00110-8", "10.1021/jf020482t"])
        self.assertEqual([(r["source_id"], r["used"], r["pIC50_gap"]) for r in iy["potency_replications"]],
                         [("suetsuna_2000_wakame_fulltext", True, 0.362)])
        self.assertEqual(iy["evidence_factor"], 1.0)
        # IW (single paper, 71.5) is no longer the top item; BBVI = 0.5 x MFPI 46.7 + 0.5 x MBPI 81.0
        self.assertIsNone(w["withheld_reasons"]["BBVI"])
        # the new row attaches to no other species
        others = [(a, i["peptide_sequence"]) for a, s in self.new.items() if a != 145721 for i in s["bioactivity_trace"]
                  if any(r["source_id"] == "suetsuna_2000_wakame_fulltext" for r in i.get("potency_replications") or [])]
        self.assertEqual(others, [])

    def test_supplement_is_read_from_3_12_on(self):
        cfg = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
        for old in (V33, V34, V35, V36, V37, V38, V39, V310, V311):
            xo = cfg(old).get("peptide_bioactivity", {}).get("cross_origin_potency", {})
            self.assertNotEqual(xo.get("supplement"), XO312)



V312 = ROOT / "config" / "verified-indices-v3.12.json"  # superseded by 3.13 (멸치 peptide rows); its rows stay tested
ANCHOVY = "research/verified-indices/evidence-anchovy-2026-10-01.json"


class VerifiedPilot313Tests(unittest.TestCase):
    """Superseded by 3.14. 3.13: 3.12 plus the reviewed 멸치 peptide rows (research/verified-indices/evidence-anchovy-2026-10-01.md).
    Evidence rows only: rules, coefficients and cohorts are 3.12's."""

    def setUp(self):
        self.report = build(*load_inputs(config=V313))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V312)))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.13", "provisional_unvalidated"))
        # the published 3.13 report is archived as it was
        archived313 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.13.json"
        self.assertEqual(render(self.report), archived313.read_text(encoding="utf-8"))

    def test_only_anchovy_mbpi_moves(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(219984, "MBPI"): 22.6})
        self.assertEqual(sum(s["scores"]["MBPI"] is not None for s in self.new.values()), 16)

    def test_anchovy_rows(self):
        m = self.new[219984]
        peptides = sorted((i["peptide_sequence"], i["percentile"]) for i in m["bioactivity_trace"] if i["stratum_kind"] == "peptide")
        # NHP is not recorded: the text and Table 1 spell it differently (NHP/NPH)
        self.assertEqual(peptides, [("DGGP", 30.11), ("GCK", 29.26), ("PK", 1.42)])
        self.assertEqual((m["mbpi_stratum"], m["mbpi_label"]), ("peptide", "참고값(단일 논문)"))
        self.assertEqual(m["withheld_reasons"]["BBVI"], "mbpi_single_source")

    def test_rows_are_read_from_3_13_on(self):
        cfg = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
        for old in (V33, V34, V35, V36, V37, V38, V39, V310, V311, V312):
            self.assertNotIn(ANCHOVY, cfg(old)["peptide_supplements"])



V313 = ROOT / "config" / "verified-indices-v3.13.json"  # superseded by 3.14 (purified peptides accepted); its rows stay tested
ISOLATES = "research/verified-indices/evidence-isolates-2026-10-01.json"
XO314 = "research/verified-indices/evidence-xo-potency-3.14.json"


class VerifiedPilot314Tests(unittest.TestCase):
    """Superseded by 3.15. 3.14: 3.13 with sequence-confirmed purified peptides accepted for origin rows and potency replications
    (research/verified-indices/evidence-isolates-2026-10-01.md). Coefficients, cohorts and the pIC50 gap are 3.13's."""

    def setUp(self):
        self.report = build(*load_inputs(config=V314))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V313)))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.14", "provisional_unvalidated"))
        # the published 3.14 report is archived as it was
        archived314 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.14.json"
        self.assertEqual(render(self.report), archived314.read_text(encoding="utf-8"))

    def test_changes(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(145721, "MBPI"): 95.3, (145721, "BBVI"): 71.0, (231750, "MBPI"): 58.6, (254538, "MBPI"): 59.9})
        self.assertEqual(sum(s["scores"]["MBPI"] is not None for s in self.new.values()), 17)

    def test_purified_replications(self):
        item = lambda a, seq: [i for i in self.new[a]["bioactivity_trace"] if i.get("peptide_sequence") == seq][0]
        used = lambda i: [(r["source_id"], r.get("material"), r["used"]) for r in i["potency_replications"]]
        self.assertEqual(used(item(145721, "IW")), [("lin_2018_chlorella", "purified_isolate", True)])
        self.assertEqual(used(item(145721, "VW")), [("lin_2018_chlorella", "purified_isolate", True),
                                                    ("kapel_2006_alfalfa", "purified_isolate", True)])
        # the scallop VW (86.9 uM) is more than 1.0 pIC50 away from both purified values
        self.assertEqual(used(item(393716, "VW")), [("lin_2018_chlorella", "purified_isolate", False),
                                                    ("kapel_2006_alfalfa", "purified_isolate", False)])
        self.assertEqual(self.new[393716]["withheld_reasons"]["BBVI"], "mbpi_single_source")

    def test_purified_origin_rows(self):
        top = lambda a: max((i for i in self.new[a]["bioactivity_trace"] if i["stratum_kind"] == "peptide"), key=lambda i: i["adjusted"])
        self.assertEqual(top(254538)["peptide_sequence"], "GASSGMPG")
        self.assertEqual(top(231750)["peptide_sequence"], "VISDEDGVTH")
        for a in (254538, 231750):
            self.assertEqual(self.new[a]["withheld_reasons"]["BBVI"], "mbpi_single_source")

    def test_older_configs_stay_synthetic_only(self):
        cfg = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
        for old in (V33, V34, V35, V36, V37, V38, V39, V310, V311, V312, V313):
            c = cfg(old)
            self.assertNotIn(ISOLATES, c["peptide_supplements"])
            xo = c.get("peptide_bioactivity", {}).get("cross_origin_potency", {})
            self.assertNotEqual(xo.get("supplement"), XO314)
            self.assertNotIn("accepted_materials", xo)


V314 = ROOT / "config" / "verified-indices-v3.14.json"  # superseded by 3.15 (gap closing); its rows stay tested
GAP = {"rda_name_links": "research/verified-indices/rda-name-links-2026-10-01.json",
       "aquaculture": "research/verified-indices/mfpi-aquaculture-names-2026-10-01.json",
       "literature": "research/verified-indices/mfpi-literature-rows-2026-10-01.json",
       "abalone": "research/verified-indices/evidence-abalone-2026-10-01.json",
       "national": "research/verified-indices/national-red-list-crosswalk-2026-10-01.json",
       "mcui": "research/verified-indices/mcui-substitutes-2026-10-02.json"}
# Rapid LC met, shown as reference information only (team-lead decision 2026-10-02: the back-test failed, so no MCUI)
RAPID_LC_REFERENCE = {145721, 250680, 372119, 494972, 377084, 371986, 234476, 494853, 236157, 145086, 275816, 274849, 254538, 1061762}


V315 = ROOT / "config" / "verified-indices-v3.15.json"  # superseded by 3.16 (one more range-state MCUI); its rows stay tested
MCUI316 = "research/verified-indices/mcui-substitutes-3.16-2026-10-02.json"


class VerifiedPilot315Tests(unittest.TestCase):
    """Superseded by 3.16. Public method: 3.14 plus the team-lead decisions of 2026-10-01 on closing the site's gaps
    (research/verified-indices/gap-closing-2026-10-02.md): RDA rows linked by a Korean national name authority, six aquaculture
    records, a literature nutrition row, ug/mL -> uM for synthetic peptides, MCUI substitutes (Korean crosswalk, another range
    state's list) and labels read from the post-hoc validation. The preliminary Rapid LC failed its back-test and is reference
    information only (team-lead decision 2026-10-02), never an MCUI. Coefficients and cohorts are 3.14's."""

    def setUp(self):
        self.report = build(*load_inputs(config=V315))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V314)))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.15", "provisional_unvalidated"))
        # the published 3.15 report is archived as it was
        archived315 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.15.json"
        self.assertEqual(render(self.report), archived315.read_text(encoding="utf-8"))

    def test_changes(self):
        # MFPI, MBPI and BBVI; the 2 MCUI changes (시카메굴 range state, 참문어 national) are checked in test_mcui_substitutes
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(241776, "MFPI"): 63.5, (342067, "MFPI"): 46.1, (372119, "MFPI"): 76.7, (377084, "MFPI"): 56.7,
                                   (236157, "MFPI"): 70.0, (836041, "MFPI"): 56.1, (127022, "MFPI"): 59.9, (534443, "MFPI"): 37.8,
                                   (397082, "MBPI"): 15.6})
        # MCUI 16 = IUCN 7 + Korean national 8 + range state 1; a reference-only Rapid LC fills nothing (63 of 120)
        filled = {axis: sum(s["scores"][axis] is not None for s in self.new.values()) for axis in ("MFPI", "MBPI", "MCUI", "BBVI")}
        self.assertEqual(filled, {"MFPI": 27, "MBPI": 18, "MCUI": 16, "BBVI": 2})
        self.assertEqual(sum(filled.values()), 63)

    def test_name_links(self):
        for aphia, code in {377084: "L0050000000a", 372119: "L0190000000a", 236157: "L0040000000a", 241776: "K6340000000a",
                            127022: "K0150000000a", 534443: "K6110030000a"}.items():
            f = self.new[aphia]["food_trace"]
            self.assertEqual(f["source_food_item_id"], code, aphia)
            self.assertNotIn("row_table", f)
            own = [o for o in f["observed_rows"] if o["linked"]]
            self.assertEqual([(o["food_item_id"], bool(o.get("link_source_id"))) for o in own], [(code, True)])
        self.assertEqual(self.new[241776]["food_trace"]["observed_rows"][0]["link_source_id"], "mfds_food_raw_material_codes")
        # the generic 갑오징어 row stays unlinked (no exact 국명)
        self.assertFalse(any(o["linked"] and o["food_item_id"] == "K6230010000a" for o in self.new[1666974]["food_trace"]["observed_rows"]))

    def test_literature_row(self):
        f = self.new[836041]["food_trace"]
        self.assertEqual((f["source_food_item_id"], f["row_table"], f["outside_cohort"]), ("LIT:liu2021-csikamea-table1", "literature", True))
        self.assertEqual({k: (n["value"], n["grade"]) for k, n in f["nutrients"].items()},
                         {"protein_g": (5.96, "literature_converted"), "iron_mg": (8.2, "literature_converted"),
                          "calcium_mg": (141.44, "literature_converted")})
        self.assertEqual(f["omitted_components"], ["zinc_mg"])
        self.assertEqual(f["edible_fraction"]["value"], 0.2055)
        self.assertEqual(self.report["method"]["nutrition"]["grade_factors"]["literature_converted"], 0.85)

    def test_aquaculture_records(self):
        feasible = {a: self.new[a]["food_trace"]["aquaculture"]["feasible"] for a in (342067, 377084, 372119, 236157, 241776, 836041)}
        self.assertEqual(feasible, {342067: False, 377084: True, 372119: True, 236157: True, 241776: True, 836041: True})

    def test_unit_conversion(self):
        item = [i for i in self.new[397082]["bioactivity_trace"] if i.get("peptide_sequence") == "AMN"][0]
        m = item["measurements"][0]
        self.assertEqual((m["value"], m["unit"], m["converted_from"]),
                         (317.71, "uM", {"value": 106.24, "unit": "ug/mL", "molecular_weight": 334.39}))
        self.assertEqual(self.new[397082]["withheld_reasons"]["BBVI"], "mbpi_single_source")

    def test_mcui_substitutes(self):
        # only another range state's list gives a substitute MCUI; it stays on the matrix as before
        self.assertEqual({a for a, s in self.new.items() if s["mcui_basis"] in ("range_state", "preliminary")}, {836041})
        oyster = self.new[836041]
        self.assertEqual((oyster["mcui_basis"], oyster["scores"]["MCUI"], oyster["mcui_substitute"]["record"]["country"]),
                         ("range_state", 35.0, "Japan"))
        self.assertEqual(self.report["method"]["matrix"]["include_substitute_mcui"], ["range_state"])
        octopus = self.new[534443]
        self.assertEqual((octopus["mcui_basis"], octopus["scores"]["MCUI"], octopus["national_assessment"]["name_as_published"]),
                         ("national", 35.0, "참문어 Octopus vulgaris"))
        self.assertEqual({a: s["scores"]["MCUI"] for a, s in self.new.items() if s["scores"]["MCUI"] != self.old[a]["scores"]["MCUI"]},
                         {836041: 35.0, 534443: 35.0})
        # team-lead decision 2026-10-02: a met Rapid LC is reference information only, shown beside the withheld MCUI
        t, sources = self.report["method"]["mcui_substitutes"]["thresholds"], self.report["sources"]
        self.assertEqual({a for a, s in self.new.items() if (s["mcui_substitute"] or {}).get("use") == "reference_only"},
                         RAPID_LC_REFERENCE)
        for a in RAPID_LC_REFERENCE:
            s, sub = self.new[a], self.new[a]["mcui_substitute"]
            rec = sub["record"]
            self.assertEqual((s["scores"]["MCUI"], s["withheld_reasons"]["MCUI"], s["mcui_basis"]), (None, "not_in_red_list", None), a)
            self.assertEqual((sub["value"], sub["category"], sub["result"]), (None, "LC", "likely_least_concern"), a)
            self.assertNotIn("pilot_mapping", sub)
            self.assertIn("점수 아님", sub["label"])
            self.assertEqual(rec["thresholds"], t)
            self.assertTrue(rec["eoo_km2"] > t["eoo_km2"] and rec["aoo_km2"] > t["aoo_km2"] and rec["records"] >= t["records"], a)
            self.assertNotEqual(rec["trend_class"], "decline_signal", a)
            self.assertTrue(set(sub["source_ids"]) <= set(sources) and set(sub["source_ids"]) <= set(s["source_ids"]), a)
            self.assertIn("no_conservation_assessment", s["priority_survey_reasons"])
            # the reference changes nothing 3.14 published for the species' MCUI, sufficiency or survey priority
            for key in ("priority_survey_reasons", "priority_survey"):
                self.assertEqual(s[key], self.old[a][key], (a, key))
            self.assertEqual(s["information_sufficiency"]["MCUI"], self.old[a]["information_sufficiency"]["MCUI"], a)
        self.assertEqual({a for a, s in self.new.items() if s["priority_survey"]}, RAPID_LC_REFERENCE)
        for a, s in self.new.items():
            self.assertNotEqual(s["mcui_basis"], "preliminary", a)
            self.assertNotIn("preliminary_assessment_only", s["priority_survey_reasons"], a)
        self.assertNotIn("preliminary_assessment_only", self.report["method"]["conservation"]["no_assessment"]["labels"])
        check = self.report["method"]["posthoc"]["validation_sets"]["MCUI_preliminary"]
        self.assertEqual((check["result"], check["agreement"], check["n"], check["false_lc_for_threatened"]),
                         ("failed", 11, 14, ["해삼", "전복(종 수준)"]))

    def test_preliminary_needs_every_threshold(self):
        rule = self.report["method"]["mcui_substitutes"]
        lc = json.loads((ROOT / rule["rapid_lc_snapshot"]).read_text(encoding="utf-8"))
        t = rule["thresholds"]
        for row in lc["species"].values():
            self.assertEqual(row["likely_least_concern"],
                             row["eoo_km2"] > t["eoo_km2"] and row["aoo_km2"] > t["aoo_km2"] and row["records"] >= t["records"])
            self.assertEqual(row["aoo_km2"], row["aoo_cells"] * t["aoo_cell_km"] ** 2)

    def test_older_configs_read_none_of_it(self):
        cfg = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
        for old in (V312, V313, V314):
            c, text = cfg(old), Path(old).read_text(encoding="utf-8")
            self.assertNotIn("mcui_substitutes", c)
            self.assertNotIn("unit_conversion", c["peptide_bioactivity"])
            for path in GAP.values():
                self.assertNotIn(path, text)


V316 = ROOT / "config" / "verified-indices-v3.16.json"  # superseded by 3.17 (display-only EPA/DHA); its rows stay tested
FATTY = "research/verified-indices/snapshots/rda-epa-dha-2026-10-02.json"


class VerifiedPilot316Tests(unittest.TestCase):
    """Superseded by 3.17. Public method: 3.15 plus one more range-state MCUI. The Russian Red Data Book (Order No. 320 of 23.05.2023, Section 5
    ВОДОРОСЛИ row 594) gives Gelidium elegans the threat status 'У' = VU, so 우뭇가사리 gets a labelled range-state MCUI 60
    where 3.15 had none. Russia is the northern edge of the range, so the row carries that limitation. Every other rule,
    coefficient, cohort and threshold is 3.15's."""

    def setUp(self):
        self.report = build(*load_inputs(config=V316))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V315)))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.16", "provisional_unvalidated"))
        # the published 3.16 report is archived as it was
        archived316 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.16.json"
        self.assertEqual(render(self.report), archived316.read_text(encoding="utf-8"))

    def test_only_the_one_cell_changes(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(372119, "MCUI"): 60.0})
        filled = {axis: sum(s["scores"][axis] is not None for s in self.new.values()) for axis in ("MFPI", "MBPI", "MCUI", "BBVI")}
        self.assertEqual(filled, {"MFPI": 27, "MBPI": 18, "MCUI": 17, "BBVI": 2})
        self.assertEqual(sum(filled.values()), 64)

    def test_russian_row(self):
        s = self.new[372119]
        sub = s["mcui_substitute"]
        self.assertEqual((s["mcui_basis"], s["scores"]["MCUI"]), ("range_state", 60.0))
        self.assertEqual((sub["category"], sub["record"]["country"], sub["record"]["scope"]), ("VU", "Russia", "national (Russia)"))
        self.assertEqual(sub["record"]["name_as_published"], "Гелидиум изящный - Gelidium elegans")
        # the rarity column (3 = rare) is a Russian scale and is never mapped; only the threat-status column is
        self.assertIn("Угроза исчезновения: У", sub["record"]["category_as_published"])
        self.assertIn("northern edge of the range", sub["record"]["limitations"])
        self.assertIn(sub["record"]["source_id"], self.report["sources"])
        # a peripheral VU must not be ranked with IUCN-based MCUI, and 우뭇가사리 has no BBVI, so it reaches no matrix quadrant
        self.assertIsNone(s["scores"]["BBVI"])
        self.assertEqual({a for a, r in self.new.items() if r["mcui_basis"] == "range_state"}, {836041, 372119})

    def test_rapid_lc_stays_reference_only(self):
        self.assertEqual({a for a, s in self.new.items() if (s["mcui_substitute"] or {}).get("use") == "reference_only"},
                         RAPID_LC_REFERENCE - {372119})
        self.assertNotIn("use", self.new[372119]["mcui_substitute"])

    def test_older_configs_do_not_read_the_new_file(self):
        for old in (V312, V313, V314, V315):
            self.assertNotIn(MCUI316, Path(old).read_text(encoding="utf-8"))


V317 = ROOT / "config" / "verified-indices-v3.17.json"  # superseded by 3.18 (AMP stratum); its rows stay tested
AMP = "research/verified-indices/evidence-amp-2026-10-02.json"


class VerifiedPilot317Tests(unittest.TestCase):
    """Superseded by 3.18. Public method: 3.16 plus display-only EPA and DHA. The species' own RDA DB 10.4 row carries the two fatty acids per
    100 g (scripts/collect_rda_fatty_acids.py, same 425 rows), shown beside the species with its share of the 330 mg daily
    reference value. Korea has no omega-3 content claim, so no claim word is used. No score, cohort, percentile or weight
    changes: MFPI keeps protein, calcium, iron and zinc."""

    def setUp(self):
        self.report = build(*load_inputs(config=V317))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V316)))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.17", "provisional_unvalidated"))
        # the published 3.17 report is archived as it was
        archived317 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.17.json"
        self.assertEqual(render(self.report), archived317.read_text(encoding="utf-8"))

    def test_no_score_moves(self):
        for a, s in self.new.items():
            self.assertEqual(s["scores"], self.old[a]["scores"], a)
            for key in ("nutrients", "cohort_id", "cohort_food_item_ids", "unrounded", "formula", "edible_fraction"):
                self.assertEqual((s["food_trace"] or {}).get(key), (self.old[a]["food_trace"] or {}).get(key), (a, key))
        self.assertEqual(self.report["method"]["nutrition"]["components"],
                         {"protein_g": "g", "iron_mg": "mg", "zinc_mg": "mg", "calcium_mg": "mg"})

    def test_fatty_acids_are_display_only(self):
        shown = {a: s["food_trace"]["display_fatty_acids"] for a, s in self.new.items()
                 if (s["food_trace"] or {}).get("display_fatty_acids")}
        self.assertEqual({a: fa["sum_mg"] for a, fa in shown.items()},
                         {145721: 16.7, 250680: 185.0, 836033: 149.1, 231750: 212.25, 393716: 221.35,
                          281273: 850.9, 275816: 622.6, 274849: 562.0, 276651: 1360.0, 1061762: 276.3})
        rule = self.report["method"]["nutrition"]["display_fatty_acids"]
        for a, fa in shown.items():
            self.assertEqual(fa["use"], "display_only")
            self.assertEqual(round(fa["epa_mg"] + fa["dha_mg"], 2), fa["sum_mg"], a)
            self.assertEqual((fa["reference_mg"], fa["source_id"]), (330, rule["display_source_id"]), a)
            # the pair must come from the same published row as the nutrition values
            self.assertEqual(fa["row_source"], self.new[a]["food_trace"]["row_source"], a)
        self.assertIn(rule["display_source_id"], self.report["sources"])
        # a species whose scored row is not its own RDA row never gets the line (MEXT and literature rows)
        for a in (413600, 836041):
            self.assertNotIn("display_fatty_acids", self.new[a]["food_trace"])

    def test_snapshot_matches_the_nutrition_rows(self):
        rule = self.report["method"]["nutrition"]["display_fatty_acids"]
        fa = json.loads((ROOT / rule["snapshot"]).read_text(encoding="utf-8"))
        nutrition = json.loads((ROOT / self.report["method"]["nutrition"]["snapshot"]).read_text(encoding="utf-8"))
        self.assertEqual([r["code"] for r in fa["rows"]], [r["code"] for r in nutrition["rows"]])
        for a, b in zip(fa["rows"], nutrition["rows"]):
            self.assertEqual(a["row_source"], b["values"].get("row_source"), a["code"])
            # EPA and DHA are reported as a pair or not at all, and a blank is never 0
            self.assertEqual(a["epa_mg"] is None, a["dha_mg"] is None, a["code"])
        self.assertEqual(sum(r["epa_mg"] is not None for r in fa["rows"]), 39)

    def test_older_configs_do_not_read_it(self):
        for old in (V313, V314, V315, V316):
            self.assertNotIn(FATTY, Path(old).read_text(encoding="utf-8"))


V318 = ROOT / "config" / "verified-indices-v3.18.json"  # superseded by 3.19 (Poor Broth, Cg-BigDef1); its rows stay tested


class VerifiedPilot318Tests(unittest.TestCase):
    """Superseded by 3.19. Public method: 3.17 plus the antimicrobial-peptide stratum the proposal names beside the ACE one. A fixed DBAASP cohort
    per target bacterium (MIC, broth media, single clean numeric value) ranks pMIC = 6 - log10(MIC uM) the way the ACE stratum
    ranks pIC50, with the same minimum cohort, the same DOI factors and the same max aggregation. A MIC percentile is never
    ranked against an ACE IC50 percentile. Origin rows are read in the original paper, never in the database. 피조개 and
    조피볼락 gain a single-paper MBPI; their BBVI stays withheld."""

    def setUp(self):
        self.report = build(*load_inputs(config=V318))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V317)))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.18", "provisional_unvalidated"))
        # the published 3.18 report is archived as it was
        archived318 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.18.json"
        self.assertEqual(render(self.report), archived318.read_text(encoding="utf-8"))

    def test_two_species_gain_an_mbpi_and_nothing_else_moves(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(504357, "MBPI"): 22.1, (274849, "MBPI"): 31.6})
        filled = {axis: sum(s["scores"][axis] is not None for s in self.new.values()) for axis in ("MFPI", "MBPI", "MCUI", "BBVI")}
        self.assertEqual(filled, {"MFPI": 27, "MBPI": 20, "MCUI": 17, "BBVI": 2})
        self.assertEqual(sum(filled.values()), 66)
        # one paper each, so both are reference values and BBVI stays withheld
        for a in (504357, 274849):
            self.assertEqual(self.new[a]["mbpi_label"], "참고값(단일 논문)")
            self.assertEqual(self.new[a]["withheld_reasons"]["BBVI"], "mbpi_single_source")

    def test_items_rank_inside_their_own_cohort(self):
        book = json.loads((ROOT / self.report["method"]["amp_bioactivity"]["cohort_file"]).read_text(encoding="utf-8"))
        cohorts = {c["cohort_id"]: c for c in book["cohorts"]}
        seen = 0
        for a, s in self.new.items():
            for item in s["bioactivity_trace"]:
                if item.get("stratum_kind") != "amp":
                    continue
                seen += 1
                cohort = cohorts[item["stratum_id"]]
                self.assertEqual(item["peer_peptides"], cohort["size"], item["record_ids"])
                self.assertEqual(cohort["target_kind"], "bacterium")
                self.assertGreaterEqual(cohort["size"], self.report["method"]["amp_bioactivity"]["minimum_peptides"])
                self.assertEqual(item["evidence_factor"], 0.75)  # one paper each
                self.assertAlmostEqual(item["adjusted"], item["percentile"] * 0.75, places=1)
                for m in item["measurements"]:
                    self.assertEqual((m["endpoint"], m["relation"], m["unit"], m["method"]), ("MIC", "=", "uM", "broth_microdilution"))
                    self.assertEqual(m["target_species"], item["measurements"][0]["target_species"])
        self.assertEqual(seen, 10)

    def test_best_items_are_the_published_ones(self):
        best = lambda a: max(self.new[a]["bioactivity_trace"], key=lambda i: i["adjusted"])
        clam, rockfish = best(504357), best(274849)
        self.assertEqual((clam["stratum_kind"], clam["peptide_name"], clam["percentile"]), ("amp", "AI-hemocidin 2", 29.41))
        self.assertEqual((rockfish["stratum_kind"], rockfish["peptide_name"], rockfish["percentile"]), ("amp", "TS40", 42.2))
        for item in (clam, rockfish):
            self.assertEqual(item["target_species"], "Staphylococcus aureus")
            self.assertLess(item["pMIC"], item["cohort_median_pMIC"])  # both sit below the cohort median; say so, do not hide it

    def test_a_mic_is_never_ranked_against_an_ace_ic50(self):
        strata = {i["stratum_id"] for s in self.new.values() for i in s["bioactivity_trace"] if i.get("stratum_kind") == "amp"}
        ace = {i["stratum_id"] for s in self.new.values() for i in s["bioactivity_trace"] if i.get("stratum_kind") == "peptide"}
        self.assertTrue(strata and ace and not (strata & ace))
        for s in self.new.values():
            for i in s["bioactivity_trace"]:
                self.assertEqual("pMIC" in i, i.get("stratum_kind") == "amp")
                self.assertEqual("pIC50" in i, i.get("stratum_kind") == "peptide")

    def test_the_cohort_file_obeys_its_own_published_rule(self):
        rule = self.report["method"]["amp_bioactivity"]
        book = json.loads((ROOT / rule["cohort_file"]).read_text(encoding="utf-8"))
        for c in book["cohorts"]:
            self.assertEqual(c["measure"], "MIC")
            self.assertEqual(len(c["members"]), c["size"])
            pmic = sorted(6 - math.log10(m["mic_uM"]) for m in c["members"])
            self.assertAlmostEqual(round(median(pmic), 3), c["median_pMIC"], places=3)
            self.assertAlmostEqual(round(pmic[0], 3), c["min_pMIC"], places=3)
            self.assertTrue(all(m["mic_uM"] > 0 for m in c["members"]))
        self.assertIn(rule["cohort_source_id"], self.report["sources"])
        # Candida albicans is a fungus and is kept out of the scored file
        self.assertNotIn("Candida", json.dumps([c["target_species"] for c in book["cohorts"]]))

    def test_rejected_rows_stay_recorded(self):
        supplement = json.loads((ROOT / self.report["method"]["amp_bioactivity"]["supplement"]).read_text(encoding="utf-8"))
        reasons = " ".join(x["reason"] for x in supplement["excluded"])
        for phrase in ("sequence", "recombinant", "MEC", "censored"):
            self.assertIn(phrase, reasons)
        self.assertEqual(len({x["species"] for x in supplement["excluded"]}), 3)

    def test_older_configs_do_not_read_it(self):
        for old in (V314, V315, V316, V317):
            text = Path(old).read_text(encoding="utf-8")
            self.assertNotIn(AMP, text)
            self.assertNotIn("amp_bioactivity", json.loads(text))


V319 = ROOT / "config" / "verified-indices-v3.19.json"  # superseded by 3.20 (P703 paper links, activity comments); its rows stay tested


class VerifiedPilot319Tests(unittest.TestCase):
    """Superseded by 3.20. Public method: 3.18 plus three team-lead decisions of 2026-10-02. (1) A liquid growth inhibition assay that reads the MIC
    over two-fold dilutions in a liquid medium counts as broth microdilution, and Poor Broth (DBAASP PBM) joins the cohort's
    broth list; 참굴 Cg-BigDef1 (total chemical synthesis) enters with all seven S. aureus strains of its table. (2) Peptides
    expressed in another organism stay excluded (Cg-Def family). (3) Only ministry or agency red lists count for the MCUI
    range-state step (no China Species Red List 2004)."""

    def setUp(self):
        self.report = build(*load_inputs(config=V319))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V318)))
        self.rule = self.report["method"]["amp_bioactivity"]

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.19", "provisional_unvalidated"))
        # the published 3.19 report is archived as it was
        archived319 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.19.json"
        self.assertEqual(render(self.report), archived319.read_text(encoding="utf-8"))

    def test_only_the_cohort_change_moves_scores(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        # Poor Broth adds 50 S. aureus members: each AMP percentile moves by hundredths, two scores by one tenth
        self.assertEqual(changed, {(504357, "MBPI"): 22.0, (274849, "MBPI"): 31.7})
        self.assertEqual(sum(s["scores"][axis] is not None for s in self.new.values() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")), 66)
        oyster = self.new[836033]
        self.assertEqual((oyster["scores"]["MBPI"], oyster["scores"]["BBVI"]), (96.3, 83.9))
        best = max(oyster["bioactivity_trace"], key=lambda i: i["adjusted"])
        self.assertEqual(best["stratum_kind"], "peptide")  # LQP still leads; Cg-BigDef1 adds evidence, not score

    def test_cg_bigdef1_uses_every_strain_of_its_table(self):
        item, = [i for i in self.new[836033]["bioactivity_trace"] if i.get("stratum_kind") == "amp"]
        self.assertEqual((item["peptide_name"], item["target_species"], item["peer_peptides"]), ("Cg-BigDef1", "Staphylococcus aureus", 6208))
        self.assertEqual(len(item["target_strains"]), 7)
        values = sorted(m["value"] for m in item["measurements"])
        self.assertEqual(values, [1.25, 1.25, 2.5, 2.5, 2.5, 2.5, 5.0])  # DBAASP lists only three of them
        self.assertAlmostEqual(item["pMIC"], round(6 - math.log10(2.5), 3), places=6)
        self.assertEqual((item["percentile"], item["evidence_factor"]), (83.51, 0.75))
        self.assertIn("피로글루탐산", item["sequence_modifications"])  # the Q at position 1 is shown as the modified residue it is
        self.assertTrue(all(m["medium"].startswith("Poor Broth") and m["method"] == "broth_microdilution" for m in item["measurements"]))
        rows = json.loads((ROOT / self.rule["supplement"]).read_text(encoding="utf-8"))["amp_bioactivity"]
        for r in rows:
            if r["peptide_name"] == "Cg-BigDef1":
                self.assertIn("liquid growth inhibition", r["method_as_published"])  # the published wording stays beside the row
                self.assertTrue(r["synthetic"])

    def test_poor_broth_is_the_only_new_medium(self):
        old_rule = json.loads(Path(V318).read_text(encoding="utf-8"))["amp_bioactivity"]
        old_book = json.loads((ROOT / old_rule["cohort_file"]).read_text(encoding="utf-8"))
        book = json.loads((ROOT / self.rule["cohort_file"]).read_text(encoding="utf-8"))
        self.assertEqual(set(book["broth_whitelist"]) - set(old_book["broth_whitelist"]), {"PBM"})
        self.assertEqual(set(old_book["broth_whitelist"]) - set(book["broth_whitelist"]), set())
        self.assertEqual([c["cohort_id"] for c in book["cohorts"]], [c["cohort_id"] for c in old_book["cohorts"]])
        for old, new in zip(old_book["cohorts"], book["cohorts"]):
            self.assertGreaterEqual(new["size"], old["size"])
            self.assertNotIn("PBM", new["dropped_media"])
            self.assertEqual(len(new["members"]), new["size"])

    def test_recombinant_and_non_ministry_sources_stay_out(self):
        supplement = json.loads((ROOT / self.rule["supplement"]).read_text(encoding="utf-8"))
        self.assertFalse([r for r in supplement["amp_bioactivity"] if r["peptide_name"].startswith("Cg-Def")])
        cg_def, = [x for x in supplement["excluded"] if x["record"].startswith("Cg-Def")]
        self.assertIn("recombinant", cg_def["reason"])
        self.assertIn("China Species Red List", self.report["method"]["mcui_substitutes"]["range_state_rule"])
        self.assertFalse([k for k, v in self.report["sources"].items()
                          if "china species red list" in json.dumps(v).lower() or "中国物种红色名录" in json.dumps(v, ensure_ascii=False)])

    def test_older_configs_do_not_read_it(self):
        for old in (V317, V318):
            self.assertNotIn("3.19-2026-10-02", Path(old).read_text(encoding="utf-8"))


V320 = ROOT / "config" / "verified-indices-v3.20.json"  # superseded by 3.21 (anticancer stratum); its rows stay tested


class VerifiedPilot320Tests(unittest.TestCase):
    """Superseded by 3.21. Public method: 3.19 plus two team-lead decisions of 2026-10-02. (1) An original-paper link is also admitted for a species
    that has Wikidata P703 statements, when the paper names the species and states where the sample came from; 다시마 gains a
    single-paper ChEMBL MBPI from Lu 2022 and 꼬시래기 is held. (2) A ChEMBL activity its depositor marked Inconclusive or
    Not Active never enters a species item."""

    def setUp(self):
        self.report = build(*load_inputs(config=V320))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V319)))
        self.rule = self.report["method"]["chembl_bioactivity"]

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.20", "provisional_unvalidated"))
        # the published 3.20 report is archived as it was
        archived320 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.20.json"
        self.assertEqual(render(self.report), archived320.read_text(encoding="utf-8"))

    def test_only_kelp_gains_a_score(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(377084, "MBPI"): 26.5})
        kelp = self.new[377084]
        self.assertEqual((kelp["mbpi_label"], kelp["withheld_reasons"]["BBVI"]), ("참고값(단일 논문)", "mbpi_single_source"))
        self.assertEqual(sum(s["scores"][axis] is not None for s in self.new.values() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")), 67)
        self.assertIsNone(self.new[236157]["scores"]["MBPI"])  # 꼬시래기 held by the team lead

    def test_kelp_items_match_the_hijiki_precedent(self):
        kelp = {i["compound_id"]: i for i in self.new[377084]["bioactivity_trace"] if i.get("stratum_kind") == "chembl"}
        hijiki = {i["compound_id"]: i for i in self.new[494972]["bioactivity_trace"] if i.get("stratum_kind") == "chembl"}
        self.assertEqual(set(kelp), {"CHEMBL252561", "CHEMBL252366"})
        for cid, item in kelp.items():
            # same compound, same cohort, same activity: the percentile is the 톳 one; only the linking papers differ
            self.assertEqual((item["stratum_id"], item["percentile"], item["activity_ids"]),
                             (hijiki[cid]["stratum_id"], hijiki[cid]["percentile"], hijiki[cid]["activity_ids"]))
            self.assertEqual(item["link_review"], "accepted")
            self.assertEqual(item["caveat"], hijiki[cid]["caveat"])  # the autoxidation caveat is shown for both species
            self.assertIn("10.1371/journal.pone.0258980", item["original_paper_dois"])
        self.assertEqual(round(kelp["CHEMBL252561"]["adjusted"], 2), 26.52)
        self.assertEqual(kelp["CHEMBL252366"]["link_factor"], 1.0)  # Lu 2022 and the Foods 2023 kombu quantitation

    def test_p703_paper_links_carry_their_conditions(self):
        sup = json.loads((ROOT / self.rule["paper_links_p703"]).read_text(encoding="utf-8"))
        for p in sup["links"]:
            v = p["verification"]
            self.assertTrue(v["species_named"] and v["sample_origin"].strip() and v["isolated_or_identified_from_species"])
        self.assertEqual({p["aphia_id"] for p in sup["links"]}, {377084})
        self.assertEqual([h["aphia_id"] for h in sup["held"]], [236157])

    def test_flagged_activities_never_enter_an_item(self):
        book = json.loads((ROOT / self.rule["activity_comments"]).read_text(encoding="utf-8"))
        flagged = {int(k) for k, v in book["comments"].items() if (v or "").lower() in self.rule["excluded_activity_comments"]}
        self.assertEqual(len(flagged), 100)
        used = {a for s in self.new.values() for i in s["bioactivity_trace"] if i.get("stratum_kind") == "chembl" for a in i["activity_ids"]}
        self.assertFalse(used & flagged)
        # no 3.19 item rested on a flagged row, so only the new kelp items differ
        for a, s in self.new.items():
            if a != 377084:
                self.assertEqual([i["adjusted"] for i in s["bioactivity_trace"]], [i["adjusted"] for i in self.old[a]["bioactivity_trace"]], a)

    def test_older_configs_do_not_read_it(self):
        for old in (V318, V319):
            text = Path(old).read_text(encoding="utf-8")
            self.assertNotIn("paper_links_p703", text)
            self.assertNotIn("activity_comments", text)


ANTICANCER = "research/verified-indices/evidence-anticancer-2026-10-02.json"


V321 = ROOT / "config" / "verified-indices-v3.21.json"  # superseded by 3.22 (괭생이모자반 MFPI); its rows stay tested


class VerifiedPilot321Tests(unittest.TestCase):
    """Superseded by 3.22. Public method: 3.20 plus the anticancer stratum the proposal names beside the antibacterial one. A fixed CancerPPD 2.0
    cohort per cancer cell line (IC50, single clean numeric value) ranks pIC50 = 6 - log10(IC50 uM) the way the AMP stratum
    ranks pMIC, with the same minimum cohort, the same DOI factors and the same max aggregation. A cell IC50 is never ranked
    against a MIC or an ACE IC50, and a peptide the database already holds is removed from its own cohort before ranking.
    피조개 gains an anticancer item that becomes its best; 가시파래 and 맛조개 gain items that rank below their best."""

    def setUp(self):
        self.report = build(*load_inputs(config=V321))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V320)))
        self.rule = self.report["method"]["anticancer_bioactivity"]
        self.items = {(a, i["peptide_name"], i["cell_line"]): i for a, s in self.new.items()
                      for i in s["bioactivity_trace"] if i.get("stratum_kind") == "anticancer"}

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.21", "provisional_unvalidated"))
        # the published 3.21 report is archived as it was
        archived321 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.21.json"
        self.assertEqual(render(self.report), archived321.read_text(encoding="utf-8"))

    def test_one_species_moves_and_the_others_only_gain_evidence(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(504357, "MBPI"): 75.0})
        clam = self.new[504357]
        self.assertEqual((clam["mbpi_label"], clam["mbpi_stratum"]), ("참고값(단일 논문)", "anticancer"))
        self.assertEqual(clam["withheld_reasons"]["BBVI"], "mbpi_single_source")
        self.assertEqual(sum(s["scores"][axis] is not None for s in self.new.values() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")), 67)
        # 가시파래 and 맛조개 gain items, but weaker than what they already had
        for a in (234476, 413600):
            self.assertEqual(self.new[a]["scores"]["MBPI"], self.old[a]["scores"]["MBPI"])
            self.assertTrue([i for i in self.new[a]["bioactivity_trace"] if i.get("stratum_kind") == "anticancer"])
        self.assertEqual({a for a, _, _ in self.items}, {504357, 234476, 413600})

    def test_items_rank_inside_their_own_cell_line_cohort(self):
        book = json.loads((ROOT / self.rule["cohort_file"]).read_text(encoding="utf-8"))
        cohorts = {c["cohort_id"]: c for c in book["cohorts"]}
        self.assertEqual(len(self.items), 6)
        for (aphia, name, cell), item in self.items.items():
            cohort = cohorts[item["stratum_id"]]
            self.assertEqual(cohort["cell_line"], cell)
            self.assertEqual(item["cohort_members"], cohort["size"])
            self.assertGreaterEqual(item["peer_peptides"], self.rule["minimum_peptides"])
            self.assertEqual(item["evidence_factor"], 0.75)  # one paper each
            self.assertLess(abs(item["adjusted"] - item["percentile"] * 0.75), 0.01)  # the item rounds the percentile
            self.assertAlmostEqual(item["pIC50"], median(6 - math.log10(m["value"]) for m in item["measurements"]), places=3)
            for m in item["measurements"]:
                self.assertEqual((m["endpoint"], m["relation"], m["unit"]), ("IC50", "=", "uM"))
                self.assertIn(m["method"], self.rule["accepted_methods"])
                self.assertEqual(m["cell_line"], cell)

    def test_a_peptide_is_never_ranked_against_itself(self):
        book = json.loads((ROOT / self.rule["cohort_file"]).read_text(encoding="utf-8"))
        cohorts = {c["cohort_id"]: c for c in book["cohorts"]}
        rows = {r["record_id"]: r for r in json.loads((ROOT / self.rule["supplement"]).read_text(encoding="utf-8"))["anticancer_bioactivity"]}
        for item in self.items.values():
            own = [rows[r] for r in item["record_ids"]]
            key = own[0]["cohort_self_member_key"]
            members = cohorts[item["stratum_id"]]["members"]
            if own[0]["cancerppd_ids"]:
                # the paper's own row is in CancerPPD, so exactly one member is dropped before ranking
                self.assertTrue(item["self_in_cohort"])
                self.assertEqual(item["peer_peptides"], item["cohort_members"] - 1)
                self.assertEqual(len([m for m in members if m["k"] == key]), 1)
            else:
                self.assertFalse(item["self_in_cohort"])
                self.assertEqual(item["peer_peptides"], item["cohort_members"])
        # 피조개 P6 beats every peer on HT-29; that is a statement about this cohort, nothing wider
        p6 = self.items[(504357, "P6", "HT-29")]
        self.assertEqual((p6["percentile"], p6["peer_peptides"], p6["cohort_members"]), (100.0, 50, 51))

    def test_an_ic50_is_never_ranked_against_a_mic_or_an_ace_ic50(self):
        kinds = {"anticancer": set(), "amp": set(), "peptide": set()}
        for s in self.new.values():
            for i in s["bioactivity_trace"]:
                if i.get("stratum_kind") in ("anticancer", "amp", "peptide"):
                    kinds[i["stratum_kind"]].add(i["stratum_id"])
                self.assertEqual("cell_line" in i, i.get("stratum_kind") == "anticancer")
                self.assertEqual("pMIC" in i, i.get("stratum_kind") == "amp")
        self.assertTrue(all(kinds.values()))
        self.assertFalse(kinds["anticancer"] & kinds["amp"])
        self.assertFalse(kinds["anticancer"] & kinds["peptide"])

    def test_the_cohort_file_obeys_its_own_published_rule(self):
        book = json.loads((ROOT / self.rule["cohort_file"]).read_text(encoding="utf-8"))
        self.assertIn("free for public", book["source"]["licence"])  # the maintainer's written permission
        for c in book["cohorts"]:
            self.assertEqual(c["measure"], "IC50")
            self.assertGreaterEqual(c["size"], self.rule["minimum_peptides"])
            self.assertEqual(len(c["members"]), c["size"])
            self.assertTrue(all(m["ic50_uM"] > 0 for m in c["members"]))
            pic = sorted(6 - math.log10(m["ic50_uM"]) for m in c["members"])
            self.assertAlmostEqual(round(median(pic), 3), c["median_pIC50"], places=3)
            self.assertAlmostEqual(round(pic[0], 3), c["min_pIC50"], places=3)
        self.assertIn(self.rule["cohort_source_id"], self.report["sources"])

    def test_rejected_rows_stay_recorded(self):
        supplement = json.loads((ROOT / self.rule["supplement"]).read_text(encoding="utf-8"))
        reasons = " ".join(x["reason"] for x in supplement["excluded"])
        for phrase in ("recombinant", "fewer than 30", "censored", "not this species"):
            self.assertIn(phrase, reasons)
        # the strongest measured value of both marine peptides is the one we cannot score; say so
        self.assertIn("DLD-1", reasons)
        self.assertIn("NCI-H460", reasons)

    def test_older_configs_do_not_read_it(self):
        for old in (V319, V320):
            text = Path(old).read_text(encoding="utf-8")
            self.assertNotIn(ANTICANCER, text)
            self.assertNotIn("anticancer_bioactivity", json.loads(text))


LIT322 = "research/verified-indices/mfpi-literature-rows-3.22-2026-10-02.json"
AQUA322 = "research/verified-indices/mfpi-aquaculture-names-3.22-2026-10-02.json"
V322 = ROOT / "config" / "verified-indices-v3.22.json"  # superseded by 3.23 (literature limitations shown); its rows stay tested


class VerifiedPilot322Tests(unittest.TestCase):
    """Superseded by 3.23. Public method: 3.21 plus an MFPI for 괭생이모자반 through the literature route the method has had since 3.12.
    Murakami et al. 2011 analyses the raw edible portion of this species and reports the moisture of the same pooled
    sample, so protein, calcium and zinc convert to fresh weight; iron is not analysed at all and stays out of the mean
    under the 3.7 minimum-components rule. The species also gains the aquaculture record the MFPI formula requires.
    No rule, cohort, weight or coefficient moves."""

    def setUp(self):
        self.report = build(*load_inputs(config=V322))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(build(*load_inputs(config=V321)))
        self.lit = self.report["method"]["nutrition"]["substitutes"]["literature"]

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.22", "provisional_unvalidated"))
        # the published 3.22 report is archived as it was
        archived322 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.22.json"
        self.assertEqual(render(self.report), archived322.read_text(encoding="utf-8"))

    def test_only_the_seaweed_gains_a_score(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        self.assertEqual(changed, {(494853, "MFPI"): 53.5})
        self.assertEqual(sum(s["scores"][axis] is not None for s in self.new.values() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")), 68)
        weed = self.new[494853]
        self.assertIsNone(weed["scores"]["BBVI"])  # its MBPI still rests on one paper
        self.assertEqual(weed["withheld_reasons"]["BBVI"], "mbpi_single_source")

    def test_the_row_is_the_paper_converted_with_its_own_moisture(self):
        trace = self.new[494853]["food_trace"]
        self.assertEqual(trace["row_table"], "literature")
        self.assertTrue(trace["outside_cohort"])
        self.assertEqual(trace["omitted_components"], ["iron_mg"])
        self.assertEqual({k: v["value"] for k, v in trace["nutrients"].items() if v},
                         {"protein_g": 1.04, "calcium_mg": 147.8, "zinc_mg": 0.48})
        book = json.loads((ROOT / LIT322).read_text(encoding="utf-8"))
        item, = [i for i in book["items"] if i["aphia_id"] == 494853]
        self.assertEqual(item["sample_state"], "raw")
        self.assertEqual(item["basis"], "100 g edible portion")
        self.assertEqual(item["food_group"], "해조류")
        # every published value is the dry-basis value at this sample's own moisture
        for key, c in item["components"].items():
            self.assertEqual(c["value"], round(c["dry_basis_value"] * (100 - item["moisture_pct"]) / 100, 2), key)
        self.assertEqual(set(item["components"]) | set(item["omitted"]), set(self.report["method"]["nutrition"]["components"]))
        self.assertIn("does not analyse iron", item["omitted"]["iron_mg"])
        self.assertIn(item["source_id"], self.lit["source_ids"])
        self.assertIn(item["source_id"], self.new[494853]["source_ids"])

    def test_the_aquaculture_record_is_research_rearing_and_says_so(self):
        aqua = self.new[494853]["food_trace"]["aquaculture"]
        self.assertTrue(aqua["feasible"])
        self.assertIn("not food production", aqua["limitations"])
        self.assertIn("Qingdao", aqua["region"])
        self.assertIn(aqua["source_id"], self.new[494853]["source_ids"])

    def test_the_other_literature_species_is_untouched(self):
        # 시카메굴 keeps the 3.12 row, so the shared file only grew
        book = json.loads((ROOT / LIT322).read_text(encoding="utf-8"))
        self.assertEqual(sorted(i["aphia_id"] for i in book["items"]), [494853, 836041])
        self.assertEqual(self.new[836041]["food_trace"]["nutrients"], self.old[836041]["food_trace"]["nutrients"])

    def test_older_configs_keep_their_own_input_files(self):
        for old in (V319, V320, V321):
            text = Path(old).read_text(encoding="utf-8")
            self.assertNotIn(LIT322, text)
            self.assertNotIn(AQUA322, text)


V323 = ROOT / "config" / "verified-indices-v3.23.json"  # superseded by 3.24 (큰가리비 VW potency replication); its rows stay tested


class VerifiedPilot323Tests(unittest.TestCase):
    """Superseded by 3.24. Public method: 3.22 plus display data only. The reviewed limitations of a literature species row (where, when and how
    the paper sampled; for the seaweed, that Kjeldahl nitrogen x 6.25 overstates protein) reach the MFPI trace as
    literature_limitations. From 3.15 to 3.22 the builder read the row's values and dropped this text. No input file,
    rule, cohort, coefficient or score moves, and the uncertainty list is untouched."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V323)), build(*load_inputs(config=V322))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.23", "provisional_unvalidated"))
        # the published 3.23 report is archived as it was
        archived323 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.23.json"
        self.assertEqual(render(self.report), archived323.read_text(encoding="utf-8"))

    def test_no_score_moves(self):
        for a, s in self.new.items():
            self.assertEqual((s["scores"], s["withheld_reasons"]), (self.old[a]["scores"], self.old[a]["withheld_reasons"]), a)
        self.assertEqual(sum(v is not None for s in self.new.values() for v in s["scores"].values()), 68)

    def test_each_literature_row_shows_its_own_limitations(self):
        book = json.loads((ROOT / LIT322).read_text(encoding="utf-8"))
        for item in book["items"]:
            new, old = self.new[item["aphia_id"]]["food_trace"], self.old[item["aphia_id"]]["food_trace"]
            self.assertEqual(new["row_table"], "literature")
            self.assertEqual(new["literature_limitations"], item["limitations"], item["aphia_id"])
            self.assertNotIn("literature_limitations", old)
            self.assertEqual(new["uncertainty"], old["uncertainty"])
        self.assertIn("Kjeldahl", self.new[494853]["food_trace"]["literature_limitations"])
        # only the literature rows carry it
        self.assertEqual(sorted(a for a, s in self.new.items() if "literature_limitations" in (s.get("food_trace") or {})),
                         sorted(i["aphia_id"] for i in book["items"]))

    def test_nothing_else_changes(self):
        # apart from the version stamps, the flag and the two added fields, the 3.23 report is the 3.22 report
        def strip(report):
            r = json.loads(render(report))
            r["method_version"] = r["method"]["method_version"] = r["method"]["changes_from"] = None
            r["method"]["nutrition"]["substitutes"]["literature"].pop("show_limitations", None)
            for s in r["species"] + r["candidate_species"]:
                t = s.get("food_trace") or {}
                t["method_version"] = None
                t.pop("literature_limitations", None)
                for n in t.get("supplemental_nutrition", []):
                    if "substitute_use" in n:
                        n["substitute_use"] = n["substitute_use"].replace(report["method_version"], "VERSION")
            return r
        self.assertEqual(strip(self.report), strip(self.old_report))

    def test_older_configs_never_show_the_line(self):
        for old in (V315, V316, V317, V318, V319, V320, V321, V322):
            lit = json.loads(Path(old).read_text(encoding="utf-8"))["nutrition"]["substitutes"].get("literature") or {}
            self.assertNotIn("show_limitations", lit, old)


XO314 = "research/verified-indices/evidence-xo-potency-3.14.json"
XO324 = "research/verified-indices/evidence-xo-potency-3.24.json"
SUETSUNA_2004 = "10.1016/j.jnutbio.2003.11.004"


V324 = ROOT / "config" / "verified-indices-v3.24.json"  # superseded by 3.25 (three synthetic wakame replications, two record fixes)


class VerifiedPilot324Tests(unittest.TestCase):
    """Superseded by 3.25. Public method: 3.23 plus one potency replication row. Suetsuna et al. 2004 (J Nutr Biochem 15:267) isolated Val-Trp
    from a wakame hot-water extract as a single HPLC peak, sequenced it by Edman degradation and measured 10.8 uM with HHL.
    A sequence-confirmed purified peptide has counted since 3.14, and its pIC50 lies 0.906 from the scallop VW (86.9 uM),
    inside the 1.0 gap, so 큰가리비's top item rests on two independent papers and its BBVI opens. No rule, cohort, gap or
    coefficient moves."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V324)), build(*load_inputs(config=V323))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.24", "provisional_unvalidated"))
        # the published 3.24 report is archived as it was
        archived324 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.24.json"
        self.assertEqual(render(self.report), archived324.read_text(encoding="utf-8"))

    def test_only_the_scallop_moves(self):
        changed = {(a, axis): s["scores"][axis] for a, s in self.new.items() for axis in ("MFPI", "MBPI", "MCUI", "BBVI")
                   if s["scores"][axis] != self.old[a]["scores"][axis]}
        # VW percentile 36.36 at the two-paper factor 1.0; BBVI = 0.5 x MFPI 55.8 + 0.5 x MBPI 36.4
        self.assertEqual(changed, {(393716, "MBPI"): 36.4, (393716, "BBVI"): 46.1})
        self.assertEqual(sum(v is not None for s in self.new.values() for v in s["scores"].values()), 69)
        scallop = self.new[393716]
        self.assertIsNone(scallop["withheld_reasons"]["BBVI"])
        self.assertIsNone(scallop["mbpi_label"])
        self.assertIsNone(scallop["reference_combination"])
        self.assertEqual(self.old[393716]["withheld_reasons"]["BBVI"], "mbpi_single_source")

    def test_the_vw_item_rests_on_two_papers(self):
        item = lambda rows: [i for i in rows[393716]["bioactivity_trace"] if i.get("peptide_sequence") == "VW"][0]
        new, old = item(self.new), item(self.old)
        self.assertEqual(new["independent_dois"], [SUETSUNA_2004, "10.16535/j.cnki.dlhyxb.2018.06.016"])
        self.assertEqual((new["evidence_factor"], old["evidence_factor"]), (1.0, 0.75))
        # the scored value is still the scallop paper's synthetic VW; the replication adds a paper, not a value
        self.assertEqual((new["measurements"], new["pIC50"], new["percentile"]), (old["measurements"], old["pIC50"], old["percentile"]))
        self.assertEqual([(r["source_id"], r["material"], r["used"], r["pIC50_gap"]) for r in new["potency_replications"]],
                         [("lin_2018_chlorella", "purified_isolate", False, 2.176), ("kapel_2006_alfalfa", "purified_isolate", False, 1.898),
                          ("suetsuna_2004_wakame", "purified_isolate", True, 0.906)])
        self.assertIn("suetsuna_2004_wakame", self.new[393716]["source_ids"])

    def test_the_supplement_only_grows(self):
        read = lambda p: json.loads((ROOT / p).read_text(encoding="utf-8"))
        old, new = read(XO314), read(XO324)
        self.assertEqual(new["snapshot_date"], old["snapshot_date"])
        self.assertEqual(new["potency_replications"][:-1], old["potency_replications"])
        row = new["potency_replications"][-1]
        self.assertEqual((row["sequence"], row["value"], row["unit"], row["substrate"], row["material"], row["synthetic"]),
                         ("VW", 10.8, "uM", "HHL", "purified_isolate", False))
        self.assertEqual(row["original_paper_doi"], SUETSUNA_2004)
        self.assertEqual({k: v for k, v in new["sources"].items() if k != row["source_id"]}, old["sources"])
        # 3.14 to 3.23 keep reading the old file, so their archives stay as published
        for cfg in (V314, V315, V316, V317, V318, V319, V320, V321, V322, V323):
            self.assertEqual(json.loads(Path(cfg).read_text(encoding="utf-8"))["peptide_bioactivity"]["cross_origin_potency"]["supplement"], XO314)

    def test_nothing_else_changes(self):
        # 미역 VW (Sato 2002, 3.3 uM) also gains the row as a replication (pIC50 gap 0.515), but it already rested on more
        # than one paper, so its factor and every 미역 score stay; apart from that, the version stamps and 큰가리비, the
        # 3.24 report is the 3.23 report
        wakame_vw = lambda rows: [i for i in rows[145721]["bioactivity_trace"] if i.get("peptide_sequence") == "VW"][0]
        self.assertEqual(wakame_vw(self.new)["evidence_factor"], wakame_vw(self.old)["evidence_factor"])
        self.assertEqual([r["pIC50_gap"] for r in wakame_vw(self.new)["potency_replications"] if r["source_id"] == "suetsuna_2004_wakame"], [0.515])

        def strip(report):
            r = json.loads(render(report))
            r["method_version"] = r["method"]["method_version"] = r["method"]["changes_from"] = None
            r["method"]["peptide_bioactivity"]["cross_origin_potency"]["supplement"] = None
            r["sources"].pop("suetsuna_2004_wakame", None)
            r["candidate_species"] = [s for s in r["candidate_species"] if s["aphia_id"] != 393716]
            for s in r["species"] + r["candidate_species"]:
                s["source_ids"] = [x for x in s["source_ids"] if x != "suetsuna_2004_wakame"]
                t = s.get("food_trace") or {}
                t["method_version"] = None
                for n in t.get("supplemental_nutrition", []):
                    if "substitute_use" in n:
                        n["substitute_use"] = n["substitute_use"].replace(report["method_version"], "VERSION")
                for i in s.get("bioactivity_trace") or []:
                    if "potency_replications" in i:
                        i["potency_replications"] = [x for x in i["potency_replications"] if x["source_id"] != "suetsuna_2004_wakame"]
                        i["independent_dois"] = [d for d in i["independent_dois"] if d != SUETSUNA_2004]
            return r
        self.assertEqual(strip(self.report), strip(self.old_report))


XO325 = "research/verified-indices/evidence-xo-potency-3.25.json"
AQUA325 = "research/verified-indices/mfpi-aquaculture-names-3.25-2026-10-02.json"
NEW325 = {"michelke_2018_iw": ("IW", "10.1002/elsc.201700172", 0.105), "nomura_2002_thresher": ("VW", "10.1046/j.1444-2906.2002.00518.x", 0.293),
          "saito_1994_sake": ("IY", "10.1271/bbb.58.1767", 0.405)}


V325 = ROOT / "config" / "verified-indices-v3.25.json"  # superseded by 3.26 (청각 limitation no longer quotes a misprint)


class VerifiedPilot325Tests(unittest.TestCase):
    """Superseded by 3.26. Public method: 3.24 plus three synthetic potency replications for the wakame IW, VW and IY items (Michelke 2018,
    Nomura 2002, Saito 1994; found by doyoun0824, two independent readers each, read a third time) and two corrected
    aquaculture records (멸치's rearing site, 청각 read in full). No feasible flag, rule, cohort, gap, coefficient or score
    moves; 미역's BBVI no longer needs the purified-isolate rule or the shared-co-author exception for those items."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V325)), build(*load_inputs(config=V324))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.25", "provisional_unvalidated"))
        # the published 3.25 report is archived as it was
        archived325 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.25.json"
        self.assertEqual(render(self.report), archived325.read_text(encoding="utf-8"))

    def test_no_score_moves(self):
        for a, s in self.new.items():
            self.assertEqual(s["scores"], self.old[a]["scores"], s["korean_name"])
            self.assertEqual(s["withheld_reasons"], self.old[a]["withheld_reasons"], s["korean_name"])
        self.assertEqual(sum(v is not None for s in self.new.values() for v in s["scores"].values()), 69)
        self.assertEqual((self.new[145721]["scores"]["MBPI"], self.new[145721]["scores"]["BBVI"]), (95.3, 71.0))

    def test_each_wakame_item_has_a_synthetic_independent_replication(self):
        items = {i["peptide_sequence"]: i for i in self.new[145721]["bioactivity_trace"] if i.get("peptide_sequence") in ("IW", "VW", "IY")}
        old = {i["peptide_sequence"]: i for i in self.old[145721]["bioactivity_trace"] if i.get("peptide_sequence") in ("IW", "VW", "IY")}
        for source, (seq, doi, gap) in NEW325.items():
            rep = [r for r in items[seq]["potency_replications"] if r["source_id"] == source]
            self.assertEqual([(r["used"], r["pIC50_gap"]) for r in rep], [(True, gap)], seq)
            self.assertIn(doi, items[seq]["independent_dois"])
            self.assertEqual(items[seq]["evidence_factor"], old[seq]["evidence_factor"])
            self.assertIn(source, self.new[145721]["source_ids"])
            # the older rows stay attached; the new one is added after them
            self.assertEqual(items[seq]["potency_replications"][:-1], old[seq]["potency_replications"])

    def test_scallop_vw_does_not_take_the_thresher_value(self):
        vw = [i for i in self.new[393716]["bioactivity_trace"] if i.get("peptide_sequence") == "VW"][0]
        self.assertEqual([(r["source_id"], r["used"], r["pIC50_gap"]) for r in vw["potency_replications"]][-1], ("nomura_2002_thresher", False, 1.714))
        self.assertEqual((self.new[393716]["scores"]["MBPI"], self.new[393716]["scores"]["BBVI"]), (36.4, 46.1))
        self.assertNotIn("nomura_2002_thresher", self.new[393716]["source_ids"])

    def test_the_supplement_only_grows(self):
        read = lambda p: json.loads((ROOT / p).read_text(encoding="utf-8"))
        old, new = read(XO324), read(XO325)
        self.assertEqual(new["snapshot_date"], old["snapshot_date"])
        self.assertEqual(new["potency_replications"][:-3], old["potency_replications"])
        added = new["potency_replications"][-3:]
        self.assertEqual([(r["source_id"], r["sequence"], r["value"], r["unit"], r["substrate"], r["synthetic"]) for r in added],
                         [("michelke_2018_iw", "IW", 1.91, "uM", "HHL", True), ("nomura_2002_thresher", "VW", 1.68, "uM", "HHL", True),
                          ("saito_1994_sake", "IY", 2.4, "uM", "HHL", True)])
        self.assertEqual({k: v for k, v in new["sources"].items() if k not in NEW325}, old["sources"])
        self.assertEqual(json.loads(V324.read_text(encoding="utf-8"))["peptide_bioactivity"]["cross_origin_potency"]["supplement"], XO324)

    def test_two_aquaculture_records_are_corrected_in_a_fork(self):
        read = lambda p: json.loads((ROOT / p).read_text(encoding="utf-8"))
        old, new = read(AQUA322), read(AQUA325)
        changed = {o["aphia_id"] for o, n in zip(old["food_support"], new["food_support"]) if o != n}
        self.assertEqual(changed, {219984, 145086})
        self.assertEqual([x["feasible"] for x in new["food_support"]], [x["feasible"] for x in old["food_support"]])
        self.assertEqual({k for k in old["sources"] if old["sources"][k] != new["sources"][k]}, {"hwang_2008_codium_wando"})
        self.assertEqual(set(new["sources"]), set(old["sources"]))
        anchovy = self.new[219984]["food_trace"]["aquaculture"]
        self.assertTrue(anchovy["region"].startswith("Hakatajima Field Station"))
        codium = self.new[145086]["food_trace"]["aquaculture"]
        self.assertEqual(codium["year"], "July 2004 to August 2005")
        self.assertNotIn("Abstract-level", codium["limitations"])
        # 3.22 to 3.24 keep reading the 3.22 file, so their archives stay as published
        for cfg in (V322, V323, V324):
            self.assertEqual(json.loads(Path(cfg).read_text(encoding="utf-8"))["nutrition"]["substitutes"]["aquaculture_supplement"], AQUA322)

    def test_nothing_else_changes(self):
        new_sources = set(NEW325)

        def strip(report):
            r = json.loads(render(report))
            r["method_version"] = r["method"]["method_version"] = r["method"]["changes_from"] = None
            r["method"]["peptide_bioactivity"]["cross_origin_potency"]["supplement"] = None
            r["method"]["nutrition"]["substitutes"]["aquaculture_supplement"] = None
            for k in new_sources | {"hwang_2008_codium_wando"}:
                r["sources"].pop(k, None)
            for s in r["species"] + r["candidate_species"]:
                s["source_ids"] = [x for x in s["source_ids"] if x not in new_sources]
                t = s.get("food_trace") or {}
                t["method_version"] = None
                if s["aphia_id"] in (219984, 145086):
                    t["aquaculture"] = None
                for n in t.get("supplemental_nutrition", []):
                    if "substitute_use" in n:
                        n["substitute_use"] = n["substitute_use"].replace(report["method_version"], "VERSION")
                for i in s.get("bioactivity_trace") or []:
                    if "potency_replications" in i:
                        i["potency_replications"] = [x for x in i["potency_replications"] if x["source_id"] not in new_sources]
                        i["independent_dois"] = [d for d in i["independent_dois"] if d not in {v[1] for v in NEW325.values()}]
            return r
        self.assertEqual(strip(self.report), strip(self.old_report))


AQUA326 = "research/verified-indices/mfpi-aquaculture-names-3.26-2026-10-02.json"
V326 = ROOT / "config" / "verified-indices-v3.26.json"  # superseded by 3.27 (gap filling: labelled single-paper BBVI and new rows)


class VerifiedPilot326Tests(unittest.TestCase):
    """Superseded by 3.27. Public method: 3.25 with one record sentence corrected. The 청각 aquaculture limitation quoted Hwang et al. 2008's
    36,110 kg dry weight per hectare as the authors' estimate. By Table 2's own footnotes (5% dry yield, 100 ropes of 100 m
    per hectare) that row is 3,610, the rule the other three depths follow, so the printed figure is a misprint and the
    limitation now says so. No feasible flag, rule, cohort, coefficient or score moves."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V326)), build(*load_inputs(config=V325))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.26", "provisional_unvalidated"))
        # the published 3.26 report is archived as it was
        archived326 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.26.json"
        self.assertEqual(render(self.report), archived326.read_text(encoding="utf-8"))

    def test_no_score_moves(self):
        for a, s in self.new.items():
            self.assertEqual((s["scores"], s["withheld_reasons"]), (self.old[a]["scores"], self.old[a]["withheld_reasons"]), s["korean_name"])
        self.assertEqual(sum(v is not None for s in self.new.values() for v in s["scores"].values()), 69)

    def test_only_the_codium_limitation_changes_in_a_fork(self):
        # Hwang 2008 Table 2, depth: (kg dry per 100 m of rope, printed kg dry per hectare); a hectare holds 100 such ropes
        table2 = {0.5: (7.9, 790), 1: (36.1, 36110), 2: (17.2, 1720), 3: (5.15, 515)}
        self.assertEqual({d for d, (rope, printed) in table2.items() if round(rope * 100) != printed}, {1})
        read = lambda p: json.loads((ROOT / p).read_text(encoding="utf-8"))
        old, new = read(AQUA325), read(AQUA326)
        changed = {(o["aphia_id"], k) for o, n in zip(old["food_support"], new["food_support"]) for k in set(o) | set(n) if o.get(k) != n.get(k)}
        self.assertEqual(changed, {(145086, "limitations")})
        self.assertEqual((new["rule"], new["sources"], len(new["food_support"])), (old["rule"], old["sources"], len(old["food_support"])))
        limitation = self.new[145086]["food_trace"]["aquaculture"]["limitations"]
        self.assertIn("gives 3,610", limitation)
        self.assertNotIn("potential-production estimate", limitation)
        # 3.25 keeps reading its own file, so its archive stays as published
        self.assertEqual(json.loads(V325.read_text(encoding="utf-8"))["nutrition"]["substitutes"]["aquaculture_supplement"], AQUA325)

    def test_nothing_else_changes(self):
        def strip(report):
            r = json.loads(render(report))
            r["method_version"] = r["method"]["method_version"] = r["method"]["changes_from"] = None
            r["method"]["nutrition"]["substitutes"]["aquaculture_supplement"] = None
            for s in r["species"] + r["candidate_species"]:
                t = s.get("food_trace") or {}
                t["method_version"] = None
                if s["aphia_id"] == 145086:
                    t["aquaculture"]["limitations"] = None
                for n in t.get("supplemental_nutrition", []):
                    if "substitute_use" in n:
                        n["substitute_use"] = n["substitute_use"].replace(report["method_version"], "VERSION")
            return r
        self.assertEqual(strip(self.report), strip(self.old_report))


V327_CHANGED = {342067: "살오징어", 836041: "시카메굴", 236157: "꼬시래기", 234476: "가시파래"}
V327 = ROOT / "config" / "verified-indices-v3.27.json"  # superseded by 3.28 (톳 GKY/SKTY potency replication, Chen 2016)


class VerifiedPilot327Tests(unittest.TestCase):
    """Public method (team-lead decisions 2026-10-03): 3.26 plus (1) a labelled BBVI score when the top MBPI item rests on one
    paper, (2) 살오징어 MBPI from Wako 1996's purified YALPHA (HHL), (3) 시카메굴 MBPI from flazin (Kong 2021) and 꼬시래기 MBPI from
    PGA2 (hold released), both from a same-release ChEMBL supplement, (4) 가시파래 MCUI from Sweden's red list 2025, and (5) the
    MBPI drug-origin check computed (failed) with two failed MCUI checks recorded. Superseded by 3.28."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V327)), build(*load_inputs(config=V326))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.27", "provisional_unvalidated"))
        # the published 3.27 report is archived as it was
        archived327 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.27.json"
        self.assertEqual(render(self.report), archived327.read_text(encoding="utf-8"))

    def test_filled_cells_and_which_axes_moved(self):
        filled = lambda rows: sum(v is not None for s in rows.values() for v in s["scores"].values())
        self.assertEqual((filled(self.old), filled(self.new)), (69, 92))
        moved = {(a, k) for a, s in self.new.items() for k in ("MFPI", "MBPI", "MCUI") if s["scores"][k] != self.old[a]["scores"][k]}
        self.assertEqual(moved, {(342067, "MBPI"), (836041, "MBPI"), (236157, "MBPI"), (234476, "MCUI")})
        self.assertEqual([self.new[a]["scores"]["MBPI"] for a in (342067, 836041, 236157)], [56.9, 13.8, 49.3])
        self.assertEqual(self.new[234476]["scores"]["MCUI"], 10.0)
        for a, s in self.new.items():
            sc = s["scores"]
            best = max(s["bioactivity_trace"], key=lambda i: i["adjusted"]) if s["bioactivity_trace"] else None
            if sc["MFPI"] is None or sc["MBPI"] is None:
                self.assertIsNone(sc["BBVI"], s["korean_name"])
                continue
            self.assertEqual(sc["BBVI"], round1(0.5 * sc["MFPI"] + 0.5 * sc["MBPI"]), s["korean_name"])
            single = independent_sources(best) < 2
            self.assertEqual((s["bbvi_label"], s["mbpi_label"]), ("단일 논문", "단일 논문") if single else (None, None), s["korean_name"])
            self.assertIsNone(s["withheld_reasons"]["BBVI"])
            self.assertIsNone(s["reference_combination"])
            if not single:  # 미역, 참굴, 큰가리비 keep their BBVI
                self.assertEqual(sc["BBVI"], self.old[a]["scores"]["BBVI"])
        self.assertEqual(sum(s["bbvi_label"] is not None for s in self.new.values()), 19)
        self.assertEqual(sum(s["scores"]["BBVI"] is not None for s in self.new.values()), 22)

    def test_older_configs_still_withhold_single_paper_bbvi(self):
        for s in self.old.values():
            self.assertNotIn("bbvi_label", s)
            if s["withheld_reasons"]["BBVI"] == "mbpi_single_source":
                self.assertIsNone(s["scores"]["BBVI"])
                self.assertIsNotNone(s["reference_combination"])

    def test_squid_purified_peptide_rows(self):
        items = {i["peptide_sequence"]: i for i in self.new[342067]["bioactivity_trace"]}
        self.assertEqual({k: (v["pIC50"], v["percentile"], v["evidence_factor"]) for k, v in items.items()},
                         {"YALPHA": (5.009, 75.85, 0.75), "GYALPHA": (4.564, 57.1, 0.75)})
        self.assertEqual(items["YALPHA"]["original_paper_dois"], ["10.1271/bbb.60.1353"])
        self.assertTrue(all("3시간" in i["caveat"] and "액틴" in i["caveat"] for i in items.values()))  # the reviewed assay caveat reaches the page
        self.assertIn("wako_1996_squid", self.new[342067]["source_ids"])
        self.assertEqual((self.new[342067]["scores"]["BBVI"], self.new[342067]["bbvi_label"]), (51.5, "단일 논문"))

    def test_supplement_compounds_score_as_the_rule_says(self):
        oyster = max(self.new[836041]["bioactivity_trace"], key=lambda i: i["adjusted"])
        self.assertEqual((oyster["compound_id"], oyster["target_chembl_id"], oyster["standard_type"], oyster["percentile"],
                          oyster["link_factor"], oyster["activity_factor"]), ("CHEMBL1822160", "CHEMBL378", "IC50", 24.51, 0.75, 0.75))
        self.assertIn("EC50 2.36", oyster["caveat"])  # the score row is a review's restatement of one EC50 measurement; the page says so
        alga = max(self.new[236157]["bioactivity_trace"], key=lambda i: i["adjusted"])
        self.assertEqual((alga["compound_id"], alga["target_chembl_id"], alga["standard_type"], alga["percentile"],
                          alga["link_factor"], alga["activity_factor"]), ("CHEMBL1084643", "CHEMBL2392", "Potency", 87.62, 0.75, 0.75))
        self.assertIn("qHTS", alga["caveat"])
        self.assertIn("발효", oyster["caveat"])
        # the 3.20 rule still drops the depositor's Inconclusive and Not Active rows of the new compounds
        sup = json.loads((ROOT / "research/verified-indices/snapshots/mbpi-links-supplement-2026-10-03.json").read_text(encoding="utf-8"))
        flagged = {int(k) for k, v in sup["activity_comments"].items() if (v or "").lower() in ("inconclusive", "not active", "inactive")}
        used = {x for s in self.new.values() for i in s["bioactivity_trace"] for x in i.get("activity_ids", [])}
        self.assertTrue(flagged and not flagged & used)
        # same release, and every cohort the snapshot already held keeps its total
        base = json.loads((ROOT / "research/verified-indices/snapshots/mbpi-links-2026-09-30.json").read_text(encoding="utf-8"))
        self.assertEqual(sup["chembl_version"], base["sources"]["chembl_mbpi"]["version"])
        self.assertTrue(all(base["cohorts"][k]["total"] == c["total"] for k, c in sup["cohorts"].items() if k in base["cohorts"]))
        self.assertEqual(self.report["chembl_common_taxon_limit"], self.old_report["chembl_common_taxon_limit"])
        # 꼬시래기 is no longer held; the release is recorded with the team-lead decision
        p703 = json.loads((ROOT / "research/verified-indices/mbpi-paper-links-p703-3.27-2026-10-03.json").read_text(encoding="utf-8"))
        self.assertNotIn("held", p703)
        self.assertEqual([r["aphia_id"] for r in p703["released"]], [236157])

    def test_ulva_takes_the_most_recent_range_state_list(self):
        s = self.new[234476]
        self.assertEqual((s["mcui_basis"], s["mcui_substitute"]["category"], s["mcui_substitute"]["record"]["country"]),
                         ("range_state", "LC", "Sweden"))
        self.assertIn("DD", s["mcui_substitute"]["record"]["continuity"])
        self.assertIn("distant range state", s["mcui_substitute"]["record"]["limitations"])
        self.assertIn("slu_rodlista_2025", s["source_ids"])
        # 3.26 and earlier keep reading the 3.16 file
        self.assertEqual(json.loads(V326.read_text(encoding="utf-8"))["mcui_substitutes"]["snapshot"],
                         "research/verified-indices/mcui-substitutes-3.16-2026-10-02.json")

    def test_posthoc_records_match_their_computation(self):
        import hashlib
        import posthoc_validation as P
        sets = self.report["method"]["posthoc"]["validation_sets"]
        mbpi = P.mbpi_check(self.report, self.report["method"])
        self.assertEqual((sets["MBPI"]["result"], mbpi["result"]), ("failed", "failed"))
        cases = {r["scientific_name"]: r["mbpi"] for r in mbpi["rows"]}
        self.assertEqual(cases, {"Conus magus": None, "Halichondria (Halichondria) okadai": 73.8, "Ecteinascidia turbinata": 56.1})
        self.assertEqual(sets["MBPI"]["case_mbpi"], {"Conus magus": None, "Halichondria okadai": 73.8, "Ecteinascidia turbinata": 56.1})
        self.assertEqual(sets["MBPI"]["operating_max_mbpi"], max(mbpi["operating_mbpi"].values()))
        self.assertEqual((sets["MCUI_trend"]["result"], sets["MCUI_preliminary_criterion_A"]["result"]), ("failed", "failed"))
        self.assertEqual(sets["MCUI"]["result"], "reproduced_n2")  # the MCUI axis label does not move: neither check scores MCUI
        # the stored method and result files keep the bytes their runs hashed (.gitattributes keeps the folder byte-exact)
        base = ROOT / "research/verified-indices/posthoc-3.27"
        checked = 0
        # raw OBIS/IUCN pulls the trend run hashed but the repo does not carry (third-party data; see the 3.27 record)
        uncommitted = {("mcui-obis-trend", n) for n in ("trend_results.json", "candidates.json", "jp_lists.json")}
        for folder, book in (("mcui-obis-trend", "locked.sha256"), ("mcui-obis-trend", "results.sha256"), ("mcui-criterion-a", "locked.sha256")):
            for line in (base / folder / book).read_text(encoding="utf-8").splitlines():
                parts = line.split()
                name = parts[1].lstrip("*") if len(parts) == 2 else None
                if not name or (folder, name) in uncommitted:
                    continue
                body = (base / folder / name).read_bytes()
                self.assertEqual(hashlib.sha256(body).hexdigest(), parts[0], name)
                checked += 1
        self.assertEqual(checked, 8)

    def test_nothing_else_changes(self):
        def strip(report):
            r = json.loads(render(report))
            for k in ("method_version", "generated_at", "posthoc", "method"):
                r[k] = None
            for k in ("wako_1996_squid", "slu_rodlista_2025"):
                r["sources"].pop(k, None)
            for k in ("chembl_mbpi", "pubchem_inchikey_mbpi", "wikidata_p703_lotus"):  # re-queried by the supplement
                r["sources"][k]["accessed"] = r["sources"][k]["version"] = None
            for s in r["species"] + r["candidate_species"]:
                for k in ("scores", "withheld_reasons", "score_status", "bbvi_label", "mbpi_label", "reference_combination",
                          "sensitivity", "bbvi_mbpi_from_peptide_stratum"):
                    s.pop(k, None)
                (s.get("food_trace") or {})["method_version"] = None
                if s["aphia_id"] in V327_CHANGED:
                    for k in ("bioactivity_trace", "chembl_links", "single_axis_views", "mbpi_stratum", "source_ids",
                              "information_sufficiency", "priority_survey", "priority_survey_reasons", "occurrence_trend",
                              "mcui_basis", "mcui_substitute"):
                        s.pop(k, None)
                for n in (s.get("food_trace") or {}).get("supplemental_nutrition", []):
                    if "substitute_use" in n:
                        n["substitute_use"] = n["substitute_use"].replace(report["method_version"], "VERSION")
            return r
        self.assertEqual([self.report["sources"][k]["accessed"] for k in ("chembl_mbpi", "wikidata_p703_lotus")], ["2026-10-03"] * 2)
        self.assertEqual(self.report["sources"]["chembl_mbpi"]["version"], self.old_report["sources"]["chembl_mbpi"]["version"])
        self.assertEqual(strip(self.report), strip(self.old_report))


XO328 = "research/verified-indices/evidence-xo-potency-3.28-2026-10-03.json"
V328 = ROOT / "config" / "verified-indices-v3.28.json"  # superseded by 4.0 (released set, labelled gap filling)
V40 = ROOT / "config" / "verified-indices-v4.0.json"    # superseded by 4.1 (꽃게 AMP row)
V41 = ROOT / "config" / "verified-indices-v4.1.json"    # superseded by 4.2 (sub-national MCUI basis)
V42 = ROOT / "config" / "verified-indices-v4.2.json"    # superseded by 4.3 (every cell filled, labelled fallbacks)
V43 = ROOT / "config" / "verified-indices-v4.3.json"    # superseded by 4.4 (참문어 relaxation (d))
V44 = ROOT / "config" / "verified-indices-v4.4.json"    # superseded by 4.5 (방어 sbGnRH·갑오징어 FMRFamide relaxation (d))
V45 = ROOT / "config" / "verified-indices-v4.5.json"    # superseded by 4.6 (sub-national MCUI sufficiency steps)
V46 = ROOT / "config" / "verified-indices-v4.6.json"    # superseded by 4.7 (source corrections, trace sources cited)
V47 = ROOT / "config" / "verified-indices-v4.7.json"    # superseded by 4.8 (참문어 national-list page re-check)
V48 = ROOT / "config" / "verified-indices-v4.8.json"    # superseded by 4.9 (relaxation (d) independent replication)
V49 = ROOT / "config" / "verified-indices-v4.9.json"    # superseded by 4.10 (secondary MBPI-Rx, exploratory)
V410 = ROOT / "config" / "verified-indices-v4.10.json"  # superseded by 4.11 (2026-10-13 audit: rules 1-5)
V411 = ROOT / "config" / "verified-indices-v4.11.json"  # superseded by 4.12 (MCUI stock-decline basis)
V412 = ROOT / "config" / "verified-indices-v4.12.json"  # superseded by 4.13 (2026-10-14 evidence brief)
V413 = ROOT / "config" / "verified-indices-v4.13.json"  # superseded by 4.14 (2026-10-14 method review: official MCUI only)
V414 = ROOT / "config" / "verified-indices-v4.14.json"  # superseded by 4.17 (2026-10-15 team-lead decision: preliminary MCUI)


class VerifiedPilot328Tests(unittest.TestCase):
    """Public method: 3.27 plus Chen et al. 2016's synthetic re-measurements (GKY, SKTY, FY; HHL) under the existing potency
    replication rule, read through the user's library login on 2026-10-03. 톳's top item now rests on two papers, so its MBPI
    loses the single-paper factor and its BBVI the '단일 논문' label. Nothing else moves."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V328)), build(*load_inputs(config=V327))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.28", "provisional_unvalidated"))
        # the published 3.28 report is archived as it was
        archived328 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-pilot-3.28.json"
        self.assertEqual(render(self.report), archived328.read_text(encoding="utf-8"))

    def test_hijiki_gky_and_skty_are_replicated(self):
        tot, old = self.new[494972], self.old[494972]
        self.assertEqual((old["scores"]["MBPI"], old["scores"]["BBVI"], old["bbvi_label"]), (65.0, 64.2, "단일 논문"))
        self.assertEqual((tot["scores"]["MBPI"], tot["scores"]["BBVI"], tot.get("bbvi_label"), tot.get("mbpi_label")), (86.6, 74.9, None, None))
        items = {i.get("peptide_sequence"): i for i in tot["bioactivity_trace"]}
        for seq, gap in (("GKY", 0.307), ("SKTY", 0.27)):
            (r,) = items[seq]["potency_replications"]
            self.assertEqual((r["original_paper_doi"], r["pIC50_gap"], r["used"], items[seq]["evidence_factor"]),
                             ("10.1111/jfpp.12628", gap, True, 1.0))
        self.assertEqual(items["SVY"]["evidence_factor"], 0.75)  # Chen 2016 did not measure SVY

    def test_only_hijiki_moves(self):
        moved = {a for a, s in self.new.items() if s["scores"] != self.old[a]["scores"] or s.get("bbvi_label") != self.old[a].get("bbvi_label")}
        self.assertEqual(moved, {494972})
        fy = next(i for i in self.new[145721]["bioactivity_trace"] if i.get("peptide_sequence") == "FY")
        self.assertEqual((fy["potency_replications"][0]["pIC50_gap"], fy["evidence_factor"]), (0.942, 1.0))  # not the 미역 top item
        filled = lambda rows: sum(v is not None for s in rows.values() for v in s["scores"].values())
        self.assertEqual((filled(self.old), filled(self.new)), (92, 92))

        def strip(report):
            r = json.loads(render(report))
            for k in ("method_version", "generated_at", "method"):
                r[k] = None
            r["sources"].pop("chen_2016_jfpp", None)
            for s in r["species"] + r["candidate_species"]:
                (s.get("food_trace") or {})["method_version"] = None
                for n in (s.get("food_trace") or {}).get("supplemental_nutrition", []):
                    if "substitute_use" in n:
                        n["substitute_use"] = n["substitute_use"].replace(report["method_version"], "VERSION")
                if s["aphia_id"] in (494972, 145721):
                    for k in ("bioactivity_trace", "scores", "bbvi_label", "mbpi_label", "sensitivity", "single_axis_views", "source_ids",
                              "chembl_links"):  # its rule_sensitivity restates the species MBPI
                        s.pop(k, None)
            return r
        self.assertEqual(strip(self.report), strip(self.old_report))

    def test_older_record_is_unchanged(self):
        old = json.loads((ROOT / XO325).read_text(encoding="utf-8"))
        new = json.loads((ROOT / XO328).read_text(encoding="utf-8"))
        self.assertEqual(new["potency_replications"][:len(old["potency_replications"])], old["potency_replications"])
        self.assertEqual([r["sequence"] for r in new["potency_replications"][len(old["potency_replications"]):]], ["GKY", "SKTY", "FY"])
        self.assertEqual(new["snapshot_date"], old["snapshot_date"])

    def test_mbpi_posthoc_block_matches_this_report(self):
        # 3.28 raises an operating MBPI (톳 86.6), so the published drug-origin block is re-checked against this report
        import posthoc_validation as P
        block = self.report["method"]["posthoc"]["validation_sets"]["MBPI"]
        mbpi = P.mbpi_check(self.report, self.report["method"])
        self.assertEqual((block["result"], mbpi["result"]), ("failed", "failed"))
        self.assertEqual(block["operating_max_mbpi"], max(mbpi["operating_mbpi"].values()))
        self.assertEqual(block["case_mbpi"], {"Conus magus": None, "Halichondria okadai": 73.8, "Ecteinascidia turbinata": 56.1})


V40_CHANGED = {371986: "감태", 234476: "가시파래", 372119: "우뭇가사리", 275816: "넙치", 254538: "대구"}


class Verified40Tests(unittest.TestCase):
    """Released set (team-lead decisions 2026-10-04): 3.28's rules frozen and published as 정식 산출 (status 'released'), plus
    three labelled gap-filling extensions: MFPI rows converted with other samples' fresh moisture (가시파래, 감태), MCUI from the
    Fisheries Agency of Japan 'ランク外' read as LC-equivalent (넙치, 대구) and MBPI through the Korean 'Gelidium amansii' ->
    G. elegans mapping (우뭇가사리, pheophorbide A). Also an IUCN re-check record and reviewed partial records; no score moves
    elsewhere."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V40)), build(*load_inputs(config=V328))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.0", "released"))
        # the published 4.0 report is archived as it was
        archived40 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.0.json"
        self.assertEqual(render(self.report), archived40.read_text(encoding="utf-8"))

    def test_filled_cells_and_which_species_moved(self):
        filled = lambda rows: sum(v is not None for s in rows.values() for v in s["scores"].values())
        self.assertEqual((filled(self.old), filled(self.new)), (92, 100))
        moved = {a for a, s in self.new.items() if s["scores"] != self.old[a]["scores"]}
        self.assertEqual(moved, set(V40_CHANGED))
        for a, s in self.new.items():  # a filled cell never empties and an existing value never changes
            for k, v in self.old[a]["scores"].items():
                if v is not None:
                    self.assertEqual(s["scores"][k], v, f"{V40_CHANGED.get(a, a)} {k}")
        self.assertEqual({a: self.new[a]["scores"] for a in V40_CHANGED}, {
            371986: {"BBVI": 65.0, "MBPI": 67.5, "MCUI": None, "MFPI": 62.5},
            234476: {"BBVI": 53.8, "MBPI": 73.3, "MCUI": 10.0, "MFPI": 34.2},
            372119: {"BBVI": 45.1, "MBPI": 13.5, "MCUI": 60.0, "MFPI": 76.7},
            275816: {"BBVI": 44.3, "MBPI": 29.2, "MCUI": 10.0, "MFPI": 59.4},
            254538: {"BBVI": 49.1, "MBPI": 59.9, "MCUI": 10.0, "MFPI": 38.3}})

    def test_other_sample_moisture_rows(self):
        for aphia, item, m, omitted in ((234476, "LIT:rda-L0270010001a-dried", 93.1, ["zinc_mg"]),
                                        (371986, "LIT:kawashima1983-ecklonia-cava-P18", 85.5, ["protein_g"])):
            f = self.new[aphia]["food_trace"]
            self.assertEqual((f["row_table"], f["source_food_item_id"], f["omitted_components"]), ("literature", item, omitted))
            lm = f["literature_moisture"]
            self.assertEqual((lm["kind"], lm["moisture_pct"], lm["label"]), ("other_sample", m, "수분 환산값(다른 시료)"))
            self.assertEqual(median(v["value"] for v in lm["values"]), m)
            self.assertTrue(all(n["grade"] == "literature_converted" for n in f["nutrients"].values()))
        # the 3.28 config does not allow the route, so the same rows stay out there
        self.assertIsNone(self.old[234476]["scores"]["MFPI"])

    def test_rank_out_rows(self):
        for aphia in (275816, 254538):
            sub = self.new[aphia]["mcui_substitute"]
            self.assertEqual((sub["basis"], sub["category"], sub["value"], sub["record"]["category_as_published"], sub["record"]["rank_out"]),
                             ("range_state", "LC", 10.0, "ランク外", True))
            self.assertIn("ランク外 → LC 상당", sub["pilot_mapping"])
            self.assertEqual(self.new[aphia]["mcui_basis"], "range_state")

    def test_gelidium_mbpi_link(self):
        g = self.new[372119]
        top = max(g["bioactivity_trace"], key=lambda t: t["adjusted"])
        self.assertEqual((top["compound_id"], top["standard_type"], top["link_factor"], top["activity_factor"]),
                         ("CHEMBL510103", "IC50", 0.75, 0.75))
        self.assertIn("Gelidium elegans", top["caveat"])
        self.assertIn("엽록소 분해 산물", top["caveat"])
        self.assertEqual((g["mbpi_label"], g["bbvi_label"]), ("단일 논문", "단일 논문"))

    def test_recheck_and_partials_never_score(self):
        rechecked = {a for a, s in self.new.items() if (s.get("conservation_trace") or {}).get("recheck")}
        self.assertEqual(len(rechecked), 12)
        for a in rechecked:
            r = self.new[a]["conservation_trace"]["recheck"]
            self.assertEqual((r["checked_on"], r["red_list_version"], r["result_count"]), ("2026-10-04", "2026-1", 0))
        for a in (1061762, 281273, 1666974, 534443):
            self.assertIsNone(self.new[a]["scores"]["MBPI"])
            self.assertTrue(any(p["source_id"] in ("hong_2025_ijms_mts", "chen_2023_foods_xoi", "yu_2020_md_sepia", "zhou_2025_fsi_octopus")
                                for p in self.new[a]["bioactivity_partial"]))

    def test_mbpi_posthoc_block_still_matches(self):
        import posthoc_validation as P
        block = self.report["method"]["posthoc"]["validation_sets"]["MBPI"]
        mbpi = P.mbpi_check(self.report, self.report["method"])
        self.assertEqual((block["result"], mbpi["result"]), ("failed", "failed"))
        self.assertEqual(block["operating_max_mbpi"], max(mbpi["operating_mbpi"].values()))


class Verified41Tests(unittest.TestCase):
    """4.1 (team-lead request 2026-10-04 to find ways to fill the last blanks): 꽃게 enters the AMP stratum with MCCC1-MTS.
    4.0 held the record back because the group's patent names a different crab for the same sequence; the origin is settled on
    public sequence records and the caveat travels with the value. Nothing else moves."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V41)), build(*load_inputs(config=V40))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.1", "released"))
        # the published 4.1 report is archived as it was
        archived41 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.1.json"
        self.assertEqual(render(self.report), archived41.read_text(encoding="utf-8"))

    def test_only_the_swimming_crab_moved(self):
        filled = lambda rows: sum(v is not None for s in rows.values() for v in s["scores"].values())
        self.assertEqual((filled(self.old), filled(self.new)), (100, 102))
        self.assertEqual({a for a, s in self.new.items() if s["scores"] != self.old[a]["scores"]}, {1061762})
        for a, s in self.new.items():  # a filled cell never empties and an existing value never changes
            for k, v in self.old[a]["scores"].items():
                if v is not None:
                    self.assertEqual(s["scores"][k], v, f"{a} {k}")
        self.assertEqual(self.new[1061762]["scores"], {"BBVI": 46.2, "MBPI": 30.3, "MCUI": None, "MFPI": 62.0})
        self.assertEqual((self.new[1061762]["mbpi_label"], self.new[1061762]["bbvi_label"]), ("단일 논문", "단일 논문"))

    def test_amp_row_chain_and_caveats(self):
        top = max(self.new[1061762]["bioactivity_trace"], key=lambda t: t["adjusted"])
        self.assertEqual((top["stratum_kind"], top["stratum_id"], top["evidence_factor"]),
                         ("amp", "amp-dbaasp-mic-broth-escherichia-coli", 0.75))
        self.assertEqual((top["pMIC"], top["percentile"]), (4.851, 40.44))
        self.assertGreaterEqual(top["peer_peptides"], 30)
        self.assertEqual({m["value"] for m in top["measurements"]}, {14.1})
        self.assertEqual({m["unit"] for m in top["measurements"]}, {"uM"})
        self.assertEqual({m["method"] for m in top["measurements"]}, {"broth_microdilution"})
        self.assertEqual({m["target_species"] for m in top["measurements"]}, {"Escherichia coli"})
        amp = json.loads((ROOT / "research/verified-indices/evidence-amp-4.1-2026-10-04.json").read_text(encoding="utf-8"))
        own = [r for r in amp["amp_bioactivity"] if r["origin_aphia_id"] == 1061762]
        self.assertEqual({r["target_species"] for r in own}, {"Escherichia coli", "Staphylococcus aureus"})
        for r in own:  # the origin verdict and both limits stay in the record
            self.assertIn("A0A5B7CYN9", r["origin_evidence"])
            self.assertIn("A0A8J5CHQ3", r["origin_evidence"])
            self.assertIn("KR20250095776A", r["origin_evidence"])
            self.assertIn("XP_045119878.1", r["origin_evidence"])

    def test_partial_records_lost_the_scored_one(self):
        supplement = json.loads((ROOT / "research/verified-indices/bioactivity-partial-4.1-2026-10-04.json").read_text(encoding="utf-8"))
        self.assertEqual(set(supplement["sources"]), {"chen_2023_foods_xoi", "yu_2020_md_sepia", "zhou_2025_fsi_octopus"})
        from_file = lambda rows: [r for r in rows if r["source_id"] in supplement["sources"]]
        held = {a: from_file(s.get("bioactivity_partial") or []) for a, s in self.new.items()}
        self.assertEqual({a for a, v in held.items() if v}, {281273, 1666974, 534443})  # 꽃게 is no longer among them
        for a in (281273, 1666974, 534443):
            self.assertIsNone(self.new[a]["scores"]["MBPI"])
        self.assertFalse(any(r["source_id"] == "hong_2025_ijms_mts"
                             for r in self.new[1061762].get("bioactivity_partial") or []))


class Verified42Tests(unittest.TestCase):
    """4.2 (team-lead decision 2026-10-04, the competition deadline falls before every official route): the conservation axis
    accepts an official SUB-NATIONAL red list when no national one exists. The rule and the over-statement back-test were
    pre-registered and committed before the rows were collected; the back-test result rides with every value and changes no
    score. Only 톳, 청각 and 꽃게 move; DD, regional extinction and a variety-level row give nothing."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V42)), build(*load_inputs(config=V41))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)
        self.record = json.loads((ROOT / "research/verified-indices/mcui-subnational-4.2-2026-10-04.json").read_text(encoding="utf-8"))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.2", "released"))
        # the published 4.2 report is archived as it was
        archived42 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.2.json"
        self.assertEqual(render(self.report), archived42.read_text(encoding="utf-8"))

    def test_only_three_species_move_and_nothing_else_changes(self):
        filled = lambda rows: sum(v is not None for s in rows.values() for v in s["scores"].values())
        self.assertEqual((filled(self.old), filled(self.new)), (102, 105))
        self.assertEqual({a for a, s in self.new.items() if s["scores"] != self.old[a]["scores"]}, {494972, 145086, 1061762})
        for a, s in self.new.items():
            for k, v in self.old[a]["scores"].items():
                if v is not None:
                    self.assertEqual(s["scores"][k], v, f"{a} {k}")
        self.assertEqual({a: self.new[a]["scores"]["MCUI"] for a in (494972, 145086, 1061762)},
                         {494972: 60.0, 145086: 35.0, 1061762: 35.0})
        for a in (494972, 145086, 1061762):
            self.assertEqual(self.new[a]["mcui_basis"], "sub_national")

    def test_a_sub_national_row_never_overrides_an_official_one(self):
        # every species that holds a sub-national row and an official category keeps the official basis
        listed = {p["aphia_id"] for p in self.record["backtest_pairs"]}
        self.assertTrue(listed)
        for a in listed:
            self.assertIn(self.new[a]["mcui_basis"], ("iucn", "national", "range_state"))
        self.assertEqual({r["aphia_id"] for r in self.record["sub_national"]} & listed, set())

    def test_excluded_rows_give_no_score(self):
        reasons = {r["aphia_id"]: r["excluded_reason"] for r in self.record["excluded"]}
        for aphia in (371986, 236157, 274849, 377084):  # 지역 절멸, DD 둘, 변종
            self.assertIn(aphia, reasons)
            self.assertIsNone(self.new[aphia]["scores"]["MCUI"])
        self.assertTrue(all(r["category"] is None for r in self.record["excluded"]))

    def test_median_rule_and_regions_shown(self):
        hijiki = self.new[494972]["mcui_substitute"]
        self.assertEqual([r["region"] for r in hijiki["record"]["regions"]], ["Ishikawa", "Okinawa"])
        self.assertEqual(hijiki["category"], "VU")
        self.assertEqual(subnational_category([{"category": "NT"}, {"category": "VU"}]), "NT")   # even: lower risk
        self.assertEqual(subnational_category([{"category": "VU"}, {"category": "CR"}, {"category": "CR"}]), "CR")

    def test_backtest_was_pre_registered_and_its_result_rides_along(self):
        back = self.new[494972]["mcui_substitute"]["record"]["backtest"]
        self.assertEqual(back["prereg"], "research/verified-indices/prereg-subnational-mcui-2026-10-04.md")
        self.assertTrue((ROOT / back["prereg"]).exists())
        self.assertIn(back["result"], ("passed", "failed", "inconclusive"))
        # the thresholds in the config are the registered ones and the verdict follows them
        rule = self.report["method"]["mcui_substitutes"]["sub_national"]["backtest"]
        self.assertEqual((rule["one_step_delta"], rule["two_step_delta"], rule["minimum_pairs"]), (25, 50, 5))
        recomputed = subnational_backtest(load_inputs(config=V42)[0], json.loads(V42.read_text(encoding="utf-8")))
        self.assertEqual(recomputed["result"], back["result"])
        self.assertEqual(recomputed["n"], back["n"])
        for value in ("과대평가 역검증", "역검증"):
            if value in back["label"]:
                break
        else:
            self.fail(back["label"])


class Verified43Tests(unittest.TestCase):
    """4.3 (team-lead decisions 2026-10-05, "fill every value"): pre-registered fallbacks fill the last 15 cells. MCUI: a met
    Rapid LC check scores LC-equivalent 10 only where no official list of any level gives a category, and 미역 takes the
    Primorsky Krai decree No. 272 row. MBPI: a literature-built XO peptide cohort gives 참조기 a value; species with no item in
    any stratum get the labelled floor 0. No existing value changes."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V43)), build(*load_inputs(config=V42))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.3", "released"))
        # the published 4.3 report is archived as it was
        archived43 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.3.json"
        self.assertEqual(render(self.report), archived43.read_text(encoding="utf-8"))

    def test_every_cell_is_filled_and_no_value_moves(self):
        filled = lambda rows: sum(v is not None for s in rows.values() for v in s["scores"].values())
        self.assertEqual((filled(self.old), filled(self.new)), (105, 120))
        for a, s in self.new.items():
            for k, v in self.old[a]["scores"].items():
                if v is not None:
                    self.assertEqual(s["scores"][k], v, f"{a} {k}")
            self.assertEqual(set(s["score_status"].values()), {"산출됨"}, a)
        self.assertEqual({a for a, s in self.new.items() if s["scores"] != self.old[a]["scores"]},
                         {145721, 250680, 377084, 371986, 494853, 236157, 274849, 281273, 276651, 534443, 1666974})

    def test_rapid_lc_scores_only_where_every_official_list_is_silent(self):
        rule = self.report["method"]["mcui_substitutes"]
        for a, s in self.new.items():
            if s["mcui_basis"] != "preliminary":
                continue
            sub = s["mcui_substitute"]
            self.assertEqual((sub["use"], sub["category"], s["scores"]["MCUI"]), ("scored", "LC", 10.0))
            self.assertEqual(sub["label"], rule["labels"]["preliminary"])
            self.assertEqual(sub["backtest"]["result"], "failed")
            self.assertEqual(s["conservation_trace"]["iucn_state"], "not_in_red_list")
            self.assertIsNone(s["national_assessment"])
            self.assertIsNone(self.old[a]["scores"]["MCUI"])
        self.assertEqual(sum(s["mcui_basis"] == "preliminary" for s in self.new.values()), 6)
        # official lists that name a species without a scored category (RE, DD, variety) travel with the value (review 2026-10-05)
        named = {a: [(r["region"], r["category_as_published"]) for r in s["mcui_substitute"]["record"]["official_unscored"]]
                 for a, s in self.new.items() if s["mcui_basis"] == "preliminary"}
        self.assertEqual(named[371986], [("Ibaraki", "絶滅")])
        self.assertEqual((named[236157], named[274849], named[250680]), ([("Okinawa", "情報不足（DD）")], [("Fukuoka", "DD")], []))
        for a, s in self.new.items():
            for r in s["mcui_substitute"]["record"].get("official_unscored", []) if s["mcui_basis"] == "preliminary" else []:
                self.assertIsNone(r["category"])
                if r["source_id"]:
                    self.assertIn(r["source_id"], s["source_ids"])
        # the 4.2 config keeps the check reference-only
        self.assertTrue(all(s["mcui_basis"] != "preliminary" for s in self.old.values()))

    def test_undaria_takes_the_primorsky_decree(self):
        u = self.new[145721]
        self.assertEqual((u["mcui_basis"], u["scores"]["MCUI"], u["mcui_substitute"]["category"]), ("sub_national", 80.0, "EN"))
        row = u["mcui_substitute"]["record"]["regions"][0]
        self.assertEqual((row["source_id"], row["currency_source_id"]), ("primorsky_decree272_2002", "primorsky_723pp_2022_official"))
        self.assertIn("역검증 미통과", u["mcui_substitute"]["label"])

    def test_xo_cohort_is_built_from_its_review_and_ranks_croaker(self):
        sys.path.insert(0, str(ROOT / "scripts"))
        import build_xo_cohort
        review = json.loads(build_xo_cohort.REVIEW.read_text(encoding="utf-8"))
        cohort = json.loads(build_xo_cohort.OUT.read_text(encoding="utf-8"))
        self.assertEqual(build_xo_cohort.build(review), cohort)
        self.assertGreaterEqual(cohort["size"], 30)
        self.assertFalse({"WDDMEKIW", "APPERKYSVW"} & {m["sequence"] for m in cohort["members"]})
        top = max(self.new[281273]["bioactivity_trace"], key=lambda t: t["adjusted"])
        self.assertEqual((top["stratum_kind"], top["peptide_sequence"], top["peer_peptides"]), ("xo", "WDDMEKIW", cohort["size"]))
        peers = [6 - math.log10(m["ic50_uM"]) for m in cohort["members"]]
        mine = 6 - math.log10(3160)
        rank = 100 * (sum(p < mine for p in peers) + 0.5 * sum(p == mine for p in peers)) / len(peers)
        self.assertAlmostEqual(top["percentile"], round(rank, 2))
        self.assertEqual(self.new[281273]["scores"]["MBPI"], round1(rank * 0.75))
        self.assertEqual(self.new[281273]["mbpi_label"], "단일 논문")

    def test_floor_only_where_no_item_exists(self):
        floor = self.report["method"]["mbpi_floor"]
        floored = {a for a, s in self.new.items() if s.get("mbpi_floor")}
        self.assertEqual(floored, {276651, 534443, 1666974})
        for a in floored:
            s = self.new[a]
            self.assertEqual((s["scores"]["MBPI"], s["bioactivity_trace"], s["mbpi_stratum"]), (0.0, [], "floor"))
            self.assertEqual((s["mbpi_label"], s["bbvi_label"]), (floor["label"], floor["bbvi_label"]))
            self.assertEqual(s["scores"]["BBVI"], round1(0.5 * s["scores"]["MFPI"]))
        for a, s in self.new.items():
            if a not in floored:
                self.assertIsNone(s.get("mbpi_floor"))
                self.assertTrue(s["bioactivity_trace"], a)

    def test_pre_registration_is_on_record(self):
        prereg = ROOT / "research/verified-indices/prereg-fill-all-4.3-2026-10-05.md"
        self.assertTrue(prereg.exists())
        self.assertEqual(self.report["method"]["mbpi_floor"]["prereg"], "research/verified-indices/prereg-fill-all-4.3-2026-10-05.md")

    def test_xo_cohort_ships_with_the_item_and_re_ranks(self):
        x = next(t for t in self.new[281273]["bioactivity_trace"] if t["stratum_kind"] == "xo")
        peers = [6 - math.log10(m["ic50_uM"]) for m in x["cohort_members"]]
        self.assertEqual(len(peers), x["peer_peptides"])
        self.assertNotIn(x["peptide_sequence"], {m["sequence"] for m in x["cohort_members"]})
        rank = 100 * (sum(p < x["pIC50"] for p in peers) + 0.5 * sum(p == x["pIC50"] for p in peers)) / len(peers)
        self.assertAlmostEqual(rank, x["percentile"], places=2)

    def test_floor_species_keep_their_open_bioactivity_steps(self):
        # the readiness rows moved to Verified44Tests: the current dist is the 4.4 run, where 참문어 left the floor
        for a in (276651, 534443, 1666974):
            self.assertTrue(self.new[a]["mbpi_floor"])


class Verified44Tests(unittest.TestCase):
    """4.4 (team-lead order 2026-10-05, "resolve the fallback cells"): the 4.3 one-condition relaxation (d) is applied for the
    first time. 참문어's cephalotocin (its genome encodes the mature peptide; synthetic copy, human V1b/V2 EC50) is ranked in
    the fixed ChEMBL target x endpoint cohort snapshot; MBPI 0 -> 70.5, BBVI 18.9 -> 54.2. Every other cell stays, 방어 and
    갑오징어 keep the labelled floor, and the MCUI re-check changes no value."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V44)), build(*load_inputs(config=V43))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.4", "released"))
        # the published 4.4 report is archived as it was
        archived44 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.4.json"
        self.assertEqual(render(self.report), archived44.read_text(encoding="utf-8"))

    def test_only_two_octopus_cells_move(self):
        for a, s in self.new.items():
            for k, v in self.old[a]["scores"].items():
                if a == 534443 and k in ("MBPI", "BBVI"):
                    continue
                self.assertEqual(s["scores"][k], v, (a, k))
        self.assertEqual((self.old[534443]["scores"]["MBPI"], self.old[534443]["scores"]["BBVI"]), (0.0, 18.9))
        self.assertEqual((self.new[534443]["scores"]["MBPI"], self.new[534443]["scores"]["BBVI"]), (70.5, 54.2))

    def test_relaxed_item_re_ranks_and_keeps_the_best_target(self):
        x = next(t for t in self.new[534443]["bioactivity_trace"] if t["stratum_kind"] == "relaxed")
        self.assertEqual((x["relaxation"], x["target_chembl_id"], x["standard_type"]), ("d", "CHEMBL1921", "EC50"))
        self.assertEqual(len(x["cohort_pchembl"]), x["cohort_records"])
        rank = 100 * (sum(p < x["pchembl"] for p in x["cohort_pchembl"]) + 0.5 * sum(p == x["pchembl"] for p in x["cohort_pchembl"])) / x["cohort_records"]
        self.assertAlmostEqual(rank, x["percentile"], places=2)
        self.assertEqual(x["evidence_factor"], 0.75)  # one paper
        self.assertAlmostEqual(x["adjusted"], rank * 0.75, places=9)
        # the origin is never relaxed: the species' own sequence record encodes the tested mature peptide
        self.assertIn(x["peptide_sequence"], x["origin_record"]["translation"])
        self.assertIn(x["peptide_sequence"] + "GKR", x["origin_record"]["translation"])  # amidation donor G + KR cleavage
        # the weaker target stays visible and out of the score
        self.assertEqual([t["target_chembl_id"] for t in x["other_targets"]], ["CHEMBL1790"])
        self.assertLess(x["other_targets"][0]["percentile"], x["percentile"])

    def test_floor_now_applies_to_two_species_only(self):
        # the readiness rows moved on to the 4.5 run (no floor species); this class checks its own build only
        self.assertFalse(self.new[534443]["mbpi_floor"])
        self.assertEqual(self.new[534443]["mbpi_label"], "단일 논문")
        for a in (276651, 1666974):
            self.assertTrue(self.new[a]["mbpi_floor"])

    def test_partial_records_stay_out_of_scores(self):
        for a, n in ((276651, 1), (1666974, 3)):
            fresh = [r for r in self.new[a]["bioactivity_partial"] if r["source_id"] not in
                     {r2["source_id"] for r2 in self.old[a]["bioactivity_partial"]}]
            self.assertEqual(len(fresh), n, a)
            for r in fresh:
                self.assertEqual(r["status"], "partial_only")
                self.assertGreaterEqual(len(r["missing"]), 2)


class Verified45Tests(unittest.TestCase):
    """4.5 (team-lead decision cards 2026-10-05): relaxation (d) also covers 방어 (sbGnRH, its genome's own hormone variant,
    human GnRHR binding IC50 684 nM) and 갑오징어 (FMRFamide, encoded 11 times by its own transcriptome; its own ChEMBL rows,
    best human NPFF2 Ki 6.6 nM, excluded from their cohorts). Both are clade-common peptides and say so in their caveats.
    No species of this run takes the floor; every other cell stays."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V45)), build(*load_inputs(config=V44))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.5", "released"))
        # the published 4.5 report is archived as it was
        archived45 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.5.json"
        self.assertEqual(render(self.report), archived45.read_text(encoding="utf-8"))

    def test_only_four_cells_move(self):
        for a, s in self.new.items():
            for k, v in self.old[a]["scores"].items():
                if a in (276651, 1666974) and k in ("MBPI", "BBVI"):
                    continue
                self.assertEqual(s["scores"][k], v, (a, k))
        self.assertEqual((self.new[276651]["scores"]["MBPI"], self.new[276651]["scores"]["BBVI"]), (7.5, 29.3))
        self.assertEqual((self.new[1666974]["scores"]["MBPI"], self.new[1666974]["scores"]["BBVI"]), (65.8, 54.2))

    def test_no_species_takes_the_floor_and_the_rule_stays(self):
        self.assertTrue(self.report["method"]["mbpi_floor"])
        for s in self.new.values():
            self.assertFalse(s["mbpi_floor"])

    def test_relaxed_items_re_rank_with_their_own_caveats(self):
        for a, target, n, pchembl in ((276651, "CHEMBL1855", 1844, 6.165), (1666974, "CHEMBL5952", 138, 8.18)):
            x = next(t for t in self.new[a]["bioactivity_trace"] if t["stratum_kind"] == "relaxed")
            self.assertEqual((x["relaxation"], x["target_chembl_id"]), ("d", target))
            self.assertEqual((x["cohort_records"], len(x["cohort_pchembl"]), x["pchembl"]), (n, n, pchembl))
            rank = 100 * (sum(p < x["pchembl"] for p in x["cohort_pchembl"]) + 0.5 * sum(p == x["pchembl"] for p in x["cohort_pchembl"])) / n
            self.assertAlmostEqual(rank, x["percentile"], places=2)
            self.assertEqual(x["evidence_factor"], 0.75)
            self.assertIn(x["peptide_sequence"], x["origin_record"]["translation"])
            # each relaxed item carries its own caveat naming the clade-commonness
            self.assertIn("공통", x["caveat"])
            self.assertTrue(all(m["endpoint"] == x["standard_type"] and m["target_chembl_id"] == x["target_chembl_id"]
                                for m in x["measurements"]))
        # 갑오징어: the weaker targets stay visible and out of the score
        x = next(t for t in self.new[1666974]["bioactivity_trace"] if t["stratum_kind"] == "relaxed")
        self.assertEqual([(t["target_chembl_id"], t["standard_type"]) for t in x["other_targets"]],
                         [("CHEMBL5952", "EC50"), ("CHEMBL3309", "IC50")])
        self.assertTrue(all(t["percentile"] < x["percentile"] for t in x["other_targets"]))
        # 참문어 keeps its 4.4 value and caveat wording
        o = next(t for t in self.new[534443]["bioactivity_trace"] if t["stratum_kind"] == "relaxed")
        self.assertEqual((o["pchembl"], o["percentile"], self.new[534443]["scores"]["MBPI"]), (7.999, 94.02, 70.5))
        self.assertEqual(o["caveat"], next(t for t in self.old[534443]["bioactivity_trace"]
                                           if t["stratum_kind"] == "relaxed")["caveat"])

    def test_self_rows_are_excluded_from_their_cohorts(self):
        snap = json.loads((ROOT / "research" / "verified-indices" / "snapshots" /
                           "relaxed-chembl-cohorts-4.5-2026-10-05.json").read_text(encoding="utf-8"))
        cohorts = {c["cohort_id"]: c for c in snap["cohorts"]}
        for check in snap["self_inclusion_checks"]:
            mol = check.get("molecule_chembl_id")
            if not mol:
                self.assertEqual((check["document_hits"], check["molecule_hits"]), (0, 0))
                continue
            self.assertTrue(check["excluded_activity_ids"])
            for c in cohorts.values():
                ids = {m["activity_id"] for m in c["members"]}
                self.assertFalse(ids & set(check["excluded_activity_ids"]), c["cohort_id"])
                self.assertTrue(all(m["molecule"] != mol for m in c["members"]), c["cohort_id"])

    def test_floor_rows_leave_the_readiness_steps(self):
        rows = {r["aphia_id"]: r for r in json.loads((ROOT / "dist" / "matrix-readiness.json").read_text(encoding="utf-8"))["species"]}
        for a in (276651, 534443, 1666974):
            self.assertEqual(rows[a]["bioactivity_missing_steps"], [])
            self.assertNotIn("mbpi_label", rows[a])  # the readiness label travels only with the floor



class Verified46Tests(unittest.TestCase):
    """4.6 (data audit 2026-10-08): a scored sub-national MCUI reads its information-sufficiency steps from its reviewed,
    current-edition list rows, as a range-state list does, instead of falling through to the IUCN steps (0/3). Only the
    sufficiency of 미역, 톳, 청각 and 꽃게 moves; no score, label, type or flag changes, and a Rapid LC stays open."""

    SUB = (145721, 494972, 145086, 1061762)  # 미역, 톳, 청각, 꽃게

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V46)), build(*load_inputs(config=V45))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.6", "released"))
        # the published 4.6 report is archived as it was
        archived46 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.6.json"
        self.assertEqual(render(self.report), archived46.read_text(encoding="utf-8"))

    def test_sub_national_mcui_counts_its_list_rows(self):
        self.assertEqual({a for a, s in self.new.items() if s["mcui_basis"] == "sub_national"}, set(self.SUB))
        for a in self.SUB:
            self.assertEqual(self.old[a]["information_sufficiency"]["MCUI"]["ratio"], 0.0)
            self.assertEqual(self.new[a]["information_sufficiency"]["MCUI"], {
                "required": ["assessment_record", "numeric_category", "current_check"], "ratio": 1.0, "basis": "sub_national"})
            rows = self.new[a]["mcui_substitute"]["record"]["regions"]
            self.assertTrue(all(r["reviewed"] and r["verified_in_original"] and r["species_level"] for r in rows))
        for a, s in self.new.items():  # a Rapid LC is not an official assessment: its steps stay open
            if s["mcui_basis"] == "preliminary":
                self.assertEqual(s["information_sufficiency"]["MCUI"]["ratio"], 0.0, a)

    def test_nothing_but_sufficiency_moves(self):
        for a, s in self.new.items():
            o = self.old[a]
            for k in ("scores", "score_status", "withheld_reasons", "mcui_basis", "bbvi_label", "priority_survey",
                      "priority_survey_reasons", "unexplored_candidate", "sensitivity", "mcui_substitute"):
                self.assertEqual(s[k], o[k], (a, k))
            if a not in self.SUB:
                self.assertEqual(s["information_sufficiency"], o["information_sufficiency"], a)
        mean = lambda i: round(sum(i[k]["ratio"] for k in ("MFPI", "MBPI", "MCUI")) / 3, 2)
        for a in self.SUB:
            self.assertEqual(self.new[a]["information_sufficiency"]["mean_ratio"], mean(self.new[a]["information_sufficiency"]))



class Verified47Tests(unittest.TestCase):
    """4.7 (source audit 2026-10-08): every registered source a published trace names is listed in the species' source_ids,
    and audited metadata (Crossref titles and first authors, documentation pages for dead API endpoints, missing licences,
    one unregistered DOI, one licence text per work, the RDA row parameter) is applied to the published registry only.
    No score, label, type, flag or trace value changes."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V47)), build(*load_inputs(config=V46))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.7", "released"))
        # the published 4.7 report is archived as it was
        archived47 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.7.json"
        self.assertEqual(render(self.report), archived47.read_text(encoding="utf-8"))

    def test_only_sources_move(self):
        for a, s in self.new.items():
            o = self.old[a]
            for k in set(s) | set(o):
                if k not in ("source_ids", "food_trace"):
                    self.assertEqual(s.get(k), o.get(k), (a, k))
            self.assertLessEqual(set(o["source_ids"]), set(s["source_ids"]), a)
        self.assertEqual({k for k in self.report["sources"] if self.report["sources"][k] != self.old_report["sources"].get(k)},
                         set(self.report["method"]["source_corrections"]))

    def test_every_named_source_is_cited(self):
        def named(node):
            if isinstance(node, dict):
                for k, v in node.items():
                    if k.endswith("source_id") and isinstance(v, str):
                        yield v
                    elif k.endswith("source_ids") and isinstance(v, list):
                        yield from v
                    else:
                        yield from named(v)
            elif isinstance(node, list):
                for v in node:
                    yield from named(v)
        for a, s in self.new.items():
            self.assertLessEqual({x for x in named(s) if x in self.report["sources"]}, set(s["source_ids"]), a)
        for a in (241776, 393716):  # 해삼 holotoxin and PubChem, 큰가리비 replication papers
            self.assertTrue({"yun_2018_holotoxin", "pubchem_pugrest"} <= set(self.new[a]["source_ids"]) if a == 241776
                            else {"lin_2018_chlorella", "kapel_2006_alfalfa", "nomura_2002_thresher"} <= set(self.new[a]["source_ids"]), a)

    def test_corrected_sources_are_complete(self):
        src = self.report["sources"]
        for sid in self.report["method"]["source_corrections"]:
            self.assertTrue(src[sid]["url"].startswith("https://"), sid)
            self.assertTrue(src[sid].get("license") or src[sid].get("terms"), sid)
        for sid in ("cmnpd_mbpi", "europepmc_mbpi"):
            self.assertTrue(src[sid]["license"] and src[sid]["title"], sid)
        self.assertIn("Liu H", src["zhang_2022_rockfish_ts40"]["title"])
        self.assertNotIn("Zhang M", src["zhang_2022_rockfish_ts40"]["title"])
        self.assertIn("fdNms=", src["rda_10_4_ulva_prolifera_dried"]["url"])
        self.assertIn("not registered", src["ding_2011_cjnm_qpk"]["doi_status"])



class Verified48Tests(unittest.TestCase):
    """4.8 (2026-10-08): 참문어 joined the national list on 2026-10-01 (WoRMS crosswalk), after the 2026-09-27 page re-check,
    so its current_check step stayed open. Its list and index pages were re-read and the row added; only its sufficiency moves."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V48)), build(*load_inputs(config=V47))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.8", "released"))
        # the published 4.8 report is archived as it was
        archived48 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.8.json"
        self.assertEqual(render(self.report), archived48.read_text(encoding="utf-8"))

    def test_only_octopus_sufficiency_moves(self):
        self.assertEqual(self.old[534443]["information_sufficiency"]["MCUI"]["ratio"], 0.67)
        self.assertEqual(self.new[534443]["information_sufficiency"]["MCUI"]["ratio"], 1.0)
        for a, s in self.new.items():
            for k in set(s) | set(self.old[a]):
                if k == "food_trace" or (a == 534443 and k == "information_sufficiency"):
                    continue
                self.assertEqual(s.get(k), self.old[a].get(k), (a, k))

    def test_every_scored_national_row_is_re_read(self):
        rows = self.report["method"]["national_red_list"]["page_recheck"]["rows"]
        for a, s in self.new.items():
            if s["mcui_basis"] == "national":
                self.assertIn(str(a), rows, a)
                self.assertEqual(s["information_sufficiency"]["MCUI"]["ratio"], 1.0, a)


class Verified49Tests(unittest.TestCase):
    """4.9 (prereg-4.9-2026-10-10, team-lead decision card 2026-10-10, option (가)): the ACE stratum's replication device
    (2.3 cross_origin_potency) now also reads a relaxation (d) item. Bonini 2000's human NPFF2 Ki 4.0 nM for FMRF-amide is a
    second independent paper behind 갑오징어's item, so its evidence factor goes 0.75 -> 1.0: MBPI 65.8 -> 87.7,
    BBVI 54.2 -> 65.1, the '단일 논문' label drops. The scored value, percentile and cohort do not move, and no other cell does."""

    def setUp(self):
        self.report, self.old_report = build(*load_inputs(config=V49)), build(*load_inputs(config=V48))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.old_report)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.9", "released"))
        # the published 4.9 report is archived as it was; its config has no mbpi_rx key, so no species carries one (4.10)
        archived49 = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.9.json"
        self.assertEqual(render(self.report), archived49.read_text(encoding="utf-8"))
        self.assertFalse(any("mbpi_rx" in s for s in self.new.values()))
        self.assertNotIn("MBPI_RX", self.report["method"]["posthoc"]["validation_sets"])

    def test_only_the_cuttlefish_evidence_weight_moves(self):
        self.assertEqual((self.old[1666974]["scores"]["MBPI"], self.old[1666974]["scores"]["BBVI"]), (65.8, 54.2))
        self.assertEqual((self.new[1666974]["scores"]["MBPI"], self.new[1666974]["scores"]["BBVI"]), (87.7, 65.1))
        for label in ("bbvi_label", "mbpi_label"):  # the second paper is what the '단일 논문' label was waiting for
            self.assertEqual((self.old[1666974][label], self.new[1666974].get(label)), ("단일 논문", None), label)
        self.assertEqual(self.new[1666974]["single_axis_views"], {"bioactivity_only_MBPI": 87.7, "food_only_MFPI": 42.5})
        self.assertEqual(self.old[1666974]["single_axis_views"]["food_only_MFPI"], 42.5)  # the food axis does not move
        for a, s in self.new.items():
            for k in set(s) | set(self.old[a]):
                # food_trace only carries the method_version string, and every relaxed trace gains the replication list
                # (test_other_relaxed_items_only_gain_an_empty_replication_list); 갑오징어's score, label and papers do move
                if k in ("food_trace", "bioactivity_trace") or (a == 1666974 and k in (
                        "scores", "bbvi_label", "mbpi_label", "single_axis_views", "sensitivity", "chembl_links", "source_ids")):
                    continue
                self.assertEqual(s.get(k), self.old[a].get(k), (a, k))
        # the sensitivity block follows the new MBPI, at every food weight and under both aggregations
        self.assertEqual(self.new[1666974]["sensitivity"],
                         {"food_weights": {"0.25": 76.4, "0.5": 65.1, "0.75": 53.8}, "mean_compound_sensitivity": 87.7,
                          "median_compound_sensitivity": 87.7, "range_from_aggregation": [87.7, 87.7]})
        # and so does the ChEMBL rule sensitivity, which reports the same MBPI under five loosened ChEMBL rules
        new, was = (r[1666974]["chembl_links"] for r in (self.new, self.old))
        self.assertEqual({k: v for k, v in new.items() if k != "rule_sensitivity"},
                         {k: v for k, v in was.items() if k != "rule_sensitivity"})
        self.assertEqual(set(new["rule_sensitivity"].values()), {87.7})
        self.assertEqual(set(was["rule_sensitivity"].values()), {65.8})
        # the two papers of the replication rows are the only sources any species gains
        self.assertEqual(set(self.new[1666974]["source_ids"]) - set(self.old[1666974]["source_ids"]),
                         {"bonini_2000_npff_receptors", "kotani_2001_npff_receptor"})

    def test_other_relaxed_items_only_gain_an_empty_replication_list(self):
        for a, s in self.new.items():
            if a == 1666974:
                continue
            for item, was in zip(s["bioactivity_trace"], self.old[a]["bioactivity_trace"]):
                self.assertEqual({k: v for k, v in item.items() if k in was}, was, a)
                self.assertEqual({k: v for k, v in item.items() if k not in was},
                                 {"independent_dois": sorted(d.lower() for d in was["original_paper_dois"]),
                                  "potency_replications": []} if item.get("stratum_kind") == "relaxed" else {}, a)

    def test_the_scored_value_and_its_cohort_do_not_move(self):
        new = next(t for t in self.new[1666974]["bioactivity_trace"] if t["stratum_kind"] == "relaxed")
        old = next(t for t in self.old[1666974]["bioactivity_trace"] if t["stratum_kind"] == "relaxed")
        for k in ("peptide_sequence", "stratum_id", "standard_type", "target_chembl_id", "cohort_records", "cohort_pchembl",
                  "pchembl", "percentile", "measurements", "record_ids", "original_paper_dois", "other_targets", "caveat"):
            self.assertEqual(new.get(k), old.get(k), k)
        self.assertEqual(new["measurements"][0]["value"], 6.6)  # the scored number is still the item's own Ki
        self.assertEqual((old["evidence_factor"], new["evidence_factor"]), (0.75, 1.0))
        self.assertEqual(round(new["adjusted"], 2), new["percentile"])
        self.assertEqual(round(old["adjusted"], 2), round(new["percentile"] * 0.75, 2))
        # the item's own paper plus the replication's: a used row adds its DOI and nothing else
        self.assertEqual(new["independent_dois"], ["10.1021/acs.jmedchem.0c00643", "10.1074/jbc.m004385200"])
        self.assertNotIn("independent_dois", old)
        self.assertEqual((independent_sources(old), independent_sources(new)), (1, 2))  # the label rule counts the same two

    def test_the_replication_rows_say_what_they_are(self):
        rows = next(t for t in self.new[1666974]["bioactivity_trace"] if t["stratum_kind"] == "relaxed")["potency_replications"]
        self.assertEqual([(r["original_paper_doi"], r["used"], r["p_scale"]) for r in rows],
                         [("10.1074/jbc.M004385200", True, "pKi"), ("10.1038/sj.bjp.0704038", False, "pKi")])
        used, held = rows
        self.assertEqual((used["value"], used["unit"], used["endpoint"], used["target_chembl_id"]), (4.0, "nM", "Ki", "CHEMBL5952"))
        self.assertEqual((used["p"], used["p_gap"]), (8.398, 0.218))
        self.assertLessEqual(used["p_gap"], self.report["method"]["relaxed_bioactivity"]["cross_origin_replication"]["max_p_gap"])
        self.assertIn("합성", used["origin_label"])  # a commercial synthetic peptide, not a cuttlefish sample
        self.assertIsNone(used["reason"])
        self.assertTrue(held["reason"])              # the candidate that is not counted says why, in Korean
        for r in rows:                               # and every row's paper is cited among the species' sources
            self.assertIn(r["source_id"], self.report["sources"])
            self.assertIn(r["source_id"], self.new[1666974]["source_ids"])

    def test_a_replication_can_not_become_a_value_or_an_origin(self):
        evidence, candidates, config, snapshot, taxonomy = load_inputs(config=V49)
        for r in evidence["relaxed_replications"]:
            self.assertNotIn("origin_aphia_id", r)   # a replication never carries a species origin
            self.assertNotIn("status", r)            # and is never a scorable evidence row
            self.assertTrue(r["cohort_check"])       # each one shows it is outside the item's cohort snapshot
        # a row on another sequence, target or endpoint is not a replication of this item at all
        for key, value in (("sequence", "FMRFG"), ("target_chembl_id", "CHEMBL3309"), ("endpoint", "EC50")):
            ev = copy.deepcopy(evidence)
            ev["relaxed_replications"][0][key] = value
            item = next(t for t in species(build(ev, candidates, config, snapshot, taxonomy), 1666974)["bioactivity_trace"]
                        if t["stratum_kind"] == "relaxed")
            self.assertEqual((item["evidence_factor"], item["percentile"]), (0.75, 87.68), key)
        # and a row that fails its own checks stops the build instead of being skipped quietly
        for key, value in (("reviewed", False), ("relation", ">"), ("unit", "uM"), ("value_in_text", False), ("synthetic", False),
                           ("cohort_id", "ChEMBL_37:CHEMBL5952|IC50"), ("cohort_check", ""), ("source_id", "not_registered")):
            ev = copy.deepcopy(evidence)
            ev["relaxed_replications"][0][key] = value
            with self.assertRaises(ValueError, msg=key):
                build(ev, candidates, config, snapshot, taxonomy)


class Verified410Tests(unittest.TestCase):
    """4.10 (research/verified-indices/prereg-mbpi-rx-4.10-2026-10-12.md, registered in its own commit before the code): a
    secondary, exploratory MBPI-Rx beside MBPI. It is the published MBPI rule over the items outside the two strata whose
    comparison groups collect food-protein functional peptides (AHTPDB ACE peptides, the XO peptide literature cohort);
    the 4.3 floor does not apply, so a species left without an item gets null and a reason. The MBPI post-hoc check is
    re-run with it (MBPI_RX, exploratory). No score, label, type, flag or trace value moves."""

    EXCLUDED = {"ahtpdb-ace-ic50-hhl-cushman-cheung", "xo-peptide-literature-2026-10-05"}

    @classmethod
    def setUpClass(cls):
        cls.report, cls.old_report = build(*load_inputs(config=V410)), build(*load_inputs(config=V49))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        cls.new, cls.old = rows(cls.report), rows(cls.old_report)
        cls.rule = cls.report["method"]["mbpi_rx"]
        cls.by_name = {s["korean_name"]: s for s in cls.new.values()}

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.10", "released"))
        # the published 4.10 report is archived as it was; its config has none of the 4.11 keys (Verified411Tests)
        archived = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.10.json"
        self.assertEqual(render(self.report), archived.read_text(encoding="utf-8"))
        self.assertFalse(any("mbpi_breadth" in s for s in self.new.values()))

    def test_only_mbpi_rx_and_version_strings_move(self):
        # every species object is 4.9's plus mbpi_rx; the only other change is the method_version string inside food_trace
        for a, s in self.new.items():
            rest = {k: v for k, v in s.items() if k != "mbpi_rx"}
            self.assertEqual(json.dumps(rest, ensure_ascii=False, sort_keys=True).replace("verified-4.10", "verified-4.9"),
                             json.dumps(self.old[a], ensure_ascii=False, sort_keys=True), a)
            self.assertIn("mbpi_rx", s, a)
        self.assertEqual(list(self.new), list(self.old))
        for k in set(self.report) | set(self.old_report):
            if k not in ("method_version", "method", "posthoc", "species", "candidate_species"):
                self.assertEqual(self.report[k], self.old_report.get(k), k)
        # the method gains the rule and the exploratory post-hoc block, nothing else
        method, was = self.report["method"], self.old_report["method"]
        self.assertEqual({k for k in set(method) | set(was) if method.get(k) != was.get(k)},
                         {"method_version", "changes_from", "mbpi_rx", "posthoc"})
        sets, old_sets = method["posthoc"]["validation_sets"], was["posthoc"]["validation_sets"]
        self.assertEqual({k: v for k, v in sets.items() if k != "MBPI_RX"}, old_sets)
        self.assertEqual(self.report["posthoc"], method["posthoc"])

    def test_classification_is_complete_and_fixed(self):
        classes = self.rule["classified_strata"]
        self.assertEqual(len(classes), 52)
        self.assertEqual({k for k, v in classes.items() if v == "exclude"}, self.EXCLUDED)
        self.assertEqual(set(self.rule["excluded_strata"]), self.EXCLUDED)
        self.assertEqual(set(classes.values()), {"include", "exclude"})
        used = {i["stratum_id"] for s in self.new.values() for i in s["bioactivity_trace"]}
        self.assertEqual(len(used), 33)
        self.assertLessEqual(used, set(classes))
        # every classified id is written in the pre-registration, which was committed on its own before the code
        doc = (ROOT / self.rule["prereg"]).read_text(encoding="utf-8").replace("\\|", "|")
        for sid in classes:
            self.assertIn(f"`{sid}`", doc, sid)
        self.assertEqual((self.rule["status"], self.rule["label"]), ("exploratory_secondary", "의약 후보 MBPI(보조, 탐색적)"))

    def test_mbpi_rx_is_the_mbpi_rule_without_the_excluded_strata(self):
        for a, s in self.new.items():
            rx, trace = s["mbpi_rx"], s["bioactivity_trace"]
            kept = [i for i in trace if i["stratum_id"] not in self.EXCLUDED]
            self.assertEqual(rx["excluded_item_count"], len(trace) - len(kept), a)
            if not kept:
                continue
            best = max(kept, key=lambda i: i["adjusted"])
            top = rx["top_item"]
            self.assertEqual(trace[top["trace_index"]], best, a)
            self.assertNotIn(best["stratum_id"], self.EXCLUDED, a)  # no excluded item is ever used
            self.assertEqual(rx["value"], round1(best["adjusted"]), a)
            self.assertEqual((rx["stratum_id"], rx["stratum_kind"]), (best["stratum_id"], best.get("stratum_kind", "small_molecule")), a)
            self.assertEqual((top["adjusted"], top["percentile"], top["evidence_factor"]),
                             (best["adjusted"], best["percentile"], best["evidence_factor"]), a)
            self.assertEqual(top.get("compound_id"), best.get("compound_id"), a)
            self.assertEqual(top.get("record_ids"), best.get("record_ids"), a)
            self.assertIsNone(rx["reason"], a)
            # never above MBPI, and equal to it when the top item survives
            self.assertLessEqual(rx["value"], s["scores"]["MBPI"], a)
            if max(trace, key=lambda i: i["adjusted"]) is best:
                self.assertEqual(rx["value"], s["scores"]["MBPI"], a)

    def test_null_has_a_reason_and_is_never_zero(self):
        nulls = sorted(s["korean_name"] for s in self.new.values() if s["mbpi_rx"]["value"] is None)
        self.assertEqual(nulls, sorted(["미역", "해삼", "살오징어", "바지락", "전복(종 수준)", "큰가리비", "고등어", "멸치", "참조기", "넙치", "대구"]))
        for s in self.new.values():
            rx = s["mbpi_rx"]
            if rx["value"] is None:
                self.assertEqual(rx["reason"], self.rule["reasons"]["only_excluded"], s["korean_name"])
                self.assertEqual((rx["stratum_id"], rx["stratum_kind"], rx["top_item"]), (None, None, None))
                self.assertGreater(rx["excluded_item_count"], 0)
            else:
                self.assertGreater(rx["value"], 0, s["korean_name"])  # the lowest values are 0.4 (청각) and 2.3 (가시파래)
        # no floor: a species without any item gets null and the no-item reason, not the 0-point floor
        from build_verified_indices import mbpi_rx
        self.assertEqual(mbpi_rx([], self.rule)["value"], None)
        self.assertEqual(mbpi_rx([], self.rule)["reason"], "MBPI 항목이 없습니다")

    def test_values_are_the_registered_expectations(self):
        # prereg 5.1 and 5.3, computed from the published 4.9 report before registration; the run gives the same values
        expected = {"미역": None, "해삼": None, "멍게": 13.5, "살오징어": None, "우뭇가사리": 13.5, "톳": 45.3, "홍합(참담치)": 10.1,
                    "참굴": 62.6, "다시마": 26.5, "감태": 67.5, "가시파래": 2.3, "괭생이모자반": 21.6, "꼬시래기": 49.3, "청각": 0.4,
                    "바지락": None, "전복(종 수준)": None, "큰가리비": None, "시카메굴": 13.8, "피조개": 75.0, "가리맛조개": 3.3,
                    "고등어": None, "멸치": None, "참조기": None, "넙치": None, "조피볼락": 31.7, "방어": 7.5, "대구": None,
                    "꽃게": 30.3, "참문어(동아시아 종)": 70.5, "갑오징어": 87.7}
        self.assertEqual({n: s["mbpi_rx"]["value"] for n, s in self.by_name.items()}, expected)
        # 감태 keeps its ACE item: the comparison group is one paper's five isolated compounds, not a peptide collection
        self.assertEqual(self.by_name["감태"]["mbpi_rx"]["stratum_id"], "wijesinghe-2011-cell-free-ACE-IC50")
        self.assertEqual(self.by_name["참굴"]["mbpi_rx"]["stratum_id"], "amp-dbaasp-mic-broth-staphylococcus-aureus")

    def test_an_unclassified_stratum_stops_the_build(self):
        evidence, candidates, config, snapshot, taxonomy = load_inputs(config=V410)
        for sid in ("amp-dbaasp-mic-broth-staphylococcus-aureus", "ChEMBL_37:CHEMBL247|IC50", "wijesinghe-2011-cell-free-ACE-IC50"):
            cfg = copy.deepcopy(config)
            del cfg["mbpi_rx"]["classified_strata"][sid]
            with self.assertRaisesRegex(ValueError, "not classified for MBPI-Rx", msg=sid):
                build(evidence, candidates, cfg, snapshot, taxonomy)
        # the excluded list is the classification's 'exclude' rows, never a separate list to edit after the run
        cfg = copy.deepcopy(config)
        cfg["mbpi_rx"]["excluded_strata"] = ["ahtpdb-ace-ic50-hhl-cushman-cheung"]
        with self.assertRaisesRegex(ValueError, "excluded strata differ"):
            build(evidence, candidates, cfg, snapshot, taxonomy)
        cfg = copy.deepcopy(config)
        cfg["mbpi_rx"]["classified_strata"]["xo-peptide-literature-2026-10-05"] = "maybe"
        with self.assertRaisesRegex(ValueError, "excluded strata differ"):
            build(evidence, candidates, cfg, snapshot, taxonomy)

    def test_mbpi_rx_never_reaches_scores_or_bbvi(self):
        for a, s in self.new.items():
            self.assertEqual((s["scores"], s.get("mbpi_label"), s.get("bbvi_label")),
                             (self.old[a]["scores"], self.old[a].get("mbpi_label"), self.old[a].get("bbvi_label")), a)
        # nor any other published file: the matrix, the expedition stops and page, unexplored candidates, the chatbot
        for name in ("matrix-readiness.json", "expedition-stops.json", "unexplored-candidates.json", "expedition.js", "chatbot.js", "live-data.js"):
            text = (ROOT / "dist" / name).read_text(encoding="utf-8")
            for word in ("mbpi_rx", "MBPI_RX", "MBPI-Rx", "의약 후보"):
                self.assertNotIn(word, text, name)

    def test_posthoc_rx_record_matches_its_computation(self):
        import posthoc_validation as P
        sets = self.report["method"]["posthoc"]["validation_sets"]
        block, check = sets["MBPI_RX"], P.mbpi_rx_check(self.report, self.report["method"])
        self.assertEqual((block["result"], check["result"], block["expected_result"]), ("failed", "failed", "failed"))
        self.assertEqual((block["n"], block["computed"]), (check["n"], check["computed"]))
        cases = {r["scientific_name"]: r["mbpi_rx"] for r in check["rows"]}
        self.assertEqual(cases, {"Conus magus": None, "Halichondria (Halichondria) okadai": 73.8, "Ecteinascidia turbinata": 56.1})
        self.assertEqual(block["case_mbpi"], {"Conus magus": None, "Halichondria okadai": 73.8, "Ecteinascidia turbinata": 56.1})
        self.assertEqual(block["case_mbpi"], sets["MBPI"]["case_mbpi"])  # every case item is a ChEMBL stratum
        self.assertEqual(block["operating_max_mbpi"], max(check["operating_mbpi_rx"].values()))
        self.assertEqual((block["operating_max_mbpi"], block["operating_max_species"]), (62.6, "참굴"))
        self.assertEqual(sorted(block["operating_without_value"]), sorted(check["operating_without_mbpi_rx"]))
        # the three operating species with only excluded items leave the comparison; the other five stay in it
        self.assertEqual(check["operating_without_mbpi_rx"], ["미역", "살오징어", "해삼"])
        self.assertEqual(len(check["operating_mbpi_rx"]) + len(check["operating_without_mbpi_rx"]), len(self.report["species"]))
        self.assertEqual((block["criterion"], block["cases"]), (sets["MBPI"]["criterion"], sets["MBPI"]["cases"]))
        self.assertIs(block["exploratory"], True)
        self.assertEqual(block["prereg"], self.rule["prereg"])
        self.assertTrue((ROOT / block["prereg"]).exists())
        record = json.loads((ROOT / block["record"]).read_text(encoding="utf-8"))
        self.assertEqual((record["report_version"], record["MBPI_RX"]), ("verified-4.10", check))
        self.assertNotIn("미통과", block["reason"])  # neutral wording (2026-10-08)
        # the axis checks keep their own results; the exploratory block is never one of them
        self.assertEqual((sets["MBPI"]["result"], sets["MFPI"]["result"]), ("failed", "passed"))


class Verified411Tests(unittest.TestCase):
    """4.11 (research/verified-indices/prereg-4.11-2026-10-13.md, registered in its own commit before the code; team-lead
    decision 2026-10-13 after the data audit): (1) a potency replication joins independent_dois only when it measured a
    purified isolate of the scored species itself; peptides of three residues or fewer carry a caveat; (2) the small-molecule
    stratum needs 30 compounds like every other stratum; (3) mbpi_breadth beside MBPI (exploratory, display only); (4) a
    sub-national list whose back-test did not pass is reference only; (5) a Rapid LC is not scored at a reporting-rate ratio at
    or below the decline ratio, and the OBIS +10 adjustment is suspended."""

    @classmethod
    def setUpClass(cls):
        cls.inputs = load_inputs(config=V411)
        cls.report, cls.old_report = build(*cls.inputs), build(*load_inputs(config=V410))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        cls.new, cls.old = rows(cls.report), rows(cls.old_report)
        cls.by_name = {s["korean_name"]: s for s in cls.new.values()}

    def rebuild(self, edit):
        evidence, candidates, config, snapshot, taxonomy = self.inputs
        cfg = copy.deepcopy(config)
        edit(cfg)
        return {s["korean_name"]: s for r in [build(evidence, candidates, cfg, snapshot, taxonomy)]
                for s in r["species"] + r["candidate_species"]}

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.11", "released"))
        # the published 4.11 report is archived as it was; its config has none of the 4.12 keys (Verified412Tests)
        archived = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.11.json"
        self.assertEqual(render(self.report), archived.read_text(encoding="utf-8"))
        self.assertFalse(any("stock_decline" in s for s in self.new.values()))

    def test_values_are_the_registered_expectations(self):
        # prereg 6, computed by hand from the published 4.10 report before registration (BBVI there from rounded MBPI,
        # so 감태 59.6, 큰가리비 41.5 and 갑오징어 54.1 come out 59.7, 41.6 and 54.2 from the unrounded value)
        moved = {"미역": ((89.2, 68.0, 10.0), None, "preliminary"), "톳": ((65.0, 64.2, 10.0), "단일 논문", "preliminary"),
                 "참굴": ((72.2, 71.9, 10.0), "단일 논문", "national"), "큰가리비": ((27.3, 41.6, 10.0), "단일 논문", "national"),
                 "갑오징어": ((65.8, 54.2, 10.0), "단일 논문", "national"), "감태": ((56.8, 59.7, 10.0), "단일 논문", "preliminary"),
                 "청각": ((0.4, 18.6, 10.0), "단일 논문", "preliminary"), "꽃게": ((30.3, 46.2, 10.0), "단일 논문", "preliminary"),
                 "멍게": ((13.5, 33.2, None), "단일 논문", None), "살오징어": ((56.9, 51.5, 10.0), "단일 논문", "iucn"),
                 "멸치": ((22.6, 48.3, 10.0), "단일 논문", "iucn"), "참조기": ((53.8, 46.6, 10.0), "단일 논문", "iucn"),
                 "가리맛조개": ((56.9, 57.3, 10.0), "단일 논문", "national")}
        for name, (scores, label, basis) in moved.items():
            s = self.by_name[name]
            self.assertEqual((tuple(s["scores"][k] for k in ("MBPI", "BBVI", "MCUI")), s["bbvi_label"], s["mcui_basis"]),
                             (scores, label, basis), name)
        # every other species keeps its 4.10 scores, labels and basis; MFPI never moves
        for a, s in self.new.items():
            self.assertEqual(s["scores"]["MFPI"], self.old[a]["scores"]["MFPI"], a)
            if s["korean_name"] not in moved:
                for k in ("scores", "bbvi_label", "mbpi_label", "mcui_basis"):
                    self.assertEqual(s.get(k), self.old[a].get(k), (s["korean_name"], k))
        # only 미역 keeps a top item on two independent papers, through its own purified VW
        self.assertEqual(sorted(s["korean_name"] for s in self.new.values() if s["bbvi_label"] is None), ["미역"])

    def test_only_a_purified_isolate_of_the_species_counts_as_an_independent_paper(self):
        rule = self.report["method"]["bioactivity"]["replication_origin_rule"]
        self.assertEqual(rule["same_origin_isolates"], {"10.1016/j.jnutbio.2003.11.004:Table1:VW-purified": 145721})
        seen = 0
        for a, s in self.new.items():
            for item in s["bioactivity_trace"]:
                for r in item.get("potency_replications", []):
                    seen += 1
                    if r["used"]:
                        self.assertEqual(rule["same_origin_isolates"].get(r["record_id"]), a, (a, r["record_id"]))
                        self.assertEqual(r.get("material"), "purified_isolate")
                    elif r["reason"] == rule["reason"]:
                        self.assertNotEqual(rule["same_origin_isolates"].get(r["record_id"]), a)
                if "independent_dois" in item:  # the label rule counts the item's own papers plus used rows only
                    self.assertEqual(item["independent_dois"], sorted({d.lower() for d in item["original_paper_dois"]}
                                     | {r["original_paper_doi"].lower() for r in item["potency_replications"] if r["used"]}))
        self.assertEqual(seen, 18)
        # the same wakame row is another organism for 큰가리비's VW
        vw = next(i for i in self.by_name["큰가리비"]["bioactivity_trace"] if i.get("peptide_sequence") == "VW")
        wakame = next(r for r in vw["potency_replications"] if "jnutbio" in r["record_id"])
        self.assertEqual((wakame["used"], wakame["reason"]), (False, rule["reason"]))
        # without the rule the 4.10 values come back
        old = self.rebuild(lambda c: c["bioactivity"].pop("replication_origin_rule"))
        self.assertEqual({n: old[n]["scores"]["MBPI"] for n in ("참굴", "톳", "큰가리비", "갑오징어")},
                         {"참굴": 96.3, "톳": 86.6, "큰가리비": 36.4, "갑오징어": 87.7})

    def test_short_peptides_carry_the_specificity_caveat(self):
        note = self.report["method"]["bioactivity"]["specificity_note"]
        flagged = set()
        for s in self.new.values():
            for item in s["bioactivity_trace"]:
                seq = item.get("peptide_sequence") or ""
                if seq and len(seq) <= note["max_residues"]:
                    self.assertTrue(item["caveat"].endswith(note["caveat"]), (s["korean_name"], seq))
                    flagged.add(seq)
                else:
                    self.assertNotIn(note["caveat"], item.get("caveat") or "", (s["korean_name"], seq))
        self.assertLessEqual({"IW", "VW", "LQP", "GKY", "KAF", "AMN", "VQY"}, flagged)
        self.assertNotIn("FMRF", flagged)  # four residues; its own caveat already says it is a shared neuropeptide

    def test_the_small_molecule_stratum_needs_thirty_compounds(self):
        self.assertEqual(self.report["method"]["bioactivity"]["minimum_compounds_per_stratum"], 30)
        used = {i["stratum_id"] for s in self.new.values() for i in s["bioactivity_trace"]}
        self.assertNotIn("wijesinghe-2011-cell-free-ACE-IC50", used)
        ecklonia = self.by_name["감태"]
        self.assertEqual((ecklonia["mbpi_stratum"], ecklonia["mbpi_rx"]["value"]), ("chembl", 56.8))
        old = self.rebuild(lambda c: c["bioactivity"].update(minimum_compounds_per_stratum=3))
        self.assertEqual(old["감태"]["scores"]["MBPI"], 67.5)

    def test_mbpi_breadth_is_display_only(self):
        for s in self.new.values():
            ranked = sorted((i["adjusted"] for i in s["bioactivity_trace"]), reverse=True)
            b = s["mbpi_breadth"]
            self.assertEqual(b, {"item_count": len(ranked), "median": round1(median(ranked)),
                                 "top2_mean": round1(sum(ranked[:2]) / len(ranked[:2])), "exploratory": True}, s["korean_name"])
            self.assertEqual(s["scores"]["MBPI"], round1(ranked[0]))  # MBPI is still the top item
        for name in ("matrix-readiness.json", "expedition-stops.json", "unexplored-candidates.json", "chatbot.js", "expedition.js"):
            self.assertNotIn("mbpi_breadth", (ROOT / "dist" / name).read_text(encoding="utf-8"), name)

    def test_a_sub_national_list_that_failed_its_back_test_is_reference_only(self):
        refs = {s["korean_name"]: s["mcui_substitute"] for s in self.new.values() if (s.get("mcui_substitute") or {}).get("sub_national_reference")}
        self.assertEqual(sorted(refs), sorted(["미역", "톳", "청각", "꽃게"]))
        self.assertFalse(any(s["mcui_basis"] == "sub_national" for s in self.new.values()))
        for name, sub in refs.items():
            ref = sub["sub_national_reference"]
            self.assertEqual((ref["use"], ref["value"], ref["backtest"]["result"]), ("reference_only", None, "failed"), name)
            self.assertEqual((sub["basis"], sub["use"], sub["value"]), ("preliminary", "scored", 10.0), name)
            self.assertLessEqual(set(ref["source_ids"]), set(sub["source_ids"]))
        self.assertEqual(refs["미역"]["sub_national_reference"]["chosen_category"], "EN")
        # the alternative-production quadrant lost the two sub-national species; since 4.12 it holds only 살오징어, placed by
        # the stock-decline signal (Verified412Tests)
        matrix = json.loads((ROOT / "dist" / "matrix-readiness.json").read_text(encoding="utf-8"))
        types = {s["korean_name"]: s["matrix_type"] for s in matrix["species"]}
        self.assertEqual([n for n, t in types.items() if t == "alternative_production"], ["살오징어"])
        # 4.14 (prereg-4.14 3) made their Rapid LC a reference; 4.17 (prereg-4.17 2) scores it again as a preliminary
        # assessment, so 미역·톳 are typed by their Rapid LC, never by the failed sub-national list (29 points)
        self.assertEqual((types["미역"], types["톳"]), ("sustainable_use", "sustainable_use"))
        self.assertEqual(matrix["matrix_points"], 29)

    def test_a_fall_to_the_decline_ratio_blocks_rapid_lc(self):
        ascidian = self.by_name["멍게"]
        sub, trend = ascidian["mcui_substitute"], ascidian["occurrence_trend"]
        self.assertEqual((trend["class"], trend["reporting_rate_ratio"]), ("undetermined", 0.655))
        self.assertEqual((sub["result"], sub["value"], sub["basis"]), ("decline_ratio_reached", None, None))
        self.assertEqual((ascidian["scores"]["MCUI"], ascidian["withheld_reasons"]["MCUI"]), (None, "not_in_red_list"))
        self.assertEqual(ascidian["priority_survey_reasons"], ["no_conservation_assessment"])
        # every scored Rapid LC sits above the decline ratio
        ratio = self.report["method"]["conservation"]["trend"]["decline_ratio"]
        for s in self.new.values():
            if s["mcui_basis"] == "preliminary":
                self.assertGreater(s["occurrence_trend"]["reporting_rate_ratio"], ratio, s["korean_name"])

    def test_the_trend_adjustment_is_suspended(self):
        self.assertEqual(self.report["method"]["conservation"]["effort_adjustment"], 0)
        self.assertEqual(self.report["method"]["conservation"]["effort_adjustment_suspended"]["previous_value"], 10)
        signals = sorted(s["korean_name"] for s in self.new.values() if s["occurrence_trend"]["class"] == "decline_signal")
        self.assertEqual(signals, sorted(["살오징어", "가리맛조개", "멸치", "참조기"]))
        for s in self.new.values():
            self.assertEqual(s["occurrence_trend"]["mcui_adjustment"], 0, s["korean_name"])
            self.assertEqual(s["occurrence_trend"]["mcui_base"], s["scores"]["MCUI"], s["korean_name"])

    def test_posthoc_mbpi_record_matches_its_computation(self):
        import posthoc_validation as P
        block, check = self.report["method"]["posthoc"]["validation_sets"]["MBPI"], P.mbpi_check(self.report, self.report["method"])
        self.assertEqual((block["result"], check["result"]), ("failed", "failed"))
        self.assertEqual(block["operating_max_mbpi"], max(check["operating_mbpi"].values()))
        self.assertEqual((block["operating_max_mbpi"], block["operating_max_species"]), (89.2, "미역"))
        record = json.loads((ROOT / block["record"]).read_text(encoding="utf-8"))
        self.assertEqual((record["report_version"], record["MBPI"]), ("verified-4.11", check))
        rx = self.report["method"]["posthoc"]["validation_sets"]["MBPI_RX"]
        self.assertEqual(rx["operating_max_mbpi"], max(P.mbpi_rx_check(self.report, self.report["method"])["operating_mbpi_rx"].values()))


class Verified412Tests(unittest.TestCase):
    """4.12 (research/verified-indices/prereg-4.12-2026-10-14.md, registered in its own commit before the code; LKH's request
    2026-10-14): a second MCUI basis from the KOSIS DT_1EW0004 coastal catch (2015~2024). D = 1 - mean(2022~24) / mean(2015~17);
    30·50·80% give 35·60·80 points (a broader item is capped at 60); an item mostly farmed (share >= 50%), with a baseline
    under 100 t or with three or more blank years gets no score. MCUI = max(extinction-risk value, stock-decline score)."""

    # prereg 4: match level, D (%), recent aquaculture share (%), score, unscored reason
    TABLE = {"미역": ("broader", -39.4, 99.3, None, "aquaculture_dominant"), "해삼": ("broader", 23.3, 0.3, None, None),
             "멍게": ("species", 19.0, 94.6, None, "aquaculture_dominant"), "살오징어": ("species", 79.8, 0.0, 60.0, None),
             "우뭇가사리": ("species", 90.2, 0.0, 80.0, None), "톳": ("species", 74.5, 97.8, None, "aquaculture_dominant"),
             "홍합(참담치)": ("broader", 66.2, 99.2, None, "aquaculture_dominant"),
             "참굴": ("broader", -18.3, 94.0, None, "aquaculture_dominant"),
             "다시마": ("broader", -129.3, 100.0, None, "aquaculture_dominant"), "감태": ("none", None, None, None, "no_match"),
             "가시파래": ("broader", 69.6, 96.3, None, "aquaculture_dominant"), "괭생이모자반": ("none", None, None, None, "no_match"),
             "꼬시래기": ("broader", 83.5, 0.0, None, "small_catch"), "청각": ("species", 31.6, 97.1, None, "aquaculture_dominant"),
             "바지락": ("species", -37.7, 37.6, None, None), "전복(종 수준)": ("broader", 23.0, 99.6, None, "aquaculture_dominant"),
             "큰가리비": ("broader", -5.1, 99.7, None, "aquaculture_dominant"),
             "시카메굴": ("broader", -18.3, 94.0, None, "aquaculture_dominant"),
             "피조개": ("species", -41.1, 88.2, None, "aquaculture_dominant"), "가리맛조개": ("broader", 14.5, 0.0, None, None),
             "고등어": ("species", 3.5, 0.2, None, None), "멸치": ("species", 29.0, 0.0, None, None),
             "참조기": ("species", 31.4, 0.3, 35.0, None), "넙치": ("broader", 1.6, 91.9, None, "aquaculture_dominant"),
             "조피볼락": ("species", 31.9, 90.8, None, "aquaculture_dominant"), "방어": ("broader", -74.0, 3.1, None, None),
             "대구": ("species", 2.6, 0.0, None, None), "꽃게": ("species", -69.9, 0.0, None, None),
             "참문어(동아시아 종)": ("broader", 7.4, 0.0, None, None), "갑오징어": ("broader", -28.6, 0.0, None, None)}
    MOVED = {"살오징어": (10.0, 60.0), "우뭇가사리": (60.0, 80.0), "참조기": (10.0, 35.0)}

    @classmethod
    def setUpClass(cls):
        cls.inputs = load_inputs(config=V412)
        cls.report, cls.old_report = build(*cls.inputs), build(*load_inputs(config=V411))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        cls.new, cls.old = rows(cls.report), rows(cls.old_report)
        cls.rule = cls.report["method"]["mcui_stock_decline"]
        cls.by_name = {s["korean_name"]: s for s in cls.new.values()}

    def rebuild(self, edit_config=None, edit_evidence=None):
        evidence, candidates, config, snapshot, taxonomy = self.inputs
        cfg, ev = copy.deepcopy(config), copy.deepcopy(evidence)
        if edit_config:
            edit_config(cfg)
        if edit_evidence:
            edit_evidence(ev)
        return build(ev, candidates, cfg, snapshot, taxonomy)

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.12", "released"))
        # the published 4.12 report is archived as it was; 4.13 adds the 넙치 AMP rows (Verified413Tests)
        archived = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.12.json"
        self.assertEqual(render(self.report), archived.read_text(encoding="utf-8"))
        self.assertEqual(self.rule["prereg"], "research/verified-indices/prereg-4.12-2026-10-14.md")
        self.assertTrue((ROOT / self.rule["prereg"]).exists())
        self.assertIn(self.rule["source"]["id"], self.report["sources"])

    def test_values_are_the_registered_table(self):
        self.assertEqual(len(self.new), 30)
        got = {s["korean_name"]: tuple(s["stock_decline"][k] for k in ("match_level", "decline_pct", "aquaculture_share_recent_pct",
                                                                          "score", "unscored_reason")) for s in self.new.values()}
        self.assertEqual(got, self.TABLE)
        for s in self.new.values():
            d = s["stock_decline"]
            self.assertEqual((d["not_iucn"], d["stock_assessment"], d["source_id"]), (True, "확인 전", self.rule["source"]["id"]))
            self.assertEqual(d["label"], next(b["label"] for b in self.rule["bands"] if b["score"] == d["score"]) if d["score"]
                             else self.rule["labels"][d["unscored_reason"] or "no_signal"], s["korean_name"])
            # the record names its source even when no item matches (4.7: every source a trace names is cited)
            self.assertIn(self.rule["source"]["id"], s["source_ids"], s["korean_name"])

    def test_only_three_mcui_values_move_and_nothing_else(self):
        for a, s in self.new.items():
            old, name = self.old[a], s["korean_name"]
            self.assertEqual(s["mcui_extinction_risk"], old["scores"]["MCUI"], name)
            if name in self.MOVED:
                self.assertEqual((old["scores"]["MCUI"], s["scores"]["MCUI"], s["mcui_driver"]), (*self.MOVED[name], "stock_decline"))
            else:
                self.assertEqual(s["scores"]["MCUI"], old["scores"]["MCUI"], name)
                self.assertNotEqual(s["mcui_driver"], "stock_decline", name)
            for k in ("MFPI", "MBPI", "BBVI"):
                self.assertEqual(s["scores"][k], old["scores"][k], (name, k))
            for k in ("mcui_basis", "conservation_label", "bbvi_label", "mbpi_label", "mcui_substitute", "occurrence_trend"):
                self.assertEqual(s.get(k), old.get(k), (name, k))
        # 멍게 still has no MCUI: its KOSIS item is mostly farmed
        self.assertEqual((self.by_name["멍게"]["scores"]["MCUI"], self.by_name["멍게"]["mcui_driver"]), (None, None))

    def test_matrix_moves_only_the_squid(self):
        # from this version's own report (the committed matrix file is 4.13's; Verified413Tests reads that)
        import build_matrix_readiness as M
        rule, counts = self.report["method"]["matrix"], {}
        kind = lambda s: M.matrix_type(s["scores"], rule) if None not in (s["scores"]["BBVI"], s["scores"]["MCUI"]) else None
        for s in self.new.values():
            counts[kind(s)] = counts.get(kind(s), 0) + 1
        self.assertEqual(counts, {"baseline_survey": 14, "sustainable_use": 11, "conservation_priority": 3,
                                  "alternative_production": 1, None: 1})
        self.assertEqual(kind(self.by_name["살오징어"]), "alternative_production")
        self.assertEqual(sum(v for k, v in counts.items() if k), 29)

    def test_broader_links_are_capped_and_the_reasons_come_in_order(self):
        level = lambda name: next(a for a, s in self.new.items() if s["korean_name"] == name)
        def relink(name, **edit):
            return lambda ev: ev["stock_decline"]["mapping"][level(name)].update(edit)
        rows = lambda r: {s["korean_name"]: s for s in r["species"] + r["candidate_species"]}
        # 우뭇가사리 read as a broader item keeps 60 (capped), not 80; its MCUI is then its extinction-risk 60, a tie
        agar = rows(self.rebuild(edit_evidence=relink("우뭇가사리", match_level="broader")))["우뭇가사리"]
        self.assertEqual((agar["stock_decline"]["score"], agar["stock_decline"]["capped_broader"], agar["scores"]["MCUI"], agar["mcui_driver"]),
                         (60.0, True, 60.0, "tie"))
        # an item mostly farmed is never scored, whatever its decline (톳 −74.5%)
        self.assertEqual(self.by_name["톳"]["stock_decline"]["score"], None)
        # a lower aquaculture limit is the only thing that would let 바지락 (37.6%) be judged on its catch; it rose, so no signal
        clam = rows(self.rebuild(edit_config=lambda c: c["mcui_stock_decline"].update(aquaculture_share_max=0.3)))["바지락"]
        self.assertEqual(clam["stock_decline"]["unscored_reason"], "aquaculture_dominant")

    def test_the_inputs_are_checked(self):
        from build_verified_indices import read_stock_decline
        self.assertEqual(len(read_stock_decline(self.rule)["mapping"]), 30)
        with self.assertRaisesRegex(ValueError, "KOSIS table lacks"):
            read_stock_decline({**self.rule, "reference_column": "2026p"})
        with self.assertRaisesRegex(ValueError, "KOSIS table lacks"):
            read_stock_decline({**self.rule, "years": [2014, 2024]})
        evidence, candidates, config, snapshot, taxonomy = self.inputs
        ev = copy.deepcopy(evidence)
        ev["stock_decline"]["mapping"].pop(next(iter(ev["stock_decline"]["mapping"])))
        with self.assertRaises(ValueError):
            build(ev, candidates, config, snapshot, taxonomy)

    def test_without_the_rule_the_411_scores_come_back(self):
        old = self.rebuild(edit_config=lambda c: c.pop("mcui_stock_decline"))
        for s in old["species"] + old["candidate_species"]:
            self.assertEqual(s["scores"], self.old[s["aphia_id"]]["scores"], s["korean_name"])
            self.assertNotIn("stock_decline", s)

    def test_posthoc_is_a_same_data_consistency_check(self):
        block = self.report["method"]["posthoc"]["validation_sets"]["MCUI_stock_decline"]
        self.assertEqual(block["result"], "consistent_same_data")
        self.assertIn("독립 검증 아님", block["result_label"])
        ranked = sorted((s["scores"]["MCUI"] for s in self.new.values() if s["scores"]["MCUI"] is not None), reverse=True)
        squid = self.by_name["살오징어"]["scores"]["MCUI"]
        self.assertEqual((block["cases"]["살오징어"]["mcui_rank"], block["cases"]["살오징어"]["of"]), (ranked.index(squid) + 1, len(ranked)))
        self.assertEqual((ranked.index(squid) + 1, len(ranked)), (4, 29))
        for name in ("고등어", "대구"):
            self.assertIsNone(self.by_name[name]["stock_decline"]["score"], name)
        # the stock-decline score never changes the OBIS trend adjustment, which stays suspended
        self.assertEqual(self.report["method"]["conservation"]["effort_adjustment"], 0)


class Verified413Tests(unittest.TestCase):
    """4.13 (research/verified-indices/prereg-4.13-2026-10-14.md, registered in its own commit before the inputs): the
    2026-10-14 evidence brief, re-verified against the DOI originals. No rule changed. The AMP supplement gains the four
    cohort targets of 넙치 P35 (Xu, Yuan & Sun 2022, read in full text); seven records this run could not verify in the
    original text, or that the fixed rules do not cover, join the partial supplement and score nothing; three compound
    caveats gain their original-measurement sources."""

    @classmethod
    def setUpClass(cls):
        cls.inputs = load_inputs(config=V413)
        cls.report, cls.old_report = build(*cls.inputs), build(*load_inputs(config=V412))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        cls.new, cls.old = rows(cls.report), rows(cls.old_report)
        cls.by_name = {s["korean_name"]: s for s in cls.new.values()}

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.13", "released"))
        # the published 4.13 report is archived as it was (superseded by 4.14)
        archived = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.13.json"
        self.assertEqual(render(self.report), archived.read_text(encoding="utf-8"))

    def test_values_are_the_registered_expectations(self):
        # prereg 7: only 넙치 moves, and the rest of the report is 4.11's
        flounder = self.by_name["넙치"]
        self.assertEqual(flounder["scores"], {"MFPI": 59.4, "MBPI": 43.2, "MCUI": 10.0, "BBVI": 51.3})
        self.assertEqual((flounder["mbpi_stratum"], flounder["bbvi_label"]), ("amp", "단일 논문"))
        self.assertEqual(flounder["sensitivity"]["food_weights"], {"0.25": 47.3, "0.5": 51.3, "0.75": 55.3})
        self.assertEqual(flounder["mbpi_breadth"], {"exploratory": True, "item_count": 6, "median": 35.9, "top2_mean": 40.9})
        for a, s in self.new.items():
            if s["korean_name"] != "넙치":
                for k in ("scores", "bbvi_label", "mbpi_label", "mbpi_stratum", "mcui_basis", "mbpi_breadth"):
                    self.assertEqual(s.get(k), self.old[a].get(k), (s["korean_name"], k))

    def test_the_four_scored_p35_rows_are_the_cohort_targets_read_in_the_paper(self):
        items = [i for i in self.by_name["넙치"]["bioactivity_trace"] if i.get("peptide_name") == "P35"]
        self.assertEqual({i["target_species"].split(" (")[0] for i in items},
                         {"Staphylococcus aureus", "Escherichia coli", "Vibrio anguillarum", "Bacillus subtilis"})
        for i in items:
            self.assertEqual(i["stratum_kind"], "amp")
            self.assertEqual(i["original_paper_dois"], ["10.3390/ijms232112722"])
            self.assertEqual(i["evidence_factor"], self.report["method"]["bioactivity"]["single_doi_factor"])
            self.assertGreaterEqual(i["peer_peptides"], self.report["method"]["amp_bioactivity"]["minimum_peptides"])
            self.assertEqual([m["unit"] for m in i["measurements"]], ["uM"])
        top = max(items, key=lambda i: i["adjusted"])
        self.assertEqual((top["target_species"].split(" (")[0], top["measurements"][0]["value"]), ("Vibrio anguillarum", 5))
        self.assertEqual(round(top["adjusted"], 1), 43.2)

    def test_the_matrix_file_moves_only_the_flounder(self):
        # the 4.13 matrix, rebuilt from the 4.13 report (the published file is 4.14 now)
        from build_matrix_readiness import build as build_matrix
        read = lambda name: json.loads((ROOT / "dist" / name).read_text(encoding="utf-8"))
        matrix = build_matrix(self.report, read("candidate-catalog.json"), read("expansion-evidence.json"))
        counts = {}
        for s in matrix["species"]:
            counts[s["matrix_type"]] = counts.get(s["matrix_type"], 0) + 1
        self.assertEqual(counts, {"baseline_survey": 13, "sustainable_use": 12, "conservation_priority": 3,
                                  "alternative_production": 1, None: 1})
        self.assertEqual(next(s["matrix_type"] for s in matrix["species"] if s["korean_name"] == "넙치"), "sustainable_use")
        self.assertEqual(matrix["matrix_points"], 29)

    def test_the_rows_outside_the_four_cohorts_are_recorded_as_excluded(self):
        rows = json.loads((ROOT / "research/verified-indices/evidence-amp-4.13-2026-10-14.json").read_text(encoding="utf-8"))
        self.assertEqual(rows["snapshot_date"], "2026-10-14")
        excluded = " ".join(e["reason"] + e["record"] for e in rows["excluded"])
        for name in ("Micrococcus luteus", "Bacillus cereus", "TP25", "mSshep 1", "RpdefB"):
            self.assertIn(name, excluded)
        # 4.1's rows are carried over unchanged
        old = json.loads((ROOT / "research/verified-indices/evidence-amp-4.1-2026-10-04.json").read_text(encoding="utf-8"))
        self.assertEqual(rows["amp_bioactivity"][:len(old["amp_bioactivity"])], old["amp_bioactivity"])

    def test_the_new_partial_records_score_nothing_and_keep_their_missing_step(self):
        added = {"가시파래": 1, "대구": 1, "참굴": 2, "조피볼락": 1, "넙치": 1, "바지락": 1}
        for name, more in added.items():
            new, old = self.by_name[name], self.old[self.by_name[name]["aphia_id"]]
            self.assertEqual(len(new["bioactivity_partial"]), len(old["bioactivity_partial"]) + more, name)
            if name != "넙치":  # 넙치's MBPI moves on the scored P35 rows, never on its partial TP25 record
                self.assertEqual(new["scores"]["MBPI"], old["scores"]["MBPI"], name)
        for s in self.new.values():
            for r in s["bioactivity_partial"]:
                self.assertEqual(r["status"], "partial_only")
                self.assertFalse(all(r["chain"].values()), r["record_id"])
        # the TP25 row says why a buffer MIC is not a broth MIC; the 참굴 row why a market sample is not an origin
        tp25 = next(r for r in self.by_name["넙치"]["bioactivity_partial"] if "TP25" in r["record_id"])
        self.assertFalse(tp25["chain"]["comparable_cohort"])
        oyster = next(r for r in self.by_name["참굴"]["bioactivity_partial"] if "379234" in r["record_id"])
        self.assertFalse(oyster["chain"]["origin"])

    def test_the_caveats_name_their_original_measurement(self):
        caveats = self.report["method"]["chembl_bioactivity"]["compound_caveats"]
        self.assertIn("10.3390/ijms22126481", caveats["SUCKEYMKNGZJHK-ZARIWKGHSA-N"])
        self.assertIn("10.1002/cbdv.200890044", caveats["USBWYUYKHHILLZ-UHFFFAOYSA-N"])
        self.assertIn("10.3390/d14100826", caveats["NSFSLUUZQIAOOX-QEWKCGBTSA-N"])
        for key, text in caveats.items():  # a caveat is shown with its item and changes no score
            self.assertNotIn("미통과", text)
        shown = {k for s in self.new.values() for i in s["bioactivity_trace"] if i.get("caveat") for k in i.get("inchikeys", [])}
        self.assertIn("SUCKEYMKNGZJHK-ZARIWKGHSA-N", shown)


class Verified414Tests(unittest.TestCase):
    """4.14 (research/verified-indices/prereg-4.14-2026-10-14.md, registered in its own commit before the code; LKH's method review
    2026-10-14): the extinction-risk part of MCUI comes only from an IUCN global or Korean national category. Another region's list
    and the Rapid LC check stay as references with no number, type or map colour; a stock decline alone counts only as a lower
    bound at or above the matrix line. BBVI is mixed from the unrounded MFPI·MBPI and rounded once."""

    @classmethod
    def setUpClass(cls):
        cls.inputs = load_inputs(config=V414)
        cls.report, cls.old_report = build(*cls.inputs), build(*load_inputs(config=V413))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        cls.new, cls.old = rows(cls.report), rows(cls.old_report)
        cls.by_name = {s["korean_name"]: s for s in cls.new.values()}
        cls.scope = cls.report["method"]["mcui_scope"]

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.14", "released"))
        # the published 4.14 report is archived as it was (superseded by 4.17)
        archived = ROOT / "research" / "verified-indices" / "archive" / "assessments-verified-4.14.json"
        self.assertEqual(render(self.report), archived.read_text(encoding="utf-8"))
        self.assertEqual(self.scope["prereg"], "research/verified-indices/prereg-4.14-2026-10-14.md")
        self.assertTrue((ROOT / self.scope["prereg"]).exists())

    def test_only_an_official_global_or_korean_category_scores(self):
        self.assertEqual(self.scope["scored_bases"], ["iucn", "national"])
        unknown = [s for s in self.new.values() if s["scores"]["MCUI"] is None]
        self.assertEqual(len(unknown), 14)
        for s in self.new.values():
            st, name = s["conservation_status"], s["korean_name"]
            self.assertEqual(st["label"], self.scope["state_labels"][st["state"]], name)
            self.assertEqual(st["mapping_note"], self.scope["mapping_note"], name)
            used = [x for x in st["assessments"] if x["used_for_mcui"]]
            self.assertLessEqual(len(used), 1, name)
            self.assertTrue(all(x["scope"] in ("global", "korea") for x in used), name)
            for x in st["assessments"]:
                if x["scope"] not in ("global", "korea"):  # another country's or region's list: never a number
                    self.assertEqual((x["used_for_mcui"], x["why_not"]), (False, "other_population"), name)
            self.assertIn(s["mcui_basis"], (None, "iucn", "national"), name)
            self.assertEqual(st["state"] == "official_scored", s["mcui_basis"] is not None, name)
            # a missing MCUI is never 0, and its state never reads as a low risk
            self.assertNotEqual(s["scores"]["MCUI"], 0, name)
            if s["mcui_basis"] is None:
                self.assertIsNone(s["mcui_extinction_risk"], name)
                self.assertNotIn("LC", st["label"], name)
        # the Rapid LC record stays whole as a reference, with no number
        for s in self.new.values():
            sub = s.get("mcui_substitute") or {}
            if sub.get("basis") in self.scope["reference_bases"]:
                self.assertEqual((sub["use"], sub["value"], sub["reference_note"]),
                                 ("reference_only", None, self.scope["reference_notes"][sub["basis"]]), s["korean_name"])

    def test_the_stock_decline_alone_is_a_lower_bound_at_the_line(self):
        line = self.report["method"]["matrix"]["mcui_threshold"]
        agar = self.by_name["우뭇가사리"]
        self.assertEqual((agar["mcui_basis"], agar["mcui_extinction_risk"], agar["scores"]["MCUI"]), (None, None, 80.0))
        self.assertEqual(agar["conservation_status"]["state"], "other_region_only")
        self.assertEqual(agar["conservation_status"]["mcui_role"], "stock_decline_lower_bound")
        for s in self.new.values():
            score = (s.get("stock_decline") or {}).get("score")
            if s["mcui_extinction_risk"] is None:
                self.assertEqual(s["scores"]["MCUI"], score if score is not None and score >= line else None, s["korean_name"])
            else:
                self.assertEqual(s["scores"]["MCUI"], max(s["mcui_extinction_risk"], score or 0), s["korean_name"])

    def test_bbvi_and_types_come_from_the_unrounded_values(self):
        w = self.report["method"]["bbvi"]["default_food_weight"]
        for s in self.new.values():
            raw, name = s.get("scores_unrounded"), s["korean_name"]
            if s["scores"]["BBVI"] is None:
                continue
            for k in ("MFPI", "MBPI", "BBVI"):
                self.assertEqual(round1(raw[k]), s["scores"][k], (name, k))
            self.assertAlmostEqual(raw["BBVI"], w * raw["MFPI"] + (1 - w) * raw["MBPI"], places=9, msg=name)

    def test_what_moved_from_413(self):
        lost, bbvi = [], []
        for a, s in self.new.items():
            old, name = self.old[a], s["korean_name"]
            for k in ("MFPI", "MBPI"):
                self.assertEqual(s["scores"][k], old["scores"][k], (name, k))
            if s["scores"]["BBVI"] != old["scores"]["BBVI"]:
                self.assertAlmostEqual(abs(s["scores"]["BBVI"] - old["scores"]["BBVI"]), 0.1, places=6, msg=name)
                bbvi.append(name)
            if s["scores"]["MCUI"] != old["scores"]["MCUI"]:
                self.assertIsNone(s["scores"]["MCUI"], name)
                lost.append(name)
        # 13 species lose an MCUI that came from another region or the Rapid LC (멍게 had none in 4.12)
        self.assertEqual(len(lost), 13)
        self.assertIsNone(self.old[250680]["scores"]["MCUI"])
        self.assertEqual(len(bbvi), 11)

    def test_types_are_neutral_research_labels(self):
        matrix = self.report["method"]["matrix"]
        self.assertEqual({t["id"]: (t["label"], t["plain"]) for t in matrix["types"].values()},
                         {"sustainable_use": ("활용 연구 검토", "활용 지표 높음"),
                          "alternative_production": ("활용·보전 병행 검토", "두 지표 모두 높음"),
                          "conservation_priority": ("보전 연구 우선 검토", "보전 지표 높음"),
                          "baseline_survey": ("기초조사 검토", "두 지표 모두 낮음")})
        self.assertEqual(matrix["threshold_label"], "탐색적 구분선")
        self.assertIn("지속가능성 판정이 아님", matrix["type_note"])
        # the 4.14 matrix, rebuilt from the 4.14 report (the published file is 4.17 now)
        from build_matrix_readiness import build as build_matrix
        read = lambda name: json.loads((ROOT / "dist" / name).read_text(encoding="utf-8"))
        published = build_matrix(self.report, read("candidate-catalog.json"), read("expansion-evidence.json"))
        counts = {}
        for s in published["species"]:
            counts[s["matrix_type"]] = counts.get(s["matrix_type"], 0) + 1
        self.assertEqual(counts, {"sustainable_use": 6, "alternative_production": 1, "baseline_survey": 6,
                                  "conservation_priority": 3, None: 14})
        self.assertEqual(published["matrix_points"], 16)

    def test_mbpi_breadth_counts_items_papers_and_materials(self):
        for s in self.new.values():
            b = s.get("mbpi_breadth")
            if not b:
                continue
            self.assertTrue(b["exploratory"], s["korean_name"])
            self.assertEqual(sum(b["material_counts"].values()), b["item_count"], s["korean_name"])

    def test_the_posthoc_rank_counts_only_scored_species(self):
        block = self.report["method"]["posthoc"]["validation_sets"]["MCUI_stock_decline"]
        ranked = sorted((s["scores"]["MCUI"] for s in self.new.values() if s["scores"]["MCUI"] is not None), reverse=True)
        squid = self.by_name["살오징어"]["scores"]["MCUI"]
        self.assertEqual((block["cases"]["살오징어"]["mcui_rank"], block["cases"]["살오징어"]["of"]), (ranked.index(squid) + 1, 16))



class Verified417Tests(unittest.TestCase):
    """4.17 (research/verified-indices/prereg-4.17-2026-10-15.md, registered in its own commit before the code; LKH's decision
    2026-10-15 after the search for official assessments of the 14 species found none): with no IUCN global or Korean national
    category, a range-state list and then the Rapid LC check give the extinction-risk part of MCUI again, as a preliminary
    assessment ('예비 평가(공식 평가 전)') that joins the matrix and map colours and is replaced by an official result once
    published. Everything else is 4.14."""

    @classmethod
    def setUpClass(cls):
        cls.inputs = load_inputs()
        cls.report, cls.old_report = build(*cls.inputs), build(*load_inputs(config=V414))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        cls.new, cls.old = rows(cls.report), rows(cls.old_report)
        cls.by_name = {s["korean_name"]: s for s in cls.new.values()}
        cls.scope = cls.report["method"]["mcui_scope"]
        cls.v413 = rows(build(*load_inputs(config=V413)))

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-4.17", "released"))
        self.assertEqual(render(self.report), (ROOT / "dist" / "assessments.json").read_text(encoding="utf-8"))
        self.assertEqual(DEFAULT_CONFIG.name, "verified-indices-v4.17.json")
        self.assertEqual(self.scope["prereg"], "research/verified-indices/prereg-4.17-2026-10-15.md")
        self.assertTrue((ROOT / self.scope["prereg"]).exists())

    def test_the_preliminary_values_are_the_registered_ones(self):
        # prereg 4: the 13 species get back the MCUI they had in 4.13; 멍게 stays without one
        expected = {"미역": "preliminary", "톳": "preliminary", "감태": "preliminary", "꼬시래기": "preliminary",
                    "다시마": "preliminary", "괭생이모자반": "preliminary", "청각": "preliminary", "조피볼락": "preliminary",
                    "꽃게": "preliminary", "가시파래": "range_state", "넙치": "range_state", "대구": "range_state",
                    "시카메굴": "range_state"}
        for name, basis in expected.items():
            s = self.by_name[name]
            self.assertEqual(s["mcui_basis"], basis, name)
            self.assertEqual(s["scores"]["MCUI"], self.v413[s["aphia_id"]]["scores"]["MCUI"], name)
            self.assertEqual(s["conservation_status"]["state"], "preliminary_scored", name)
            self.assertEqual(s["conservation_status"]["label"], "예비 평가(공식 평가 전)", name)
            self.assertEqual(s["conservation_status"]["preliminary"]["basis"], basis, name)
        self.assertEqual(self.by_name["시카메굴"]["scores"]["MCUI"], 35.0)
        self.assertIsNone(self.by_name["멍게"]["scores"]["MCUI"])
        self.assertEqual(self.by_name["멍게"]["conservation_status"]["state"], "self_preliminary_only")

    def test_official_categories_come_first_and_stay_as_they_were(self):
        for a, s in self.new.items():
            old, name = self.old[a], s["korean_name"]
            for k in ("MFPI", "MBPI", "BBVI"):
                self.assertEqual(s["scores"][k], old["scores"][k], (name, k))
            if old["mcui_basis"] in ("iucn", "national"):
                self.assertEqual((s["scores"]["MCUI"], s["mcui_basis"], s["conservation_status"]["state"]),
                                 (old["scores"]["MCUI"], old["mcui_basis"], "official_scored"), name)
            used = [x for x in s["conservation_status"]["assessments"] if x["used_for_mcui"]]
            self.assertLessEqual(len(used), 1, name)
            if s["mcui_basis"] == "range_state":
                self.assertEqual((used[0]["scope"], used[0]["use"]), ("other_country", "preliminary"), name)
            if s["mcui_basis"] == "preliminary":
                self.assertEqual(used, [], name)
                self.assertTrue(s["conservation_status"]["self_preliminary"]["used_for_mcui"], name)
            for x in s["conservation_status"]["assessments"]:  # sub-national lists stay reference only
                if x["scope"] == "sub_national":
                    self.assertFalse(x["used_for_mcui"], name)

    def test_the_agar_keeps_its_stock_decline_mcui(self):
        agar = self.by_name["우뭇가사리"]
        self.assertEqual((agar["mcui_basis"], agar["mcui_extinction_risk"], agar["scores"]["MCUI"], agar["mcui_driver"]),
                         ("range_state", 60.0, 80.0, "stock_decline"))
        self.assertEqual(agar["conservation_status"]["state"], "preliminary_scored")

    def test_the_matrix_places_29_species(self):
        published = json.loads((ROOT / "dist" / "matrix-readiness.json").read_text(encoding="utf-8"))
        counts = {}
        for s in published["species"]:
            counts[s["matrix_type"]] = counts.get(s["matrix_type"], 0) + 1
        self.assertEqual(counts, {"sustainable_use": 12, "alternative_production": 1, "baseline_survey": 13,
                                  "conservation_priority": 3, None: 1})
        self.assertEqual(published["matrix_points"], 29)
        self.assertEqual(published["method_version"], "verified-4.17")

    def test_the_posthoc_rank_counts_only_scored_species(self):
        block = self.report["method"]["posthoc"]["validation_sets"]["MCUI_stock_decline"]
        ranked = sorted((s["scores"]["MCUI"] for s in self.new.values() if s["scores"]["MCUI"] is not None), reverse=True)
        squid = self.by_name["살오징어"]["scores"]["MCUI"]
        self.assertEqual((block["cases"]["살오징어"]["mcui_rank"], block["cases"]["살오징어"]["of"]), (ranked.index(squid) + 1, len(ranked)))
        self.assertEqual(len(ranked), 29)


if __name__ == "__main__":
    unittest.main()
