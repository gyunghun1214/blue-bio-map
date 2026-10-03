"""verified-pilot-3.1 ChEMBL stratum rules on a synthetic snapshot: commonness fence, strata, cohorts, evidence factors."""
import copy
import json
import math
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_verified_indices import chembl_items, chembl_stratum, common_limit, load_inputs  # noqa: E402

CONFIG = json.loads((ROOT / "config" / "verified-indices-v3.1.json").read_text(encoding="utf-8"))
STRATA = CONFIG["chembl_bioactivity"]["strata"]


def link(q, ik, refs):
    return {"compound_qid": q, "inchikey": ik, "statements": [{"taxon_qid": "QT", "references": refs}]}


def act(aid, parent, target, st, value, doc):
    return {"activity_id": aid, "parent_molecule_chembl_id": parent, "target_chembl_id": target,
            "standard_type": st, "pchembl_value": value, "document_chembl_id": doc}


def snapshot():
    return {
        "sources": {"chembl_mbpi": {"version": "ChEMBL_37 (2026-05-01)"}},
        "species": [
            {"aphia_id": 1, "links": [link("Q1", "IK1", ["QR1", "QR2"]), link("Q2", "IK2", ["QR1"]),
                                      link("Q5", "IK5", ["QR1"]), link("Q3", "IK3", [])]},
            {"aphia_id": 2, "links": [link("Q4", "IK4", ["QR3"])]},
            {"aphia_id": 3, "links": [link("Q6", "IK6", ["QR3"])]}],
        "reference_dois": {"QR1": "10.1/A", "QR2": "10.1/b", "QR3": "10.1/c"},
        "compound_taxon_counts": {"Q1": 1, "Q2": 2, "Q3": 3, "Q4": 4, "Q5": 100},
        "compounds": {"IK1": {"parent_chembl_id": "P1", "pubchem_cids": [11]}, "IK2": {"parent_chembl_id": "P2", "pubchem_cids": []},
                      "IK3": {"parent_chembl_id": "P3", "pubchem_cids": []}, "IK4": {"parent_chembl_id": "P4", "pubchem_cids": [44]},
                      "IK5": {"parent_chembl_id": "P5", "pubchem_cids": []}, "IK6": {"parent_chembl_id": None, "pubchem_cids": []}},
        "parent_max_phase": {"P1": None, "P2": 4.0}, "parent_names": {"P1": "one"},
        "targets": {"T1": {"target_type": "SINGLE PROTEIN", "pref_name": "Enzyme one", "organism": "Homo sapiens"},
                    "T2": {"target_type": "CELL-LINE", "pref_name": "LINE-2", "organism": "Homo sapiens",
                           "cellosaurus": {"id": "CVCL_0002", "category": "Cancer cell line"}},
                    "T4": {"target_type": "ORGANISM", "pref_name": "Bug", "organism": "Bug", "organism_class": ["Bacteria", "Gram+", None]},
                    "T6": {"target_type": "ADMET", "pref_name": "ADMET", "organism": None}},
        "activities": [act(1, "P1", "T1", "IC50", 7.0, "D1"), act(2, "P1", "T1", "IC50", 7.2, "D2"),
                       act(3, "P1", "T4", "MIC", 5.0, "D1"), act(4, "P1", "T6", "CL", 9.0, "D1"),
                       act(5, "P2", "T1", "IC50", 8.0, "D1"), act(6, "P5", "T1", "IC50", 7.1, "D3"),
                       act(7, "P4", "T2", "GI50", 6.0, "D4")],
        "cohorts": {"T1|IC50": {"total": 40, "below": {"7.1": 30, "8.0": 38}, "equal": {"7.1": 2, "8.0": 1}},
                    "T4|MIC": {"total": 20, "below": {"5.0": 5}, "equal": {"5.0": 0}},
                    "T2|GI50": {"total": 50, "below": {"6.0": 10}, "equal": {"6.0": 1}}}}


def run(**kw):
    return chembl_items({"chembl_links": snapshot()}, CONFIG, **kw)


class CommonnessFence(unittest.TestCase):
    def test_raw_scale_tukey_fence(self):
        # counts 1,2,3,4,100: inclusive Q1 = 2, Q3 = 4, fence 4 + 1.5 * 2
        self.assertEqual(common_limit(snapshot()), 7.0)

    def test_log_scale_fence_is_the_looser_sensitivity_view(self):
        self.assertAlmostEqual(common_limit(snapshot(), log_scale=True), 4 * 2 ** 1.5)


class Strata(unittest.TestCase):
    def test_target_classes(self):
        cases = [({"target_type": "SINGLE PROTEIN"}, "protein"),
                 ({"target_type": "PROTEIN COMPLEX"}, "protein"),
                 ({"target_type": "CELL-LINE", "cellosaurus": {"category": "Cancer cell line"}}, "cancer_cell_line"),
                 ({"target_type": "CELL-LINE", "cellosaurus": {"category": "Transformed cell line"}}, None),
                 ({"target_type": "CELL-LINE", "cellosaurus": {"id": None, "category": None}}, None),
                 ({"target_type": "ORGANISM", "organism_class": ["Bacteria", "Gram-", None]}, "pathogen"),
                 ({"target_type": "ORGANISM", "organism_class": ["Eukaryotes", "Apicomplexa", "Plasmodium"]}, "pathogen"),
                 ({"target_type": "ORGANISM", "organism_class": ["Eukaryotes", "Fungi", None]}, None),
                 ({"target_type": "ORGANISM", "organism_class": ["Eukaryotes", "Vertebrata", "Mammalia"]}, None),
                 ({"target_type": "ORGANISM", "organism_class": None}, None),
                 ({"target_type": "ADMET"}, None), ({"target_type": "UNCHECKED"}, None),
                 ({"target_type": "NON-MOLECULAR"}, None)]
        for target, expected in cases:
            self.assertEqual(chembl_stratum(target, STRATA), expected, target)


class ChemblItems(unittest.TestCase):
    def test_default_rule(self):
        items, info = run()
        self.assertEqual(info["common_taxon_limit"], 7.0)
        self.assertEqual([(a, i["compound_id"], i["chembl_stratum"]) for a, i in items],
                         [(1, "P1", "protein"), (2, "P4", "cancer_cell_line")])
        p1 = items[0][1]
        self.assertEqual(p1["stratum_id"], "ChEMBL_37:T1|IC50")
        self.assertEqual(p1["median_pchembl"], 7.1)
        self.assertEqual(p1["percentile"], 77.5)          # 100 * (30 + 0.5 * 2) / 40
        self.assertEqual(p1["original_paper_dois"], ["10.1/a", "10.1/b"])
        self.assertEqual(p1["document_chembl_ids"], ["D1", "D2"])
        self.assertEqual((p1["link_factor"], p1["activity_factor"], p1["evidence_factor"]), (1.0, 1.0, 1.0))
        self.assertEqual((p1["independent_sources"], p1["cohort_records"], p1["activity_ids"]), (2, 40, [1, 2]))
        self.assertEqual((p1["pubchem_cids"], p1["wikidata_qids"], p1["label"]), ([11], ["Q1"], CONFIG["chembl_bioactivity"]["label"]))
        p4 = items[1][1]                                   # one link paper, one ChEMBL document
        self.assertEqual((p4["percentile"], p4["evidence_factor"], p4["independent_sources"]), (21.0, 0.5625, 1))
        self.assertAlmostEqual(p4["adjusted"], 21.0 * 0.5625)

    def test_counts_and_sufficiency(self):
        _, info = run()
        self.assertEqual(info["species"][1]["counts"], {"linked": 4, "with_reference_doi": 3, "common_metabolite": 1,
                                                        "approved_drug": 1, "scored_compounds": 1})
        self.assertEqual(info["species"][1]["sufficiency"]["ratio"], 1.0)
        self.assertEqual(info["species"][3]["sufficiency"]["best_record_steps"], 1)   # linked, but no ChEMBL structure
        self.assertEqual(info["species"][3]["counts"]["scored_compounds"], 0)

    def test_non_scored_targets_never_enter(self):
        items, _ = run(minimum=1)
        self.assertNotIn("T6", {i["target_chembl_id"] for _, i in items})

    def test_minimum_cohort_sensitivity(self):
        items, _ = run(minimum=10)
        pathogen = [i for a, i in items if i["chembl_stratum"] == "pathogen"]
        self.assertEqual([(i["compound_id"], i["percentile"]) for i in pathogen], [("P1", 25.0)])
        self.assertEqual(len(run(minimum=100)[0]), 0)

    def test_filters_can_be_switched_off_for_sensitivity(self):
        drug = [i for a, i in run(exclude_drugs=False)[0] if i["compound_id"] == "P2"]
        self.assertEqual([(i["percentile"], i["evidence_factor"]) for i in drug], [(96.25, 0.5625)])
        common = [i for a, i in run(limit=math.inf)[0] if i["compound_id"] == "P5"]
        self.assertEqual([i["percentile"] for i in common], [77.5])
        self.assertIsNone(run(limit=math.inf)[1]["common_taxon_limit"])


class SnapshotGuards(unittest.TestCase):
    """load_inputs refuses a ChEMBL snapshot that is out of date, redefines a source or lists other sources."""

    def attempt(self, **changes):
        evidence = json.loads((ROOT / "research" / "verified-indices" / "evidence.json").read_text(encoding="utf-8"))
        snap = {"snapshot_date": evidence["snapshot_date"],
                "sources": {k: {} for k in CONFIG["chembl_bioactivity"]["source_ids"]}} | changes
        with tempfile.TemporaryDirectory() as tmp:
            cfg = copy.deepcopy(CONFIG)
            cfg["chembl_bioactivity"]["snapshot"] = str(Path(tmp) / "snap.json")   # ROOT / absolute path = absolute path
            (Path(tmp) / "snap.json").write_text(json.dumps(snap), encoding="utf-8")
            (Path(tmp) / "cfg.json").write_text(json.dumps(cfg), encoding="utf-8")
            with self.assertRaises(ValueError) as caught:
                load_inputs(config=Path(tmp) / "cfg.json")
        return str(caught.exception)

    def test_date_mismatch(self):
        self.assertIn("older than evidence", self.attempt(snapshot_date="2000-01-01"))

    def test_paper_record_must_not_postdate_the_snapshot(self):
        papers = json.loads((ROOT / CONFIG["chembl_bioactivity"]["paper_links"]).read_text(encoding="utf-8"))
        before = str(date.fromisoformat(papers["snapshot_date"]) - timedelta(days=1))
        self.assertIn("must date between", self.attempt(snapshot_date=before))

    def test_original_paper_links_only_for_species_without_p703(self):
        papers = json.loads((ROOT / CONFIG["chembl_bioactivity"]["paper_links"]).read_text(encoding="utf-8"))
        aphia = papers["links"][0]["aphia_id"]
        species = [{"aphia_id": aphia, "links": [{"statements": [{"taxon_qid": "Q1"}]}]}]
        self.assertIn("only for species without a P703 link",
                      self.attempt(snapshot_date=papers["snapshot_date"], species=species))

    def test_paper_links_must_all_be_in_the_snapshot(self):
        # 3.27 review: a link added to the paper record without re-collecting its compounds would never score, silently
        papers = json.loads((ROOT / CONFIG["chembl_bioactivity"]["paper_links"]).read_text(encoding="utf-8"))
        self.assertIn("hold different original-paper links", self.attempt(snapshot_date=papers["snapshot_date"], species=[]))

    def test_source_redefinition(self):
        evidence = json.loads((ROOT / "research" / "verified-indices" / "evidence.json").read_text(encoding="utf-8"))
        taken = next(iter(evidence["sources"]))
        sources = {k: {} for k in CONFIG["chembl_bioactivity"]["source_ids"]} | {taken: {}}
        self.assertIn("redefines", self.attempt(sources=sources))

    def test_source_list_mismatch(self):
        sources = {k: {} for k in CONFIG["chembl_bioactivity"]["source_ids"][1:]}
        self.assertIn("source list differs", self.attempt(sources=sources))


def reviewed(*entries):
    snap = snapshot()
    snap["link_review"] = [{"aphia_id": a, "inchikey": ik, "dois": dois, "decision": d, "compound_name": ik,
                            "compound_chembl_id": None, "class": cls, "reason": "synthetic"} for a, ik, dois, d, cls in entries]
    return chembl_items({"chembl_links": snap}, CONFIG)


class LinkReview(unittest.TestCase):
    """mbpi-link-review: a rejected link never scores, a stale review stops the build, an unreviewed link is marked."""

    def test_rejected_link_is_removed_and_listed(self):
        items, info = reviewed((1, "IK1", ["10.1/a", "10.1/b"], "reject", "contaminant"), (2, "IK4", ["10.1/c"], "accept", None))
        self.assertEqual([(a, i["compound_id"]) for a, i in items], [(2, "P4")])
        self.assertEqual(info["species"][1]["counts"]["rejected_by_review"], 1)
        self.assertEqual([(r["inchikey"], r["class"]) for r in info["species"][1]["rejected_links"]], [("IK1", "contaminant")])
        self.assertEqual(info["species"][1]["counts"]["scored_compounds"], 0)

    def test_stale_review_stops_the_build(self):
        with self.assertRaisesRegex(ValueError, "link review is stale"):
            reviewed((1, "IK1", ["10.1/a"], "accept", None))

    def test_unreviewed_link_is_marked(self):
        items, _ = reviewed((1, "IK1", ["10.1/a", "10.1/b"], "accept", None))
        self.assertEqual({a: i["link_review"] for a, i in items}, {1: "accepted", 2: "not_reviewed"})
        self.assertEqual({i["evidence_level"] for _, i in items}, {2})


if __name__ == "__main__":
    unittest.main()
