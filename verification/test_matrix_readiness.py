"""Cross-pipeline regression: missing inputs never become zero or a real point."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_matrix_readiness import build  # noqa: E402


class MatrixReadinessTests(unittest.TestCase):
    def setUp(self):
        self.assessments = json.loads((ROOT / "dist/assessments.json").read_text())
        self.catalog = json.loads((ROOT / "dist/candidate-catalog.json").read_text())
        self.expansion = json.loads((ROOT / "dist/expansion-evidence.json").read_text())

    def test_30_species_missing_remains_missing(self):
        report = build(self.assessments, self.catalog, self.expansion)
        self.assertEqual(len(report["species"]), 30)
        # verified-pilot-3.2: a national MCUI is placed too (marked apart), so a point is any species with both BBVI and MCUI.
        # verified-pilot-3.15: a substitute MCUI joins only for the bases the rule lists (range_state). 3.15 (team-lead decision
        # 2026-10-02): a Rapid LC is reference only, so 미역 has BBVI 71.0 but no MCUI and stays off.
        allowed = report["matrix_rule"].get("include_substitute_mcui", [])
        placed = [r["aphia_id"] for r in report["species"] if r["matrix_eligible"]]
        self.assertEqual(placed, [r["aphia_id"] for r in report["species"]
                                  if r["scores"]["BBVI"] is not None and r["scores"]["MCUI"] is not None
                                  and (r["mcui_basis"] not in ("range_state", "preliminary") or r["mcui_basis"] in allowed)
                                  and (not r.get("bbvi_label") or report["matrix_rule"].get("include_single_source_bbvi"))])
        # verified-pilot-3.27 (team-lead decision 2026-10-03): a labelled single-paper BBVI is a score and a (hollow) point,
        # so every species with BBVI and an admitted MCUI is placed: 2 -> 12 points.
        # verified-4.0 (team-lead decisions 2026-10-04): 우뭇가사리 (MBPI via the G. amansii mapping), 가시파래 (MFPI with other
        # samples' moisture) and 넙치·대구 (Fisheries Agency 'ランク外' as LC-equivalent) join: 12 -> 16 points.
        # verified-4.2 (team-lead decision 2026-10-04): 톳·청각·꽃게 join through the sub-national basis, labelled and with the
        # pre-registered back-test result beside them: 16 -> 19 points.
        # verified-4.3 (team-lead decisions 2026-10-05): every cell is filled (scored Rapid LC, 미역 Primorsky EN, XO stratum,
        # MBPI floor), so all 30 species are placed: 19 -> 30 points.
        # verified-4.11 (prereg-4.11-2026-10-13 5.2): 멍게's OBIS reporting rate fell to the decline ratio, so its Rapid LC is not
        # scored and it has no MCUI: 30 -> 29 points.
        # verified-4.14 (prereg-4.14-2026-10-14 2·3): only an IUCN global or Korean national category scores MCUI; another
        # region's list and a Rapid LC are references without a number, and a stock decline alone counts only as a lower bound
        # at or above the matrix line. 14 species are left with no MCUI and no type: 29 -> 16 points.
        # verified-4.17 (team-lead decision 2026-10-15, prereg-4.17-2026-10-15 2): with no official category, a range-state list
        # and then the Rapid LC check score again as a preliminary assessment; only 멍게 is left with no MCUI: 16 -> 29 points.
        # verified-4.19 (prereg-4.19-2026-10-15 1): the OBIS reporting-rate ratio no longer blocks a met Rapid LC check (4.11
        # rule 5a withdrawn), so 멍게 is placed too: 29 -> 30 points.
        unknown = [r["aphia_id"] for r in self.assessments["species"] + self.assessments["candidate_species"]
                   if r["scores"]["MCUI"] is None]
        self.assertEqual(unknown, [])
        self.assertEqual(placed, [r["aphia_id"] for r in report["species"] if r["aphia_id"] not in unknown])
        self.assertEqual(len(placed), 30)
        self.assertEqual(report["matrix_points"], len(placed))
        self.assertEqual([r["aphia_id"] for r in report["species"] if r.get("bbvi_label")],
                         [r["aphia_id"] for r in report["species"] if r["scores"]["BBVI"] is not None
                          # 3.28: 톳 replicated (Chen 2016); 4.9: 갑오징어 replicated (Bonini 2000); 4.11: only a purified
                          # isolate of the species itself counts, so 미역 (its own VW) is the one species left without the label
                          and r["aphia_id"] != 145721])
        # 4.2: 꽃게 now carries a sub-national MCUI, so its BBVI does become a (labelled) point. 4.11: that list's back-test did
        # not pass, so it is reference only and 꽃게 stays a point through its Rapid LC
        # 4.14: that Rapid LC is a reference too, so 꽃게 has no MCUI and is no point
        # 4.17: the Rapid LC scores again as a preliminary assessment, so 꽃게 is a point through it
        self.assertEqual(next(r for r in report["species"] if r["aphia_id"] == 1061762)["mcui_basis"], "preliminary")
        self.assertEqual([(r["aphia_id"], r["scores"]["BBVI"]) for r in report["species"]
                          if r["scores"]["BBVI"] is not None],
                         # 4.13: 넙치 BBVI 44.3 -> 51.3 and MBPI 29.2 -> 43.2 (the P35 antimicrobial rows), crossing the 50 threshold.
                         # 4.11: 미역 71.0 -> 68.0, 톳 74.9 -> 64.2, 참굴 83.9 -> 71.9, 감태 65.0 -> 59.7, 큰가리비 46.1 -> 41.6,
                         # 갑오징어 65.1 -> 54.2 (other-origin replications no longer count; the 3-compound ACE stratum is gone).
                         # 4.14 (prereg-4.14 5): BBVI is mixed from the unrounded MFPI·MBPI and rounded once, so 11 species move
                         # down by 0.1 (미역 68.0 -> 67.9, 멍게, 감태, 가시파래, 괭생이모자반, 꼬시래기, 청각, 전복, 큰가리비, 시카메굴,
                         # 갑오징어 54.2 -> 54.1); none crosses the 50 line
                         # 4.18 (prereg-4.18 3): 청각 gains a second original paper on its siphonaxanthin link (link factor
                         # 0.75 -> 1.0), so its MBPI is 0.6 and its BBVI 18.5 -> 18.6; no other species moves
                         [(145721, 67.9), (241776, 36.1), (250680, 33.1), (342067, 51.5), (372119, 45.1), (494972, 64.2), (506159, 35.5),
                          (836033, 71.9), (377084, 41.6), (371986, 59.6), (234476, 53.7), (494853, 37.5), (236157, 59.6), (145086, 18.6),
                          (231750, 59.5), (397082, 35.1), (393716, 41.5),
                          (836041, 34.9), (504357, 68.5), (413600, 57.3), (127022, 47.4), (219984, 48.3), (281273, 46.6), (275816, 51.3),
                          (274849, 40.1), (276651, 29.3), (254538, 49.1), (1061762, 46.2), (534443, 54.2), (1666974, 54.1)])
        # 4.1: 꽃게 (MCCC1-MTS, origin settled on sequence records). 4.3: 참조기 (XO stratum) and the floor BBVIs of 방어·참문어·갑오징어
        self.assertEqual([(r["aphia_id"], r["scores"]["MBPI"]) for r in report["species"]
                          if r["scores"]["MBPI"] is not None],
                         [(145721, 89.2), (241776, 8.7), (250680, 13.5), (342067, 56.9), (372119, 13.5), (494972, 65.0), (506159, 10.1),
                          (836033, 72.2),
                          (377084, 26.5), (371986, 56.8), (234476, 73.3), (494853, 21.6), (236157, 49.3), (145086, 0.6), (231750, 58.6),
                          (397082, 15.6), (393716, 27.3), (836041, 13.8),
                          (504357, 75.0), (413600, 56.9),
                          (127022, 34.9), (219984, 22.6), (281273, 53.8), (275816, 43.2), (274849, 31.7), (276651, 7.5),
                          # 4.1: 꽃게 AMP row; 4.3: 참조기 XO, three floors; 4.9: 갑오징어 65.8 -> 87.7 (second independent paper);
                          # 4.11: back to 65.8 (that paper measured a synthetic peptide, not a cuttlefish isolate)
                          (254538, 59.9), (1061762, 30.3), (534443, 70.5), (1666974, 65.8)])
        # verified-pilot-3.18: the antimicrobial-peptide stratum gives 피조개 (AI-hemocidin 2) and 조피볼락 (TS40) a
        # single-paper MBPI from their MIC percentile, so neither opens a BBVI. 3.19 adds Poor Broth to the cohort's broth
        # list (team-lead decision), which moves them by one tenth (22.1 -> 22.0, 31.6 -> 31.7).
        # verified-pilot-3.20: 다시마 gets a single-paper ChEMBL MBPI 26.5 through a paper link the team lead admitted for
        # species with P703 statements; one paper, so no BBVI.
        # verified-pilot-3.21: the anticancer stratum moves 피조개 22.0 -> 75.0 (P6 on HT-29, Li 2022); it still rests
        # on one paper, so no BBVI.
        # verified-pilot-3.22: 괭생이모자반 gets MFPI 53.5 from the literature route (Murakami 2011) plus the
        # aquaculture record it needed (Pang 2008); MBPI is unchanged, so it still has no BBVI.
        # verified-pilot-3.23: display data only (literature-row limitations in the MFPI trace); no count moves.
        # verified-pilot-3.24: Suetsuna 2004's purified VW replicates the 큰가리비 VW potency (pIC50 gap 0.906): MBPI
        # 27.3 -> 36.4 and BBVI 46.1; its MCUI is a national assessment, so it is the matrix's second point.
        # verified-pilot-3.25: three synthetic wakame replications and two corrected aquaculture records; no count moves.
        # verified-pilot-3.26: one aquaculture limitation sentence corrected (청각, a misprint in the paper's Table 2); no count moves.
        # verified-pilot-3.27: 살오징어 (Wako 1996 YALPHA), 시카메굴 (flazin) and 꼬시래기 (PGA2, hold released) get a
        # single-paper MBPI; 가시파래 gets MCUI 10 from the Swedish red list (range state); BBVI 3 -> 22 under the labelled policy.
        # verified-pilot-3.5 adds single-paper peptide MBPI (해삼, 가시파래, 큰가리비, 가리맛조개, 넙치; 미역 19.6 -> 71.5 after the
        # Sato 2002 full text) and three aquaculture records (참조기, 넙치, 꽃게 MFPI). Every new MBPI rests on one paper: no new BBVI.
        # verified-pilot-2.3: 참굴 LQP potency is replicated across origins, so its BBVI exists, but its MCUI is a
        # national assessment and stays off the matrix; 미역 MBPI still rests on one paper, so the matrix stays empty.
        # verified-pilot-3.1 adds five ChEMBL MBPI values after the link review; each rests on one linking paper, so BBVI stays withheld.
        # Operating MFPI 3 + MCUI 2 (main), plus the #39 reviewed candidates: MFPI 4 (바지락·참가리비·조피볼락·방어),
        # MCUI 5 (전복·고등어·멸치·참조기·방어). Every matrix score must equal the reviewed report, species by species.
        # verified-pilot-3.3 fills a missing RDA zinc value from uFiSh: 홍합(species), 전복(genus), 대구(species), 갑오징어(family).
        # verified-pilot-3.6 fills 피조개 zinc from the MEXT 2020 same-species raw item (あかがい 10279): MFPI 14 -> 15.
        # verified-pilot-3.7 adds calcium (3 of 4 components) and three aquaculture records: 톳·청각·멸치 MFPI, 참굴 BBVI 80.9 -> 83.9.
        # verified-pilot-3.8 adds the reviewed 바지락 peptide rows (single paper): 바지락 MBPI 39.5, BBVI withheld.
        # verified-pilot-3.9 uses a MEXT same-species raw item as the own row where RDA has none: 맛조개·고등어·참문어 MFPI, 18 -> 21.
        # verified-pilot-3.10 adds the reviewed 톳 peptide rows (Suetsuna 1998, single paper): 톳 MBPI 45.3 -> 65.0, BBVI withheld.
        # verified-pilot-3.11 adds the reviewed 고등어 peptide rows (Wang 2024, Zhang 2025; one paper per sequence): 고등어 MBPI 34.9.
        # verified-pilot-3.12 counts Suetsuna 2000's synthetic IY as a potency replication of 미역 IY: MBPI 71.5 -> 81.0, BBVI 63.9
        # (no MCUI, so the matrix keeps one point).
        # verified-pilot-3.13 adds the reviewed 멸치 peptide rows (Kim 2016, anchovy sauce, single paper): 멸치 MBPI 22.6.
        # verified-pilot-3.14 accepts sequence-confirmed purified peptides: 미역 IW replicated (Lin 2018) -> MBPI 95.3, BBVI 71.0;
        # 바지락 VISDEDGVTH (Chen 2018) 39.5 -> 58.6; 대구 GASSGMPG (Ngo 2016) 59.9, all single-paper except 미역.
        # verified-pilot-3.15 links RDA rows by name (다시마·우뭇가사리·꼬시래기·해삼), reads 시카메굴 from a paper, adds six
        # aquaculture records (살오징어 false) and converts the synthetic 전복 AMN to uM: MFPI 21 -> 27, 전복 MBPI 15.6.
        # verified-pilot-3.22 adds 괭생이모자반 through the literature route: MFPI 27 -> 28.
        # verified-4.0 adds 가시파래 and 감태 with other samples' fresh moisture (team-lead decision 2026-10-04): 28 -> 30.
        self.assertEqual(sum(r["scores"]["MFPI"] is not None for r in report["species"]), 30)
        # verified-pilot-2.1 adds 7 Korean national-assessment MCUI, kept apart by mcui_basis and out of the matrix.
        self.assertEqual(sum(r["scores"]["MCUI"] is not None and r["mcui_basis"] == "iucn" for r in report["species"]), 7)
        # 3.15: 참문어 joins through the misapplied-name crosswalk; 시카메굴 reads Japan's list. 3.15 (team-lead decision
        # 2026-10-02): the 14 species with a met Rapid LC keep it as reference only, so none has a preliminary MCUI.
        self.assertEqual(sum(r["scores"]["MCUI"] is not None and r["mcui_basis"] == "national" for r in report["species"]), 8)
        # verified-pilot-3.16: 우뭇가사리 joins through Russia's Red Data Book (VU, peripheral population)
        # verified-pilot-3.27: 가시파래 joins through Sweden's red list 2025 (LC; distant range state)
        # verified-4.0: 넙치·대구 join through the Fisheries Agency of Japan rarity evaluation ('ランク外' as LC-equivalent)
        # 4.14 (prereg-4.14-2026-10-14 3): another region's list (range state or sub-national) is a reference without a number,
        # so none of the 5 range-state species keeps it as a basis. 3.15 / 4.3 / 4.11 history: the met Rapid LC (9 species in
        # 4.12) is reference only again, as in 3.15, so no species has a preliminary or sub-national basis
        # 4.17 (prereg-4.17-2026-10-15 2): with no official category, the 5 range-state lists (우뭇가사리 included, its MCUI
        # still set by the stock decline 80) and the 9 met Rapid LC checks score again as preliminary assessments; sub-national
        # lists stay reference only
        self.assertEqual({b: sum(r["mcui_basis"] == b for r in report["species"]) for b in ("range_state", "preliminary", "sub_national")},
                         {"range_state": 5, "preliminary": 10, "sub_national": 0})  # 4.19: 멍게's Rapid LC
        self.assertEqual(sum(r["mcui_basis"] == "iucn" for r in report["species"]), 7)
        self.assertEqual([r["aphia_id"] for r in report["species"] if r["scores"]["MCUI"] is not None and not r["mcui_basis"]], [])
        self.assertEqual(sum(r["scores"]["MCUI"] is not None for r in report["species"]), 30)
        self.assertEqual(next(r for r in report["species"] if r["aphia_id"] == 145721)["scores"]["MCUI"], 10.0)
        reviewed = {s["aphia_id"]: s["scores"] for s in
                    self.assessments["species"] + self.assessments["candidate_species"]}
        for row in report["species"]:
            for axis in ("MFPI", "MBPI", "MCUI"):
                self.assertEqual(row["scores"][axis], reviewed.get(row["aphia_id"], {}).get(axis), (row["aphia_id"], axis))
        published = json.loads((ROOT / "dist/matrix-readiness.json").read_text())
        self.assertEqual(report, published)

    def test_matrix_type_and_sufficiency_layers(self):
        report = build(self.assessments, self.catalog, self.expansion)
        rule = self.assessments["method"]["matrix"]
        self.assertEqual(report["matrix_rule"], rule)
        reviewed = {s["aphia_id"]: s for s in self.assessments["species"] + self.assessments["candidate_species"]}
        for row in report["species"]:
            s = reviewed[row["aphia_id"]]
            self.assertEqual((row["priority_survey"], row["unexplored_candidate"]),
                             (s["priority_survey"], s["unexplored_candidate"]), row["aphia_id"])
            if not row["matrix_eligible"]:
                self.assertIsNone(row["matrix_type"], row["aphia_id"])
                continue
            key = ("high" if row["scores"]["BBVI"] >= 50 else "low") + "_bbvi_" + ("high" if row["scores"]["MCUI"] >= 50 else "low") + "_mcui"
            self.assertEqual(row["matrix_type"], rule["types"][key]["id"], row["aphia_id"])
        # the national stratum leaves the matrix again when the rule says so; nothing else moves
        off = copy.deepcopy(self.assessments)
        off["method"]["matrix"]["include_national_mcui"] = False
        rows = build(off, self.catalog, self.expansion)["species"]
        self.assertFalse(any(r["matrix_eligible"] or r["matrix_type"] for r in rows if r["mcui_basis"] == "national"))
        self.assertEqual([r["scores"] for r in rows], [r["scores"] for r in report["species"]])
        # an older report without a matrix rule publishes no type fields
        older = copy.deepcopy(self.assessments)
        del older["method"]["matrix"]
        self.assertFalse(any("matrix_type" in r for r in build(older, self.catalog, self.expansion)["species"]))

    def test_candidate_checklist_is_not_an_original_iucn_assessment(self):
        rows = build(self.assessments, self.catalog, self.expansion)["species"]
        reviewed = {s["aphia_id"]: s for s in self.assessments["candidate_species"]}
        for row in rows:
            if row["scope"] != "expansion_22" or row["scores"]["MCUI"] is None:
                continue
            # A candidate MCUI must come from a reviewed original assessment, never from the catalog checklist line.
            if row["mcui_basis"] == "national":
                national = reviewed[row["aphia_id"]]["national_assessment"]
                self.assertTrue(national["source_id"] and national["category"], row["aphia_id"])
                continue
            if row["mcui_basis"] in ("range_state", "sub_national", "preliminary"):
                # after 3.14 (4.2 adds sub_national): a substitute MCUI cites its own record — another state's list, a
                # sub-national list or the Rapid LC run — never the catalog checklist line
                sub = reviewed[row["aphia_id"]]["mcui_substitute"]
                self.assertTrue(sub["record"] and set(sub["source_ids"]) <= set(self.assessments["sources"]), row["aphia_id"])
                continue
            trace = reviewed[row["aphia_id"]]["conservation_trace"]
            self.assertTrue(trace["assessment_date"] and trace["criteria_version"], row["aphia_id"])
            self.assertTrue(trace["current_status_check"]["is_current"], row["aphia_id"])
        stripped = copy.deepcopy(self.assessments)
        for s in stripped["candidate_species"]:
            s["scores"]["MCUI"] = None
        self.assertTrue(all(r["scores"]["MCUI"] is None for r in build(stripped, self.catalog, self.expansion)["species"]
                            if r["scope"] == "expansion_22"))

    def test_source_mismatch_and_unearned_bbvi_are_rejected(self):
        mismatched = copy.deepcopy(self.expansion)
        mismatched["species"][0]["name"] = "another species"
        with self.assertRaises(ValueError):
            build(self.assessments, self.catalog, mismatched)
        counterfeit = copy.deepcopy(self.assessments)
        # a BBVI whose MBPI input is gone (4.3 fills every cell, so the counterfeit removes an input instead of adding a BBVI)
        next(s for s in counterfeit["candidate_species"] if s["scores"]["BBVI"] is not None)["scores"]["MBPI"] = None
        with self.assertRaises(ValueError):
            build(counterfeit, self.catalog, self.expansion)

    def test_single_paper_bbvi_needs_the_policy_and_its_label(self):
        # 3.27 (team-lead decision 2026-10-03): a BBVI over a single-paper MBPI is a score only as a labelled one under the
        # report's own policy, and it is placed only while the matrix rule admits it (hollow marker on the page)
        unlabelled = copy.deepcopy(self.assessments)
        next(s for s in unlabelled["species"] if s.get("bbvi_label"))["bbvi_label"] = None
        with self.assertRaises(ValueError):
            build(unlabelled, self.catalog, self.expansion)
        no_policy = copy.deepcopy(self.assessments)
        no_policy["method"]["bbvi"].pop("single_source_policy")
        with self.assertRaises(ValueError):
            build(no_policy, self.catalog, self.expansion)
        off = copy.deepcopy(self.assessments)
        off["method"]["matrix"]["include_single_source_bbvi"] = False
        rows = build(off, self.catalog, self.expansion)["species"]
        # 4.2: 톳 keeps its replicated BBVI, so turning the single-paper policy off leaves three points, not two;
        # 4.3: 미역 (replicated MBPI) gains its MCUI and joins them; 4.9: 갑오징어's item is replicated too, so it stays as well;
        # 4.11: replications from another origin no longer count, so 미역 is the only point left
        # 4.14: 미역 has no MCUI any more (its only lists are Primorsky and a Rapid LC), so no point is left
        # 4.17: its Rapid LC scores again as a preliminary assessment, so 미역 is the one point left
        self.assertEqual([r["aphia_id"] for r in rows if r["matrix_eligible"]], [145721])
        self.assertEqual([r["scores"] for r in rows], [r["scores"] for r in build(self.assessments, self.catalog, self.expansion)["species"]])


if __name__ == "__main__":
    unittest.main()
