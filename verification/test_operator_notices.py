"""Who runs the map, how to reach the team and how it was made (2026-10-19, LKH's site fixes for the v3 review): the footer
line, the feedback link (a new issue on the public repository, outside the site), its issue template, the next-step
targets, and the '만든 방법' list of the tools used to build the site."""
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

    def test_tools_used_to_build_the_site(self):
        # prompt 8/10: the tools the repository's history shows (authors Codex and Sites, .openai/hosting.json, the Claude
        # co-author lines, the Workers AI route of the guide chatbot until 2026-10-15), listed under the source notices
        made = self.html[self.html.index('<section class="mt-made"'):]
        made = made[:made.index("</section>")]
        self.assertLess(self.html.index("(SIL OFL 1.1).</p>"), self.html.index('<section class="mt-made"'))
        rows = [(re.sub(r"<[^>]+>", "", b), re.sub(r"<[^>]+>", "", t))
                for b, t in re.findall(r"<li><b>(.*?)</b><span>(.*?)</span></li>", made)]
        self.assertEqual(rows, [
            ("Claude Code(Anthropic)", "사이트 코드, 자료 수집·지표 계산 스크립트, 자동 검사 작성"),
            ("Claude(Anthropic)", "기획 정리, 자료 점검, 발표 자료·대본 초안"),
            ("ChatGPT(OpenAI)", "화면 디자인 시안"),
            ("Codex·Sites(OpenAI)", "초기 시험판 일부 코드와 시험 배포(2026-09, 지금 공개 주소와 별도)"),
            ("안내 챗봇", "2026-10-15까지 일부 답에 Cloudflare Workers AI 사용, 지금은 고정 답만")])
        self.assertIn('<p class="mt-made-note">자료 선택, 지표 규칙, 최종 판단은 팀이 했습니다. 서비스 안에는 AI가 없습니다'
                      "(안내 챗봇은 고정 질문·답).</p>", made)
        # the early trial stays on record: .openai/ is kept and README says it is no longer used
        self.assertTrue((ROOT / ".openai/hosting.json").exists())
        self.assertIn("Codex/ChatGPT의 Sites 도구로만 갱신된다(초기 시험판, 지금은 쓰지 않음).", text("README.md"))


if __name__ == "__main__":
    unittest.main()
