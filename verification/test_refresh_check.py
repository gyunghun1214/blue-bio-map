"""scripts/refresh_check.py: 분기 자료 확인이 사이트 값과 공개 자료를 맞게 비교하고, dist/를 고치지 않는지 (네트워크 없이)."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import refresh_check as rc  # noqa: E402


class FakeFetcher(rc.Fetcher):
    """Answers like the live APIs: everything unchanged, except a few planted differences."""

    def __init__(self, data):
        super().__init__(None)
        self.by_aphia = {sp["aphia_id"]: sp for sp in rc.species_list(data)}
        self.by_key = {}
        for sp in self.by_aphia.values():
            key = ((sp.get("mcui_substitute") or {}).get("record") or {}).get("gbif", {}).get("taxon_key") or 9_000_000 + sp["aphia_id"]
            self.by_key[key] = sp

    def get(self, url):
        self.calls += 1
        if "/AphiaRecordByAphiaID/" in url:
            aphia = int(url.rsplit("/", 1)[1])
            sp = self.by_aphia[aphia]
            if aphia == 836033:  # planted: WoRMS moved the oyster back to Crassostrea
                return {"status": "unaccepted", "valid_name": "Crassostrea gigas", "valid_AphiaID": 140656, "modified": "2026-12-01T00:00:00Z"}
            return {"status": "accepted", "valid_name": sp["scientific_name"], "valid_AphiaID": aphia, "modified": "2024-01-01T00:00:00Z"}
        if "/species/match?" in url:
            if "Ecklonia" in url:
                return {"matchType": "NONE"}
            name = rc.urllib.parse.parse_qs(rc.urllib.parse.urlsplit(url).query)["name"][0]
            sp = next(s for s in self.by_aphia.values() if s["scientific_name"] == name)
            return {"usageKey": 9_000_000 + sp["aphia_id"]}
        if url.endswith("/iucnRedListCategory"):
            sp = self.by_key[int(url.split("/species/")[1].split("/")[0])]
            if sp["aphia_id"] == 342067:  # planted: squid LC -> VU
                return {"category": "VULNERABLE", "code": "VU"}
            shown = rc.shown_iucn(sp)
            return None if shown == "NE" else {"code": shown}
        if "/dataset/" in url:
            return {"title": "The IUCN Red List of Threatened Species", "pubDate": "2026-09-01T00:00:00Z"}
        if "api.obis.org" in url:
            aphia = int(rc.urllib.parse.parse_qs(rc.urllib.parse.urlsplit(url).query)["taxonid"][0])
            before = self.by_aphia[aphia]["mcui_substitute"]["record"]["obis"]["count"]
            return {"total": before * 2 if aphia == 145721 else before + 3}  # planted: wakame doubles
        if "/occurrence/search?" in url:
            key = int(rc.urllib.parse.parse_qs(rc.urllib.parse.urlsplit(url).query)["taxonKey"][0])
            return {"count": self.by_key[key]["mcui_substitute"]["record"]["gbif"]["count"]}
        raise LookupError(url)


class RefreshCheckTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(rc.ASSESSMENTS.read_text(encoding="utf-8"))
        cls.table = rc.run(FakeFetcher(cls.data), cls.data, False, None, {"date": "2026-12-28", "at": "x", "trigger": "test", "url": ""})

    def changed(self):
        return {(r["aphia_id"], r["source"], r["item"]) for r in self.table["rows"] if r["result"] == "바뀜"}

    def test_thirty_species_each_checked_on_worms_and_iucn(self):
        self.assertEqual(self.table["baseline"]["species"], 30)
        for source in ("WoRMS", "IUCN(GBIF 사본)"):
            self.assertEqual(len({r["aphia_id"] for r in self.table["rows"] if r["source"] == source}), 30, source)

    def test_only_planted_differences_are_flagged(self):
        self.assertEqual(self.changed(), {
            (836033, "WoRMS", "승인 학명"), (836033, "WoRMS", "기록 수정일"),
            (342067, "IUCN(GBIF 사본)", "적색목록 범주"),
            (145721, "OBIS", "출현 기록 수(예비평가 조건)")})

    def test_missing_gbif_name_is_unknown_not_changed(self):
        rows = [r for r in self.table["rows"] if r["aphia_id"] == 371986 and r["source"].startswith("IUCN")]
        self.assertEqual([r["result"] for r in rows], ["확인 불가"])

    def test_small_count_drift_is_not_a_change(self):
        rows = [r for r in self.table["rows"] if r["aphia_id"] == 250680 and r["source"] == "OBIS"]
        self.assertEqual(rows[0]["result"], "같음")
        self.assertIn("작은 차이", rows[0]["note"])

    def test_render_lists_changes_and_keeps_site_untouched(self):
        dist = ROOT / "dist"
        before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in dist.rglob("*.json")}
        md = rc.render(self.table)
        self.assertIn("바뀜 4", md)
        self.assertIn("사이트 숫자를 바꾸지 않습니다", md)
        self.assertIn("살오징어", md)
        with tempfile.TemporaryDirectory() as tmp:
            fx = Path(tmp) / "fx.json"
            fx.write_text("{}", encoding="utf-8")
            # A fixture with no answers: every source is '확인 불가', the run still finishes and writes both files.
            self.assertEqual(rc.main(["--fixture", str(fx), "--out", tmp, "--no-ai"]), 0)
            self.assertTrue((Path(tmp) / "review.md").exists())
            self.assertEqual(json.loads((Path(tmp) / "review.json").read_text(encoding="utf-8"))["counts"]["바뀜"], 0)
        self.assertEqual(before, {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in dist.rglob("*.json")})

    def test_invention_guard(self):
        self.assertEqual(rc.numbers_not_in("범주 VU, 기록 1607건, 새 수치 4242", '{"count": 1607}'), ["4242"])


if __name__ == "__main__":
    unittest.main()
