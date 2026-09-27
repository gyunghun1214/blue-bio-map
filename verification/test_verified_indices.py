"""Regression checks for the reviewed snapshot and the scorer's admission rules (verified-pilot-2)."""
import copy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_verified_indices import build, load_inputs, render  # noqa: E402


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
    """The published method: v2 plus a separately labelled national MCUI and paper-only peptide raw values."""

    def setUp(self):
        self.report = build(*load_inputs())
        self.v2 = build(*load_inputs(config=V2))

    def test_committed_output_is_reproducible(self):
        self.assertEqual(self.report["method_version"], "verified-pilot-2.1")
        self.assertEqual(render(self.report), (ROOT / "dist" / "assessments.json").read_text(encoding="utf-8"))

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
        self.assertEqual({k: [r["sequence"] for r in v] for k, v in raw.items()}, {145721: ["KNFL"], 836033: ["AEYLCEAC"]})
        for rows in raw.values():
            for r in rows:
                self.assertIs(r["used_for_score"], False)
                self.assertEqual(r["label"], "원값·출처")
                self.assertNotIn("percentile", r)
                self.assertEqual(self.report["sources"][r["source_id"]]["license"], "CC BY 4.0")
        self.assertEqual({k: v[0]["value"] for k, v in raw.items()}, {145721: 225.87, 836033: 4287})
        self.assertNotIn("ahtpdb_ic50_2026", self.report["sources"])
        self.assertTrue(all(s["scores"]["BBVI"] is None for s in self.report["species"] + self.report["candidate_species"]))


class VerifiedPilot3Tests(unittest.TestCase):
    V3 = ROOT / "config" / "verified-indices-v3.json"

    def setUp(self):
        self.evidence, self.candidates, self.config, self.snapshot, self.taxonomy = load_inputs(config=self.V3)

    def run_build(self, evidence=None):
        return build(evidence or self.evidence, self.candidates, self.config, self.snapshot, self.taxonomy)

    def test_committed_v3_output_is_reproducible_and_v2_scores_unchanged(self):
        report = self.run_build()
        self.assertEqual((ROOT / "research" / "verified-indices" / "assessments-v3.json").read_text(encoding="utf-8"), render(report))
        v2 = build(*load_inputs())
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


if __name__ == "__main__":
    unittest.main()
