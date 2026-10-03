"""MBPI lineage: the tables reproduce the published scores, every record has a source, every score change is explained."""
import csv
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import lineage  # noqa: E402


def item(value, percentile, factor, records, stratum="s1"):
    return {"stratum_kind": "peptide", "peptide_sequence": "GKY", "stratum_id": stratum, "pIC50": value, "percentile": percentile,
            "evidence_factor": factor, "adjusted": percentile * factor, "record_ids": records, "original_paper_dois": ["10.1/x"]}


def report(species, version="1"):
    return {"sources": {"ahtpdb": {"version": version}},
            "species": [{"aphia_id": a, "scientific_name": f"S{a}", "scores": {"MBPI": m}, "bioactivity_trace": items}
                        for a, m, items in species]}


class LineageTables(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = lineage.tables()
        cls.log = json.loads(lineage.CHANGELOG.read_text(encoding="utf-8"))
        cls.results = {r["check"].split(".")[0]: r for r in lineage.checks(cls.t, cls.log)}

    def test_1_reproduces_published_mbpi(self):
        self.assertEqual(self.results["1"]["failures"], [])
        self.assertGreater(self.results["1"]["total"], 0)

    def test_2_referential_integrity(self):
        self.assertEqual(self.results["2"]["failures"], [])

    def test_3_every_record_has_source(self):
        self.assertEqual(self.results["3"]["failures"], [])

    def test_4_stratum_order(self):
        self.assertEqual(self.results["4"]["failures"], [])

    def test_5_every_score_change_explained(self):
        self.assertEqual(self.results["5"]["failures"], [])

    def test_6_posthoc_cases_smoke(self):
        r = self.results["6"]
        if r["total"] == 0:
            self.skipTest(r["note"])
        self.assertEqual(r["failures"], [])

    def test_excluded_records_are_kept_with_reason(self):
        excluded = [c for c in self.t["contributions"] if not c["included"]]
        self.assertTrue(excluded)
        self.assertTrue(all(c["exclusion_reason"] and c["contribution_value"] == "" for c in excluded))

    def test_committed_tables_are_current(self):
        folder = lineage.OUT / self.t["run"]["run_id"]
        for name, rows in (("species_compound_link", self.t["links"]), ("bioassay_record", self.t["records"]),
                           ("score_contribution", self.t["contributions"])):
            with open(folder / f"{name}.csv", encoding="utf-8", newline="") as f:
                committed = list(csv.DictReader(f))
            self.assertEqual(committed, [{k: "" if v is None else str(v) for k, v in r.items()} for r in rows],
                             f"{name}.csv is stale: python scripts/lineage.py export")

    def test_explain_reaches_source_links(self):
        text = lineage.explain(self.t, 836033)
        self.assertIn("★", text)
        self.assertIn("https://doi.org/", text)


class Compare(unittest.TestCase):
    def test_classifies_each_change_and_flags_unexplained(self):
        old = report([(1, 50.0, [item(5.0, 50.0, 1.0, ["a"])]), (2, 40.0, [item(4.0, 40.0, 1.0, ["b"], "s2")])])
        new = report([(1, 60.0, [item(5.0, 60.0, 1.0, ["a"])]), (2, 45.0, [item(4.0, 40.0, 1.0, ["b"], "s2")]),
                      (3, 30.0, [item(3.0, 40.0, .75, ["c"])])], version="2")
        got = {(e["entity_type"], e["entity_id"].split("|")[0], e["change_type"]) for e in lineage.compare(old, new, "r1", "r2")}
        self.assertEqual(got, {("source", "ahtpdb", "version"), ("assay", "1", "version"),
                               ("species", "2", "unexplained"), ("assay", "3", "evidence")})

    def test_evidence_weight_and_record_changes(self):
        old = report([(1, 37.5, [item(5.0, 50.0, .75, ["a"])])])
        new = report([(1, 50.0, [item(5.0, 50.0, 1.0, ["a", "b"])])])
        types = sorted(e["change_type"] for e in lineage.compare(old, new, "r1", "r2"))
        self.assertEqual(types, ["evidence", "evidence"])


if __name__ == "__main__":
    unittest.main()
