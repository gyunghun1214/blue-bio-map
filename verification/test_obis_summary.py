"""OBIS query results cannot silently become published occurrence or scores."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from publish_expansion_obis_summary import publish  # noqa: E402


class OBISSummaryTests(unittest.TestCase):
    def setUp(self):
        self.evidence = json.loads((ROOT / "dist/expansion-evidence.json").read_text())
        self.rows = [{"aphiaID": s["aphiaID"], "name": s["name"],
                      "status": "query_count_unreviewed", "reportedTotal": 15,
                      "publicCellCount": 0, "queryUrl": "https://api.obis.org/v3/occurrence?size=0"}
                     for s in self.evidence["species"]]

    def test_count_never_becomes_a_cell_or_score(self):
        before = copy.deepcopy(self.evidence)
        result = publish({"schemaVersion": "obis-count-audit-1", "generatedAt": "2026-09-26T00:00:00Z",
                          "species": self.rows}, self.evidence)
        for old, new in zip(before["species"], result["species"]):
            self.assertEqual(set(new), set(old))  # no cell or score field appears
            self.assertEqual(new["scores"], old["scores"])
            self.assertEqual(new["obis"]["reportedTotal"], 15)
            self.assertNotIn("results", new["obis"])

    def test_failure_is_not_zero(self):
        self.rows[0]["status"] = "collection_failed"
        self.rows[0]["reportedTotal"] = None
        result = publish({"schemaVersion": "obis-count-audit-1", "generatedAt": "2026-09-26T00:00:00Z",
                          "species": self.rows}, self.evidence)
        self.assertIsNone(result["species"][0]["obis"]["reportedTotal"])
        self.assertNotEqual(result["species"][0]["obis"]["status"], "zero_for_scope")

    def test_reject_mismatched_identity_or_unreviewed_release(self):
        report = {"schemaVersion": "obis-count-audit-1", "generatedAt": "2026-09-26T00:00:00Z",
                  "species": self.rows}
        self.rows[0]["publicCellCount"] = 1
        with self.assertRaises(ValueError):
            publish(report, copy.deepcopy(self.evidence))
        self.rows[0]["publicCellCount"] = 0
        self.rows[0]["name"] = "different species"
        with self.assertRaises(ValueError):
            publish(report, copy.deepcopy(self.evidence))


if __name__ == "__main__":
    unittest.main()
