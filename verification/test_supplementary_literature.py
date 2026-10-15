"""관련 문헌 · 점수 미사용 (verified-4.13, prereg-4.13-2026-10-14 4): the committed file is reproducible, and the builder
refuses a row the rule does not admit. These rows never touch a score: no index, matrix, map colour, chip or ranking reads
the file, and their count is not the '최상위 근거 독립 재현 확인 중' label (formerly '근거 논문 1편')."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_supplementary_literature import DEFAULT_OUTPUT, DEFAULT_RECORD, DEFAULT_REPORT, RELATIONS, build, render  # noqa: E402

read = lambda p: json.loads(p.read_text(encoding="utf-8"))
RECORD, REPORT = read(DEFAULT_RECORD), read(DEFAULT_REPORT)
SPECIES = REPORT["species"] + REPORT["candidate_species"]


class SupplementaryLiterature(unittest.TestCase):
    def setUp(self):
        self.out = build(RECORD, REPORT)
        self.rows = self.out["records"]

    def test_committed_output_is_reproducible(self):
        self.assertEqual(DEFAULT_OUTPUT.read_text(encoding="utf-8"), render(self.out))
        # 4.18 (prereg-4.18-2026-10-15 2-3): the same 23 rows with four reasons settled rather than pending
        self.assertEqual(self.out["snapshot_date"], "2026-10-15")
        self.assertEqual(self.out["prereg"], "research/verified-indices/prereg-4.18-2026-10-15.md")

    def test_every_row_says_why_it_is_not_scored_and_how_far_it_was_read(self):
        self.assertTrue(self.rows)
        for r in self.rows:
            self.assertIn(r["relation"], RELATIONS)
            self.assertIn(r["checked_via"], ("full_text", "abstract"))
            self.assertLessEqual(r["checked_on"], self.out["snapshot_date"])
            self.assertTrue(r["not_scored_reason"].strip() and r["finding"].strip() and r["title_ko"].strip())
            self.assertIn(r["aphia_id"], {s["aphia_id"] for s in SPECIES})

    def test_a_paper_a_score_or_a_partial_record_shows_is_not_repeated_here(self):
        scored = {d.lower() for s in SPECIES for x in s["bioactivity_trace"] for d in x.get("original_paper_dois", [])}
        partial = {(REPORT["sources"].get(p["source_id"]) or {}).get("doi", "").lower()
                   for s in SPECIES for p in s["bioactivity_partial"]}
        for r in self.rows:
            self.assertNotIn(r["doi"].lower(), scored, r["doi"])
            self.assertNotIn(r["doi"].lower(), partial, r["doi"])
        # the six papers of the 2026-10-14 brief that became partial records are there, not here
        for doi in ("10.1186/s13567-021-00908-y", "10.1155/2014/379234", "10.1016/j.foodchem.2022.134127"):
            self.assertIn(doi.lower(), partial)

    def test_the_contrary_row_is_published_with_its_reason(self):
        contrary = [r for r in self.rows if r["relation"] == "contrary"]
        self.assertEqual([(r["aphia_id"], r["doi"]) for r in contrary], [(371986, "10.1007/s00044-022-02903-0")])
        self.assertEqual(contrary[0]["checked_via"], "full_text")
        self.assertIn("표적", contrary[0]["not_scored_reason"])

    def test_rows_are_sorted_species_then_relation_then_newest(self):
        order = ["contrary", "same_item_followup", "new_quantitative", "link_support", "context", "excluded"]
        key = lambda r: (r["aphia_id"], order.index(r["relation"]), -r["year"], r["doi"])
        self.assertEqual(self.rows, sorted(self.rows, key=key))

    def refuses(self, change):
        record = copy.deepcopy(RECORD)
        change(record["records"][0])
        with self.assertRaises(ValueError):
            build(record, REPORT)

    def test_the_rule(self):
        self.refuses(lambda r: r.update(doi=""))                                   # a source without a DOI (team decision)
        self.refuses(lambda r: r.pop("doi"))
        self.refuses(lambda r: r.update(doi="10.1016/j.procbio.2016.01.009"))      # a paper a score uses
        self.refuses(lambda r: r.update(doi="10.1186/s13567-021-00908-y"))         # a paper a partial record shows
        self.refuses(lambda r: r.update(relation="scored"))
        self.refuses(lambda r: r.update(aphia_id=1))                               # outside the 30
        self.refuses(lambda r: r.update(year=2027))
        self.refuses(lambda r: r.update(checked_via="library_copy"))
        self.refuses(lambda r: r.update(checked_on="2026-10-16"))                  # after the snapshot
        self.refuses(lambda r: r.update(not_scored_reason=" "))
        self.refuses(lambda r: r.update(finding=""))

    def test_a_duplicate_row_and_an_unknown_schema_stop_the_build(self):
        record = copy.deepcopy(RECORD)
        record["records"].append(copy.deepcopy(record["records"][0]))
        with self.assertRaises(ValueError):
            build(record, REPORT)
        with self.assertRaises(ValueError):
            build({**RECORD, "schema_version": "supplementary-literature-2"}, REPORT)

    def test_the_published_file_carries_only_the_public_fields(self):
        allowed = {"aphia_id", "doi", "year", "journal", "title_ko", "finding", "relation",
                   "not_scored_reason", "checked_on", "checked_via"}
        for r in self.rows:
            self.assertEqual(set(r), allowed)


if __name__ == "__main__":
    unittest.main()
