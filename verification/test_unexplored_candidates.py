"""미탐색 후보 beyond the 30 (scripts/build_unexplored_candidates.py): the GBIF genus pick and the published file's rules."""
import json
import re
import sys
import unittest
from unittest import mock
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_unexplored_candidates as u  # noqa: E402

GENUS = {"aphiaID": 1, "name": "Ulva", "family": "Ulvaceae"}


def pick(strict, verbose):
    with mock.patch.object(u.B, "cached", lambda name, fetch: verbose if "verbose" in name else strict):
        return u.gbif_genus_key(GENUS, "Plantae")


class GbifGenusKey(unittest.TestCase):
    def test_exact_genus_match_is_used(self):
        self.assertEqual(pick({"usageKey": 7, "rank": "GENUS", "matchType": "EXACT", "canonicalName": "Ulva"}, None), 7)

    def test_homonym_falls_back_to_the_family_matched_alternative(self):
        strict = {"usageKey": 6, "rank": "KINGDOM", "matchType": "HIGHERRANK"}  # what GBIF returned for Ulva and Anadara
        alt = lambda key, family, status="ACCEPTED": {"usageKey": key, "rank": "GENUS", "status": status, "canonicalName": "Ulva",
                                                      "family": family, "kingdom": "Plantae"}
        self.assertEqual(pick(strict, {"alternatives": [alt(9, "Ulvaceae"), alt(5, "Scarabaeidae")]}), 9)
        self.assertIsNone(pick(strict, {"alternatives": [alt(9, "Ulvaceae", "DOUBTFUL")]}))
        self.assertIsNone(pick(strict, {"alternatives": [alt(9, "Ulvaceae"), alt(8, "Ulvaceae")]}))  # ambiguous: no key


class KoreanName(unittest.TestCase):
    def test_needs_hangul_and_one_entry(self):
        row = lambda nm, full: {"taxon_nm": nm, "taxon_full_nm_em": full}
        name = lambda *rows: mock.patch.object(u.B, "cached", lambda n, f: {"data": {"list": list(rows)}})
        with name(row("새꼬막", "<em>Anadara</em> <em>kagoshimensis</em> (Tokunaga, 1906)")):
            self.assertEqual(u.korean_name("Anadara kagoshimensis"), "새꼬막")
        with name(row("adhaerens", "<em>Ulva</em> <em>adhaerens</em> Matsumoto & Shimada 2015")):  # no Korean name: epithet
            self.assertIsNone(u.korean_name("Ulva adhaerens"))
        with name(row("가", "Ulva a X"), row("나", "Ulva a Y")):
            self.assertIsNone(u.korean_name("Ulva a"))


class PublishedFile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = json.loads(u.OUT.read_text(encoding="utf-8"))
        report = json.loads(u.REPORT.read_text(encoding="utf-8"))
        cls.rows = {s["aphia_id"]: s for s in report["species"] + report["candidate_species"]}
        cls.threshold = report["method"]["unexplored_candidates"]["relative_min_bbvi"]
        cls.version = report["method_version"]

    def test_built_from_the_published_report(self):
        self.assertEqual((self.out["schemaVersion"], self.out["reportVersion"]), ("unexplored-candidates-1", self.version))
        self.assertEqual(sorted(r["aphiaID"] for r in self.out["relatives"]),
                         sorted(a for a, s in self.rows.items() if (s["scores"]["BBVI"] or 0) >= self.threshold))

    def test_outside_the_30_same_genus_and_never_scored(self):
        for s in self.out["species"]:
            self.assertNotIn(s["aphiaID"], self.rows)
            self.assertFalse({"scores", "BBVI", "MBPI", "MFPI", "MCUI"} & set(s))
            self.assertTrue(s["relatives"])
            self.assertTrue(s["koreanName"] is None or re.search("[가-힣]", s["koreanName"]), s["koreanName"])
            for r in s["relatives"]:
                self.assertEqual(r["name"].split()[0], s["genus"])
                self.assertEqual(s["name"].split()[0], s["genus"])
                self.assertGreaterEqual(self.rows[r["aphiaID"]]["scores"]["BBVI"], self.threshold)

    def test_cell_years_are_plausible(self):
        for s in self.out["species"]:
            for c in s["cells"]:
                self.assertTrue(1800 <= c["yearStart"] <= c["yearEnd"] <= 2026, (s["name"], c["period"], c["yearStart"]))
                self.assertEqual(c["historical"], c["yearEnd"] < 2000)

    def test_congeners_of_a_4_degree_species_stay_at_4_degrees(self):
        four = {a for a in u.B.FOUR_DEGREE if a in self.rows}
        for s in self.out["species"]:
            sizes = {c["sizeDeg"] for c in s["cells"]}
            self.assertLessEqual(sizes, {4} if any(r["aphiaID"] in four for r in s["relatives"]) else {1})


if __name__ == "__main__":
    unittest.main()
