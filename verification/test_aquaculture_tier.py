"""양식 단계 표시 (scripts/build_aquaculture_tier.py): the committed dist/aquaculture-tier.json is reproducible from the
config, the KOSIS 해면양식업 table, the KOSIS-to-species links and the published report; the rule order holds (no completed
farming record → 기록 없음, species-level KOSIS production → 상업, a record or FAO CASIP → 상업, else 시험·연구); broader KOSIS
items never decide a tier; the file carries no score and the indicator build reads none of it."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_aquaculture_tier import DEFAULT_CONFIG, DEFAULT_OUTPUT, DEFAULT_REPORT, build, read_csv, render  # noqa: E402

read = lambda p: json.loads(p.read_text(encoding="utf-8"))
CONFIG, REPORT = read(DEFAULT_CONFIG), read(DEFAULT_REPORT)
KOSIS, LINKS = read_csv(ROOT / CONFIG["kosis"]["raw_file"]), read_csv(ROOT / CONFIG["kosis"]["mapping_file"])


class AquacultureTier(unittest.TestCase):
    def setUp(self):
        self.out = build(CONFIG, REPORT, KOSIS, LINKS)
        self.rows = {r["aphia_id"]: r for r in self.out["rows"]}
        self.species = {s["aphia_id"]: s for s in REPORT["species"] + REPORT["candidate_species"]}

    def test_committed_output_is_reproducible(self):
        self.assertEqual(DEFAULT_OUTPUT.read_text(encoding="utf-8"), render(self.out))
        self.assertEqual(self.out["report_version"], REPORT["method_version"])

    def test_counts_and_every_species_once(self):
        self.assertEqual(self.out["counts"], {"commercial": 18, "trial": 9, "none": 3})
        self.assertEqual(set(self.rows), set(self.species))
        self.assertEqual(self.out["total"], 30)

    def test_none_only_without_completed_farming_record(self):
        for aphia, s in self.species.items():
            feasible = s["food_trace"]["aquaculture"]["feasible"]
            self.assertEqual(self.rows[aphia]["tier"] == "none", not feasible, s["korean_name"])
        self.assertEqual({r["korean_name"] for r in self.rows.values() if r["tier"] == "none"}, {"살오징어", "대구", "참문어(동아시아 종)"})

    def test_species_level_production_is_commercial(self):
        for r in self.rows.values():
            if r["kosis"]["status"] == "species_production" and r["tier"] != "none":
                self.assertEqual((r["tier"], r["source_id"]), ("commercial", "kosis_dt_1ew0004"), r["korean_name"])
                self.assertGreater(r["kosis"]["recent_t"], 0)
        self.assertEqual(self.rows[250680]["kosis"]["recent_t"], 56213)  # 우렁쉥이 2022-2024

    def test_broader_items_never_decide(self):
        broader = {a for a, r in self.rows.items() if r["kosis"]["status"].startswith("broader") and r["tier"] != "none"}
        self.assertTrue(broader)
        no_record = copy.deepcopy(CONFIG)
        no_record["commercial_records"] = [r for r in no_record["commercial_records"] if r["aphia_id"] not in broader]
        rows = {r["aphia_id"]: r for r in build(no_record, REPORT, KOSIS, LINKS)["rows"]}
        for a in broader:  # without a record or CASIP entry, broader-item production alone leaves 시험·연구
            self.assertEqual(rows[a]["tier"], "commercial" if rows[a]["source_id"] == "fao_casip_2009" else "trial",
                             rows[a]["korean_name"])
            self.assertNotEqual(self.rows[a]["source_id"], "kosis_dt_1ew0004")

    def test_trial_species(self):
        self.assertEqual({r["korean_name"] for r in self.rows.values() if r["tier"] == "trial"},
                         {"우뭇가사리", "홍합(참담치)", "감태", "가시파래", "괭생이모자반", "꼬시래기", "가리맛조개", "멸치", "갑오징어"})

    def test_display_only_no_scores(self):
        self.assertIs(self.out["display_only"], True)
        text = DEFAULT_OUTPUT.read_text(encoding="utf-8")
        for word in ("MFPI", "MBPI", "MCUI", "BBVI", "score"):
            self.assertNotIn(word, text)
        builder = (ROOT / "scripts/build_verified_indices.py").read_text(encoding="utf-8")
        self.assertNotIn("aquaculture-tier", builder)

    def test_sources_known(self):
        sources = REPORT["sources"]
        for r in self.rows.values():
            self.assertTrue(r["source_id"] in sources or r["source_id"] in ("kosis_dt_1ew0004", "fao_casip_2009"), r)

    def test_unknown_config_schema_refused(self):
        bad = dict(CONFIG, schema_version="aquaculture-tier-config-2")
        with self.assertRaises(ValueError):
            build(bad, REPORT, KOSIS, LINKS)

    def test_production_number_must_be_whole(self):
        bad = copy.deepcopy(KOSIS)
        bad[0]["2023"] = "12.5"
        with self.assertRaises(ValueError):
            build(CONFIG, REPORT, bad, LINKS)


if __name__ == "__main__":
    unittest.main()
