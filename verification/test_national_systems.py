"""'근거와 방법' 01: the national marine-life systems read beside this map (2026-10-21, 사이트 v4 prompt 03, evaluation C1).
Each row says what the system gives and how this map relates to it, every fact carries a dated public source, and the
text neither claims a contact or partnership nor talks the other systems or this map down."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class NationalSystemsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        html = (ROOT / "dist/index.html").read_text(encoding="utf-8")
        fold = html[html.index('id="mt-acc-01"'):html.index('id="mt-acc-02"')]
        cls.sec = fold[fold.index('<section class="mt-nat"'):fold.index("</section>", fold.index('<section class="mt-nat"'))]
        cls.fold = fold

    def test_rows(self):
        rows = re.findall(r'<tr><th scope="row"><b>([^<]+)</b><small>([^<]+)</small></th>'
                          r'<td data-label="무엇을 주나">([^<]+)</td><td data-label="단위">([^<]+)</td>'
                          r'<td data-label="이 지도와의 관계">([^<]+)</td></tr>', self.sec)
        self.assertEqual([r[0] for r in rows], ["MBRIS", "해양생물 공간정보시스템", "해양바이오뱅크", "이 지도"])
        self.assertIn("통합종정보", rows[0][2])
        self.assertIn("분포 정보", rows[1][2])
        self.assertIn("1~3등급", rows[2][2])
        self.assertIn("A~C", rows[2][2])
        self.assertIn("국가 시스템과 함께 읽기", self.fold)

    def test_sources(self):
        src = self.sec[self.sec.index('<p class="mt-nat-src">'):]
        links = re.findall(r'<a href="(https://[^"]+)" target="_blank" rel="noopener">', src)
        self.assertEqual(links, [
            "https://newsseoul.co.kr/news/view/1065594623082008",
            "https://m.dailian.co.kr/news/view/1060200",
            "https://www.dailian.co.kr/news/view/981448/",
            "https://newsseoul.co.kr/news/view/1065572416659195",
            "https://www.mbris.kr/pub/marine/natilist/nationalist.do"])
        for d in ("2024-03-26", "2021-12-06", "2021-04-13", "2023-11-27"):
            self.assertIn(d, src)

    def test_wording(self):
        text = re.sub(r"<[^>]+>", " ", self.sec)
        for w in ("연락", "협력", "협약", "MOU", "제휴", "부족", "한계", "못", "없습니다", "아직", "대체", "능가", "더 낫"):
            self.assertNotIn(w, text, w)

    def test_css_text_size(self):
        css = (ROOT / "dist/method.css").read_text(encoding="utf-8")
        block = css[css.index("/* ---------- 01: national marine-life systems"):]
        for size in re.findall(r"font-size:([\d.]+)px", block):
            self.assertGreaterEqual(float(size), 12)


if __name__ == "__main__":
    unittest.main()
