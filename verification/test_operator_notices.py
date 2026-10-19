"""Who runs the map and how to reach the team (2026-10-19, LKH's site fixes for the v3 review): the footer line, the
feedback link (a new issue on the public repository, outside the site), its issue template, and the next-step targets."""
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
        self.assertIn('<p class="foot-ops">운영: alt F4 팀(OCEAN 20 해커톤 출품) · 갱신: 자료는 분기마다, 지표 규칙이 바뀌면 '
                      '버전 번호와 함께 공개 · <a class="foot-link" href="' + FEEDBACK_URL
                      + '" target="_blank" rel="noopener">의견 보내기</a></p>', foot)

    def test_feedback_stays_outside_the_site(self):
        # the coordinate dialog ends with the same link; the site has no form that takes personal details
        self.assertIn('절차는 기관 검토를 거쳐 확정합니다. <a class="coord-link" href="' + FEEDBACK_URL
                      + '" target="_blank" rel="noopener">의견 보내기</a></p>', self.html)
        self.assertEqual(self.html.count(FEEDBACK_URL), 2)
        for page in ("dist/index.html", "dist/expedition.html"):
            self.assertNotRegex(text(page), r"<form\b|<textarea\b")

    def test_issue_template(self):
        tpl = text(".github/ISSUE_TEMPLATE/feedback.md")
        head, body = re.match(r"---\n(.*?)\n---\n(.*)", tpl, re.S).groups()
        self.assertIn('title: "[의견] "', head)
        self.assertRegex(head, r"(?m)^name: \S")
        self.assertRegex(head, r"(?m)^about: \S")
        self.assertEqual(re.findall(r"(?m)^### (.+)$", body),
                         ["어떤 종·화면을 보셨나요", "무엇을 하려고 쓰셨나요(연구·정책·교육·기타)", "고쳤으면 하는 점"])
        self.assertEqual(len([line for line in body.splitlines() if "개인정보" in line]), 1)

    def test_next_step_targets(self):
        self.assertEqual(re.findall(r'<p class="gate-next-tag">([^<]*)</p>', self.html),
                         ["목표 2027 상반기", "목표 2027 하반기", "목표 2028"])


if __name__ == "__main__":
    unittest.main()
