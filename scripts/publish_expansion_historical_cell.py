"""Release one independently reviewed historical specimen as a coarse public cell.

Requires the ignored GBIF raw audit in tmp/. Neither original coordinates nor
an occurrence identifier is written to dist/. Fails closed when the source changes.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "tmp/expansion-30/gbif/504357-raw.json"
OUT = ROOT / "dist/expansion-public-cells.json"
DATASET = "44bcde48-ac71-46f2-bf73-24fc3c008b6c"
LICENSE = "http://creativecommons.org/publicdomain/zero/1.0/legalcode"
SIZE = 4


def build() -> dict:
    records = json.loads(RAW.read_text())
    audit = json.loads((ROOT / "tmp/expansion-30/gbif/summary.json").read_text())
    species_audit = next(s for s in audit["species"] if s["aphiaID"] == 504357)
    datasets = [d for d in species_audit["datasets"] if d["key"] == DATASET]
    if (species_audit["retrieved"] != 224 or len(datasets) != 1
            or datasets[0]["metadata"].get("license") != LICENSE
            or datasets[0]["retrieved"] != 1 or datasets[0]["eligible"] != 1):
        raise ValueError("Dataset rights, source counts or audit changed")
    matches = [r for r in records if r.get("datasetKey") == DATASET
               and r.get("eventDate") == "1930"
               and r.get("species") == "Anadara broughtonii"]
    if len(matches) != 1:
        raise ValueError("Historic CAS specimen must match exactly once")
    record = matches[0]
    # WoRMS taxlist confirms Scapharca broughtoni -> Anadara broughtonii.
    if not (record.get("scientificName", "").startswith("Scapharca broughtoni ")
            and record.get("acceptedScientificName", "").startswith("Anadara broughtonii ")
            and record.get("taxonRank") == "SPECIES"
            and record.get("basisOfRecord") == "PRESERVED_SPECIMEN"
            and record.get("occurrenceStatus") == "PRESENT"
            and record.get("country") == "Japan"
            and record.get("locality") == "Beppu Bay, Beppu"
            and record.get("license") == LICENSE
            and record.get("coordinateUncertaintyInMeters") == 6065.0
            and not record.get("issues")):
        raise ValueError("Specimen's taxonomy, provenance, rights or quality changed")
    lat, lon = record.get("decimalLatitude"), record.get("decimalLongitude")
    if (not isinstance(lat, (int, float)) or not isinstance(lon, (int, float))
            or not (33 <= lat <= 38.7 and 124 <= lon <= 132)):
        raise ValueError("Specimen is outside audited marine test bounds")
    # The archive georeference says 'off Beppu', and Natural Earth land mask
    # supplies an independent geographic sanity check. Coordinates stay local.
    from collect_expansion_gbif import on_land
    if on_land(lon, lat):
        raise ValueError("Archived coordinate falls on generalized land polygon")
    south, west = math.floor(lat / SIZE) * SIZE, math.floor(lon / SIZE) * SIZE
    if (south, west) != (32, 128):
        raise ValueError("Unexpected coarse cell; redo sensitivity review")
    return {
        "schemaVersion": "candidate-public-cells-1",
        "reviewedOn": "2026-09-25",
        "scope": "One 1930 preserved specimen, not current distribution, abundance or regional value.",
        "species": [{
            "aphiaID": 504357, "name": "Anadara broughtonii",
            "sensitivity": "harvested shellfish; release only at 4-degree resolution",
            "taxonomySource": "https://www.marinespecies.org/aphia.php?p=taxlist&tName=Scapharca+broughtoni",
            "review": "Original Scapharca name linked by WoRMS; 1930 archived marine specimen with 6065 m uncertainty. Single CAS specimen and CC0 at record and dataset level; no other 1930 match in GBIF query. Historical evidence only.",
            "cells": [{
                "lat0": south, "lon0": west, "sizeDeg": SIZE,
                "resolutionM": 360000, "period": "1930–1930",
                "yearStart": 1930, "yearEnd": 1930,
                "records": 1, "sites": 1, "uncertaintyMissing": 0,
                "seaAreas": ["해역명 미확인"], "countries": ["Japan"],
                "citations": [{
                    "title": "CAS Invertebrate Zoology (IZ)",
                    "url": "https://www.gbif.org/dataset/" + DATASET,
                    "doi": "10.15468/tiac99",
                    "licenses": ["CC0 1.0"],
                }],
                "licenses": ["CC0 1.0"],
            }],
        }],
    }


def main() -> None:
    output = build()
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print("Released one reviewed 4-degree historical cell; no raw coordinates or occurrence ID")


if __name__ == "__main__":
    main()
