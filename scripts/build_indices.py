"""Rebuild the frozen, reviewed pilot report; no network or production DB writes.

Run: python scripts/build_indices.py
The immutable research snapshot is a small, factual extract of source records.
Acquire fresh third-party records separately; do not overwrite a reviewed snapshot.
"""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from evaluate_candidates import scores, required

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "research/index-inputs/curated.json"
CONFIG = ROOT / "config/pilot-method.json"
OUT = ROOT / "dist/assessments.json"
PARTIAL = ROOT / "research/index-inputs/partial-evidence.json"
PARTIAL_OUT = ROOT / "dist/partial-evidence.json"


def collect_snapshot():
    """Read a pinned evidence extract; external retrieval is documented separately."""
    return json.loads(INPUT.read_text(encoding="utf-8"))


def normalize(snapshot):
    species = deepcopy(snapshot["species"])
    for item in species:
        item.pop("candidate_label", None)
    return {"schema_version": 1, "sources": snapshot["sources"], "species": species}


def verify_links(snapshot, payload, method):
    required(snapshot["snapshot_date"] == method["snapshot_date"], "snapshot/method mismatch")
    required(snapshot["roster_status"].startswith("candidate_"), "roster provenance missing")
    for s in payload["species"]:
        c = s.get("conservation")
        if c:
            src = payload["sources"][c["source_id"]]
            taxon = payload["sources"][c["taxon_source_id"]]
            required(c["reviewed"] is True and c["original_taxon"].startswith(s["scientific_name"])
                     and taxon["record_id"] == f"AphiaID:{s['aphia_id']}" and src["record_id"]
                     and c["assessment_scope"] and c["criteria"] and src["assessment_date"],
                     "IUCN taxon/source/date/scope mismatch")
            required(c["assessment_year"] == int(src["assessment_date"][:4])
                     and c["publication_year"] == src["publication_year"], "IUCN dates mismatch")
            required("obis_trend" not in c or (c["obis_trend"]["effort_adjusted"] is True
                     and c["obis_trend"]["reviewed"] is True), "uncontrolled OBIS trend")
        for n in s.get("nutrition", {}).values():
            required(n["reviewed"] is True and n["sample_state"] == "fresh"
                     and n["basis"] == "100 g edible portion" and n["source_id"] in payload["sources"],
                     "nutrition cohort mismatch")
        for a in s.get("bioassays", []):
            required(a.get("reviewed") is True and all(a.get(k) for k in (
                "origin_taxon_source", "compound_id", "compound_identity_source", "target_id",
                "endpoint", "assay_type", "test_system", "conditions", "activity_id",
                "original_value", "original_unit", "original_relation", "validity", "reference_id")),
                "incomplete species–compound–assay–paper link")
            required(a["origin_taxon_source"] in payload["sources"]
                     and a["compound_identity_source"] in payload["sources"]
                     and a["reference_id"] in payload["sources"]
                     and a["endpoint"] not in ("MIC", "MFC"), "invalid small-molecule potency input")
            required(a["original_relation"] == "=" and a["validity"] == "valid"
                     and a["original_unit"] == "nM" and a["original_value"] > 0,
                     "pChEMBL original endpoint, relation, units or validity not eligible")


def cohort_manifest(payload, method):
    species = payload["species"]
    required(len({s["aphia_id"] for s in species}) == len(species), "duplicate taxon")
    nutrition = {n: sorted(s["aphia_id"] for s in species if n in s.get("nutrition", {}))
                 for n in ("protein_g", "iron_mg", "zinc_mg")}
    assays = sorted({(a["target_id"], a["endpoint"], a["assay_type"], a["test_system"],
                      a["conditions"], a["compound_id"]) for s in species for a in s.get("bioassays", [])})
    return {"frozen_at": method["snapshot_date"], "species_count": len(species),
            "candidate_aphia_ids": [s["aphia_id"] for s in species], "reference_only_count": 0,
            "nutrition_cohorts": nutrition, "eligible_assay_compounds": len(assays),
            "inclusion": "exact WoRMS species, raw fresh edible 100g, reviewed comparable endpoint/conditions",
            "exclusion": "unverified origin, dry/processed or whole sample, fractions, unresolved CID, mismatched assay",
            "minimum_peer_count": method["min_peer_species"],
            "limitation": "three peers is a pilot rule, not evidence of stable ranks; no qualifying nutrient or assay cohorts yet"}


def build():
    raw = collect_snapshot()
    method = json.loads(CONFIG.read_text(encoding="utf-8"))
    payload = normalize(raw)
    verify_links(raw, payload, method)
    cohort = cohort_manifest(payload, method)
    report = scores(payload, food_weight=method["food_weight"],
                    min_peers=method["min_peer_species"], method=method)
    report["method_version"] = method["method_version"]
    report["generated_at"] = method["snapshot_date"] + "T00:00:00Z"
    report["snapshot_date"] = raw["snapshot_date"]
    report["method"] = method
    report["cohort"] = cohort
    report["roster_status"] = raw["roster_status"]
    for row in report["species"]:
        original = next(s for s in raw["species"] if s["aphia_id"] == row["aphia_id"])
        row["candidate_label"] = original["candidate_label"]
        row["axis_status"] = {axis: ("산출됨" if row["scores"][axis] is not None else
                             "일부 근거 확인" if axis == "MBPI" and row["aphia_id"] == 241776 else
                             "산출 보류") for axis in ("MFPI", "MBPI", "MCUI", "BBVI")}
        if row["scores"]["MCUI"] is not None:
            row["conservation_trace"]["score_rule"] = f"IUCN {row['iucn_category']} → {row['scores']['MCUI']} (project pilot, no occurrence correction)"
            row["conservation_trace"]["uncertainty"] = "2010 assessment is old; latest superseding assessment unverified; not a Korean regional score"
        row["missing"] = [axis for axis in ("MFPI", "MBPI", "MCUI", "BBVI") if row["scores"][axis] is None]
    return report


def main():
    result = build()
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    partial = json.loads(PARTIAL.read_text(encoding="utf-8"))
    required(partial["accessed"] == result["snapshot_date"] and partial["status"] ==
             "research_not_approved_as_index_input", "partial research version mismatch")
    for row in partial["records"]:
        required(row["url"].startswith("https://doi.org/") and row["excluded_reason"]
                 and row["kind"] != "approved_small_molecule", "partial record must not be approved")
    PARTIAL_OUT.write_text(json.dumps(partial, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(result['species'])} candidates; "
          + ", ".join(f"{key}={sum(row['scores'][key] is not None for row in result['species'])}"
                      for key in ("MFPI", "MBPI", "MCUI", "BBVI")))


if __name__ == "__main__":
    main()
