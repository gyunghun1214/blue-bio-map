"""dist/expedition-stops.json copies released values; it never invents, rounds or zero-fills them."""
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_expedition_stops as bes  # noqa: E402

# The 8 released stops keep the cells of the second version (docs/expedition/design.md).
RELEASED_CELLS = {494972: "deg1:N34E125:2016", 836033: "deg1:N34E127:2000", 342067: "deg1:N33E127:2000",
                  145721: "deg1:N34E128:2000", 506159: "deg1:N34E129:2000", 241776: "deg4:N32E128:2000",
                  250680: "deg1:N35E129:2000", 372119: "deg1:N37E131:2016"}
OCTOPUS = 534443  # 참문어: both public cells have their centre on land


def read(name):
    return json.loads((ROOT / "dist" / name).read_text(encoding="utf-8"))


class ExpeditionStops(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = read("expedition-stops.json")
        cls.report = read("assessments.json")
        cls.released = {s["aphia_id"] for s in cls.report["species"]}
        cls.species = {s["aphia_id"]: s for s in cls.report["species"] + cls.report["candidate_species"]}
        cls.matrix = {s["aphia_id"]: s for s in read("matrix-readiness.json")["species"]}
        cls.snap = read("live-snapshot.json")
        cls.expansion = {s["aphiaID"]: s for s in read("expansion-public-cells.json")["species"]}
        cls.route = [s for s in cls.out["stops"] if s["on_route"]]

    def test_committed_file_matches_a_rebuild(self):
        self.assertEqual(bes.build(), self.out)

    def test_scores_labels_and_types_equal_the_released_report(self):
        for stop in self.out["stops"]:
            sp = self.species[stop["aphia_id"]]
            self.assertEqual(stop["scores"], {k: sp["scores"][k] for k in bes.AXES})
            self.assertEqual(stop["bbvi_label"], sp["bbvi_label"])
            self.assertEqual(stop["withheld_reasons"], sp["withheld_reasons"])
            self.assertEqual(stop["korean_name"], sp["korean_name"])
            self.assertEqual(stop["candidate_label"], sp.get("candidate_label"))
            self.assertEqual(stop["group"], "operational" if stop["aphia_id"] in self.released else "candidate")
            self.assertEqual(stop["matrix_type"]["id"], self.matrix[stop["aphia_id"]]["matrix_type"])
            self.assertEqual(stop["mcui"]["basis"], sp["mcui_basis"])
            best = max(sp["bioactivity_trace"], key=lambda x: x["adjusted"])
            self.assertEqual(stop["bio"]["percentile"], best["percentile"])
            self.assertEqual(stop["bio"]["dois"], best["original_paper_dois"])
        self.assertEqual(self.out["method_version"], self.report["method_version"])
        # 큰가리비 has no BBVI label in the report: it stays without one
        self.assertIsNone(next(s for s in self.out["stops"] if s["aphia_id"] == 393716)["bbvi_label"])
        self.assertTrue(all(s["candidate_label"] == "조사 후보" for s in self.out["stops"] if s["group"] == "candidate"))

    def test_mcui_source_is_read_from_the_record_never_an_all_null_dict(self):
        for stop in self.out["stops"]:
            src = stop["mcui"]["source"]
            self.assertTrue(src is None or (src["id"] and src["title"] and src["url"]), (stop["korean_name"], src))
        ids = {s["aphia_id"]: (s["mcui"]["source"] or {}).get("id") for s in self.out["stops"]}
        # the two released stops whose source was empty before: 멍게 (preliminary) and 우뭇가사리 (range_state)
        self.assertEqual(ids[250680], "bachman_2020_rapid_lc")
        self.assertEqual(ids[372119], "russia_red_data_book_plants_2023")
        for stop in self.out["stops"]:
            rec = (self.species[stop["aphia_id"]].get("mcui_substitute") or {}).get("record") or {}
            if stop["mcui"]["basis"] == "range_state":
                self.assertEqual(ids[stop["aphia_id"]], rec["source_id"])
            if stop["mcui"]["basis"] == "preliminary":
                self.assertEqual(ids[stop["aphia_id"]], rec["method_source_id"])
        self.assertNotIn("gbif_rapid_lc", json.dumps([s["mcui"] for s in self.out["stops"]]))

    def test_every_species_is_one_stop_route_then_off_route(self):
        self.assertEqual(sorted(s["aphia_id"] for s in self.out["stops"]), sorted(self.species))
        self.assertEqual(len(self.out["stops"]), 30)
        self.assertEqual([s["order"] for s in self.out["stops"]], list(range(1, 31)))
        self.assertEqual(len(self.route), 29)
        self.assertEqual(self.out["stops"][:29], self.route, "stops off the route come last")
        self.assertEqual({s["matrix_type"]["id"] for s in self.out["stops"]}, {t["id"] for t in self.report["method"]["matrix"]["types"].values()})

    def test_centres_are_shared_only_where_shared_with_says_so(self):
        at = {}
        for s in self.route:
            at.setdefault(tuple(s["cell"]["center"]), []).append(s["aphia_id"])
        for s in self.out["stops"]:
            if not s["on_route"]:
                self.assertEqual(s["shared_with"], [])
                continue
            others = [a for a in at[tuple(s["cell"]["center"])] if a != s["aphia_id"]]
            self.assertEqual(sorted(s["shared_with"]), sorted(others), s["korean_name"])
        # released stops never share with each other; a survey candidate shares only when all its centres are taken
        for s in self.route:
            if s["aphia_id"] in self.released:
                self.assertFalse(set(s["shared_with"]) & self.released)
        self.assertEqual({s["aphia_id"] for s in self.route if s["shared_with"] and s["aphia_id"] not in self.released},
                         {234476, 836041, 413600, 393716, 371986, 236157, 494853})

    def test_released_stops_keep_their_cell(self):
        cells = {s["aphia_id"]: s["cell"]["code"] for s in self.out["stops"] if s["aphia_id"] in self.released}
        self.assertEqual(cells, RELEASED_CELLS)
        self.assertEqual([cells[a] for a in bes.FIRST_PICK], ["deg1:N34E127:2000", "deg1:N34E128:2000", "deg4:N32E128:2000"])

    def test_missing_values_stay_missing_not_zero(self):
        for stop in self.out["stops"]:
            sp = self.species[stop["aphia_id"]]
            for n in stop["food"]["nutrients"]:
                src = sp["food_trace"]["nutrients"].get(n["key"])
                self.assertEqual(n["value"], src["value"] if src else None)
        gaps = {(s["korean_name"], n["key"]) for s in self.out["stops"] for n in s["food"]["nutrients"] if n["value"] is None}
        for name, key in [("해삼", "zinc_mg"), ("다시마", "zinc_mg"), ("감태", "protein_g"), ("괭생이모자반", "iron_mg")]:
            self.assertIn((name, key), gaps)
        # a synthetic species without food or bioactivity evidence gives None, never 0
        self.assertTrue(all(n["value"] is None for n in bes._food({"food_trace": {}}, {})["nutrients"]))
        self.assertIsNone(bes._bio({"bioactivity_trace": []}))

    def test_cell_is_a_published_cell_at_sea_inside_the_test_box(self):
        rings = list(bes._rings(read("countries.json")))
        profile = {p["aphia_id"]: p["species_id"] for p in self.snap["profiles"]}
        for stop in self.route:
            c = stop["cell"]
            if stop["aphia_id"] in self.released:
                row = next(r for r in self.snap["cells"] if r["species_id"] == profile[stop["aphia_id"]] and r["cell_code"] == c["code"])
                self.assertEqual((c["records"], c["sites"], c["year_start"], c["year_end"]),
                                 (row["record_count"], row["site_count"], row["year_start"], row["year_end"]))
            else:
                rows = [r for r in self.expansion[stop["aphia_id"]]["cells"]
                        if (r["lat0"], r["lon0"], r["sizeDeg"]) == (c["lat0"], c["lon0"], c["size_deg"]) and r["period"] == c["period"]]
                self.assertEqual(len(rows), 1, stop["korean_name"])
                r = rows[0]
                self.assertEqual((c["records"], c["sites"], c["year_start"], c["year_end"]), (r["records"], r["sites"], r["yearStart"], r["yearEnd"]))
                self.assertFalse(r["historical"])
                self.assertFalse(r["outsideKoreanEEZ"])
                self.assertEqual(c["code"], f"deg{r['sizeDeg']}:N{r['lat0']}E{r['lon0']}:{r['period'][:4]}")
            self.assertIn(c["size_deg"], (1, 4))
            self.assertEqual(c["center"], [c["lat0"] + c["size_deg"] / 2, c["lon0"] + c["size_deg"] / 2])
            self.assertTrue(bes._in_box(c))
            self.assertFalse(any(bes._inside(c["center"][1], c["center"][0], r) for r in rings))
            self.assertTrue(c["citations"] and all(x["url"].startswith("https://") for x in c["citations"]))

    def test_public_cell_counts_include_every_period(self):
        for stop in self.out["stops"]:
            if stop["group"] == "candidate":
                rows = self.expansion[stop["aphia_id"]]["cells"]
                self.assertEqual((stop["public_cells"], stop["public_records"]), (len(rows), sum(r["records"] for r in rows)))

    def test_octopus_is_off_the_route_with_its_values(self):
        stop = next(s for s in self.out["stops"] if s["aphia_id"] == OCTOPUS)
        self.assertFalse(stop["on_route"])
        self.assertIsNone(stop["cell"])
        self.assertEqual(stop["cell_missing_reason"], "셀 중심이 바다인 공개 셀 없음")
        self.assertEqual(stop["map_link"], "index.html#s=534443&v=explore")
        self.assertEqual(stop["scores"], {k: self.species[OCTOPUS]["scores"][k] for k in bes.AXES})
        self.assertEqual((stop["public_cells"], stop["public_records"]), (2, 7))
        self.assertEqual([s["aphia_id"] for s in self.out["stops"] if not s["on_route"]], [OCTOPUS])

    def test_map_link_uses_the_existing_hash_format(self):
        for stop in self.out["stops"]:
            if not stop["on_route"]:
                self.assertRegex(stop["map_link"], r"^index\.html#s=\d+&v=explore$")
                continue
            m = re.fullmatch(r"index\.html#s=(\d+)&v=explore&m=(\d+)/(-?\d+\.\d\d)/(-?\d+\.\d\d)", stop["map_link"])
            self.assertIsNotNone(m, stop["map_link"])
            self.assertEqual(int(m[1]), stop["aphia_id"])
            self.assertEqual([float(m[3]), float(m[4])], [round(v, 2) for v in stop["cell"]["center"]])

    def test_no_wording_that_turns_records_into_presence(self):
        text = json.dumps(self.out, ensure_ascii=False)
        self.assertNotRegex(text, r"살고 있|서식한다|서식 중")


if __name__ == "__main__":
    unittest.main()
