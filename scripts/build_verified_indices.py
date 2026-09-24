"""Build a deterministic, provisional species score report from reviewed snapshots.

No network or database writes occur here. Source retrieval and human review are
separate stages; this module rejects incomplete numeric score inputs rather than
silently filling them. `--check` verifies the committed public report byte for byte.
"""
from __future__ import annotations

import argparse
import json
import math
import re
from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EVIDENCE = ROOT / "research" / "verified-indices" / "evidence.json"
DEFAULT_CANDIDATES = ROOT / "research" / "verified-indices" / "candidates.json"
DEFAULT_CONFIG = ROOT / "config" / "verified-indices-v1.json"
DEFAULT_OUTPUT = ROOT / "dist" / "assessments.json"
COMPOUND_ID = re.compile(r"^(?:CID:\d+|[A-Z]{14}-[A-Z]{10}-[A-Z])$")


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def finite(value: object, field: str, low: float = 0, high: float | None = None) -> float:
    require(type(value) in (int, float) and math.isfinite(value), f"{field}: finite number required")
    require(value >= low and (high is None or value <= high), f"{field}: out of range")
    return float(value)


def percentile(value: float, peers: list[float]) -> float:
    require(len(peers) > 0, "empty comparison cohort")
    return 100 * (sum(p < value for p in peers) + 0.5 * sum(p == value for p in peers)) / len(peers)


def round1(value: float) -> float:
    """Use the same positive one-decimal tie rule as the browser display."""
    return float(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def valid_date(value: object, *, not_before: int | None = None, not_after: str | None = None) -> bool:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return False
    try:
        day = date.fromisoformat(value)
    except ValueError:
        return False
    return (not_before is None or day.year >= not_before) and (not_after is None or value <= not_after)


def source_ids_valid(ids: list[str], sources: dict) -> bool:
    return bool(ids) and all(i in sources for i in ids)


def nutrition_rows(evidence: dict, config: dict) -> tuple[list[dict], dict[str, dict]]:
    settings = config["nutrition"]
    all_rows = {r["food_item_id"]: r for r in evidence.get("nutrition_rows", [])}
    require(len(all_rows) == len(evidence.get("nutrition_rows", [])), "duplicate food item ID")
    cohort = [all_rows[i] for i in settings["food_item_ids"]]
    require(len(cohort) >= settings["minimum_species"], "nutrition cohort too small")
    require(len({r["scientific_name"] for r in cohort}) == len(cohort), "duplicate species in nutrition cohort")
    for row in cohort:
        require(row.get("reviewed") is True and row.get("source_id") in evidence["sources"]
                and row.get("sample_state") == "raw" and row.get("basis") == "100 g edible portion"
                and row.get("original_reference_ids")
                and row.get("method_source_id") in evidence["sources"]
                and isinstance(row.get("sample_year_range"), list)
                and len(row["sample_year_range"]) == 2
                and all(type(year) is int and 1900 <= year <= date.today().year
                        for year in row["sample_year_range"])
                and row["sample_year_range"][0] <= row["sample_year_range"][1],
                f"{row['food_item_id']}: incompatible/unreviewed food row")
        for name, unit in settings["components"].items():
            n = row.get("nutrients", {}).get(name)
            require(isinstance(n, dict) and n.get("unit") == unit
                    and n.get("grade") in settings["grade_factors"] and n.get("method"),
                    f"{row['food_item_id']}: {name} unit/grade/method")
            finite(n.get("value"), f"{row['food_item_id']}:{name}")
    return cohort, all_rows


def food_score(candidate: dict, evidence: dict, config: dict, cohort: list[dict]) -> tuple[float | None, dict, str]:
    settings = config["nutrition"]
    row = next((r for r in cohort if r.get("aphia_id") == candidate["aphia_id"]), None)
    trace = {"cohort_id": settings["cohort_id"], "cohort_species": len(cohort),
             "cohort_food_item_ids": settings["food_item_ids"], "sample_state": "raw",
             "basis": "100 g edible portion", "nutrients": {}, "edible_fraction": None,
             "aquaculture": None, "method_version": config["method_version"],
             "supplemental_nutrition": [r for r in evidence.get("nutrition_observations", [])
                                      if r.get("aphia_id") == candidate["aphia_id"]]}
    if row:
        trace["source_food_item_id"] = row["food_item_id"]
        trace["source_id"] = row["source_id"]
        trace["method_source_id"] = row["method_source_id"]
        trace["reported_scientific_name"] = row["reported_scientific_name"]
        trace["sample_year_range"] = row["sample_year_range"]
        trace["publication_year"] = row.get("publication_year")
        for name in settings["components"]:
            n = row["nutrients"][name]
            peers = [float(r["nutrients"][name]["value"]) for r in cohort]
            rank = percentile(float(n["value"]), peers)
            trace["nutrients"][name] = {**n, "percentile": round(rank, 2),
                "percentile_unrounded": rank,
                "evidence_factor": settings["grade_factors"][n["grade"]],
                "peer_values": [{"food_item_id": r["food_item_id"], "scientific_name": r["scientific_name"],
                                 "value": r["nutrients"][name]["value"]} for r in cohort]}
    supports = [r for r in evidence.get("food_support", []) if r.get("aphia_id") == candidate["aphia_id"]]
    fraction = next((r for r in supports if r.get("kind") == "edible_fraction"), None)
    aqua = next((r for r in supports if r.get("kind") == "aquaculture"), None)
    trace["edible_fraction"], trace["aquaculture"] = fraction, aqua
    trace["edible_fraction_sensitivity"] = [r for r in supports if r.get("kind") == "edible_fraction_sensitivity"]
    if not row:
        return None, trace, "comparable_nutrition_missing"
    if not fraction or fraction.get("reviewed") is not True:
        return None, trace, "species_edible_yield_unverified"
    if not aqua or aqua.get("reviewed") is not True:
        return None, trace, "aquaculture_method_unverified"
    require(fraction.get("source_id") in evidence["sources"] and fraction.get("record_id")
            and fraction.get("method") and fraction.get("region") and fraction.get("limitations"),
            "edible fraction provenance incomplete")
    require(aqua.get("source_id") in evidence["sources"] and aqua.get("record_id")
            and aqua.get("method") and aqua.get("region") and aqua.get("year")
            and aqua.get("limitations") and type(aqua.get("feasible")) is bool,
            "aquaculture provenance incomplete")
    edible = finite(fraction.get("value"), "edible_fraction", 0, 1)
    numerator = sum(n["percentile_unrounded"] * n["evidence_factor"]
                    for n in trace["nutrients"].values()) / len(settings["components"])
    score = 100 * (settings["nutrient_weight"] * numerator / 100
                   + settings["edible_fraction_weight"] * edible
                   + settings["aquaculture_weight"] * int(aqua["feasible"]))
    trace["formula"] = "nutrient_weight × mean(percentile × evidence_factor) + 100 × edible_fraction_weight × edible_fraction + 100 × aquaculture_weight × aquaculture_boolean"
    trace["weights"] = {k: settings[k] for k in ("nutrient_weight", "edible_fraction_weight", "aquaculture_weight")}
    trace["unrounded"] = score
    trace["yield_sensitivity"] = [{"source_id": r["source_id"], "record_id": r["record_id"],
                                   "fraction": r["value"],
                                   "mfpi_at_same_nutrients": round1(score + 100 * settings["edible_fraction_weight"]
                                                                     * (r["value"] - edible))}
                                  for r in trace["edible_fraction_sensitivity"]]
    trace["uncertainty"] = ["Only three oyster species in the fixed comparison cohort; ranks change in large steps.",
                            "AFCD Australian nutrient specimens and the independent Dalian edible-yield specimens differ by place and collection period.",
                            "AFCD workbook says 2008 (SARDI); the underlying FRDC report dates sample supply to July 2010–July 2011 and does not assign a year per food item."]
    return round1(score), trace, "calculated"


def _approved_assays(evidence: dict, config: dict) -> list[dict]:
    rows = [r for r in evidence.get("bioactivity", []) if r.get("status") == "approved_for_score"]
    eligible = config["bioactivity"]["eligible_endpoints"]
    for a in rows:
        require(a.get("reviewed") is True and a.get("origin_reviewed") is True
                and a.get("compound_structure_reviewed") is True
                and COMPOUND_ID.fullmatch(str(a.get("compound_id", ""))) is not None
                and a.get("source_id") in evidence["sources"] and a.get("origin_aphia_id")
                and a.get("origin_scientific_name") and a.get("original_paper_doi")
                and a.get("activity_id") and a.get("assay_id") and a.get("target_id")
                and a.get("assay_type") and a.get("test_system") and a.get("conditions_key")
                and a.get("endpoint") in eligible and a.get("standard_relation") == "="
                and a.get("standard_units") == "nM"
                and a.get("data_validity_comment") in (None, "Manually validated")
                and a.get("material_kind") == "single_compound",
                f"{a.get('activity_id')}: incomplete compound-origin/ChEMBL chain")
        finite(a.get("standard_value"), "standard_value", 0.0000001)
        p = finite(a.get("pchembl_value"), "pchembl_value", 0, 15)
        require(abs(p - (9 - math.log10(a["standard_value"]))) < 0.03,
                f"{a['activity_id']}: pChEMBL inconsistent with nM endpoint")
    return rows


def bio_scores(evidence: dict, config: dict) -> dict[int, tuple[float, list, dict]]:
    approved = _approved_assays(evidence, config)
    by_id = {a["activity_id"]: a for a in approved}
    require(len(by_id) == len(approved), "duplicate bioactivity ID")
    out: dict[int, tuple[float, list, dict]] = {}
    for stratum in evidence.get("bioactivity_cohorts", []):
        ids = stratum["activity_ids"]
        require(all(i in by_id for i in ids) and len(ids) == len(set(ids)), "invalid fixed bioactivity cohort")
        rows = [by_id[i] for i in ids]
        keys = {(a["target_id"], a["assay_type"], a["endpoint"], a["test_system"],
                 a["conditions_key"]) for a in rows}
        require(len(keys) == 1, "mixed bioactivity stratum")
        compounds = defaultdict(list)
        for a in rows:
            compounds[a["compound_id"]].append(a)
        if len(compounds) < config["bioactivity"]["minimum_compounds_per_stratum"]:
            continue
        peers = {c: median(a["pchembl_value"] for a in group) for c, group in compounds.items()}
        for compound, group in compounds.items():
            for origin in {a["origin_aphia_id"] for a in group}:
                own = [a for a in group if a["origin_aphia_id"] == origin]
                doi_count = len({a["original_paper_doi"].lower() for a in own})
                rank = percentile(peers[compound], list(peers.values()))
                factor = config["bioactivity"]["single_doi_factor"] if doi_count == 1 else config["bioactivity"]["multiple_doi_factor"]
                item = {"compound_id": compound, "stratum_id": stratum["id"],
                        "activity_ids": sorted(a["activity_id"] for a in own),
                        "original_paper_dois": sorted({a["original_paper_doi"] for a in own}),
                        "peer_compounds": len(peers), "median_pchembl": round(peers[compound], 3),
                        "percentile": round(rank, 2), "evidence_factor": factor,
                        "adjusted": rank * factor}
                old = out.get(origin, (None, [], {}))[1]
                out[origin] = (None, old + [item], {})
    for aphia, (_, items, _) in list(out.items()):
        adjusted = [i["adjusted"] for i in items]
        primary = max(adjusted)
        out[aphia] = (round1(primary), items,
                      {"median_compound_sensitivity": round1(median(adjusted)),
                       "range_from_aggregation": [round1(min(adjusted)), round1(primary)]})
    return out


def conservation_score(candidate: dict, evidence: dict, config: dict) -> tuple[float | None, dict | None, str]:
    assessment = next((r for r in evidence.get("conservation", [])
                       if r.get("aphia_id") == candidate["aphia_id"]), None)
    if not assessment:
        return None, None, "assessment_not_verified"
    checked = assessment.get("current_status_check")
    trace = {k: v for k, v in assessment.items() if k != "current_status_check"}
    trace["current_status_check"] = checked
    if assessment.get("reviewed") is not True:
        return None, trace, "original_assessment_not_reviewed"
    if assessment.get("category") not in config["conservation"]["category_scores"]:
        return None, trace, "category_not_numeric_or_unverified"
    if not checked:
        return None, trace, "current_status_unverified"
    require(type(checked.get("is_current")) is bool and checked.get("source_id") in evidence["sources"]
            and valid_date(checked.get("checked_on"), not_before=assessment["assessment_year"],
                           not_after=evidence["snapshot_date"]), "invalid current IUCN assessment check")
    if not checked["is_current"]:
        return None, trace, "assessment_not_current"
    score = config["conservation"]["category_scores"][assessment["category"]]
    trend = assessment.get("obis_trend")
    if trend:
        require(trend.get("reviewed") is True and trend.get("effort_adjusted") is True
                and trend.get("source_id") in evidence["sources"]
                and trend.get("direction") in ("declining", "stable", "increasing"),
                "OBIS trend needs independent effort adjustment")
        delta = {"declining": 1, "stable": 0, "increasing": -1}[trend["direction"]]
        score = max(0, min(100, score + config["conservation"]["effort_adjustment"] * delta))
    return float(score), trace, "calculated"


def build(evidence: dict, candidates: dict, config: dict) -> dict:
    require(evidence.get("schema_version") == 2 and candidates.get("schema_version") == 1,
            "unsupported evidence/candidate schema")
    require(valid_date(evidence.get("snapshot_date")) and config.get("method_version"), "snapshot/method required")
    require(evidence["snapshot_date"] >= candidates["checked_on"], "candidate list newer than evidence")
    weights = [config["nutrition"][key] for key in ("nutrient_weight", "edible_fraction_weight", "aquaculture_weight")]
    require(all(type(w) in (int, float) and 0 <= w <= 1 for w in weights)
            and abs(sum(weights) - 1) < 1e-9, "MFPI weights must sum to one")
    finite(config["bbvi"]["default_food_weight"], "BBVI food weight", 0, 1)
    sources = evidence.get("sources", {})
    require(bool(sources), "sources required")
    for sid, src in sources.items():
        require(str(src.get("url", "")).startswith("https://") and src.get("provider")
                and src.get("version") and src.get("terms") and valid_date(src.get("accessed"),
                not_after=evidence["snapshot_date"]), f"{sid}: incomplete source registration")
    identities = candidates.get("candidates", [])
    require(len(identities) == 8 and len({c["aphia_id"] for c in identities}) == 8,
            "expected 8 unique published candidates")
    cohort, _ = nutrition_rows(evidence, config)
    assay = bio_scores(evidence, config)
    output = []
    for candidate in identities:
        aphia = candidate["aphia_id"]
        mfpi, food_trace, food_reason = food_score(candidate, evidence, config, cohort)
        mbpi, bio_trace, bio_sensitivity = assay.get(aphia, (None, [], {}))
        mcui, conservation_trace, conservation_reason = conservation_score(candidate, evidence, config)
        bbvi = round1(config["bbvi"]["default_food_weight"] * mfpi
                      + (1 - config["bbvi"]["default_food_weight"]) * mbpi) if mfpi is not None and mbpi is not None else None
        scores = {"MFPI": mfpi, "MBPI": mbpi, "MCUI": mcui, "BBVI": bbvi}
        partial_bio = [r for r in evidence.get("bioactivity", []) if r.get("origin_aphia_id") == aphia
                       and r.get("status") != "approved_for_score"]
        status = {"MFPI": "산출됨" if mfpi is not None else "일부 근거 확인" if food_trace["nutrients"] else "산출 보류",
                  "MBPI": "산출됨" if mbpi is not None else "일부 근거 확인" if partial_bio else "산출 보류",
                  "MCUI": "산출됨" if mcui is not None else "일부 근거 확인" if conservation_trace else "산출 보류",
                  "BBVI": "산출됨" if bbvi is not None else "산출 보류"}
        reasons = {"MFPI": food_reason if mfpi is None else None,
                   "MBPI": "compound_origin_assay_chain_or_fixed_cohort_missing" if mbpi is None else None,
                   "MCUI": conservation_reason if mcui is None else None,
                   "BBVI": "requires_MFPI_and_MBPI" if bbvi is None else None}
        weights = config["bbvi"]["sensitivity_food_weights"]
        sensitivity = {"food_weights": {str(w): round1(w * mfpi + (1-w) * mbpi)
                         for w in weights} if bbvi is not None else {}, **bio_sensitivity}
        source_ids = set()
        if food_trace.get("source_id"):
            source_ids.add(food_trace["source_id"])
        if food_trace.get("method_source_id"):
            source_ids.add(food_trace["method_source_id"])
        if food_trace.get("source_id"):
            source_ids.add(cohort[0]["detail_source_id"])
        for item in food_trace.get("edible_fraction_sensitivity", []):
            require(item.get("source_id") in sources, "unregistered edible-yield sensitivity source")
            source_ids.add(item["source_id"])
        for item in food_trace["supplemental_nutrition"]:
            require(item.get("source_id") in sources and item.get("record_id"), "unregistered nutrition observation")
            source_ids.add(item["source_id"])
        for kind in ("edible_fraction", "aquaculture"):
            if food_trace.get(kind):
                source_ids.add(food_trace[kind]["source_id"])
        if (food_trace.get("aquaculture") or {}).get("regional_source_id"):
            source_ids.add(food_trace["aquaculture"]["regional_source_id"])
        if conservation_trace and conservation_trace.get("source_id"):
            source_ids.add(conservation_trace["source_id"])
        if conservation_trace and conservation_trace.get("current_status_check"):
            source_ids.add(conservation_trace["current_status_check"]["source_id"])
        source_ids.update(r["source_id"] for r in partial_bio)
        for item in bio_trace:
            source_ids.update(r["source_id"] for r in evidence["bioactivity"]
                              if r.get("activity_id") in item["activity_ids"])
        output.append({"aphia_id": aphia, "scientific_name": candidate["scientific_name"],
                       "scores": scores, "score_status": status, "withheld_reasons": reasons,
                       "food_trace": food_trace, "bioactivity_trace": bio_trace,
                       "bioactivity_partial": partial_bio,
                       "conservation_trace": conservation_trace,
                       "sensitivity": sensitivity, "source_ids": sorted(source_ids)})
    return {"method_version": config["method_version"], "status": config["status"],
            "snapshot_date": evidence["snapshot_date"], "candidate_snapshot_date": candidates["checked_on"],
            "generated_at": evidence["snapshot_date"] + "T00:00:00Z",
            "food_weight": config["bbvi"]["default_food_weight"],
            "comparison_cohort": {"id": config["nutrition"]["cohort_id"],
                 "criteria": evidence["nutrition_cohort_criteria"],
                 "food_item_ids": config["nutrition"]["food_item_ids"],
                 "species_count": len(cohort),
                 "warning": "Small fixed cohorts give unstable ranks; sensitivity is not a confidence interval."},
            "method": config, "sources": sources, "species": output}


def render(report: dict) -> str:
    return json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, default=DEFAULT_EVIDENCE)
    parser.add_argument("--candidates", type=Path, default=DEFAULT_CANDIDATES)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="compare existing output without writing")
    args = parser.parse_args()
    evidence = json.loads(args.evidence.read_text(encoding="utf-8"))
    candidates = json.loads(args.candidates.read_text(encoding="utf-8"))
    config = json.loads(args.config.read_text(encoding="utf-8"))
    content = render(build(evidence, candidates, config))
    if args.check:
        require(args.out.read_text(encoding="utf-8") == content, "public report differs from reproducible build")
        print("Reproducible report matches committed output")
    else:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(content, encoding="utf-8")
        report = json.loads(content)
        count = {axis: sum(s["scores"][axis] is not None for s in report["species"])
                 for axis in ("MFPI", "MBPI", "MCUI", "BBVI")}
        print(f"Wrote {args.out}: {count}")


if __name__ == "__main__":
    main()
