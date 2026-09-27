"""Record rules of scripts/build_expansion_cells.py on synthetic records (no network, no cache)."""
import datetime
import json
import sys
import unittest
from unittest import mock
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_expansion_cells as b  # noqa: E402

SPECIES = {"aphiaID": 1, "name": "Genus species"}
CC0 = "http://creativecommons.org/publicdomain/zero/1.0/legalcode"


def gbif(key, **kw):
    return {"key": key, "species": "Genus species", "taxonRank": "SPECIES", "occurrenceStatus": "PRESENT",
            "basisOfRecord": "PRESERVED_SPECIMEN", "license": CC0, "year": 2010, "eventDate": "2010-05-01",
            "decimalLatitude": 35.2, "decimalLongitude": 129.1, "datasetKey": "g1", **kw}


def obis(rid, **kw):
    ms = int((datetime.datetime(2010, 5, 1) - datetime.datetime(1970, 1, 1)).total_seconds() * 1000)
    return {"id": rid, "speciesid": 1, "dataset_id": "o1", "date_start": ms, "date_end": ms, "eventDate": "2010-05-01",
            "decimalLatitude": 35.2, "decimalLongitude": 129.1, **kw}


def xy(aphia, points):  # (131.5, 34.5) lies in Japan's EEZ, (129.6, 35.9) on land
    return [{"shoredistance": -3 if (lon, lat) == (129.6, 35.9) else 50,
             "areas": {"obis": [{"name": "Japan" if lon > 131 else "South Korea"}], "lme": [{"name": "Kuroshio Current"}]}}
            for lon, lat in points]


def meta(src, key, titles):
    return {"title": key, "url": ("https://www.gbif.org/dataset/" if src == "GBIF" else "https://obis.org/dataset/") + key,
            "source": src}


class CellRules(unittest.TestCase):
    def test_exclusions_duplicates_and_flags(self):
        g = {"keys": [9], "genusFallback": None, "records": [
            gbif(1),
            gbif(2, locality="Busan fish market"),
            gbif(3, occurrenceRemarks="UNVERIFIED"),
            gbif(4, year=1930, eventDate="1930-06-01", decimalLatitude=34.5, decimalLongitude=131.5),
            gbif(5, year=None, eventDate="2001-01-01/2003-12-31"),
            gbif(6, decimalLatitude=35.9, decimalLongitude=129.6)]}
        o = {"total": 5, "datasets": [{"id": "o1", "title": "o1", "records": 2, "licence": "CC0 1.0"},
                                      {"id": "o2", "title": "o2", "records": 3, "licence": None}],
             "records": [obis("a"), obis("b", license="CC-BY-NC 4.0", decimalLatitude=36.5)]}
        with mock.patch.object(b, "resolves", lambda name, s: name == s["name"]), \
                mock.patch.object(b, "xylookup", xy), mock.patch.object(b, "dataset_meta", meta):
            e = b.review(SPECIES, g, o)
        rv = e["review"]
        self.assertEqual(rv["gbif"]["excluded"], {"market_purchase_point": 1, "taxon_not_verified": 1,
                                                  "multi_year_range": 1, "on_land_obis_rule": 1})
        # The OBIS copy of GBIF record 1 is a duplicate; non-open datasets are counted without download.
        self.assertEqual(rv["obis"]["excluded"], {"license_not_open": 4, "duplicate": 1})
        self.assertEqual((rv["accepted"], rv["historical"], rv["outsideKoreanEEZ"]), (2, 1, 1))
        cells = {(c["lat0"], c["lon0"], c["period"]): c for c in e["cells"]}
        self.assertEqual(set(cells), {(35, 129, "2000–2015"), (34, 131, "2000년 이전")})
        self.assertFalse(cells[35, 129, "2000–2015"]["historical"] or cells[35, 129, "2000–2015"]["outsideKoreanEEZ"])
        self.assertTrue(cells[34, 131, "2000년 이전"]["historical"] and cells[34, 131, "2000년 이전"]["outsideKoreanEEZ"])
        text = json.dumps(e)
        self.assertNotIn("35.2", text)  # exact coordinates stay in memory
        self.assertNotIn("129.1", text)


if __name__ == "__main__":
    unittest.main()
