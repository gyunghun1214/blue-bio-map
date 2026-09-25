"""Public release gate for the 22 audited but unpublished species."""
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
        for item in audits:
            self.assertTrue(all(value is None for value in item["scores"].values()))
            g = item["gbif"]
            self.assertEqual(g["retrievedCount"], sum(g["reasons"].values()))
            self.assertEqual(g["rawCount"], g["retrievedCount"])
            self.assertFalse(g["truncated"])
            self.assertEqual(g["publicCellStatus"], "withheld_pending_sensitivity_source_and_duplicate_review")
            for d in g["datasets"]:
                self.assertTrue(d["url"].startswith("https://www.gbif.org/dataset/"))
                self.assertIsNotNone(d["datasetLicense"])
                self.assertTrue(d["recordLicenses"])
        self.assertEqual(len(snapshot["cells"]), 19)  # the prior published map is unchanged


if __name__ == "__main__":
    unittest.main()
