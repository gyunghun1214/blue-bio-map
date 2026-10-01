"""Regression checks for the reviewed snapshot and the scorer's admission rules (verified-pilot-2)."""
import copy
import json
import sys
import unittest
from statistics import median
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_verified_indices import build, independent_sources, load_inputs, render, round1, unexplored_flag  # noqa: E402


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



class VerifiedPilot36Tests(unittest.TestCase):
    """Public method: 3.5 plus a MEXT 2020 same-species raw item for zinc missing from a species' own RDA row."""

    def setUp(self):
        self.evidence, *self.rest = load_inputs()
        self.report = build(self.evidence, *self.rest)
        self.v35 = build(*load_inputs(config=V35))
        rows = lambda r: {s["aphia_id"]: s for s in r["species"] + r["candidate_species"]}
        self.new, self.old = rows(self.report), rows(self.v35)
        self.rule = self.report["method"]["nutrition"]["substitutes"]

    def test_committed_output_is_reproducible(self):
        self.assertEqual((self.report["method_version"], self.report["status"]), ("verified-pilot-3.6", "provisional_unvalidated"))
        self.assertEqual(render(self.report), (ROOT / "dist" / "assessments.json").read_text(encoding="utf-8"))

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
            evidence, candidates, config, snapshot, taxonomy = load_inputs()
            config["nutrition"]["substitutes"]["mext"]["components"] = [name]
            report = build(evidence, candidates, config, snapshot, taxonomy)
            self.assertIsNone(next(s for s in report["candidate_species"] if s["aphia_id"] == 504357)["scores"]["MFPI"], name)


if __name__ == "__main__":
    unittest.main()
