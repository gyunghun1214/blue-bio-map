"""Method change ledger (research/method-changelog.json) and the current/history split of matrix_rule."""
import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_matrix_readiness as M  # noqa: E402
from build_method_changelog import NOTES, OUTPUTS, TIMINGS, build, public_configs  # noqa: E402


def _git(*args):
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


class MethodChangelogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger = build()
        cls.assessments = json.loads((ROOT / "dist/assessments.json").read_text(encoding="utf-8"))
        cls.readiness = json.loads((ROOT / "dist/matrix-readiness.json").read_text(encoding="utf-8"))

    def test_committed_copies_are_reproducible(self):
        serialized = json.dumps(self.ledger, ensure_ascii=False, indent=2) + "\n"
        for rel in OUTPUTS:
            self.assertEqual((ROOT / rel).read_text(encoding="utf-8"), serialized, rel)

    def test_one_entry_per_published_version_in_order(self):
        versions = [e["method_version"] for e in self.ledger["entries"]]
        self.assertEqual(versions, [v for v, _ in public_configs()])
        self.assertEqual(versions[0], "verified-pilot-1")
        self.assertEqual(versions[-1], self.assessments["method_version"])
        self.assertNotIn("verified-4.15", versions)
        self.assertIn("verified-4.15", self.ledger["not_listed"])
        app = (ROOT / "dist/app.js").read_text(encoding="utf-8")
        listed = re.search(r"const VERIFIED = (\[[^\]]*\]);", app).group(1)
        self.assertEqual(versions[1:], json.loads(listed.replace("'", '"')))

    def test_every_entry_has_the_asked_columns(self):
        dates = [e["published_on"] for e in self.ledger["entries"]]
        self.assertEqual(dates, sorted(dates))
        for e in self.ledger["entries"]:
            with self.subTest(e["method_version"]):
                self.assertRegex(e["published_on"], r"^2026-\d\d-\d\d$")
                self.assertTrue(e["summary"] and e["reason"] and e["decided_by"])
                self.assertIn(e["timing"], TIMINGS)
                self.assertTrue(e["timing_basis"])
                self.assertEqual(e["rule_changed"], e["timing"] != "규칙 변경 없음")
                for doc in [e["preregistration"]] + e["records"]:
                    if doc:
                        self.assertTrue((ROOT / doc).exists(), doc)

    def test_score_impact_comes_from_the_archives(self):
        by = {e["method_version"]: e for e in self.ledger["entries"]}
        # 4.18 moved one species (청각 MBPI 0.4 -> 0.6, BBVI 18.5 -> 18.6) and no type; 4.17 placed 13 more species
        self.assertEqual(by["verified-4.18"]["score_impact"], {"species_changed": 1, "by_axis": {"MFPI": 0, "MBPI": 1, "MCUI": 0, "BBVI": 1},
                                                               "matrix_type_changed": 0, "matrix_points": 29})
        self.assertEqual(by["verified-4.17"]["score_impact"]["matrix_points"], 29)
        self.assertEqual(by["verified-4.14"]["score_impact"]["matrix_points"], 16)
        self.assertEqual(by["verified-4.16"]["score_impact"]["species_changed"], 0)
        self.assertIsNone(by["verified-pilot-2.1"]["score_impact"])   # no archived 2.0 or 2.1 report: 미확인
        # 4.19 gave 멍게 an MCUI (Rapid LC preliminary, LC 10): one species, one type, 30 points
        self.assertEqual(by["verified-4.19"]["score_impact"], {"species_changed": 1, "by_axis": {"MFPI": 0, "MBPI": 0, "MCUI": 1, "BBVI": 0},
                                                               "matrix_type_changed": 1, "matrix_points": 30})
        self.assertEqual(by[self.assessments["method_version"]]["score_impact"]["matrix_points"], self.readiness["matrix_points"])

    def test_weights_and_lines_never_moved(self):
        c = self.ledger["constants"]
        self.assertEqual((c["mfpi_weights"]["value"], c["mfpi_weights"]["changed_in"]), ([0.8, 0.1, 0.1], []))
        self.assertEqual((c["bbvi_default_food_weight"]["value"], c["bbvi_default_food_weight"]["changed_in"]), (0.5, []))
        self.assertEqual((c["matrix_thresholds"]["value"], c["matrix_thresholds"]["changed_in"]), ([50, 50], []))

    def test_timing_follows_the_records(self):
        by = {e["method_version"]: e for e in self.ledger["entries"]}
        # each pre-registration says the rule came after the results it changes were seen
        for v in ("verified-4.2", "verified-4.3", "verified-4.10", "verified-4.11", "verified-4.12", "verified-4.14", "verified-4.17", "verified-4.19"):
            self.assertEqual(by[v]["timing"], "결과 확인 후", v)
        self.assertEqual(self.ledger["counts"]["preregistered"], 13)
        self.assertEqual(self.ledger["current"]["label"],
                         f"{self.assessments['method_version']} · {by[self.assessments['method_version']]['published_on']} 동결")

    def test_preregistration_commits_come_before_the_config(self):
        if _git("rev-parse", "--is-shallow-repository") != "false":
            self.skipTest("needs the full git history (git fetch --unshallow)")
        first = lambda path: _git("log", "--diff-filter=A", "--format=%ct", "--", path).splitlines()[-1:]
        for e in self.ledger["entries"]:
            if not e["preregistration"]:
                continue
            with self.subTest(e["method_version"]):
                pre, conf = first(e["preregistration"]), first(e["config"])
                self.assertTrue(pre and conf)
                self.assertLess(int(pre[0]), int(conf[0]))
                commit = _git("log", "--diff-filter=A", "--format=%H", "--", e["preregistration"]).splitlines()[-1]
                self.assertEqual(_git("show", "--name-only", "--format=", commit).split(), [e["preregistration"]])

    def test_current_matrix_rule_has_no_withdrawn_sentence(self):
        rule = self.readiness["matrix_rule"]
        current = json.dumps({k: v for k, v in rule.items() if k != "history"}, ensure_ascii=False)
        withdrawn = rule["history"]["withdrawn_sentences"]
        self.assertEqual(len(withdrawn), 4)
        for row in withdrawn:
            self.assertNotIn(row["text"], current)
        for phrase in ("reference information only", "joins on the same terms", "its failed back-test label", "Since 3.27",
                       "4.2:", "4.3:", "4.14:", "team-lead decision"):
            self.assertNotIn(phrase, current)
        self.assertIn("preliminary assessment gives the MCUI", rule["substitute_mcui_note"])
        # nothing was lost: the config text is the withdrawn sentences plus the ones still in force, in order
        config = self.assessments["method"]["matrix"]["substitute_mcui_note"]
        for row in withdrawn:
            self.assertIn(row["text"], config)
        olds = {(r["field"], json.dumps(r["value"], ensure_ascii=False)) for r in rule["history"]["field_versions"]}
        self.assertIn(("substitute_mcui_note", json.dumps(config, ensure_ascii=False)), olds)

    def test_an_unclassified_rule_sentence_stops_the_build(self):
        method = json.loads(json.dumps(self.assessments["method"]))
        method["matrix"]["substitute_mcui_note"] += " 4.19: a new sentence."
        with self.assertRaises(ValueError):
            M.current_rule(method["matrix"], method, "verified-4.18")
        method = json.loads(json.dumps(self.assessments["method"]))
        method["mcui_scope"]["reference_bases"] = []
        with self.assertRaises(ValueError):
            M.current_rule(method["matrix"], method, "verified-4.18")

    def test_every_note_is_written(self):
        self.assertEqual(set(NOTES), {v for v, _ in public_configs()})


if __name__ == "__main__":
    unittest.main()
