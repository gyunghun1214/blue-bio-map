"""Display-only trait evidence (team-lead decision 2026-10-03): the committed file is reproducible, and the builder
refuses rows outside the admission rule. These rows never touch a score."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_trait_evidence import DEFAULT_OUTPUT, DEFAULT_RECORD, DEFAULT_REPORT, build, render  # noqa: E402

read = lambda p: json.loads(p.read_text(encoding="utf-8"))
RECORD, REPORT = read(DEFAULT_RECORD), read(DEFAULT_REPORT)


class TraitEvidence(unittest.TestCase):
    def test_committed_output_is_reproducible(self):
        self.assertEqual(DEFAULT_OUTPUT.read_text(encoding="utf-8"), render(build(RECORD, REPORT)))

    def test_species_per_trait(self):
        rows = build(RECORD, REPORT)["records"]
        per = lambda t: sorted({r["aphia_id"] for r in rows if r["trait"] == t})
        self.assertEqual(per("antioxidant"), [281273, 371986])   # 참조기, 감태
        self.assertEqual(per("diabetes"), [231750, 371986])      # 바지락, 감태
        self.assertEqual(per("fungus") + per("pain"), [])

    def test_pending_rows_are_not_published(self):
        published = {(r["aphia_id"], r["trait"]) for r in build(RECORD, REPORT)["records"]}
        self.assertNotIn((275816, "antioxidant"), published)   # 넙치: abstract only
        self.assertNotIn((1061762, "fungus"), published)       # 꽃게: no printed sequence

    def refuses(self, change):
        record = copy.deepcopy(RECORD)
        change(record["records"][0])
        with self.assertRaises(ValueError):
            build(record, REPORT)

    def test_rule(self):
        self.refuses(lambda r: r.update(verified_against="abstract"))
        self.refuses(lambda r: r.update(relation=">"))
        self.refuses(lambda r: r.update(material="extract"))
        self.refuses(lambda r: r.update(trait="ace"))
        self.refuses(lambda r: r.update(aphia_id=1))
        self.refuses(lambda r: r.update(doi=""))
        self.refuses(lambda r: r.update(value=0))
        self.refuses(lambda r: r.pop("evidence"))

    def test_scores_are_untouched(self):
        # the report does not read this file: no source id or method key names it
        self.assertNotIn("trait-evidence", json.dumps(REPORT["method"]))


if __name__ == "__main__":
    unittest.main()
