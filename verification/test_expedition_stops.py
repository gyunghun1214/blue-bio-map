"""dist/expedition-stops.json copies released values; it never invents, rounds or zero-fills them."""
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_expedition_stops as bes  # noqa: E402


def read(name):
    return json.loads((ROOT / "dist" / name).read_text(encoding="utf-8"))


class ExpeditionStops(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = read("expedition-stops.json")
        cls.report = read("assessments.json")
        cls.species = {s["aphia_id"]: s for s in cls.report["species"]}
        cls.matrix = {s["aphia_id"]: s for s in read("matrix-readiness.json")["species"]}
        cls.snap = read("live-snapshot.json")

    def test_committed_file_matches_a_rebuild(self):
        self.assertEqual(bes.build(), self.out)

    def test_scores_labels_and_types_equal_the_released_report(self):
        for stop in self.out["stops"]:
            sp = self.species[stop["aphia_id"]]
            self.assertEqual(stop["scores"], {k: sp["scores"][k] for k in bes.AXES})
            self.assertEqual(stop["bbvi_label"], sp["bbvi_label"])
            self.assertEqual(stop["withheld_reasons"], sp["withheld_reasons"])
            self.assertEqual(stop["korean_name"], sp["korean_name"])
            self.assertEqual(stop["matrix_type"]["id"], self.matrix[stop["aphia_id"]]["matrix_type"])
            self.assertEqual(stop["mcui"]["basis"], sp["mcui_basis"])
            best = max(sp["bioactivity_trace"], key=lambda x: x["adjusted"])
            self.assertEqual(stop["bio"]["percentile"], best["percentile"])
            self.assertEqual(stop["bio"]["dois"], best["original_paper_dois"])
        self.assertEqual(self.out["method_version"], self.report["method_version"])

    def test_every_released_species_is_one_stop_at_its_own_place(self):
        self.assertEqual(sorted(s["aphia_id"] for s in self.out["stops"]), sorted(self.species))
        self.assertEqual([s["order"] for s in self.out["stops"]], list(range(1, len(self.species) + 1)))
        self.assertEqual(len({tuple(s["cell"]["center"]) for s in self.out["stops"]}), len(self.out["stops"]))
        # every matrix type of the released report is visited
        self.assertEqual({s["matrix_type"]["id"] for s in self.out["stops"]}, {t["id"] for t in self.report["method"]["matrix"]["types"].values()})

    def test_v1_stops_keep_their_cell(self):
        cells = {s["aphia_id"]: s["cell"]["code"] for s in self.out["stops"]}
        self.assertEqual([cells[a] for a in bes.FIRST_PICK],
                         ["deg1:N34E127:2000", "deg1:N34E128:2000", "deg4:N32E128:2000"])

    def test_missing_values_stay_missing_not_zero(self):
        for stop in self.out["stops"]:
            sp = self.species[stop["aphia_id"]]
            for n in stop["food"]["nutrients"]:
                src = sp["food_trace"]["nutrients"].get(n["key"])
                self.assertEqual(n["value"], src["value"] if src else None)
        sea_cucumber = next(s for s in self.out["stops"] if s["aphia_id"] == 241776)
        zinc = next(n for n in sea_cucumber["food"]["nutrients"] if n["key"] == "zinc_mg")
        self.assertIsNone(zinc["value"])  # omitted_components in the report
        # a synthetic species without food or bioactivity evidence gives None, never 0
        self.assertTrue(all(n["value"] is None for n in bes._food({"food_trace": {}}, {})["nutrients"]))
        self.assertIsNone(bes._bio({"bioactivity_trace": []}))

    def test_cell_is_a_published_cell_at_sea_inside_the_test_box(self):
        rings = list(bes._rings(read("countries.json")))
        profile = {p["aphia_id"]: p["species_id"] for p in self.snap["profiles"]}
        for stop in self.out["stops"]:
            c = stop["cell"]
            row = next(r for r in self.snap["cells"] if r["species_id"] == profile[stop["aphia_id"]] and r["cell_code"] == c["code"])
            self.assertEqual((c["records"], c["sites"], c["year_start"], c["year_end"]),
                             (row["record_count"], row["site_count"], row["year_start"], row["year_end"]))
            self.assertIn(c["size_deg"], (1, 4))
            self.assertEqual(c["center"], [c["lat0"] + c["size_deg"] / 2, c["lon0"] + c["size_deg"] / 2])
            self.assertTrue(bes._in_box(c))
            self.assertFalse(any(bes._inside(c["center"][1], c["center"][0], r) for r in rings))
            self.assertTrue(c["citations"] and all(x["url"].startswith("https://") for x in c["citations"]))

    def test_map_link_uses_the_existing_hash_format(self):
        for stop in self.out["stops"]:
            m = re.fullmatch(r"index\.html#s=(\d+)&v=explore&m=(\d+)/(-?\d+\.\d\d)/(-?\d+\.\d\d)", stop["map_link"])
            self.assertIsNotNone(m, stop["map_link"])
            self.assertEqual(int(m[1]), stop["aphia_id"])
            self.assertEqual([float(m[3]), float(m[4])], [round(v, 2) for v in stop["cell"]["center"]])

    def test_no_wording_that_turns_records_into_presence(self):
        text = json.dumps(self.out, ensure_ascii=False)
        self.assertNotRegex(text, r"살고 있|서식한다|서식 중")


if __name__ == "__main__":
    unittest.main()
