"""Public release gate for 22 audited species and one historical public cell."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ExpansionReleaseGate(unittest.TestCase):
    def test_safe_evidence_and_unique_species(self):
        catalog = json.loads((ROOT / "dist/candidate-catalog.json").read_text())
        evidence_path = ROOT / "dist/expansion-evidence.json"
        data = json.loads(evidence_path.read_text())
        snapshot = json.loads((ROOT / "dist/live-snapshot.json").read_text())
        candidates = catalog["species"]
        audits = data["species"]
        self.assertEqual(len(candidates), 22)
        self.assertEqual(len(audits), 22)
        self.assertEqual({s["aphiaID"] for s in candidates}, {s["aphiaID"] for s in audits})
        self.assertFalse({s["aphiaID"] for s in candidates} &
                         {int(s["aphia_id"]) for s in snapshot["profiles"]})
        self.assertEqual(len(snapshot["profiles"]), 8)
        raw = evidence_path.read_text()
        self.assertIsNone(re.search(r'"(?:decimalLatitude|decimalLongitude|gbifID|occurrenceID|recordID|dataset_id_record)"\s*:', raw))
        release_path = ROOT / "dist/expansion-public-cells.json"
        released_text = release_path.read_text()
        self.assertIsNone(re.search(r'"(?:decimalLatitude|decimalLongitude|gbifID|occurrenceID|recordID|dataset_id_record)"\s*:', released_text))
        release = json.loads(released_text)
        self.assertEqual(release["schemaVersion"], "candidate-public-cells-1")
        self.assertEqual(len(release["species"]), 1)
        self.assertEqual(release["species"][0]["aphiaID"], 504357)
        cell = release["species"][0]["cells"][0]
        self.assertEqual((cell["lat0"], cell["lon0"], cell["sizeDeg"]), (32, 128, 4))
        self.assertEqual((cell["yearStart"], cell["yearEnd"], cell["records"]), (1930, 1930, 1))
        self.assertEqual(cell["licenses"], ["CC0 1.0"])
        for item in audits:
            self.assertTrue(all(value is None for value in item["scores"].values()))
            g = item["gbif"]
            self.assertEqual(g["retrievedCount"], sum(g["reasons"].values()))
            self.assertEqual(g["rawCount"], g["retrievedCount"])
            self.assertFalse(g["truncated"])
            if item["aphiaID"] == 504357:
                self.assertEqual(g["publicCellStatus"], "one_historical_4_degree_cell_published_remaining_withheld")
                self.assertEqual((g["publicCellCount"], g["publicRecordCount"]), (1, 1))
                self.assertEqual(g["retrievedCount"], 224)
                self.assertEqual(g["preliminaryEligible"], 3)
            else:
                self.assertEqual(g["publicCellStatus"], "withheld_pending_sensitivity_source_and_duplicate_review")
                self.assertEqual((g["publicCellCount"], g["publicRecordCount"]), (0, 0))
            for d in g["datasets"]:
                self.assertTrue(d["url"].startswith("https://www.gbif.org/dataset/"))
                self.assertIsNotNone(d["datasetLicense"])
                self.assertTrue(d["recordLicenses"])
        self.assertEqual(len(snapshot["cells"]), 19)  # the prior published map is unchanged


if __name__ == "__main__":
    unittest.main()
