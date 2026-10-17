"""dist/license-matrix.json: reproducible from the files the method tab reads, every licence sorted by a rule, the
commercial-layer count consistent with the published report, and the site's licence notices in place."""
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_license_matrix", ROOT / "scripts/build_license_matrix.py")
blm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(blm)


def read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


class LicenceMatrixTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = read("dist/assessments.json")
        cls.config = read(f"config/verified-indices-v{cls.report['method_version'].removeprefix('verified-')}.json")
        cls.doc = blm.build(cls.report, cls.config, read("dist/live-snapshot.json"), read("dist/expansion-public-cells.json"),
                            read("dist/matrix-readiness.json"))
        cls.committed = read("dist/license-matrix.json")

    def test_committed_output_is_reproducible(self):
        # a release that changes assessments.json, the live snapshot or the candidate cells rebuilds this file too
        self.assertEqual((ROOT / "dist/license-matrix.json").read_text(encoding="utf-8"), blm.render(self.doc),
                         "dist/license-matrix.json is stale: run python scripts/build_license_matrix.py")

    def test_named_licences_fall_in_the_expected_group(self):
        cases = {"CC BY-NC-SA 4.0": ("noncommercial", None), "CC BY-NC 4.0": ("noncommercial", None),
                 "IUCN Red List terms": ("permission", None), "IUCN Red List terms (non-commercial)": ("permission", None),
                 "FAO website terms": ("permission", None), "CC BY 4.0": ("commercial_ok", "open"),
                 "CC0 1.0": ("commercial_ok", "open"), "CC BY-SA 3.0": ("commercial_ok", "open_sa"),
                 "Publisher copyright": ("review", None), "공공누리 제3유형": ("review", None),
                 "KOGL Type 1 (공공누리 제1유형: 출처표시)": ("commercial_ok", "open")}
        for text, (group, tier) in cases.items():
            got = blm.classify(text)
            self.assertEqual((got["group"], got["tier"]), (group, tier), text)

    def test_every_report_source_of_a_species_has_a_row_and_an_indicator(self):
        ids = {r["id"] for r in self.doc["rows"]}
        for s in self.report["species"] + self.report["candidate_species"]:
            for sid in s["source_ids"]:
                self.assertIn(f"report:{sid}", ids, sid)
        for r in self.doc["rows"]:
            self.assertIn(r["group"], blm.GROUPS)
            self.assertTrue(r["uses"], r["id"])

    def test_cmnpd_and_iucn_rows(self):
        rows = self.doc["rows"]
        cmnpd = [r for r in rows if "CMNPD" in (r["title"] or "") + (r["provider"] or "")]
        self.assertTrue(cmnpd and all(r["group"] == "noncommercial" for r in cmnpd))
        iucn = [r for r in rows if r["license"].startswith("IUCN")]
        self.assertTrue(iucn and all(r["group"] == "permission" for r in iucn))
        item = self.doc["review_items"][0]
        self.assertEqual((item["id"], item["status"], item["url"]), ("iucn-redisplay", "확인 필요", blm.IUCN_TERMS_URL))

    def test_commercial_layer_counts_stay_inside_the_published_set(self):
        layer = self.doc["commercial_layer"]
        species = self.report["species"] + self.report["candidate_species"]
        for axis in ("MFPI", "MBPI", "MCUI", "BBVI"):
            entry = layer["indicators"][axis]
            self.assertEqual(entry["published"], sum(s["scores"][axis] is not None for s in species))
            self.assertLessEqual(entry["open"], entry["open_sa"])
            self.assertLessEqual(entry["open_sa"], entry["upper"])
            self.assertLessEqual(entry["upper"], entry["published"])
        cells = layer["map_cells"]["total"]
        self.assertLessEqual(cells["open"]["grid_cells"], cells["all"]["grid_cells"])
        self.assertEqual(cells["all"]["species_cells"],
                         sum(len({c["cell_code"].rsplit(":", 1)[0] for c in read("dist/live-snapshot.json")["cells"]
                                  if c["species_id"] == p["species_id"]}) for p in read("dist/live-snapshot.json")["profiles"])
                         + sum(len({(c["lat0"], c["lon0"]) for c in e["cells"]}) for e in read("dist/expansion-public-cells.json")["species"]))

    def test_site_notices(self):
        html = (ROOT / "dist/index.html").read_text(encoding="utf-8")
        app = (ROOT / "dist/app.js").read_text(encoding="utf-8")
        self.assertIn("콘텐츠 라이선스: 출처별 혼합 · ", html)
        self.assertIn('data-foot-go="license">출처 목록 참조', html)
        # 2026-10-17 (LKH): the licence table left the method tab (no weakness on screen); the file, its build script and
        # this test of the file stay, and the footer button opens the source list
        self.assertNotIn('id="license-table"', html)
        self.assertNotIn('id="mt-license"', html)
        self.assertIn("fetch('license-matrix.json')", app)
        # summaries derived from CMNPD (CC BY-NC-SA 4.0) carry the same conditions
        self.assertIn("비상업 이용·출처 표시·동일조건 변경허락이 이 요약에도 적용됩니다", app)
        self.assertIn("CMNPD 검색 부분은 CC BY-NC-SA 4.0 조건", app)


if __name__ == "__main__":
    unittest.main()
