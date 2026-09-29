"""Build a public, source-linked matrix gate audit from the two reviewed reports.

This is a status artifact. It never computes an indicator or substitutes a missing
value with zero. A real matrix point is eligible only if BBVI and MCUI exist.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AXES = ("MFPI", "MBPI", "MCUI", "BBVI")
STEPS = ("origin", "structure_id", "quantitative_endpoint", "comparable_cohort")


def _read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def _bio_blockers(partials):
    if not partials:
        return ["origin", "structure_id", "quantitative_endpoint", "comparable_cohort"]
    # Keep the stages of a single record together; never borrow a structure or
    # assay from another paper to make a synthetic chain.
    best = max(partials, key=lambda row: sum(row.get("chain", {}).get(k) is True for k in STEPS))
    return [k for k in STEPS if best.get("chain", {}).get(k) is not True]


def _eligible(scores, mcui_basis, rule=None):
    # verified-pilot-2.1 to 3.1: a Korean national-assessment MCUI is a separate stratum and never shares the IUCN-based matrix.
    # verified-pilot-3.2: it is placed with its own marker (method.matrix.national_mcui) and stays labelled as national.
    national_ok = bool(rule and rule.get("include_national_mcui"))
    return scores["BBVI"] is not None and scores["MCUI"] is not None and (national_ok or mcui_basis != "national")


def matrix_type(scores, rule):
    """BBVI x MCUI type at the published default BBVI weight; a value on the threshold counts as high."""
    if not rule or scores["BBVI"] is None or scores["MCUI"] is None:
        return None
    high_use, high_need = scores["BBVI"] >= rule["bbvi_threshold"], scores["MCUI"] >= rule["mcui_threshold"]
    return rule["types"][("high" if high_use else "low") + "_bbvi_" + ("high" if high_need else "low") + "_mcui"]["id"]


def _layers(s, rule):
    """verified-pilot-3.2 map fields: the matrix type and the information-sufficiency labels, never a score."""
    if not rule:
        return {}
    eligible = _eligible(s["scores"], s.get("mcui_basis"), rule)
    return {"matrix_type": matrix_type(s["scores"], rule) if eligible else None,
            "priority_survey": s.get("priority_survey", False), "unexplored_candidate": s.get("unexplored_candidate")}


def build(assessments, catalog, expansion):
    # Reviewed research candidates (e.g. Ecklonia cava MBPI) are published separately as candidate_species.
    assessed = assessments["species"] + assessments.get("candidate_species", [])
    candidates = catalog["species"]
    evidence = {s["aphiaID"]: s for s in expansion["species"]}
    if len(assessed) < 8 or len(candidates) != 22 or len(evidence) != 22:
        raise ValueError("expected original 8 and 22 expansion species")
    candidate_ids = {s["aphiaID"] for s in candidates}
    if len(candidate_ids) != 22 or len({s["aphia_id"] for s in assessed}) != len(assessed):
        raise ValueError("duplicate candidate or assessment")
    assessed_by_id = {s["aphia_id"]: s for s in assessed}
    rule = assessments["method"].get("matrix")
    if any(s["scores"]["BBVI"] is not None and s.get("mbpi_label") for s in assessed):
        raise ValueError("BBVI from a single-source MBPI")  # the label marks an MBPI below the independent-DOI minimum
    rows = []
    for s in assessed:
        if s["aphia_id"] in candidate_ids:
            continue  # Reviewed expansion assessments are joined in the loop below.
        scores = s["scores"]
        partial = s.get("bioactivity_partial", [])
        links = [assessments["sources"][sid]["url"] for sid in s["source_ids"]]
        rows.append({"aphia_id": s["aphia_id"], "scientific_name": s["scientific_name"],
                     "korean_name": s["korean_name"], "scope": "operating_8",
                     "scores": scores, "axis_reasons": s["withheld_reasons"],
                     "bioactivity_missing_steps": [] if scores["MBPI"] is not None else _bio_blockers(partial),
                     "bioactivity_leads": [{"record_id": p["record_id"], "source_url": assessments["sources"][p["source_id"]]["url"],
                                            "chain": p.get("chain", {}), "exclusion_reason": p.get("exclusion_reason")}
                                           for p in partial],
                     "source_urls": sorted(set(links)), "mcui_basis": s.get("mcui_basis"),
                     "matrix_eligible": _eligible(scores, s.get("mcui_basis"), rule), **_layers(s, rule)})
    for s in candidates:
        e = evidence[s["aphiaID"]]
        if e["name"] != s["name"] or e["scores"] != s["scores"]:
            raise ValueError(f"candidate evidence mismatch: {s['aphiaID']}")
        n, i = e["nutrition"], e["iucn"]
        missing_food = ["species_link", "edible_fraction", "aquaculture", "fixed_comparable_cohort"]
        if not n.get("foodCode"):
            missing_food.insert(0, "raw_nutrition")
        elif not all(n.get("values", {}).get(k) is not None for k in ("protein_g", "iron_mg", "zinc_mg")):
            missing_food.insert(0, "complete_raw_nutrition")
        urls = [s["wormsUrl"]]
        if n.get("rowUrl"):
            urls.append(n["rowUrl"])
        if i.get("checklistRecordUrl"):
            urls.append(i["checklistRecordUrl"])
        elif i.get("searchUrl"):
            urls.append(i["searchUrl"])
        reviewed = assessed_by_id.get(s["aphiaID"])
        if reviewed and reviewed["scientific_name"] != s["name"]:
            raise ValueError(f"reviewed expansion identity mismatch: {s['aphiaID']}")
        if reviewed:
            urls.extend(assessments["sources"][sid]["url"] for sid in reviewed["source_ids"])
        scores = reviewed["scores"] if reviewed else s["scores"]
        reasons = {"MFPI": missing_food,
                   "MBPI": None if scores["MBPI"] is not None else "origin_structure_quantitative_assay_and_cohort_not_reviewed",
                   "MCUI": "original_assessment_date_scope_criteria_and_current_status_not_reviewed"
                   if i.get("record") else "original_assessment_not_found_or_not_reviewed",
                   "BBVI": "requires_MFPI_and_MBPI"}
        if reviewed:
            # The reviewed report's own reason wins; a calculated axis has no withheld reason.
            reasons = {k: None if scores[k] is not None else (reviewed["withheld_reasons"].get(k) or v)
                       for k, v in reasons.items()}
        rows.append({"aphia_id": s["aphiaID"], "scientific_name": s["name"],
                     "korean_name": s["label"], "scope": "expansion_22",
                     "scores": scores, "axis_reasons": reasons,
                     "bioactivity_missing_steps": [] if scores["MBPI"] is not None else list(STEPS),
                     "bioactivity_leads": [], "source_urls": sorted(set(urls)),
                     "mcui_basis": reviewed and reviewed.get("mcui_basis"),
                     "matrix_eligible": _eligible(scores, reviewed and reviewed.get("mcui_basis"), rule),
                     **_layers(reviewed or {"scores": scores}, rule)})
    if len({r["aphia_id"] for r in rows}) != 30:
        raise ValueError("duplicate AphiaID")
    for row in rows:
        if set(row["scores"]) != set(AXES):
            raise ValueError("missing score axis")
        if row["scores"]["BBVI"] is not None and (row["scores"]["MFPI"] is None or row["scores"]["MBPI"] is None):
            raise ValueError("BBVI without both inputs")
        if row["matrix_eligible"] != _eligible(row["scores"], row["mcui_basis"], rule):
            raise ValueError("matrix gate mismatch")
        if rule and (row["matrix_type"] is not None) != row["matrix_eligible"]:
            raise ValueError("matrix type without an eligible point")
    return {"schema_version": 1, "method_version": assessments["method_version"],
            "assessments_snapshot": assessments["snapshot_date"], "candidate_snapshot": catalog["reviewedOn"],
            "matrix_points": sum(r["matrix_eligible"] for r in rows), "species": rows,
            **({"matrix_rule": rule} if rule else {})}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    result = build(_read("dist/assessments.json"), _read("dist/candidate-catalog.json"),
                   _read("dist/expansion-evidence.json"))
    out = ROOT / "dist/matrix-readiness.json"
    serialized = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.check:
        if out.read_text(encoding="utf-8") != serialized:
            raise ValueError("matrix readiness differs from public inputs")
        print(f"Reproducible matrix gate matches: {len(result['species'])} species, {result['matrix_points']} points")
    else:
        out.write_text(serialized, encoding="utf-8")
        print(f"Wrote {out}: {len(result['species'])} species, {result['matrix_points']} points")


if __name__ == "__main__":
    main()
