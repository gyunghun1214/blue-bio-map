"""주간 점검 · Claude 수정안 안전장치 (2026-11-02, LKH 'AI가 스스로 점검·관리').

scripts/weekly_check.py 가 고칠 것을 바르게 가르고, scripts/ai_fix_guard.py 가 점수 자료·설정·배포 파일과 큰 수정을 막고,
ai-fix.yml 이 꺼진 채로 설치되어 Claude 단계에 쓰기 권한이 없는지 본다.
Run: python -m unittest verification/test_weekly_check.py
"""
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import ai_fix_guard  # noqa: E402
import weekly_check  # noqa: E402

LIVE_OK = {"files": [{"path": "/", "status": 200, "match": None}, {"path": "/app.js", "status": 200, "match": True}],
           "api_ask": {"status": 200, "ai": True}}


def link(url, result, status="404"):
    return {"url": url, "status": status, "result": result, "final_url": "", "locations": "dist/x.json $.a"}


class FindProblems(unittest.TestCase):
    def test_all_clear(self):
        r = weekly_check.find_problems([link("https://a.org", "정상", "200")], LIVE_OK, "success", {})
        self.assertEqual(r["problems"], [])

    def test_failed_verify_is_a_problem_skipped_is_not(self):
        self.assertEqual(len(weekly_check.find_problems([], LIVE_OK, "failure", {})["problems"]), 1)
        self.assertEqual(weekly_check.find_problems([], LIVE_OK, "skipped", {})["problems"], [])

    def test_known_links_go_to_notes(self):
        links = [link("https://old.example/a", "깨짐"), link("https://new.example/b", "깨짐"),
                 link("https://moved.example/c", "이동됨", "301"), link("https://bot.example/d", "확인 불가", "403")]
        r = weekly_check.find_problems(links, LIVE_OK, "success", {"https://old.example/a": "러시아 정부 출처"})
        self.assertEqual([p["what"].split()[-1] for p in r["problems"]], ["https://new.example/b", "https://moved.example/c"])
        self.assertEqual(r["notes"][0]["kind"], "알려진 링크")

    def test_live_mismatch_and_down(self):
        live = {"files": [{"path": "/app.js", "status": 200, "match": False}, {"path": "/x", "status": 503, "match": None}],
                "api_ask": {"status": 200, "ai": False}}
        r = weekly_check.find_problems([], live, "success", {})
        self.assertEqual(len(r["problems"]), 2)
        self.assertTrue(any("ai:false" in n["what"] for n in r["notes"]))  # AI 꺼짐은 의도일 수 있어 참고로만

    def test_check_live_compares_with_dist(self):
        with tempfile.TemporaryDirectory() as d:
            for name in weekly_check.LIVE_FILES:
                Path(d, name).write_bytes(b"same")

            def fetch(url, timeout=30):
                if "api/ask" in url:
                    return 200, b'{"ai":true}'
                return 200, b"other" if "app.js" in url else b"same"
            live = weekly_check.check_live("https://x.example", Path(d), fetch)
        by = {r["path"]: r["match"] for r in live["files"]}
        self.assertIs(by["/app.js"], False)
        self.assertIs(by["/assessments.json"], True)
        self.assertIs(live["api_ask"]["ai"], True)


class AiGuard(unittest.TestCase):
    def test_number_guard_drops_invented_numbers(self):
        def post(text):
            return lambda req: json.dumps({"choices": [{"message": {"content": text}}]}).encode()
        brief = {"problems": [{"what": "깨짐 404 https://a.org"}]}
        ok, model = weekly_check.ai_summary(brief, "t", post("링크 1건이 404입니다."))
        self.assertIsNotNone(ok)
        bad, why = weekly_check.ai_summary(brief, "t", post("링크 37건이 깨졌습니다."))
        self.assertIsNone(bad)
        self.assertIn("37", why)

    def test_no_token_no_ai(self):
        self.assertEqual(weekly_check.ai_summary({}, None), (None, "토큰 없음"))


class FixGuard(unittest.TestCase):
    def test_small_link_fix_passes(self):
        self.assertEqual(ai_fix_guard.check("1\t1\tdist/license-matrix.json\n"), [])

    def test_blocked_files(self):
        for path in ("dist/assessments.json", "config/verified-indices-v3.28.json", ".github/workflows/verify.yml",
                     "worker/index.mjs", "dist/_headers", "CLAUDE.md", "wrangler.jsonc", "dist/matrix-readiness.json"):
            self.assertTrue(ai_fix_guard.check(f"1\t1\t{path}\n"), path)

    def test_too_big(self):
        many = "".join(f"1\t0\tdist/f{i}.js\n" for i in range(11))
        self.assertTrue(any("파일" in r for r in ai_fix_guard.check(many)))
        self.assertTrue(any("줄" in r for r in ai_fix_guard.check("400\t0\tdist/app.js\n")))


class Workflows(unittest.TestCase):
    fix = (ROOT / ".github/workflows/ai-fix.yml").read_text(encoding="utf-8")
    weekly = (ROOT / ".github/workflows/weekly-check.yml").read_text(encoding="utf-8")

    def test_fix_is_off_unless_switched_on(self):
        self.assertIn("if: vars.AI_FIX_ENABLED == 'true'", self.fix)
        self.assertIn("vars.AI_FIX_ENABLED == 'true' && vars.AI_FIX_AUTO == 'true'", self.weekly)

    def test_claude_job_cannot_write(self):
        draft = self.fix.split("\n  propose:")[0].split("\n  draft:")[1]
        perms = re.search(r"permissions:\n((?:\s{6}.+\n)+)", draft).group(1)
        self.assertNotIn("write", perms)
        self.assertIn("persist-credentials: false", draft)
        self.assertIn("Bash(git push:*)", draft)

    def test_action_pinned_and_pr_is_draft(self):
        self.assertRegex(self.fix, r"anthropics/claude-code-action@[0-9a-f]{40}\b")
        self.assertIn("gh pr create --draft", self.fix)
        self.assertNotIn("gh pr merge", self.fix)
        self.assertNotIn("gh pr merge", self.weekly)

    def test_known_links_file(self):
        known = json.loads((ROOT / "config/weekly-check.json").read_text(encoding="utf-8"))["known_links"]
        self.assertTrue(all(u.startswith("http") and note for u, note in known.items()))


if __name__ == "__main__":
    unittest.main()
