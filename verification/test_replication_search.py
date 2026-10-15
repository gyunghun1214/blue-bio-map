"""Replication search record (prereg-replication-search-2026-10-15 6): the committed dist/replication-search.json is
reproducible from the research record and the published report; a run that searched another item than the current top item
is not shown as a search of it; an accepted replication cannot be published before the indices count it; the indicator build
reads neither file."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_replication_search import DEFAULT_OUTPUT, DEFAULT_RECORD, DEFAULT_REPORT, build, render, top_item  # noqa: E402

read = lambda p: json.loads(p.read_text(encoding="utf-8"))
RECORD, REPORT = read(DEFAULT_RECORD), read(DEFAULT_REPORT)
SPECIES = {s["aphia_id"]: s for s in REPORT["species"] + REPORT["candidate_species"]}


class ReplicationSearch(unittest.TestCase):
    def setUp(self):
        self.out = build(RECORD, REPORT)
        self.rows = {r["aphia_id"]: r for r in self.out["species"]}

    def test_committed_output_is_reproducible(self):
        self.assertEqual(DEFAULT_OUTPUT.read_text(encoding="utf-8"), render(self.out))
        self.assertEqual(self.out["prereg"], "research/verified-indices/prereg-replication-search-2026-10-15.md")
        self.assertEqual(self.out["report_version"], REPORT["method_version"])
        self.assertTrue(self.out["display_only"])
        self.assertEqual(set(self.rows), set(SPECIES))

    def test_status_follows_the_current_top_item(self):
        for aphia, r in self.rows.items():
            self.assertEqual(r["current_item"], top_item(SPECIES[aphia]))
            if SPECIES[aphia]["evidence_profile"]["top_item_replication"] == "replicated":
                self.assertEqual(r["status"], "replicated")
            elif r["status"] == "searched_none":
                self.assertTrue(r["sources_searched"] and r["last_searched_on"])
                self.assertTrue(any(x["item_is_current"] and x["result"] == "searched_none" for x in r["runs"]))

    def test_an_earlier_item_search_is_not_a_search_of_the_current_item(self):
        # 넙치: the 2026-10-13 run searched MEVFVP; the top item is P35 since 4.13
        rec = copy.deepcopy(RECORD)
        rec["runs"] = [r for r in rec["runs"] if r["run_id"] == "2026-10-13"]
        row = {r["aphia_id"]: r for r in build(rec, REPORT)["species"]}[275816]
        self.assertEqual(row["status"], "not_current_item")
        self.assertEqual(row["earlier_item_searched_on"], "2026-10-13")
        self.assertIsNone(row["last_searched_on"])

    def test_an_unopened_source_is_named_apart_and_a_run_needs_one_searched_source(self):
        rec = copy.deepcopy(RECORD)
        r = rec["runs"][0]["species"][0]
        r["sources"] = [{**x, "status": "unavailable"} for x in r["sources"]]
        with self.assertRaisesRegex(ValueError, "no source was actually searched"):
            build(rec, REPORT)

    def test_an_accepted_replication_waits_for_the_indices(self):
        rec = copy.deepcopy(RECORD)
        r = next(x for x in rec["runs"][-1]["species"]
                 if SPECIES[x["aphia_id"]]["evidence_profile"]["top_item_replication"] != "replicated"
                 and x["item"] == top_item(SPECIES[x["aphia_id"]]))
        r["result"], r["accepted_doi"] = "accepted", "10.1000/example"
        with self.assertRaisesRegex(ValueError, "added to the indicator config"):
            build(rec, REPORT)
        r["accepted_doi"] = None
        with self.assertRaisesRegex(ValueError, "needs its DOI"):
            build(rec, REPORT)

    def test_bad_records_stop_the_build(self):
        for change, message in ((lambda rec: rec.update(schema_version="replication-search-record-2"), "unknown"),
                                (lambda rec: rec["runs"][0]["species"].append(rec["runs"][0]["species"][0]), "listed twice"),
                                (lambda rec: rec["runs"][0]["species"][0].update(aphia_id=1), "not one of"),
                                (lambda rec: rec["runs"][0]["species"][0].update(result="maybe"), "result must be")):
            rec = copy.deepcopy(RECORD)
            change(rec)
            with self.assertRaisesRegex(ValueError, message):
                build(rec, REPORT)

    def test_the_indicator_build_reads_neither_file(self):
        source = (ROOT / "scripts/build_verified_indices.py").read_text(encoding="utf-8")
        self.assertNotIn("replication-search", source)
        self.assertNotIn("replication_search", source)


if __name__ == "__main__":
    unittest.main()
