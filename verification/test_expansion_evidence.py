"""Public release gate for the 22 candidate species: reviewed occurrence cells, dated audits, no scores."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = re.compile(r'"(?:decimalLatitude|decimalLongitude|gbifID|occurrenceID|recordID|dataset_id_record|'
                     r'catalogNumber|eventDate)"\s*:')  # IUCN "locality" is the assessment scope, not a record
OPEN = {"CC0 1.0", "CC BY 4.0", "CC BY-NC 4.0"}  # CC BY-NC 4.0 allowed for candidate cells (2026-10-01), labelled on screen
CITATION = re.compile(r"^https://(www\.gbif\.org|obis\.org)/dataset/[\w-]+$")


def load(name):
    text = (ROOT / "dist" / name).read_text(encoding="utf-8")
    return text, json.loads(text)


class ExpansionReleaseGate(unittest.TestCase):
    def test_release_matches_catalog_and_counts_add_up(self):
        release_text, release = load("expansion-public-cells.json")
        _, catalog = load("candidate-catalog.json")
        self.assertIsNone(PRIVATE.search(release_text))
        self.assertEqual(release["schemaVersion"], "candidate-public-cells-2")
        names = {s["aphiaID"]: s["name"] for s in catalog["species"]}
        self.assertEqual(len(names), 22)
        self.assertEqual({e["aphiaID"]: e["name"] for e in release["species"]}, names)
        self.assertEqual(len(release["species"]), 22)
        for s in catalog["species"]:  # occurrence state lives only in the release file
            self.assertFalse({"occurrenceStatus", "sensitivityStatus"} & set(s), s["name"])
            self.assertTrue(all(v is None for v in s["scores"].values()))
        for e in release["species"]:
            size, cells, rv = e["sizeDeg"], e["cells"], e["review"]
            self.assertIn(size, (1, 4))
            self.assertEqual(rv["status"], "cells_published" if cells else "no_eligible_records")
            self.assertEqual(rv["accepted"], sum(c["records"] for c in cells))
            self.assertEqual(rv["accepted"], rv["gbif"]["accepted"] + rv["obis"]["accepted"])
            for src in ("gbif", "obis"):
                x = rv[src]
                self.assertEqual(x["queried"], x["accepted"] + sum(x["excluded"].values()), (e["name"], src))
            self.assertEqual(rv["historical"], sum(c["records"] for c in cells if c["historical"]))
            # A cell is flagged only when all its records fall outside; mixed cells stay unflagged.
            self.assertLessEqual(sum(c["records"] for c in cells if c["outsideKoreanEEZ"]), rv["outsideKoreanEEZ"])
            self.assertLessEqual(rv["outsideKoreanEEZ"], rv["accepted"])
            self.assertEqual(len({(c["lat0"], c["lon0"], c["period"]) for c in cells}), len(cells))
            for c in cells:
                self.assertEqual(c["sizeDeg"], size)
                self.assertEqual((c["lat0"] % size, c["lon0"] % size), (0, 0))
                self.assertTrue(c["lat0"] + size > 33 and c["lat0"] < 38.7 and c["lon0"] + size > 124 and c["lon0"] < 132)
                self.assertTrue(c["records"] >= c["sites"] >= 1 and c["yearStart"] <= c["yearEnd"])
                self.assertEqual(c["historical"], c["yearEnd"] < 2000)
                if c["historical"]:
                    self.assertEqual(c["period"], "2000년 이전")
                else:
                    lo, hi = (2000, 2015) if c["period"] == "2000–2015" else (2016, 2026)
                    self.assertTrue(lo <= c["yearStart"] and c["yearEnd"] <= hi, (e["name"], c["period"]))
                self.assertTrue(c["licenses"] and set(c["licenses"]) <= OPEN)
                self.assertTrue(set(c["sources"]) <= {"GBIF", "OBIS"} and c["citations"])
                for x in c["citations"]:
                    self.assertRegex(x["url"], CITATION)
                self.assertEqual({l for x in c["citations"] for l in x["licenses"]}, set(c["licenses"]))

    def test_audits_stay_dated_and_unscored(self):
        evidence_text, evidence = load("expansion-evidence.json")
        _, catalog = load("candidate-catalog.json")
        _, snapshot = load("live-snapshot.json")
        self.assertIsNone(PRIVATE.search(evidence_text))
        ids = {s["aphiaID"] for s in catalog["species"]}
        self.assertEqual({s["aphiaID"] for s in evidence["species"]}, ids)
        self.assertEqual(len(evidence["species"]), 22)
        self.assertFalse(ids & {int(p["aphia_id"]) for p in snapshot["profiles"]})
        self.assertEqual((len(snapshot["profiles"]), len(snapshot["cells"])), (8, 19))  # pilot map unchanged
        for item in evidence["species"]:
            self.assertTrue(all(v is None for v in item["scores"].values()))
            self.assertNotIn("sensitivity", item)
            g = item["gbif"]
            self.assertFalse({"publicCellStatus", "publicCellCount", "publicRecordCount"} & set(g))
            self.assertEqual(g["retrievedCount"], sum(g["reasons"].values()))
            self.assertEqual(g["rawCount"], g["retrievedCount"])
            self.assertFalse(g["truncated"])
            for d in g["datasets"]:
                self.assertTrue(d["url"].startswith("https://www.gbif.org/dataset/"))
                self.assertIsNotNone(d["datasetLicense"])
                self.assertTrue(d["recordLicenses"])


if __name__ == "__main__":
    unittest.main()
