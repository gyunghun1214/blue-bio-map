"""Provisional, auditable BBVI prototype for *curated* species evidence.

Nothing in this module fetches data or infers missing measurements. Outputs are
written outside dist/ unless --out is explicitly supplied by a reviewer.
"""
from __future__ import annotations

import argparse
import json
import math
import re
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
VERSION = "pilot-1"
NUTRIENTS = ("protein_g", "iron_mg", "zinc_mg")  # per 100 g edible portion
GRADE_WEIGHT = {"measured": 1.0, "calculated": 0.85, "proxy": 0.5}
IUCN = {"LC": 10, "NT": 35, "VU": 60, "EN": 80, "CR": 100}
COMPOUND_ID = re.compile(r"^(?:CID:\d+|[A-Z]{14}-[A-Z]{10}-[A-Z])$")


def required(condition, message):
    if not condition:
        raise ValueError(message)


def number(value, name, minimum=0, maximum=None):
    required(type(value) in (int, float) and math.isfinite(value), f"{name}: finite number required")
    required(value >= minimum and (maximum is None or value <= maximum), f"{name}: out of range")
    return float(value)


def percentile(value, peers):
    """Midrank percentile; ties remain ties and strata never get mixed."""
    return 100 * (sum(p < value for p in peers) + .5 * sum(p == value for p in peers)) / len(peers)


def validate(payload):
    required(payload.get("schema_version") == 1, "schema_version must be 1")
    species = payload.get("species")
    required(isinstance(species, list) and species, "species must be a nonempty list")
    sources = payload.get("sources")
    required(isinstance(sources, dict) and sources, "sources registry required")
    for source_id, source in sources.items():
        required(isinstance(source, dict) and str(source.get("url", "")).startswith("https://")
                 and source.get("license") and source.get("accessed"), f"{source_id}: URL, license and access date required")
    def sourced(source_id, aphia):
        required(source_id in sources, f"{aphia}: unknown source {source_id!r}")
    ids = set()
    for s in species:
        aphia = s.get("aphia_id")
        required(type(aphia) is int and aphia > 0 and aphia not in ids, "unique positive aphia_id required")
        ids.add(aphia)
        required(isinstance(s.get("scientific_name"), str) and s["scientific_name"].strip(), f"{aphia}: scientific_name required")
        for a in s.get("bioassays", []):
            required(a.get("reviewed") is True, f"{aphia}: unreviewed bioassay")
            required(COMPOUND_ID.fullmatch(str(a.get("compound_id", ""))) is not None, f"{aphia}: InChIKey or PubChem CID required")
            required(all(isinstance(a.get(k), str) and a[k].strip() for k in ("target_id", "assay_type", "reference_id")), f"{aphia}: assay context and reference required")
            sourced(a["reference_id"], aphia)
            number(a.get("pchembl"), "pchembl", 0, 15)
        for name, n in s.get("nutrition", {}).items():
            required(name in NUTRIENTS and isinstance(n, dict), f"{aphia}: unsupported nutrient")
            required(n.get("reviewed") is True and n.get("grade") in GRADE_WEIGHT and n.get("source_id"), f"{aphia}: nutrition provenance/grade required")
            sourced(n["source_id"], aphia)
            number(n.get("per_100g"), name)
            required(n.get("unit") == ("g" if name == "protein_g" else "mg")
                     and n.get("basis") == "100 g edible portion"
                     and n.get("sample_state") == "fresh" and n.get("edible_part") == "reviewed",
                     f"{aphia}: nutrient unit/fresh edible basis must be reviewed")
            required(isinstance(n.get("method"), str) and n["method"].strip()
                     and isinstance(n.get("sample_region"), str) and n["sample_region"].strip()
                     and type(n.get("sample_year")) is int and 1900 <= n["sample_year"] <= date.today().year,
                     f"{aphia}: sample method, region and year required")
        if "edible_fraction" in s:
            number(s["edible_fraction"], "edible_fraction", 0, 1)
            required(s.get("edible_fraction_source"), f"{aphia}: edible fraction source required")
            sourced(s["edible_fraction_source"], aphia)
            required(s.get("edible_fraction_reviewed") is True
                     and isinstance(s.get("edible_fraction_method"), str) and s["edible_fraction_method"].strip(),
                     f"{aphia}: edible fraction method/review required")
        if "aquaculture" in s:
            required(type(s["aquaculture"]) is bool and s.get("aquaculture_source"), f"{aphia}: aquaculture evidence required")
            sourced(s["aquaculture_source"], aphia)
            required(s.get("aquaculture_reviewed") is True
                     and all(isinstance(s.get(k), str) and s[k].strip()
                             for k in ("aquaculture_method", "aquaculture_region", "aquaculture_limitations"))
                     and type(s.get("aquaculture_assessment_year")) is int
                     and 1900 <= s["aquaculture_assessment_year"] <= date.today().year,
                     f"{aphia}: aquaculture method, region, limitations and year required")
        if "conservation" in s:
            c = s["conservation"]
            required(c.get("reviewed") is True and c.get("source_id") and c.get("category") in (*IUCN, "DD", "NE"), f"{aphia}: reviewed IUCN category/source required")
            sourced(c["source_id"], aphia)
            required(type(c.get("assessment_year")) is int and 1900 <= c["assessment_year"] <= date.today().year, f"{aphia}: assessment year required")
            if "obis_trend" in c:
                t = c["obis_trend"]
                required(t.get("reviewed") is True and t.get("effort_adjusted") is True and t.get("source_id") and t.get("direction") in ("declining", "stable", "increasing"), f"{aphia}: OBIS trend must control sampling effort")
                sourced(t["source_id"], aphia)
    return species


def scores(payload, *, food_weight=.5, min_peers=3):
    number(food_weight, "food_weight", 0, 1)
    required(type(min_peers) is int and min_peers >= 3, "min_peers must be >= 3")
    species = validate(payload)
    # Each peer is a unique compound within the SAME target and assay type.
    assay_groups = defaultdict(lambda: defaultdict(list))
    nutrient_groups = defaultdict(dict)
    for s in species:
        for a in s.get("bioassays", []):
            assay_groups[(a["target_id"], a["assay_type"])][a["compound_id"]].append(a["pchembl"])
        for n in NUTRIENTS:
            if n in s.get("nutrition", {}):
                nutrient_groups[n][s["aphia_id"]] = s["nutrition"][n]["per_100g"]
    assay_peers = {k: {compound: median(values) for compound, values in v.items()} for k, v in assay_groups.items()}
    result = []
    for s in species:
        assays = defaultdict(list)
        for a in s.get("bioassays", []):
            assays[(a["target_id"], a["assay_type"], a["compound_id"])].append(a)
        bio = []
        for (target, kind, compound), rows in assays.items():
            peers = assay_peers[(target, kind)]
            if len(peers) < min_peers:
                continue
            # Repeated reports for the same compound cannot create extra peers.
            potency = median([r["pchembl"] for r in rows])
            references = len({r["reference_id"] for r in rows})
            evidence_factor = 1.0 if references >= 2 else .75
            bio.append({"compound_id": compound, "stratum": [target, kind],
                        "peer_count": len(peers), "independent_references": references,
                        "rank": round(percentile(potency, list(peers.values())), 2),
                        "adjusted": percentile(potency, list(peers.values())) * evidence_factor})
        mbpi = round(max((b["adjusted"] for b in bio), default=0), 1) if bio else None

        nutrition = s.get("nutrition", {})
        enough_food = all(n in nutrition and len(nutrient_groups[n]) >= min_peers for n in NUTRIENTS)
        enough_food &= "edible_fraction" in s and "aquaculture" in s
        mfpi = None
        food_trace = None
        if enough_food:
            nutrient_value = sum(percentile(nutrition[n]["per_100g"], list(nutrient_groups[n].values())) * GRADE_WEIGHT[nutrition[n]["grade"]] for n in NUTRIENTS) / len(NUTRIENTS)
            # Pilot weights are explicit and unvalidated, never inferred from missing data.
            mfpi = round(.8 * nutrient_value + 10 * s["edible_fraction"] + 10 * int(s["aquaculture"]), 1)
            food_trace = {"schema_version": "food-1", "reviewed": True, "nutrients": {}}
            for name in NUTRIENTS:
                n = nutrition[name]
                peers = [t for t in species if name in t.get("nutrition", {})]
                food_trace["nutrients"][name] = {
                    "value": n["per_100g"], "unit": n["unit"], "basis": n["basis"],
                    "sample_state": n["sample_state"], "edible_part": n["edible_part"],
                    "method": n["method"], "sample_year": n["sample_year"],
                    "sample_region": n["sample_region"], "grade": n["grade"],
                    "source_id": n["source_id"], "reviewed": True,
                    "peers": [{"aphia_id": t["aphia_id"], "value": t["nutrition"][name]["per_100g"],
                               "unit": t["nutrition"][name]["unit"], "basis": t["nutrition"][name]["basis"],
                               "sample_state": t["nutrition"][name]["sample_state"],
                               "edible_part": t["nutrition"][name]["edible_part"],
                               "method": t["nutrition"][name]["method"],
                               "sample_year": t["nutrition"][name]["sample_year"],
                               "sample_region": t["nutrition"][name]["sample_region"],
                               "grade": t["nutrition"][name]["grade"],
                               "source_id": t["nutrition"][name]["source_id"], "reviewed": True}
                              for t in peers]}
            food_trace["edible_fraction"] = {
                "value": s["edible_fraction"], "source_id": s["edible_fraction_source"],
                "method": s["edible_fraction_method"], "reviewed": True}
            food_trace["aquaculture"] = {
                "feasible": s["aquaculture"], "source_id": s["aquaculture_source"],
                "method": s["aquaculture_method"], "region": s["aquaculture_region"],
                "assessment_year": s["aquaculture_assessment_year"],
                "limitations": s["aquaculture_limitations"], "reviewed": True}

        conservation = s.get("conservation", {})
        category = conservation.get("category")
        mcui = IUCN.get(category)
        trend = conservation.get("obis_trend")
        if mcui is not None and trend:
            mcui = max(0, min(100, mcui + {"declining": 10, "stable": 0, "increasing": -10}[trend["direction"]]))
        stale = bool(conservation and date.today().year - conservation["assessment_year"] > 10)
        bbvi = round(food_weight * mfpi + (1-food_weight) * mbpi, 1) if mfpi is not None and mbpi is not None else None
        missing = [key for key, value in (("MFPI", mfpi), ("MBPI", mbpi), ("MCUI", mcui)) if value is None]
        provenance = {a["reference_id"] for a in s.get("bioassays", [])}
        provenance.update(n["source_id"] for n in nutrition.values())
        if food_trace:
            provenance.update(peer["source_id"] for n in food_trace["nutrients"].values() for peer in n["peers"])
        provenance.update(s[k] for k in ("edible_fraction_source", "aquaculture_source") if k in s)
        if conservation:
            provenance.add(conservation["source_id"])
            if trend:
                provenance.add(trend["source_id"])
        result.append({"aphia_id": s["aphia_id"], "scientific_name": s["scientific_name"],
                       "scores": {"MFPI": mfpi, "MBPI": mbpi, "MCUI": mcui, "BBVI": bbvi},
                       "missing": missing, "iucn_category": category or None,
                       "iucn_assessment_year": conservation.get("assessment_year"),
                       "iucn_review_older_than_10y": stale, "bioactivity_trace": bio,
                       "food_trace": food_trace, "source_ids": sorted(provenance),
                       "note": "Pilot scores; external calibration and back-testing required."})
    return {"method_version": VERSION, "generated_at": datetime.now(timezone.utc).isoformat(),
            "food_weight": food_weight, "min_peers": min_peers,
            "status": "provisional_unvalidated", "sources": payload["sources"], "species": result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="curated JSON with reviewed observations and provenance")
    parser.add_argument("--out", type=Path, default=ROOT / "tmp" / "assessments.json")
    parser.add_argument("--food-weight", type=float, default=.5)
    parser.add_argument("--min-peers", type=int, default=3)
    args = parser.parse_args()
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    report = scores(payload, food_weight=args.food_weight, min_peers=args.min_peers)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(report['species'])} species; {sum(x['scores']['BBVI'] is not None for x in report['species'])} provisional BBVI; wrote {args.out}")


if __name__ == "__main__":
    main()
