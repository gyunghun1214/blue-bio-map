"""검증 성적표 (scripts/build_posthoc_scorecard.py): the committed dist/posthoc-scorecard.json and reports/posthoc-scorecard.csv
are reproducible from posthoc.validation_sets of the published report and config/posthoc-scorecard.json; every check is
listed with its stored result unchanged; outcome_class follows the config rule; a same-data or two-species consistency check
is never 통과; the indicator build reads neither file."""
import copy
import csv
import io
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_posthoc_scorecard import (CLASSES, DEFAULT_CONFIG, DEFAULT_CSV, DEFAULT_OUTPUT, DEFAULT_REPORT,  # noqa: E402
                                     build, render, render_csv)

read = lambda p: json.loads(p.read_text(encoding="utf-8"))
CONFIG, REPORT = read(DEFAULT_CONFIG), read(DEFAULT_REPORT)

EXPECTED = {
    "MFPI": "통과",
    "MBPI": "실패",
    "MBPI_RX": "실패",
    "MCUI": "일관성 확인(독립 아님)",
    "MCUI_stock_decline": "일관성 확인(독립 아님)",
    "MCUI_preliminary": "실패",
    "MCUI_preliminary_criterion_A": "검증 불성립",  # 4 evaluable species, the criterion fixed at least 8
    "MCUI_trend": "실패 후 사용 중단",  # the +10 adjustment stopped in 4.11
}


class PosthocScorecard(unittest.TestCase):
    def setUp(self):
        self.out = build(CONFIG, REPORT)
        self.rows = {r["key"]: r for r in self.out["rows"]}
        self.sets = REPORT["posthoc"]["validation_sets"]

    def test_committed_output_is_reproducible(self):
        self.assertEqual(DEFAULT_OUTPUT.read_text(encoding="utf-8"), render(self.out))
        self.assertEqual(DEFAULT_CSV.read_text(encoding="utf-8"), render_csv(self.out))
        self.assertEqual(self.out["report_version"], REPORT["method_version"])
        self.assertTrue(self.out["display_only"])

    def test_every_check_listed_with_its_stored_result(self):
        self.assertEqual(set(self.rows), set(self.sets))
        self.assertEqual(self.out["total"], len(self.sets))
        for key, row in self.rows.items():
            self.assertEqual(row["result"], self.sets[key]["result"], key)

    def test_outcome_classes(self):
        self.assertEqual({k: r["outcome_class"] for k, r in self.rows.items()}, EXPECTED)
        self.assertEqual(self.out["counts"], {c: list(EXPECTED.values()).count(c) for c in CLASSES})
        self.assertEqual(self.out["counts"]["통과"], 1)
        for row in self.rows.values():
            self.assertIn(row["outcome_class"], CLASSES)
            if row["result"] in ("consistent_same_data", "reproduced_n2"):
                self.assertNotEqual(row["outcome_class"], "통과")
                self.assertNotIn("통과", row["outcome_label"])
            if row["outcome_class"] == "통과":
                self.assertEqual(row["result"], "passed")
                self.assertEqual(row["action"], "none")

    def test_outcome_rule_reacts_to_the_stored_values(self):
        report = copy.deepcopy(REPORT)
        sets = report["posthoc"]["validation_sets"]
        sets["MCUI_preliminary_criterion_A"]["evaluable"] = 8
        sets["MCUI"]["result"] = "not_computable"
        report["method"]["posthoc"] = report["posthoc"]
        rows = {r["key"]: r for r in build(CONFIG, report)["rows"]}
        self.assertEqual(rows["MCUI_preliminary_criterion_A"]["outcome_class"], "실패")
        self.assertEqual(rows["MCUI"]["outcome_class"], "검증 불성립")
        sets["MFPI"]["result"] = "unknown"
        with self.assertRaises(ValueError):
            build(CONFIG, report)

    def test_a_new_check_needs_its_scorecard_text(self):
        report = copy.deepcopy(REPORT)
        report["posthoc"]["validation_sets"]["NEW"] = {"result": "passed"}
        report["method"]["posthoc"] = report["posthoc"]
        with self.assertRaises(ValueError):
            build(CONFIG, report)

    def test_indicator_badges(self):
        self.assertEqual({k: v["label"] for k, v in self.out["indicators"].items()},
                         {"MFPI": "검증 통과", "MBPI": "검증 미통과", "MCUI": "제한적 확인"})
        self.assertEqual(sum(v["checks"] for v in self.out["indicators"].values()), len(self.sets))

    def test_actions_follow_the_current_report(self):
        preliminary = sum(1 for s in REPORT["species"] + REPORT["candidate_species"] if s.get("mcui_basis") == "preliminary")
        self.assertGreater(preliminary, 0)
        self.assertEqual(self.rows["MCUI_preliminary"]["action"], "kept")
        self.assertIn(f"{preliminary}종의 MCUI에 예비 평가로 사용", self.rows["MCUI_preliminary"]["action_detail"])
        self.assertEqual(self.rows["MCUI_trend"]["action"], "removed")
        self.assertEqual(self.out["preregistered"], 7)
        for row in self.rows.values():
            for path in row["records"]:
                self.assertTrue((ROOT / path).is_file(), path)

    def test_csv_columns(self):
        text = DEFAULT_CSV.read_text(encoding="utf-8")
        self.assertTrue(text.startswith("﻿"))
        rows = list(csv.reader(io.StringIO(text.lstrip("﻿"))))
        self.assertEqual(len(rows), len(self.sets) + 1)
        head = rows[0]
        for col in ("검증 이름", "무엇을 확인했나", "사전 등록", "outcome_class", "실패 후 조치", "기록 파일"):
            self.assertIn(col, head)
        self.assertEqual([r[head.index("outcome_class")] for r in rows[1:]],
                         [self.rows[k]["outcome_class"] for k in sorted(self.rows, key=lambda k: self.rows[k]["order"])])

    def test_build_does_not_change_the_report(self):
        before = copy.deepcopy(REPORT)
        build(CONFIG, REPORT)
        self.assertEqual(REPORT, before)

    def test_indicator_build_reads_neither_file(self):
        for name in ("build_verified_indices.py", "build_matrix_readiness.py", "posthoc_validation.py"):
            self.assertNotIn("posthoc-scorecard", (ROOT / "scripts" / name).read_text(encoding="utf-8"), name)


if __name__ == "__main__":
    unittest.main()
