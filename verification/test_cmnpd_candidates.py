"""CMNPD candidate-compound layer: dist/cmnpd-candidates.json is reproducible from the research record and the published report,
lists all 30 species, publishes only CMNPD IDs and counts (no name, structure, InChIKey or activity value), carries the
CC BY-NC-SA 4.0 licence and is read by no score: the indicator build does not read it."""
import copy
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_cmnpd_candidates import DEFAULT_OUTPUT, DEFAULT_RECORD, DEFAULT_REPORT, build, render  # noqa: E402

read = lambda p: json.loads(p.read_text(encoding="utf-8"))
RECORD, REPORT = read(DEFAULT_RECORD), read(DEFAULT_REPORT)
SPECIES = {s["aphia_id"] for s in REPORT["species"] + REPORT["candidate_species"]}
INCHIKEY = re.compile(r"[A-Z]{14}-[A-Z]{10}-[A-Z]")


class CmnpdCandidates(unittest.TestCase):
    def setUp(self):
        self.out = build(RECORD, REPORT)

    def test_committed_output_is_reproducible(self):
        self.assertEqual(DEFAULT_OUTPUT.read_text(encoding="utf-8"), render(self.out))
        self.assertEqual(self.out["schema_version"], "cmnpd-candidates-1")
        self.assertIs(self.out["display_only"], True)
        self.assertIs(self.out["used_in_scores"], False)
        self.assertEqual({r["aphia_id"] for r in self.out["species"]}, SPECIES)
        self.assertEqual(len(self.out["species"]), 30)

    def test_counts_add_up(self):
        t = self.out["totals"]
        rows = self.out["species"]
        self.assertEqual(t["pairs"], sum(len(r["compound_ids"]) for r in rows))
        self.assertEqual(t["link_gap"], t["pairs"] - t["chembl_linked"])
        for r in rows:
            self.assertEqual(r["compound_count"], len(r["compound_ids"]))
            self.assertEqual(r["link_gap"], r["compound_count"] - r["chembl_linked"])
            self.assertLessEqual(r["chembl_linked"], r["mbpi_same_inchikey"])
            self.assertEqual(r["organism_id"] is None, r["compound_count"] == 0)
        # 2026-10-15 snapshot: 해삼 122 equals the count the live profile already published from CMNPD
        self.assertEqual(next(r for r in rows if r["aphia_id"] == 241776)["compound_count"], 122)

    def test_only_ids_and_counts_are_published(self):
        for path in (DEFAULT_OUTPUT, DEFAULT_RECORD):
            text = path.read_text(encoding="utf-8")
            self.assertIsNone(INCHIKEY.search(text), path.name)
            self.assertNotIn("smiles", text.lower())
            self.assertNotIn("InChI=", text)
        self.assertEqual(self.out["source"]["license"], "CC BY-NC-SA 4.0")
        with self.assertRaises(ValueError):
            rec = copy.deepcopy(RECORD)
            next(s for s in rec["species"] if s["compounds"])["compounds"][0]["name"] = "x"
            build(rec, REPORT)

    def test_every_species_once(self):
        rec = copy.deepcopy(RECORD)
        rec["species"] = rec["species"][1:]
        with self.assertRaises(ValueError):
            build(rec, REPORT)

    def test_no_score_reads_it(self):
        for path in (ROOT / "scripts").glob("build_*.py"):
            if path.name != "build_cmnpd_candidates.py":
                self.assertNotIn("cmnpd-candidates", path.read_text(encoding="utf-8"), path.name)
        for path in (ROOT / "config").glob("verified-indices-v*.json"):
            self.assertNotIn("cmnpd-candidates", path.read_text(encoding="utf-8"), path.name)


if __name__ == "__main__":
    unittest.main()
