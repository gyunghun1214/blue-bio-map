import json
import unittest
from pathlib import Path
from scripts.build_verified_indices import build, load_inputs

ROOT = Path(__file__).resolve().parents[1]

class PaperReviewTests(unittest.TestCase):
    def test_only_passed_species_change_and_single_source_stays_withheld(self):
        old = build(*load_inputs())
        new = build(*load_inputs(
            evidence=ROOT / 'research/verified-indices/evidence-papers-review-20260930.json',
            config=ROOT / 'config/verified-indices-papers-review.json'))
        before = {s['aphia_id']: s for s in old['species'] + old['candidate_species']}
        after = {s['aphia_id']: s for s in new['species'] + new['candidate_species']}
        changed = {key for key in before if before[key]['scores'] != after[key]['scores']}
        self.assertEqual(changed, {145721, 275816})
        self.assertEqual(after[145721]['scores']['MBPI'], 71.5)
        self.assertEqual(after[275816]['scores']['MBPI'], 29.2)
        for key in changed:
            self.assertIsNone(after[key]['scores']['BBVI'])
        saved = json.loads((ROOT / 'research/verified-indices/assessments-papers-review-20260930.json').read_text(encoding='utf-8'))
        self.assertEqual(saved, new)
