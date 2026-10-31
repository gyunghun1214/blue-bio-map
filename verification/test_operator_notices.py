"""Who runs the map, how to reach the team and how it was made (2026-10-19, LKH's site fixes for the v3 review): the footer
line, the feedback link (a new issue on the public repository, outside the site), its issue template, the next-step
targets. The '만든 방법' list of the tools used to build the site was removed 2026-10-25."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FEEDBACK_URL = "https://github.com/gyunghun1214/blue-bio-map/issues/new?template=feedback.md"


def text(path):
    return (ROOT / path).read_text(encoding="utf-8")


class OperatorNoticeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = text("dist/index.html")

    def test_footer_operator_line(self):
        foot = self.html[self.html.index("<footer>"):self.html.index("</footer>")]
        # since 2026-10-21 (prompt 02) dist/operations.js adds the after-contest line from dist/operations.json to the span
        self.assertIn('<p class="foot-ops"><span data-ops-operator>운영: alt F4 팀(OCEAN 20 해커톤 출품)</span> · 갱신: 자료는 분기마다, 지표 규칙이 바뀌면 '
                      '버전 번호와 함께 공개 · <a class="foot-link" data-feedback="foot" href="' + FEEDBACK_URL
                      + '" target="_blank" rel="noopener">의견 보내기</a><span data-feedback-issue hidden> · '
                      '<a class="foot-link" href="' + FEEDBACK_URL + '" target="_blank" rel="noopener">GitHub 이슈</a></span></p>', foot)

    def test_feedback_stays_outside_the_site(self):
        # the coordinate dialog ends with the same link; the site has no form that takes personal details. Since
        # 2026-10-21 a form address in dist/operations.json (an outside survey, no account) can replace both links and the
        # footer keeps the issue link beside it (verification/test_operations.mjs)
        self.assertIn('절차는 기관 검토를 거쳐 확정합니다. <a class="coord-link" data-feedback="coord" href="' + FEEDBACK_URL
                      + '" target="_blank" rel="noopener">의견 보내기</a></p>', self.html)
        self.assertEqual(self.html.count(FEEDBACK_URL), 3)
        for page in ("dist/index.html", "dist/expedition.html"):
            self.assertNotRegex(text(page), r"<form\b|<textarea\b")

    def test_issue_template(self):
        tpl = text(".github/ISSUE_TEMPLATE/feedback.md")
        head, body = re.match(r"---\n(.*?)\n---\n(.*)", tpl, re.S).groups()
        self.assertIn('title: "[의견] "', head)
        self.assertRegex(head, r"(?m)^name: \S")
        self.assertRegex(head, r"(?m)^about: \S")
        self.assertEqual(re.findall(r"(?m)^### (.+)$", body),
                         ["어떤 종·화면을 보셨나요", "무엇을 하려고 쓰셨나요(연구·정책·교육·수산/양식·기타)", "도움이 된 점",
                          "고쳤으면 하는 점"])
        self.assertEqual(len([line for line in body.splitlines() if "개인정보" in line]), 1)

    def test_next_step_targets(self):
        self.assertEqual(re.findall(r'<p class="gate-next-tag">([^<]*)</p>', self.html),
                         ["목표 2027 상반기", "목표 2027 하반기", "목표 2028"])

    def test_tools_used_to_build_the_site_removed(self):
        # the '만든 방법' list (2026-10-19, prompt 8/10) was taken off the screen on LKH's request 2026-10-25; the measured
        # effect slot it held stays under the source notices (verification/test_operations.mjs)
        self.assertNotIn("만든 방법", self.html)
        self.assertNotIn("mt-made", self.html)
        self.assertNotIn("mt-made", text("dist/method.css"))
        # the early trial stays on record: .openai/ is kept and the development log (README until 2026-10-31, now
        # docs/development-log.md) says it is no longer used
        self.assertTrue((ROOT / ".openai/hosting.json").exists())
        self.assertIn("Codex/ChatGPT의 Sites 도구로만 갱신된다(초기 시험판, 지금은 쓰지 않음).", text("docs/development-log.md"))


if __name__ == "__main__":
    unittest.main()
