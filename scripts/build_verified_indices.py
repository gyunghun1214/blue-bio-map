"""Build a deterministic, provisional species score report from reviewed snapshots.

Stages (all offline; network retrieval lives in collect_*.py and writes dated snapshots):
  1. standardize  - RDA snapshot rows -> nutrition rows (blank = missing, never zero)
  2. link         - food rows -> accepted species only through reviewed rda_taxon_links
  3. cohort       - fixed comparison cohorts from rules; the resulting member list must
                    equal the frozen list in the config, so a snapshot change cannot
                    silently move ranks
  4. score        - MFPI / MBPI / MCUI independently; BBVI only when MFPI and MBPI exist
  5. publish      - dist/assessments.json (`--check` compares byte for byte)

Weights, grade factors, minimum cohort sizes and the IUCN number mapping are the team's
pilot rules, not international standards.
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
from statistics import median, quantiles

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / "research" / "verified-indices"
DEFAULT_EVIDENCE = FOLDER / "evidence.json"
DEFAULT_CANDIDATES = FOLDER / "candidates.json"
DEFAULT_TAXONOMY = FOLDER / "taxonomy.json"
DEFAULT_CONFIG = ROOT / "config" / "verified-indices-v3.28.json"
DEFAULT_OUTPUT = ROOT / "dist" / "assessments.json"
DEFAULT_CATALOG = ROOT / "dist" / "candidate-catalog.json"
COMPOUND_ID = re.compile(r"^(?:CID:\d+|[A-Z]{14}-[A-Z]{10}-[A-Z])$")
AXES = ("MFPI", "MBPI", "MCUI", "BBVI")


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


# ---------- 1. standardize ----------------------------------------------------------

def _number(raw: object) -> float | None:
    """Blank, '-' and 'tr' are not usable magnitudes; they stay missing (never 0)."""
    if raw in (None, "", "-", "tr"):
        return None
    try:
        return float(str(raw).replace(",", ""))
    except ValueError:
        return None


def rda_rows(snapshot: dict, evidence: dict, config: dict) -> dict[str, dict]:
    """Standardize RDA snapshot rows. Grade comes from the published row-source label."""
    settings = config["nutrition"]
    links = {l["food_item_id"]: l for l in evidence.get("rda_taxon_links", [])}
    # a reviewed record here means the row's refuse does not describe the food as purchased (e.g. a fillet sample)
    rejected = {x["food_item_id"]: x for x in evidence.get("rda_refuse_not_accepted", []) if x.get("reviewed") is True}
    for x in rejected.values():
        require(bool(x.get("reason")) and x.get("source_id") in evidence["sources"] and valid_date(x.get("checked_on")),
                f"{x['food_item_id']}: refuse rejection provenance incomplete")
    require(set(rejected) <= {r["code"] for r in snapshot["rows"]}, "refuse rejection names an unknown RDA row")
    out = {}
    for r in snapshot["rows"]:
        v = r["values"]
        label = v.get("row_source") or ""
        grade = "foreign_table_cited" if re.match(r"^[A-Z]{2,}", label) else "domestic_table"
        nutrients = {}
        for name, unit in settings["components"].items():
            value = _number(v.get(name))
            nutrients[name] = None if value is None else {
                "value": value, "unit": unit, "grade": grade,
                "method": f"RDA DB 10.4 table value (row source {label or 'not shown'}); per-value derivation not exposed"}
        link = links.get(r["code"], {})
        refuse = _number(v.get("refuse_pct"))
        refused = rejected.get(r["code"])
        out[r["code"]] = {
            "food_item_id": r["code"], "reported_food_name": r["name"], "english_name": r.get("english_name"),
            "group": r["group"], "row_source": label or None,
            "aphia_id": link.get("aphia_id") if link.get("reviewed") else None,
            "scientific_name": link.get("scientific_name") if link.get("reviewed") else None,
            "taxon_link": link or None, "source_id": "rda_db_10_4", "reviewed": True,
            "sample_state": "raw", "basis": "100 g edible portion", "nutrients": nutrients,
            "refuse_not_accepted": refused and {**refused, "refuse_pct": refuse},
            "edible_fraction": None if refuse is None or refused else {
                "kind": "edible_fraction", "value": round(1 - refuse / 100, 4), "unit": "edible share of food as purchased",
                "method": f"1 - refuse ({refuse:g}%) / 100 from the same RDA row", "source_id": "rda_db_10_4",
                "record_id": f"RDA-10.4:{r['code']}:refuse", "region": "Korea (RDA national table)",
                "sample_period": label or "not stated", "reviewed": True,
                "limitations": "Refuse share of the food as purchased; shell/tunic share varies with season, size and origin."}}
    return out


# ---------- 2/3. link and cohorts ----------------------------------------------------

def check_row(row: dict, settings: dict, sources: dict) -> None:
    require(row.get("reviewed") is True and row.get("source_id") in sources
            and row.get("sample_state") == "raw" and row.get("basis") == "100 g edible portion",
            f"{row['food_item_id']}: incompatible/unreviewed food row")
    for name, unit in settings["components"].items():
        n = row.get("nutrients", {}).get(name)
        require(isinstance(n, dict) and n.get("unit") == unit
                and n.get("grade") in settings["grade_factors"] and n.get("method"),
                f"{row['food_item_id']}: {name} unit/grade/method")
        finite(n.get("value"), f"{row['food_item_id']}:{name}")


def cohort_members(spec: dict, rows: dict[str, dict], settings: dict) -> list[str]:
    if "food_item_ids" in spec:
        return list(spec["food_item_ids"])
    rule = spec["rule"]
    members = []
    for code, r in rows.items():
        if r["group"] != rule["group"] or code in rule.get("exclude_food_item_ids", {}):
            continue
        if any(term in r["reported_food_name"] for term in rule.get("exclude_name_terms", [])):
            continue
        if all(r["nutrients"].get(name) for name in settings["components"]):
            members.append(code)
    return sorted(members)


def build_cohorts(specs: list[dict], rows: dict[str, dict], settings: dict, sources: dict) -> dict[str, dict]:
    cohorts = {}
    for spec in specs:
        ids = cohort_members(spec, rows, settings)
        if "rule" in spec:
            require(ids == sorted(spec["frozen_food_item_ids"]),
                    f"{spec['cohort_id']}: cohort differs from frozen member list (snapshot changed?)")
        require(all(i in rows for i in ids), f"{spec['cohort_id']}: unknown food item")
        members = [rows[i] for i in ids]
        require(len(members) >= settings["minimum_species"], f"{spec['cohort_id']}: cohort too small")
        require(len({r["food_item_id"] for r in members}) == len(members), "duplicate food item in cohort")
        for row in members:
            check_row(row, settings, sources)
        cohorts[spec["cohort_id"]] = {"spec": spec, "rows": members}
    return cohorts


# ---------- 4. scoring ---------------------------------------------------------------

def mfpi(row: dict, cohort: list[dict], fraction: dict, aqua: dict, settings: dict,
         weights: dict | None = None, factors: dict | None = None) -> tuple[float, dict]:
    weights = weights or {k: settings[k] for k in ("nutrient_weight", "edible_fraction_weight", "aquaculture_weight")}
    factors = factors or settings["grade_factors"]
    nutrients = {}
    for name in settings["components"]:
        n = row["nutrients"][name]
        if n is None:  # 3.7: a component missing from the species' own row is left out of the mean, never scored 0
            continue
        rank = percentile(n["value"], [r["nutrients"][name]["value"] for r in cohort])
        nutrients[name] = {**n, "percentile": round(rank, 2), "percentile_unrounded": rank,
                           "evidence_factor": factors[n["grade"]],
                           "peer_values": [{"food_item_id": r["food_item_id"], "name": r["reported_food_name"],
                                            "value": r["nutrients"][name]["value"]} for r in cohort]}
    graded = sum(n["percentile_unrounded"] * n["evidence_factor"] for n in nutrients.values()) / len(nutrients)
    raw = sum(n["percentile_unrounded"] for n in nutrients.values()) / len(nutrients)
    score = (weights["nutrient_weight"] * graded
             + 100 * weights["edible_fraction_weight"] * finite(fraction["value"], "edible_fraction", 0, 1)
             + 100 * weights["aquaculture_weight"] * int(aqua["feasible"]))
    parts = {"nutrient_value_contribution": round(weights["nutrient_weight"] * raw, 2),
             "evidence_grade_deduction": round(weights["nutrient_weight"] * (raw - graded), 2),
             "edible_fraction_contribution": round(100 * weights["edible_fraction_weight"] * fraction["value"], 2),
             "aquaculture_contribution": round(100 * weights["aquaculture_weight"] * int(aqua["feasible"]), 2)}
    return score, {"nutrients": nutrients, "components": parts, "weights": weights}


def substitute(aphia: int, name: str, evidence: dict, settings: dict, rows: dict | None = None) -> dict | None:
    """verified-pilot-3.3: a component missing from a species' RDA row, taken from the closest uFiSh raw item of the
    same consumed part: species (measured > calculated) > same genus > same family (proxy). Never a pooled entry above
    family level (scripts/collect_mfpi_substitutes.py). The relative's value is labelled as a substitute on screen."""
    rule = settings["substitutes"]
    linked = [l["food_item_id"] for l in rule.get("subsample_links", []) if l["aphia_id"] == aphia and l.get("reviewed") is True]
    picked = [rows[i] for i in linked if rows and rows[i]["nutrients"][name] is not None]
    if picked:  # same-species sub-samples of the same RDA table come before any other table
        grades = {r["nutrients"][name]["grade"] for r in picked}
        require(len(grades) == 1, f"{aphia}: sub-sample rows with different grades")
        ids = [r["food_item_id"] for r in picked]
        return {"value": round(sum(r["nutrients"][name]["value"] for r in picked) / len(picked), 4), "unit": settings["components"][name],
                "grade": grades.pop(),
                "method": f"RDA DB 10.4 same-species sub-sample rows {', '.join(ids)}: " + ("mean of " if len(ids) > 1 else "") +
                          ", ".join(f"{r['reported_food_name']} {r['nutrients'][name]['value']:g}" for r in picked),
                "substitute": {"food_item_id": "+".join(ids), "food_name": " / ".join(r["reported_food_name"] for r in picked),
                               "taxon_label": picked[0]["english_name"], "taxon_level": "subsample", "part": "edible portion",
                               "doc_code": None, "n": len(picked), "source_id": "rda_db_10_4", "label": rule["labels"]["subsample"],
                               "values": {r["food_item_id"]: r["nutrients"][name]["value"] for r in picked}}}
    found = []
    for item in evidence["mfpi_substitutes"]["items"]:
        level, c = item["matches"].get(str(aphia)), item["components"].get(name)
        if c is None:
            continue
        if level in rule["levels"] and item["part"] in rule["parts"] and c["value"] is not None:
            grade = rule["species_grade_by_doc"].get(c["doc"], "proxy") if level == "species" else "proxy"
            found.append(((rule["levels"].index(level), -settings["grade_factors"][grade], -(c["n"] or 0), item["food_item_id"]),
                          item, level, grade))
    mext = rule.get("mext")  # 3.6: same-species raw item of the Japanese table, after uFiSh species and before proxies
    if mext and name in mext["components"]:
        for item in evidence["mfpi_mext"]["items"]:
            c = item["components"].get(name)
            if item["aphia_id"] == aphia and c and c["value"] is not None:
                require(item["sample_state"] == "raw" and item["basis"] == "100 g edible portion" and c["unit"] == settings["components"][name],
                        f"{aphia}: MEXT item is not a raw 100 g edible-portion value")
                found.append(((rule["levels"].index("mext"), -settings["grade_factors"][mext["grade"]], 0, item["food_item_id"]),
                              item, "mext", mext["grade"]))
    if not found:
        return None
    _, item, level, grade = min(found, key=lambda x: x[0])
    c = item["components"][name]
    if level == "mext":
        return {"value": c["value"], "unit": settings["components"][name], "grade": grade,
                "method": f"MEXT 2020 (8th) {item['food_item_id']} {item['food_name']}: same-species raw item, {item['value_basis']}",
                "substitute": {"food_item_id": item["food_item_id"], "food_name": item["food_name"], "taxon_label": item["taxon_label"],
                               "taxon_level": "mext", "part": item["part"], "doc_code": None, "n": None, "table": "MEXT",
                               "link_evidence": item["link_evidence"], "source_id": mext["source_id"], "label": rule["labels"]["mext"]}}
    return {"value": c["value"], "unit": settings["components"][name], "grade": grade,
            "method": f"uFiSh1.0 {item['food_item_id']} {item['food_name']}: {level}-level value, documentation '{c['doc']}', n {c['n'] or 'not given'}",
            "substitute": {"food_item_id": item["food_item_id"], "food_name": item["food_name"], "taxon_label": item["taxon_label"],
                           "taxon_level": level, "part": item["part"], "doc_code": c["doc"], "n": c["n"],
                           "source_id": rule["source_id"], "label": rule["labels"][level]}}


def mext_species_row(aphia: int, evidence: dict, settings: dict) -> dict | None:
    """verified-pilot-3.9: a reviewed MEXT 2020 same-species raw item as the species' own nutrition row, used only when
    RDA DB 10.4 has no row linked to the species. Graded like an RDA row that cites the Japanese table; it is ranked
    against a fixed cohort plus itself and never joins one."""
    mext = (settings.get("substitutes") or {}).get("mext") or {}
    groups = mext.get("species_row_groups")
    item = groups and next((i for i in evidence["mfpi_mext"]["items"] if i["aphia_id"] == aphia and i.get("species_row")), None)
    if not item:
        return None
    require(item["sample_state"] == "raw" and item["basis"] == "100 g edible portion" and item.get("food_group") in groups
            and all(c["unit"] == settings["components"][k] for k, c in item["components"].items()),
            f"{aphia}: MEXT species row is not a raw 100 g edible-portion item of a configured group")
    refuse = finite(item["refuse_pct"], f"{aphia}: MEXT refuse", 0, 99)
    method = f"MEXT 2020 (8th) {item['food_item_id']} {item['food_name']}: same-species raw item, {item['value_basis']}"
    return {"food_item_id": f"MEXT:{item['food_item_id']}", "reported_food_name": item["food_name"], "english_name": item["taxon_label"],
            "group": groups[item["food_group"]], "row_source": "MEXT 2020 (8th)", "aphia_id": aphia,
            "taxon_link": {"link_evidence": item["link_evidence"]}, "source_id": mext["source_id"], "reviewed": True,
            "sample_state": "raw", "basis": "100 g edible portion", "refuse_not_accepted": None,
            "nutrients": {k: None if item["components"].get(k) is None else
                          {"value": item["components"][k]["value"], "unit": unit, "grade": mext["grade"], "method": method}
                          for k, unit in settings["components"].items()},
            "edible_fraction": {"kind": "edible_fraction", "value": round(1 - refuse / 100, 4), "unit": "edible share of food as purchased",
                                "method": f"1 - refuse ({refuse:g}%) / 100 from the same MEXT item", "source_id": mext["source_id"],
                                "record_id": f"MEXT-2020:{item['food_item_id']}:refuse", "region": "Japan (MEXT 2020 national table)",
                                "sample_period": item["value_basis"], "reviewed": True,
                                "limitations": "Refuse share of the food as purchased in the Japanese table; size and origin of the sample differ from Korean catches."}}


def literature_species_row(aphia: int, evidence: dict, settings: dict) -> dict | None:
    """After 3.12: a reviewed paper's analysis of the species itself, converted to fresh weight with the moisture of the same
    sample, as the species' nutrition row when neither RDA DB 10.4 nor MEXT 2020 has one. Ranked against a fixed cohort plus
    itself and never joins one; a component the paper reports inconsistently stays out of the mean (3.7 rule)."""
    lit = (settings.get("substitutes") or {}).get("literature")
    item = lit and next((i for i in evidence["mfpi_literature"]["items"] if i["aphia_id"] == aphia), None)
    if not item:
        return None
    moisture = finite(item["moisture_pct"], f"{aphia}: literature moisture", 0, 99)
    require(item["sample_state"] == "raw" and item["basis"] == "100 g edible portion" and item["food_group"] in lit["species_row_groups"]
            and item["source_id"] in lit["source_ids"] and not set(item["components"]) & set(item.get("omitted", {}))
            and set(item["components"]) | set(item.get("omitted", {})) == set(settings["components"]),
            f"{aphia}: literature row is not a raw 100 g edible-portion row of a configured group")
    for k, c in item["components"].items():
        require(c["unit"] == settings["components"][k] and c["value"] == round(c["dry_basis_value"] * (100 - moisture) / 100, 2),
                f"{aphia}:{k}: literature value is not the dry-basis value at the sample's moisture")
    method = f"{item['record_id']} ({item['source_id']}): dry-basis value x (100 - {moisture:g}% moisture of the same sample) / 100"
    e = item["edible_fraction"]
    return {"food_item_id": f"LIT:{item['record_id']}", "reported_food_name": item["taxon_label"], "english_name": item["taxon_label"],
            "group": item["food_group"], "row_source": "literature", "aphia_id": aphia, "limitations": item.get("limitations"),
            "taxon_link": {"link_evidence": item["taxon_link_evidence"]}, "source_id": item["source_id"], "reviewed": True,
            "sample_state": "raw", "basis": "100 g edible portion", "refuse_not_accepted": None,
            "nutrients": {k: None if k not in item["components"] else
                          {"value": item["components"][k]["value"], "unit": unit, "grade": lit["grade"], "method": method}
                          for k, unit in settings["components"].items()},
            "edible_fraction": {"kind": "edible_fraction", "value": finite(e["value"], f"{aphia}: literature edible fraction", 0, 1),
                                "unit": "edible share of food as purchased", "method": e["method"], "source_id": item["source_id"],
                                "record_id": f"{item['record_id']}:edible_fraction", "region": item["region"],
                                "sample_period": item["sample_period"], "reviewed": True, "limitations": e["limitations"]}}


def support_for(aphia: int, evidence: dict, kind: str) -> list[dict]:
    return [r for r in evidence.get("food_support", []) if r.get("aphia_id") == aphia and r.get("kind") == kind]


def food_axis(candidate: dict, evidence: dict, config: dict, rows: dict, primary: dict, cross: dict) -> tuple:
    settings, aphia, sources = config["nutrition"], candidate["aphia_id"], evidence["sources"]
    aqua = next((r for r in support_for(aphia, evidence, "aquaculture") if r.get("reviewed") is True), None)
    if aqua:
        require(aqua.get("source_id") in sources and aqua.get("record_id") and aqua.get("method")
                and aqua.get("region") and aqua.get("year") and aqua.get("limitations")
                and type(aqua.get("feasible")) is bool, "aquaculture provenance incomplete")
    trace = {"method_version": config["method_version"], "aquaculture": aqua,
             "supplemental_nutrition": [r for r in evidence.get("nutrition_observations", []) if r.get("aphia_id") == aphia],
             "observed_rows": [], "cross_checks": []}
    # every linked (or explicitly unlinked) RDA row is shown as a raw observation
    for r in rows.values():
        link = r.get("taxon_link") or {}
        if r["aphia_id"] == aphia or link.get("candidate_aphia_id") == aphia:
            trace["observed_rows"].append({
                "food_item_id": r["food_item_id"], "reported_food_name": r["reported_food_name"],
                "english_name": r["english_name"], "row_source": r["row_source"], "linked": r["aphia_id"] == aphia,
                "link_evidence": link.get("link_evidence"),
                "values": {k: (n or {}).get("value") for k, n in r["nutrients"].items()},
                "missing": [k for k, n in r["nutrients"].items() if n is None],
                "refuse_pct": None if r["edible_fraction"] is None else round(100 * (1 - r["edible_fraction"]["value"]), 4),
                **({"refuse_not_accepted": r["refuse_not_accepted"]} if r["refuse_not_accepted"] else {}),
                **({"link_source_id": link["source_id"]} if r["aphia_id"] == aphia and link.get("source_id") else {})})  # name links after 3.12
    # 3.9: a MEXT species row; after 3.12 a reviewed literature row when MEXT has none either
    mrow = None if any(r["aphia_id"] == aphia for r in rows.values()) else (
        mext_species_row(aphia, evidence, settings) or literature_species_row(aphia, evidence, settings))
    if mrow:  # 3.9: the MEXT row is this species' own row, shown with the RDA observations it stands in for
        trace["observed_rows"].append({
            "food_item_id": mrow["food_item_id"], "reported_food_name": mrow["reported_food_name"], "english_name": mrow["english_name"],
            "row_source": mrow["row_source"], "linked": True, "link_evidence": mrow["taxon_link"]["link_evidence"],
            "values": {k: (n or {}).get("value") for k, n in mrow["nutrients"].items()},
            "missing": [k for k, n in mrow["nutrients"].items() if n is None],
            "refuse_pct": round(100 * (1 - mrow["edible_fraction"]["value"]), 4), "source_id": mrow["source_id"]})
    trace["observed_rows"].sort(key=lambda x: x["food_item_id"])
    have = {**{k: False for k in settings["components"]},
            "edible_fraction": any(r.get("reviewed") is True for r in support_for(aphia, evidence, "edible_fraction")),
            "aquaculture": aqua is not None}
    for obs in trace["observed_rows"]:
        if obs["linked"]:
            for k in settings["components"]:
                have[k] = have[k] or obs["values"][k] is not None
            have["edible_fraction"] = have["edible_fraction"] or obs["refuse_pct"] is not None
    trace["sufficiency"] = {"required": list(have), "present": [k for k, ok in have.items() if ok],
                            "ratio": round(sum(have.values()) / len(have), 2)}

    def completed(cohort: dict) -> dict | None:
        """3.3: the species' own RDA row of the cohort's group with its missing components substituted. It is ranked
        against the fixed cohort plus itself (as cohort members are) and never joins the cohort."""
        rule = cohort["spec"].get("rule", {})
        for r in sorted((r for r in rows.values() if r["aphia_id"] == aphia and r["group"] == rule.get("group")), key=lambda r: r["food_item_id"]):
            # rows the cohort rule leaves out (sub-samples, organs, farmed) are never ranked through the back door
            if r["food_item_id"] in rule.get("exclude_food_item_ids", {}) or any(t in r["reported_food_name"] for t in rule.get("exclude_name_terms", [])):
                continue
            missing = [k for k, n in r["nutrients"].items() if n is None]
            if not missing or len(missing) == len(r["nutrients"]):  # complete rows are cohort members; empty ones never score
                continue
            filled = {k: substitute(aphia, k, evidence, settings, rows) for k in missing}
            trace.setdefault("substitute_search", {}).update({k: v and (("MEXT:" if v["substitute"]["taxon_level"] == "mext" else "")
                                                                         + v["substitute"]["food_item_id"]) for k, v in filled.items()})
            if all(filled.values()):
                trace["substitute_row"] = r["food_item_id"]
                return {**r, "nutrients": {**r["nutrients"], **filled}}
            # 3.7: with no substitute for some component, the row still scores when it reports minimum_components
            nutrients = {**r["nutrients"], **{k: v for k, v in filled.items() if v}}
            if sum(v is not None for v in nutrients.values()) >= settings.get("minimum_components", len(nutrients)):
                trace["substitute_row"] = r["food_item_id"]
                return {**r, "nutrients": nutrients}
        return None

    def scored(cohort_id: str, cohort: dict):
        row = next((r for r in cohort["rows"] if r.get("aphia_id") == aphia), None)
        peers = cohort["rows"]
        if not row and settings.get("substitutes") and "rule" in cohort["spec"]:
            row = completed(cohort)
            peers = cohort["rows"] + [row] if row else peers
        if not row and mrow and mrow["group"] == cohort["spec"].get("rule", {}).get("group"):
            row, peers = mrow, cohort["rows"] + [mrow]
        if not row or not aqua:
            return None
        fraction = row.get("edible_fraction") or next((r for r in support_for(aphia, evidence, "edible_fraction")
                                                       if r.get("reviewed") is True), None)
        if not fraction:
            return None
        score, detail = mfpi(row, peers, fraction, aqua, settings)
        omitted = [k for k, n in row["nutrients"].items() if n is None]
        extra = ({"outside_cohort": True, "substituted_components": [k for k, n in row["nutrients"].items() if n and n.get("substitute")],
                  **({"omitted_components": omitted} if omitted else {}),  # key only in 3.7+, so older reports reproduce
                  **({"row_table": "literature" if row["row_source"] == "literature" else "mext"} if row is mrow else {})}  # 3.9+
                 if peers is not cohort["rows"] else {})
        require(not extra or extra["substituted_components"] or extra.get("omitted_components") or extra.get("row_table"),
                f"{aphia}: a row outside the cohort must carry a substitute, an omitted component or a MEXT species row")
        return score, {"cohort_id": cohort_id, "cohort_species": len(cohort["rows"]), "row": row, "fraction": fraction, **detail, **extra}

    for cid, cohort in cross.items():
        hit = scored(cid, cohort)
        if hit:
            trace["cross_checks"].append({"cohort_id": cid, "mfpi": round1(hit[0]), "cohort_species": hit[1]["cohort_species"],
                                          "edible_fraction": hit[1]["fraction"]["value"], "note": cohort["spec"].get("note", "")})
    for cid, cohort in primary.items():
        hit = scored(cid, cohort)
        if not hit:
            continue
        score, d = hit
        row, fraction = d.pop("row"), d.pop("fraction")
        trace.update(d)
        trace.update({"source_food_item_id": row["food_item_id"], "reported_food_name": row["reported_food_name"],
                      "english_name": row.get("english_name"), "row_source": row.get("row_source"),
                      "source_id": row["source_id"], "sample_state": row["sample_state"], "basis": row["basis"],
                      "cohort_food_item_ids": [r["food_item_id"] for r in cohort["rows"]],
                      "cohort_criteria": cohort["spec"]["criteria"], "edible_fraction": fraction, "unrounded": score,
                      "formula": "nutrient_weight x mean(percentile x evidence_factor) + 100 x edible_fraction_weight x edible_fraction + 100 x aquaculture_weight x aquaculture_boolean"})
        others = [r for r in support_for(aphia, evidence, "edible_fraction") + support_for(aphia, evidence, "edible_fraction_sensitivity")
                  if r.get("reviewed") is True and r is not fraction]
        trace["yield_sensitivity"] = [{"source_id": r["source_id"], "record_id": r["record_id"], "fraction": r["value"],
                                       "region": r.get("region"),
                                       "mfpi_at_same_nutrients": round1(score + 100 * settings["edible_fraction_weight"] * (r["value"] - fraction["value"]))}
                                      for r in others]
        peers = cohort["rows"] + [row] if d.get("outside_cohort") else cohort["rows"]
        trace["weight_sensitivity"] = [{**alt, "mfpi": round1(mfpi(row, peers, fraction, aqua, settings, weights=alt)[0])}
                                       for alt in config["sensitivity"]["mfpi_weights"]]
        # an observation record of the same uFiSh item says 'not used'; say which component the substitute now uses
        used = {f"uFiSh1.0:{n['substitute']['food_item_id']}": k for k, n in trace["nutrients"].items() if n.get("substitute")}
        trace["supplemental_nutrition"] = [{**r, "substitute_use": f"{used[r['record_id']]} is used as a {config['method_version']} substitute; "
                                                                   "the other values of this record stay unused"}
                                           if r.get("record_id") in used else r for r in trace["supplemental_nutrition"]]
        trace["grade_sensitivity"] = {"all_grade_factors_1": round1(mfpi(row, peers, fraction, aqua, settings,
                                                                         factors={k: 1.0 for k in settings["grade_factors"]})[0])}
        step = round(100 / len(peers), 1)
        why = ([f"{k} is a substitute ({row['nutrients'][k]['substitute']['label']}, {row['nutrients'][k]['substitute']['food_item_id']})"
                for k in d.get("substituted_components", [])]
               + [f"{k} is not reported in the species' own row and is left out of the mean (not scored 0)" for k in d.get("omitted_components", [])]
               + (["the species' own row is a MEXT 2020 same-species item (RDA DB 10.4 has no row linked to this species)"] if d.get("row_table") == "mext" else [])
               + (["the species' own row is a reviewed paper's analysis of the species converted to fresh weight with the same sample's moisture "
                   "(neither RDA DB 10.4 nor MEXT 2020 has a row for this species)"] if d.get("row_table") == "literature" else []))
        outside = [f"Ranked against the {len(cohort['rows'])}-food cohort plus itself because " + ", ".join(why)
                   + ("; a substitute comes from another sample, region or table, not from this species' own row." if d.get("substituted_components") else ".")
                   ] if d.get("outside_cohort") else []
        fa = settings.get("display_fatty_acids")
        if fa and row.get("source_id") == fa["source_id"]:
            snap = json.loads((ROOT / fa["snapshot"]).read_text(encoding="utf-8"))
            hit = next((r for r in snap["rows"] if r["code"] == row["food_item_id"]), None)
            if hit and hit.get("epa_mg") is not None and hit.get("dha_mg") is not None:
                require(hit["row_source"] == row.get("row_source"), f"{aphia}: fatty-acid row source differs from the nutrition row")
                trace["display_fatty_acids"] = {"epa_mg": hit["epa_mg"], "dha_mg": hit["dha_mg"],
                                                "sum_mg": round(hit["epa_mg"] + hit["dha_mg"], 2),
                                                "reference_mg": fa["daily_reference_mg"], "row_source": hit["row_source"],
                                                "source_id": fa["display_source_id"], "use": "display_only"}
        # 3.23: a literature row's reviewed limitations reach the trace (3.15-3.22 read its values and dropped this text)
        if d.get("row_table") == "literature" and ((settings.get("substitutes") or {}).get("literature") or {}).get("show_limitations"):
            require(row.get("limitations"), f"{aphia}: a literature row needs its reviewed limitations")
            trace["literature_limitations"] = row["limitations"]
        trace["uncertainty"] = list(cohort["spec"].get("uncertainty", [])) + outside + [
            f"{len(peers)}-food ranking (the fixed cohort plus this species): one rank step moves a nutrient percentile by about {step} points."
            if outside else f"{len(cohort['rows'])}-food fixed cohort: one rank step moves a nutrient percentile by about {step} points.",
            "Sensitivity values are scenario arithmetic, not a statistical confidence interval."]
        return round1(score), trace, None
    linked = [o for o in trace["observed_rows"] if o["linked"]]
    if not trace["observed_rows"] and not trace["supplemental_nutrition"]:
        return None, trace, "comparable_nutrition_missing"
    if not linked:
        return None, trace, "food_row_not_species_specific"
    # 3.3: once substitutes fill every missing component, the missing component is no longer what holds the score
    filled = bool(trace.get("substitute_row"))
    if all(o["missing"] for o in linked) and not filled:
        return None, trace, "component_missing_in_source"
    if not aqua:
        return None, trace, "aquaculture_method_unverified"
    return None, trace, "species_edible_yield_unverified"


def _approved_assays(evidence: dict, config: dict, candidates_by_id: dict[int, dict]) -> list[dict]:
    rows = [r for r in evidence.get("bioactivity", []) if r.get("status") == "approved_for_score"]
    eligible = config["bioactivity"]["eligible_endpoints"]
    structures = evidence.get("reviewed_compound_structures", {})
    protocols = evidence.get("reviewed_assay_protocols", {})
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
        candidate = candidates_by_id.get(a["origin_aphia_id"])
        require(candidate is not None and candidate["scientific_name"] == a["origin_scientific_name"],
                f"{a['activity_id']}: origin species does not match accepted candidate identity")
        # A CID alone does not establish the structure of the isolated molecule.
        # Freeze the source-structure and source-assay joins independently of the
        # scored activity row, so a mistyped CID, DOI or assay cannot be accepted.
        structure = structures.get(a["compound_id"])
        protocol = protocols.get(a["assay_id"])
        require(structure is not None and structure.get("name") == a.get("compound_name")
                and structure.get("formula") == a.get("molecular_formula")
                and structure.get("source_id") in evidence["sources"]
                and structure.get("url") == f"https://pubchem.ncbi.nlm.nih.gov/compound/{a['compound_id'][4:]}"
                and protocol is not None
                and all(protocol.get(k) == a.get(k) for k in
                        ("original_paper_doi", "origin_aphia_id", "origin_scientific_name",
                         "target_id", "endpoint", "assay_type", "test_system", "conditions_key"))
                and a.get("raw_unit") in ("mM", "µM", "nM")
                and a.get("original_paper_url") == evidence["sources"][a["source_id"]].get("url")
                and a.get("paper_structure_label")
                and a.get("paper_species_name") == a["origin_scientific_name"],
                f"{a['activity_id']}: reviewed structure/original paper/assay join mismatch")
        multiplier = {"mM": 1e6, "µM": 1e3, "nM": 1}[a["raw_unit"]]
        require(abs(a["raw_value"] * multiplier - a["standard_value"]) < max(1e-6, a["standard_value"] * 1e-8),
                f"{a['activity_id']}: original unit conversion mismatch")
        finite(a.get("standard_value"), "standard_value", 0.0000001)
        p = finite(a.get("pchembl_value"), "pchembl_value", 0, 15)
        require(abs(p - (9 - math.log10(a["standard_value"]))) < 0.03,
                f"{a['activity_id']}: pChEMBL inconsistent with nM endpoint")
    return rows


PEPTIDE = re.compile(r"^[ACDEFGHIKLMNPQRSTVWY]{2,}$")
# Average residue masses (ExPASy Compute pI/Mw, average isotopic composition); a free peptide adds one water.
RESIDUE_MASS = {"G": 57.0519, "A": 71.0788, "S": 87.0782, "P": 97.1167, "V": 99.1326, "T": 101.1051, "C": 103.1388, "L": 113.1594,
                "I": 113.1594, "N": 114.1038, "D": 115.0886, "Q": 128.1307, "K": 128.1741, "E": 129.1155, "M": 131.1926, "H": 137.1411,
                "F": 147.1766, "R": 156.1875, "Y": 163.1760, "W": 186.2132}
WATER_MASS = 18.01524


def converted_peptide(r: dict) -> dict:
    """ug/mL -> uM for a synthetic peptide whose sequence the paper confirmed: uM = ug/mL / (g/mol) x 1000 (free peptide,
    no counter-ion). The paper's own value and unit stay beside the converted one (team-lead decision 2026-10-01)."""
    require(r.get("synthetic") is True and r.get("sequence_confirmed") is True and PEPTIDE.fullmatch(str(r.get("sequence", ""))) is not None,
            f"{r.get('record_id')}: only a synthetic, sequence-confirmed peptide is converted to uM")
    mass = sum(RESIDUE_MASS[a] for a in r["sequence"]) + WATER_MASS
    value = finite(r.get("value"), "peptide IC50", 0.0000001)
    return {**r, "value": round(value / mass * 1000, 2), "unit": "uM",
            "converted_from": {"value": value, "unit": r["unit"], "molecular_weight": round(mass, 2)}}


def peptide_items(evidence: dict, config: dict) -> list[tuple[int, dict]]:
    """verified-pilot-3 peptide stratum: its own fixed cohort, never mixed with ChEMBL compounds."""
    settings = config.get("peptide_bioactivity")
    if not settings:
        return []
    cohort = json.loads((ROOT / settings["cohort_file"]).read_text(encoding="utf-8"))
    peers = [6 - math.log10(finite(m["ic50_uM"], "cohort IC50", 0.0000001)) for m in cohort["members"]]
    require(cohort["size"] == len(peers) >= settings["minimum_peptides"], "peptide cohort below minimum size")
    for r in evidence.get("peptide_bioactivity", []):
        require(r.get("origin_aphia_id") and r.get("origin_scientific_name"), f"{r.get('record_id')}: peptide origin species required")
        require(r.get("material_kind") not in settings["excluded_material_kinds"],
                f"{r.get('record_id')}: extracts, hydrolysates and fractions cannot enter the peptide stratum")
    approved = [r for r in evidence.get("peptide_bioactivity", []) if r.get("status") == "approved_for_score"]
    conv = settings.get("unit_conversion")
    if conv:  # after 3.14: a synthetic, sequence-confirmed peptide reported only in ug/mL becomes uM by its sequence mass
        approved = [r if r.get("unit") != conv["from_unit"] else converted_peptide(r) for r in approved]
    groups = defaultdict(list)
    for r in approved:
        require(r.get("reviewed") is True and r.get("material_kind") == "single_peptide"
                and PEPTIDE.fullmatch(str(r.get("sequence", ""))) is not None
                and r.get("sequence_confirmed") is True and r.get("value_in_text") is True
                and r.get("target") == settings["target"] and r.get("endpoint") == settings["endpoint"]
                and r.get("substrate") == settings["substrate"] and r.get("relation") == "=" and r.get("unit") == "uM"
                and r.get("source_id") in evidence["sources"] and r.get("original_paper_doi"),
                f"{r.get('record_id')}: incomplete peptide origin/sequence/assay chain")
        finite(r.get("value"), "peptide IC50", 0.0000001)
        groups[(r["origin_aphia_id"], r["sequence"])].append(r)
    xo = settings.get("cross_origin_potency")
    out = []
    for (origin, sequence), own in sorted(groups.items()):
        caveats = sorted({r["caveat"] for r in own if r.get("caveat")})
        value = median(6 - math.log10(r["value"]) for r in own)
        rank = percentile(value, peers)
        dois = {r["original_paper_doi"].lower() for r in own}
        replications = potency_replications(evidence, settings, sequence, value, dois) if xo else []
        independent = dois | {r["original_paper_doi"].lower() for r in replications if r["used"]}
        factor = config["bioactivity"]["single_doi_factor"] if len(independent) == 1 else config["bioactivity"]["multiple_doi_factor"]
        out.append((origin, {"stratum_kind": "peptide", "peptide_sequence": sequence, "stratum_id": cohort["cohort_id"],
                             "record_ids": sorted(r["record_id"] for r in own), "original_paper_dois": sorted(dois),
                             "peer_peptides": len(peers), "pIC50": round(value, 3), "percentile": round(rank, 2),
                             "evidence_factor": factor, "adjusted": rank * factor,
                             # the paper values behind pIC50, so the page can show the original number and its source
                             "measurements": [{**{k: r[k] for k in ("target", "endpoint", "relation", "value", "unit", "substrate",
                                                                    "source_id", "original_paper_doi")},
                                               **({"converted_from": r["converted_from"]} if "converted_from" in r else {})} for r in own],
                             # research-only: same synthetic sequence measured from another origin counts toward DOIs, not value
                             **({"independent_dois": sorted(independent), "potency_replications": replications} if xo else {}),
                             **({"caveat": " ".join(caveats)} if caveats else {})}))
    return out


def amp_items(evidence: dict, config: dict) -> list[tuple[int, dict]]:
    """verified-pilot-3.18 antimicrobial-peptide stratum. Same shape as the ACE peptide stratum: one fixed cohort per target
    bacterium (DBAASP MIC, broth media), pMIC = 6 - log10(MIC uM), percentile inside that cohort, the same single/multiple-DOI
    factors and the same max aggregation. The proposal names antibacterial activity as an MBPI input; this is that input, kept
    in its own stratum so a MIC is never ranked against an ACE IC50."""
    settings = config.get("amp_bioactivity")
    rows = evidence.get("amp_bioactivity", [])
    if not settings or not rows:
        return []
    book = json.loads((ROOT / settings["cohort_file"]).read_text(encoding="utf-8"))
    cohorts = {c["target_species"]: c for c in book["cohorts"]}
    groups = defaultdict(list)
    for r in rows:
        if r.get("status") != "approved_for_score":
            continue
        require(r.get("reviewed") is True and r.get("material_kind") == "single_peptide"
                and PEPTIDE.fullmatch(str(r.get("sequence", ""))) is not None
                and r.get("sequence_confirmed") is True and r.get("value_in_text") is True
                and (r.get("synthetic") is True or r.get("material") in settings["accepted_materials"])
                and r.get("endpoint") == settings["endpoint"] and r.get("relation") == "=" and r.get("unit") == "uM"
                and r.get("method") == settings["method"] and r.get("source_id") in evidence["sources"]
                and r.get("original_paper_doi") and r.get("origin_aphia_id") and r.get("origin_scientific_name"),
                f"{r.get('record_id')}: incomplete AMP origin/sequence/assay chain")
        finite(r.get("value"), "AMP MIC", 0.0000001)
        groups[(r["origin_aphia_id"], r["sequence"], r["target_species"])].append(r)
    out = []
    for (origin, sequence, target), own in sorted(groups.items()):
        cohort = next((c for c in cohorts.values() if c["target_species"].startswith(target)), None)
        require(cohort is not None, f"{target}: no AMP cohort for this target species")
        require(cohort["size"] >= settings["minimum_peptides"], f"{cohort['cohort_id']}: AMP cohort below minimum size")
        require(cohort["target_kind"] == "bacterium", f"{cohort['cohort_id']}: only bacterial cohorts are scored")
        peers = [6 - math.log10(finite(m["mic_uM"], "cohort MIC", 0.0000001)) for m in cohort["members"]]
        require(len(peers) == cohort["size"], f"{cohort['cohort_id']}: member count differs from the published size")
        value = median(6 - math.log10(r["value"]) for r in own)
        rank = percentile(value, peers)
        dois = {r["original_paper_doi"].lower() for r in own}
        factor = config["bioactivity"]["single_doi_factor"] if len(dois) == 1 else config["bioactivity"]["multiple_doi_factor"]
        out.append((origin, {"stratum_kind": "amp", "peptide_sequence": sequence, "stratum_id": cohort["cohort_id"],
                             "peptide_name": own[0].get("peptide_name"), "target_species": cohort["target_species"],
                             **({"sequence_modifications": own[0]["sequence_modifications"]}  # 3.19: e.g. pyroglutamate
                                if own[0].get("sequence_modifications") else {}),
                             "target_strains": sorted({r["target_strain"] for r in own if r.get("target_strain")}),
                             "record_ids": sorted(r["record_id"] for r in own), "original_paper_dois": sorted(dois),
                             "peer_peptides": len(peers), "cohort_median_pMIC": cohort["median_pMIC"],
                             "pMIC": round(value, 3), "percentile": round(rank, 2),
                             "evidence_factor": factor, "adjusted": rank * factor,
                             "measurements": [{"endpoint": r["endpoint"], "relation": r["relation"], "value": r["value"],
                                               "unit": r["unit"], "target_species": r["target_species"],
                                               "target_strain": r.get("target_strain"), "medium": r["medium"],
                                               "method": r["method"], "source_id": r["source_id"],
                                               "original_paper_doi": r["original_paper_doi"]} for r in own]}))
    return out


def anticancer_items(evidence: dict, config: dict) -> list[tuple[int, dict]]:
    """verified-pilot-3.21 anticancer-peptide stratum. Same shape as the AMP stratum, with a cancer cell line in place of a
    target bacterium: one fixed CancerPPD 2.0 cohort per cell line, pIC50 = 6 - log10(IC50 uM), percentile inside that cohort,
    the same minimum cohort, the same single/multiple-DOI factors and the same max aggregation. The proposal names anticancer
    activity beside the antibacterial one; this is that input. A cell IC50 is never ranked against a MIC or an ACE IC50."""
    settings = config.get("anticancer_bioactivity")
    rows = evidence.get("anticancer_bioactivity", [])
    if not settings or not rows:
        return []
    book = json.loads((ROOT / settings["cohort_file"]).read_text(encoding="utf-8"))
    cohorts = {c["cell_line_key"]: c for c in book["cohorts"]}
    key = lambda name: re.sub(r"[^A-Z0-9]", "", (name or "").upper())
    groups = defaultdict(list)
    for r in rows:
        if r.get("status") != "approved_for_score":
            continue
        require(r.get("reviewed") is True and r.get("material_kind") == "single_peptide"
                and PEPTIDE.fullmatch(str(r.get("sequence", ""))) is not None
                and r.get("sequence_confirmed") is True and r.get("value_in_text") is True
                and (r.get("synthetic") is True or r.get("material") in settings["accepted_materials"])
                and r.get("endpoint") == settings["endpoint"] and r.get("relation") == "=" and r.get("unit") == "uM"
                and r.get("method") in settings["accepted_methods"] and r.get("source_id") in evidence["sources"]
                and r.get("original_paper_doi") and r.get("origin_aphia_id") and r.get("origin_scientific_name"),
                f"{r.get('record_id')}: incomplete anticancer origin/sequence/assay chain")
        finite(r.get("value"), "anticancer IC50", 0.0000001)
        groups[(r["origin_aphia_id"], r["sequence"], key(r["cell_line"]))].append(r)
    out = []
    for (origin, sequence, cell_key), own in sorted(groups.items()):
        cohort = cohorts.get(cell_key)
        require(cohort is not None, f"{own[0]['cell_line']}: no anticancer cohort for this cell line")
        require(cohort["size"] >= settings["minimum_peptides"], f"{cohort['cohort_id']}: cohort below minimum size")
        require(len(cohort["members"]) == cohort["size"], f"{cohort['cohort_id']}: member count differs from the published size")
        # a scored peptide CancerPPD already holds is one of its own cohort rows; nothing is ranked against itself
        self_key = own[0].get("cohort_self_member_key")
        require(self_key is None or any(m["k"] == self_key for m in cohort["members"])
                or not own[0].get("cancerppd_ids"), f"{own[0]['record_id']}: the named self member is not in this cohort")
        peers = [6 - math.log10(finite(m["ic50_uM"], "cohort IC50", 0.0000001))
                 for m in cohort["members"] if m["k"] != self_key]
        require(len(peers) >= settings["minimum_peptides"],
                f"{cohort['cohort_id']}: fewer than the minimum peers once the peptide itself is removed")
        value = median(6 - math.log10(r["value"]) for r in own)
        rank = percentile(value, peers)
        dois = {r["original_paper_doi"].lower() for r in own}
        factor = config["bioactivity"]["single_doi_factor"] if len(dois) == 1 else config["bioactivity"]["multiple_doi_factor"]
        out.append((origin, {"stratum_kind": "anticancer", "peptide_sequence": sequence, "stratum_id": cohort["cohort_id"],
                             "peptide_name": own[0].get("peptide_name"), "cell_line": cohort["cell_line"],
                             "cancer_type": own[0].get("cancer_type"),
                             "record_ids": sorted(r["record_id"] for r in own), "original_paper_dois": sorted(dois),
                             "peer_peptides": len(peers), "cohort_members": cohort["size"],
                             "self_in_cohort": bool(self_key) and len(peers) < cohort["size"],
                             "cohort_median_pIC50": cohort["median_pIC50"],
                             "pIC50": round(value, 3), "percentile": round(rank, 2),
                             "evidence_factor": factor, "adjusted": rank * factor,
                             "measurements": [{"endpoint": r["endpoint"], "relation": r["relation"], "value": r["value"],
                                               "unit": r["unit"], "value_as_published": r.get("value_as_published"),
                                               "cell_line": r["cell_line"],
                                               "cancer_type": r.get("cancer_type"), "method": r["method"],
                                               "exposure": r.get("exposure"), "source_id": r["source_id"],
                                               "original_paper_doi": r["original_paper_doi"]} for r in own]}))
    return out


def potency_replications(evidence: dict, settings: dict, sequence: str, value: float, dois: set[str]) -> list[dict]:
    """A synthetic (3.14: or accepted purified) peptide re-measured in another paper replicates potency, never origin or value."""
    gap = settings["cross_origin_potency"]["max_pIC50_gap"]
    # 3.14: a config may also accept sequence-confirmed purified peptides; older configs stay synthetic-only
    accepted = settings["cross_origin_potency"].get("accepted_materials", ["synthetic"])
    out = []
    for r in evidence.get("potency_replications", []):
        if r.get("sequence") != sequence:
            continue
        material = "synthetic" if r.get("synthetic") is True else r.get("material")
        require(r.get("reviewed") is True and material in accepted and r.get("value_in_text") is True
                and r.get("target") == settings["target"] and r.get("endpoint") == settings["endpoint"]
                and r.get("substrate") == settings["substrate"] and r.get("relation") == "=" and r.get("unit") == "uM"
                and r.get("source_id") in evidence["sources"] and r.get("original_paper_doi"),
                f"{r.get('record_id')}: incomplete potency replication")
        p = 6 - math.log10(finite(r.get("value"), "replication IC50", 0.0000001))
        same_paper = r["original_paper_doi"].lower() in dois
        agrees = abs(p - value) <= gap
        out.append({"record_id": r["record_id"], "original_paper_doi": r["original_paper_doi"], "source_id": r["source_id"],
                    "origin_material": r["origin_material"], "origin_label": r.get("origin_label"), **({"material": material} if "material" in r else {}),
                    "value": r["value"], "unit": r["unit"], "pIC50": round(p, 3),
                    "pIC50_gap": round(abs(p - value), 3), "used": agrees and not same_paper,
                    "reason": "same paper as the origin measurement" if same_paper else None if agrees else f"pIC50 gap above {gap}"})
    return out


def common_limit(snap: dict, *, log_scale: bool = False) -> float:
    """Tukey upper fence Q3 + 1.5 IQR of the taxa count (P703 statements) over every linked compound.
    A compound found in more taxa than this is a common metabolite, not evidence about one species."""
    counts = [math.log10(n) if log_scale else n for n in snap["compound_taxon_counts"].values()]
    q1, _, q3 = quantiles(counts, n=4, method="inclusive")
    fence = q3 + 1.5 * (q3 - q1)
    return 10 ** fence if log_scale else fence


def chembl_stratum(target: dict, strata: dict) -> str | None:
    for sid, s in strata.items():
        if target["target_type"] not in s["target_types"]:
            continue
        if "cellosaurus_category" in s and (target.get("cellosaurus") or {}).get("category") != s["cellosaurus_category"]:
            continue
        if "organism_classes" in s and not any((target.get("organism_class") or [])[:len(c)] == c for c in s["organism_classes"]):
            continue
        return sid
    return None


def chembl_items(evidence: dict, config: dict, *, minimum: int | None = None, limit: float | None = None,
                 exclude_drugs: bool = True) -> tuple[list, dict]:
    """verified-pilot-3.1 ChEMBL stratum: species -> compound (Wikidata P703, mostly LOTUS, with reference DOIs)
    -> ChEMBL parent -> admitted pChEMBL, ranked in its ChEMBL target x endpoint cohort. The value is a public
    activity of a compound reported in the species, never the efficacy of the species or its extract."""
    rule, snap = config["chembl_bioactivity"], evidence["chembl_links"]
    minimum = minimum or rule["minimum_cohort_records"]
    limit = common_limit(snap) if limit is None else limit
    single, multiple = config["bioactivity"]["single_doi_factor"], config["bioactivity"]["multiple_doi_factor"]
    factor = lambda n: single if n == 1 else multiple
    strata = {t: chembl_stratum(v, rule["strata"]) for t, v in snap["targets"].items()}
    # link review (mbpi-link-review-*.json): a rejected species -> compound link never enters, in any view
    review = {(r["aphia_id"], r["inchikey"]): r for r in snap.get("link_review", [])}
    activities = defaultdict(lambda: defaultdict(list))   # parent -> (target, endpoint) -> admitted rows
    for a in snap["activities"]:
        if strata[a["target_chembl_id"]]:
            activities[a["parent_molecule_chembl_id"]][(a["target_chembl_id"], a["standard_type"])].append(a)
    out, summary = [], {}
    for s in snap["species"]:
        parents = defaultdict(lambda: {"qids": set(), "inchikeys": set(), "dois": set(), "cids": set(), "reviewed": True})
        chains, counts, rejected = [], defaultdict(int), []
        for link in s["links"]:
            dois = {snap["reference_dois"][r].lower() for st in link["statements"] for r in st["references"] if snap["reference_dois"].get(r)}
            ident = snap["compounds"][link["inchikey"]]
            common = snap["compound_taxon_counts"].get(link["compound_qid"], 0) > limit
            # LOTUS text mining attaches assay reference drugs to the paper's organism (zidovudine -> Ecklonia cava)
            drug = exclude_drugs and snap["parent_max_phase"].get(ident["parent_chembl_id"]) == rule["excluded_max_phase"]
            verdict = review.get((s["aphia_id"], link["inchikey"]))
            require(verdict is None or set(verdict["dois"]) == dois, f"{s['aphia_id']} {link['inchikey']}: link review is stale")
            if verdict and verdict["decision"] == "reject":
                counts["rejected_by_review"] += 1
                rejected.append({k: verdict[k] for k in ("inchikey", "compound_name", "compound_chembl_id", "dois", "class", "reason")})
            counts["linked"] += 1
            counts["with_reference_doi"] += bool(dois)
            counts["common_metabolite"] += common
            counts["approved_drug"] += bool(drug)
            chain = {"origin": bool(dois) and not common and not drug and not (verdict and verdict["decision"] == "reject"),
                     "structure_id": bool(ident["parent_chembl_id"])}
            if chain["origin"] and chain["structure_id"]:
                p = parents[ident["parent_chembl_id"]]
                p["reviewed"] &= verdict is not None
                p["qids"].add(link["compound_qid"]), p["inchikeys"].add(link["inchikey"])
                p["dois"] |= dois
                p["cids"] |= set(ident["pubchem_cids"])
                keys = activities[ident["parent_chembl_id"]]
                chain["quantitative_endpoint"] = bool(keys)
                chain["comparable_cohort"] = any(snap["cohorts"][f"{t}|{st}"]["total"] >= minimum for t, st in keys)
            chains.append({"chain": chain})
        for p, info in sorted(parents.items()):
            best = {}
            for (t, st), rows in sorted(activities[p].items()):
                cohort = snap["cohorts"][f"{t}|{st}"]
                if cohort["total"] < minimum:
                    continue
                m = round(median(a["pchembl_value"] for a in rows), 3)
                rank = 100 * (cohort["below"][str(m)] + 0.5 * cohort["equal"][str(m)]) / cohort["total"]
                sid = strata[t]
                if sid not in best or (rank, len(rows)) > best[sid][:2]:
                    best[sid] = (rank, len(rows), t, st, m, rows, cohort["total"])
            for sid, (rank, _, t, st, m, rows, total) in sorted(best.items()):
                docs = sorted({a["document_chembl_id"] for a in rows})
                lf, af = factor(len(info["dois"])), factor(len(docs))
                target = snap["targets"][t]
                out.append((s["aphia_id"], {
                    "stratum_kind": "chembl", "chembl_stratum": sid, "stratum_label": rule["strata"][sid]["label"],
                    "stratum_id": f"{snap['sources']['chembl_mbpi']['version'].split()[0]}:{t}|{st}",
                    "compound_id": p, "compound_name": snap["parent_names"].get(p),
                    "inchikeys": sorted(info["inchikeys"]), "wikidata_qids": sorted(info["qids"]), "pubchem_cids": sorted(info["cids"]),
                    "original_paper_dois": sorted(info["dois"]),
                    "target_chembl_id": t, "target_name": target["pref_name"], "target_type": target["target_type"],
                    "target_organism": target["organism"], "standard_type": st,
                    "activity_ids": sorted(a["activity_id"] for a in rows), "document_chembl_ids": docs,
                    "median_pchembl": m, "cohort_records": total, "percentile": round(rank, 2),
                    "link_factor": lf, "activity_factor": af, "evidence_factor": lf * af, "adjusted": rank * lf * af,
                    "independent_sources": min(len(info["dois"]), len(docs)), "label": rule["label"],
                    "evidence_level": 2, "link_review": "accepted" if info["reviewed"] else "not_reviewed",
                    # verified-pilot-3.20: a compound-level caveat (e.g. a possible drying artifact) travels with the item
                    **{"caveat": rule["compound_caveats"][k] for k in sorted(info["inchikeys"]) if k in rule.get("compound_caveats", {})}}))
        counts["scored_compounds"] = len({i["compound_id"] for a, i in out if a == s["aphia_id"]})
        summary[s["aphia_id"]] = {"counts": dict(counts), "sufficiency": bio_sufficiency(chains),
                                  "paper_search": snap.get("paper_search", {}).get(s["aphia_id"]), "rejected_links": rejected}
    return out, {"common_taxon_limit": round(limit, 3) if math.isfinite(limit) else None, "species": summary}


def bio_scores(evidence: dict, config: dict, candidates_by_id: dict[int, dict]) -> dict[int, tuple[float, list, dict]]:
    approved = _approved_assays(evidence, config, candidates_by_id)
    by_id = {a["activity_id"]: a for a in approved}
    require(len(by_id) == len(approved), "duplicate bioactivity ID")
    out: dict[int, tuple] = {}
    for stratum in evidence.get("bioactivity_cohorts", []):
        ids = stratum["activity_ids"]
        require(all(i in by_id for i in ids) and len(ids) == len(set(ids)), "invalid fixed bioactivity cohort")
        rows = [by_id[i] for i in ids]
        keys = {(a["target_id"], a["assay_type"], a["endpoint"], a["test_system"], a["conditions_key"]) for a in rows}
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
                        "measurements": [{"compound_name": a["compound_name"], "molecular_formula": a["molecular_formula"],
                                          "raw_value": a["raw_value"], "raw_sd": a.get("raw_sd"),
                                          "raw_unit": a["raw_unit"], "relation": a["standard_relation"],
                                          "target_id": a["target_id"], "test_system": a["test_system"],
                                          "conditions_key": a["conditions_key"], "assay_id": a["assay_id"],
                                          "paper_url": a["original_paper_url"],
                                          "structure_url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{a['compound_id'][4:]}"} for a in own],
                        "peer_compounds": len(peers), "median_pchembl": round(peers[compound], 3),
                        "percentile": round(rank, 2), "evidence_factor": factor, "adjusted": rank * factor}
                out[origin] = (None, out.get(origin, (None, [], {}))[1] + [item], {})
    for origin, item in peptide_items(evidence, config):
        out[origin] = (None, out.get(origin, (None, [], {}))[1] + [item], {})
    for origin, item in amp_items(evidence, config):  # verified-pilot-3.18
        out[origin] = (None, out.get(origin, (None, [], {}))[1] + [item], {})
    for origin, item in anticancer_items(evidence, config):  # verified-pilot-3.21
        out[origin] = (None, out.get(origin, (None, [], {}))[1] + [item], {})
    chembl = None
    if config.get("chembl_bioactivity"):  # verified-pilot-3.1
        rule = config["chembl_bioactivity"]
        items, chembl = chembl_items(evidence, config)
        require(not rule.get("link_review") or all(i["link_review"] == "accepted" for _, i in items),
                "a primary ChEMBL item rests on a link without a review entry")
        variants = {f"minimum_cohort_{m}": chembl_items(evidence, config, minimum=m)[0] for m in rule["sensitivity_minimum_cohort_records"]}
        variants["no_common_metabolite_filter"] = chembl_items(evidence, config, limit=math.inf)[0]
        variants["log_scale_common_fence"] = chembl_items(evidence, config, limit=common_limit(evidence["chembl_links"], log_scale=True))[0]
        variants["no_approved_drug_filter"] = chembl_items(evidence, config, exclude_drugs=False)[0]
        for aphia, summary in chembl["species"].items():
            other = [i["adjusted"] for i in out.get(aphia, (None, [], {}))[1]]
            summary["rule_sensitivity"] = {name: round1(max(other + [i["adjusted"] for a, i in v if a == aphia]))
                                           if other or any(a == aphia for a, _ in v) else None for name, v in variants.items()}
        for origin, item in items:
            out[origin] = (None, out.get(origin, (None, [], {}))[1] + [item], {})
    for aphia, (_, items, _) in list(out.items()):
        adjusted = [i["adjusted"] for i in items]
        primary = max(adjusted)
        out[aphia] = (round1(primary), items,
                      {"median_compound_sensitivity": round1(median(adjusted)),
                       "mean_compound_sensitivity": round1(sum(adjusted) / len(adjusted)),
                       "range_from_aggregation": [round1(min(adjusted)), round1(primary)]})
    return out, chembl


def conservation_axis(candidate: dict, evidence: dict, config: dict) -> tuple:
    assessment = next((r for r in evidence.get("conservation", []) if r.get("aphia_id") == candidate["aphia_id"]), None)
    if not assessment:
        return None, None, "assessment_lookup_failed"
    trace = dict(assessment)
    state = assessment.get("iucn_state")
    require(state in ("assessed", "data_deficient", "not_in_red_list", "lookup_failed"), "unknown IUCN state")
    trace["label"] = config["conservation"]["label"]
    if state == "not_in_red_list":
        search = assessment.get("search") or {}
        require(search.get("result_count") == 0 and search.get("queries") and valid_date(search.get("checked_on")),
                "not_in_red_list needs a dated zero-result search")
        return None, trace, "not_in_red_list"
    if state == "lookup_failed":
        return None, trace, "assessment_lookup_failed"
    if assessment.get("reviewed") is not True:
        return None, trace, "original_assessment_not_reviewed"
    if state == "data_deficient" or assessment.get("category") not in config["conservation"]["category_scores"]:
        return None, trace, "category_not_numeric"
    checked = assessment.get("current_status_check")
    if not checked:
        return None, trace, "current_status_unverified"
    require(type(checked.get("is_current")) is bool and checked.get("source_id") in evidence["sources"]
            and valid_date(checked.get("checked_on"), not_before=assessment["assessment_year"],
                           not_after=evidence["snapshot_date"]), "invalid current IUCN assessment check")
    if not checked["is_current"]:
        return None, trace, "assessment_not_current"
    value = config["conservation"]["category_scores"][assessment["category"]]
    trace["assessment_older_than_10y"] = int(evidence["snapshot_date"][:4]) - assessment["assessment_year"] > 10
    trace["pilot_mapping"] = f"{assessment['category']} -> {value} (team pilot rule, not an IUCN score)"
    trace["occurrence_trend_adjustment"] = None
    return float(value), trace, None


def national_axis(aphia: int, evidence: dict, config: dict) -> tuple:
    """verified-pilot-3: a national red-list category (IUCN regional guidelines), used only when
    the IUCN global axis has no number. Legal designations without a category stay facts."""
    settings = config["national_red_list"]
    facts = [f for f in evidence.get("legal_protection_facts", []) if f.get("aphia_id") == aphia]
    require(all(not f.get("category") for f in facts), "legal protection facts must not carry a category")
    record = next((r for r in evidence.get("national_red_list", []) if r.get("aphia_id") == aphia), None)
    if not record:
        return None, {"label": settings["label"], "legal_protection_facts": facts} if facts else None
    require(record.get("reviewed") is True and record.get("source_id") in evidence["sources"]
            and record.get("assessment_basis") == settings["accepted_basis"] and record.get("name_as_published")
            and record.get("category") in config["conservation"]["category_scores"],
            f"{aphia}: national assessment needs a reviewed IUCN-regional category")
    value = config["conservation"]["category_scores"][record["category"]]
    return float(value), {**record, "label": settings["label"],
                          "pilot_mapping": f"{record['category']} -> {value} (national assessment, team pilot rule)",
                          "legal_protection_facts": facts}


def _rate_ratio(n1: int, n2: int, e1: int, e2: int, rule: dict) -> tuple[float, float, float]:
    k = rule["continuity"]
    ratio = ((n2 + k) / e2) / ((n1 + k) / e1)
    spread = math.exp(rule["z"] * math.sqrt(1 / (n1 + k) + 1 / (n2 + k)))
    return ratio, ratio / spread, ratio * spread


def mcui_substitute(aphia: int, evidence: dict, config: dict, trend: dict | None) -> dict | None:
    """After 3.14 (team-lead decision 2026-10-01): when neither IUCN nor the Korean national list gives a category, the
    national red list of another range state, else a preliminary Rapid Least Concern check of GBIF and OBIS occurrences
    (Bachman et al. 2020). Each basis is its own stratum: labelled, never pooled or ranked with IUCN-based MCUI. A Rapid LC
    is not accepted when the OBIS reporting rate shows a decline signal (criterion A must be considered)."""
    rule, scores = config["mcui_substitutes"], config["conservation"]["category_scores"]
    row = next((r for r in evidence["mcui_substitutes"]["range_state"] if r["aphia_id"] == aphia), None)  # one row per species (load_inputs)
    if row:
        require(row.get("reviewed") is True and row.get("source_id") in evidence["sources"] and row.get("country")
                and row.get("name_as_published") and row.get("category") in scores, f"{aphia}: range-state assessment incomplete")
        return {"basis": "range_state", "label": rule["labels"]["range_state"], "category": row["category"],
                "value": float(scores[row["category"]]), "record": row, "source_ids": [row["source_id"]],
                "pilot_mapping": f"{row['category']} -> {scores[row['category']]} ({row['country']} national red list, team pilot rule)"}
    lc = evidence["mcui_rapid_lc"]["species"].get(str(aphia))
    if lc is None:
        return None
    t = rule["thresholds"]
    met = lc["eoo_km2"] > t["eoo_km2"] and lc["aoo_km2"] > t["aoo_km2"] and lc["records"] >= t["records"]
    require(met == lc["likely_least_concern"] and lc["aoo_km2"] == lc["aoo_cells"] * t["aoo_cell_km"] ** 2,
            f"{aphia}: Rapid LC flag differs from the published thresholds")
    decline = bool(trend and trend["class"] == "decline_signal")
    record = {**{k: lc[k] for k in ("records", "eoo_km2", "aoo_km2", "aoo_cells", "native_box", "countries_gbif", "gbif", "obis")},
              "thresholds": t, "trend_class": trend and trend["class"], "method_source_id": rule["method_source_id"]}
    out = {"label": rule["labels"]["preliminary"], "record": record, "source_ids": [rule["snapshot_source_id"], rule["method_source_id"]]}
    if not met or decline:
        return {**out, "basis": None, "category": None, "value": None,
                "result": "decline_signal" if decline else "thresholds_not_met"}
    # team-lead decision 2026-10-02: the back-test failed, so a met check is reference information only, never an MCUI
    return {**out, "basis": "preliminary", "category": rule["preliminary_category"], "value": None, "use": "reference_only",
            "result": "likely_least_concern"}


def occurrence_trend(aphia: int, snap: dict, rule: dict) -> dict:
    """verified-pilot-3.4: OBIS reporting-rate change between two 10-year periods. Reporting rate = species records /
    records of the species' WoRMS class (target-group effort) in the same 1-degree cells and period; only cells with
    class records in both periods count. A decline signal must also hold inside the dataset that holds most past
    records, so a survey programme ending is not read as a decline. A reporting rate is not abundance."""
    sp = snap["species"].get(str(aphia))
    require(sp is not None, f"{aphia}: no OBIS trend record")
    group = snap["group_effort"][sp["class"]]["cells"]
    past, recent = sp["past"]["cells"], sp["recent"]["cells"]
    both = lambda effort, c: all(effort.get(c, {}).get(p, 0) > 0 for p in ("past", "recent"))
    cells = sorted(c for c in set(past) | set(recent) if both(group, c))
    n1, n2 = sum(past.get(c, 0) for c in cells), sum(recent.get(c, 0) for c in cells)
    e1, e2 = sum(group[c]["past"] for c in cells), sum(group[c]["recent"] for c in cells)
    out = {"source_id": rule["source_id"], "periods": rule["periods"], "effort_group": sp["class"], "cells_compared": len(cells),
           "species_records": {"past": n1, "recent": n2}, "effort_records": {"past": e1, "recent": e2},
           "records_in_map_extent": {p: sp[p]["records"] + sp[p]["outside_grid"] for p in ("past", "recent")},
           # distribution recency: cells with records in one period only (all cells of the species, effort aside)
           "cells_past_only": sum(1 for c in past if c not in recent), "cells_recent_only": sum(1 for c in recent if c not in past),
           "latest_record_year": (sp.get("yearrange") or [None, None])[1], "records_all_years": sp["records_all_years"],
           "datasets": {p: len(sp[p]["datasets"]) for p in ("past", "recent")}}
    if not cells:
        return {**out, "class": "undetermined", "reason": "no_comparable_cells"}
    if n1 < rule["min_past_records"]:
        return {**out, "class": "undetermined", "reason": "past_records_below_minimum"}
    ratio, low, high = _rate_ratio(n1, n2, e1, e2, rule)
    a1, a2 = sum(snap["effort"][c]["past"] for c in cells), sum(snap["effort"][c]["recent"] for c in cells)
    out.update({"reporting_rate_ratio": round(ratio, 3), "ci": [round(low, 3), round(high, 3)], "effort_ratio": round(e2 / e1, 3),
                "all_taxa_sensitivity": {"effort_records": {"past": a1, "recent": a2},
                                         "reporting_rate_ratio": round(_rate_ratio(n1, n2, a1, a2, rule)[0], 3)}})
    top = sp.get("dominant_dataset")
    if top:
        ce = top["class_effort"]
        dcells = sorted(c for c in set(top["past"]) | set(top["recent"]) if both(ce, c))
        d = [sum(top[p].get(c, 0) for c in dcells) for p in ("past", "recent")] + [sum(ce[c][p] for c in dcells) for p in ("past", "recent")]
        check = {"dataset_id": top["dataset_id"], "past_share": top["past_share"], "cells_compared": len(dcells),
                 "species_records": {"past": d[0], "recent": d[1]}, "effort_records": {"past": d[2], "recent": d[3]}}
        if dcells and d[0] >= rule["min_past_records"]:
            r, lo, hi = _rate_ratio(*d, rule)
            check.update({"reporting_rate_ratio": round(r, 3), "ci": [round(lo, 3), round(hi, 3)]})
            check["confirms_decline"] = r <= rule["decline_ratio"] and hi < 1
        else:
            check["confirms_decline"] = False
        out["dataset_check"] = check
    if ratio <= rule["decline_ratio"] and high < 1:
        if out.get("dataset_check", {}).get("confirms_decline"):
            return {**out, "class": "decline_signal", "reason": "reporting_rate_fell_beyond_threshold_within_dominant_dataset_too"}
        return {**out, "class": "undetermined", "reason": "decline_not_confirmed_within_dominant_dataset"}
    if ratio <= rule["decline_ratio"]:
        return {**out, "class": "undetermined", "reason": "decline_uncertain"}
    if high < 1:  # a clear fall smaller than the threshold: shown as such, never a decline signal
        return {**out, "class": "decline_below_threshold", "reason": "reporting_rate_fell_less_than_threshold"}
    if n2 < n1 and e2 < e1:
        return {**out, "class": "survey_gap", "reason": "fewer_records_explained_by_less_effort"}
    return {**out, "class": "no_clear_decline", "reason": "reporting_rate_not_lower"}


def independent_sources(item: dict) -> int:
    """Independent papers behind an MBPI item. ChEMBL items need both the species link and the activity
    to rest on separate papers, so the weaker side counts."""
    if item.get("stratum_kind") == "chembl":
        return item["independent_sources"]
    return len({d.lower() for d in item.get("independent_dois", item["original_paper_dois"])})


def bio_sufficiency(partials: list[dict]) -> dict:
    steps = ("origin", "structure_id", "quantitative_endpoint", "comparable_cohort")
    best = max((sum(bool((p.get("chain") or {}).get(s)) for s in steps) for p in partials), default=0)
    return {"required": list(steps), "best_record_steps": best, "ratio": round(best / len(steps), 2)}


def unexplored_flag(aphia: int, output: list[dict], taxonomy: dict, threshold: float, min_bbvi: float | None = None) -> dict | None:
    """Flag a low-information species when a relative (same genus, else family) has a BBVI
    (verified-pilot-3.2: a BBVI of at least min_bbvi). The relative's score is never copied."""
    mine = taxonomy.get(str(aphia), {})
    me = next(s for s in output if s["aphia_id"] == aphia)
    if me["information_sufficiency"]["mean_ratio"] >= threshold:
        return None
    for rank in ("genus", "family"):
        rel = [s for s in output if s["aphia_id"] != aphia and s["scores"]["BBVI"] is not None
               and (min_bbvi is None or s["scores"]["BBVI"] >= min_bbvi)
               and mine.get(rank) and taxonomy.get(str(s["aphia_id"]), {}).get(rank) == mine[rank]]
        if rel:
            return {"rank": rank, "taxon": mine[rank], "relatives": [s["scientific_name"] for s in rel],
                    "note": "A relative has a calculated BBVI; this species' score is not inferred from it."}
    return None


def build(evidence: dict, candidates: dict, config: dict, snapshot: dict, taxonomy: dict, catalog: dict | None = None) -> dict:
    require(evidence.get("schema_version") == 3 and candidates.get("schema_version") == 1, "unsupported evidence/candidate schema")
    require(valid_date(evidence.get("snapshot_date")) and config.get("method_version"), "snapshot/method required")
    require(evidence["snapshot_date"] >= candidates["checked_on"], "candidate list newer than evidence")
    settings = config["nutrition"]
    weights = [settings[k] for k in ("nutrient_weight", "edible_fraction_weight", "aquaculture_weight")]
    require(all(type(w) in (int, float) and 0 <= w <= 1 for w in weights) and abs(sum(weights) - 1) < 1e-9,
            "MFPI weights must sum to one")
    finite(config["bbvi"]["default_food_weight"], "BBVI food weight", 0, 1)
    sources = evidence.get("sources", {})
    for sid, src in sources.items():
        require(str(src.get("url", "")).startswith("https://") and src.get("provider") and src.get("version")
                and src.get("terms") and valid_date(src.get("accessed"), not_after=evidence.get("inputs_as_of", evidence["snapshot_date"])),
                f"{sid}: incomplete source registration")
    identities = candidates.get("candidates", [])
    # Research candidates such as Ecklonia cava (371986) come from the catalog as candidate_species, never from this list.
    require(len(identities) == 8 and len({c["aphia_id"] for c in identities}) == 8, "expected 8 unique published candidates")
    rows = rda_rows(snapshot, evidence, config)
    evidence_rows = {r["food_item_id"]: r for r in evidence.get("nutrition_rows", [])}
    require(len(evidence_rows) == len(evidence.get("nutrition_rows", [])), "duplicate food item ID")
    primary = build_cohorts(settings["primary_cohorts"], rows, settings, sources)
    cross = build_cohorts(settings["cross_check_cohorts"], evidence_rows, settings, sources)
    if catalog is None:
        catalog = json.loads(DEFAULT_CATALOG.read_text(encoding="utf-8"))
    # Approved assays must match an accepted identity: operating species or a catalog research candidate.
    known_identities = {c["aphia_id"]: c for c in identities}
    for c in catalog.get("species", []):
        known_identities.setdefault(c["aphiaID"], {"aphia_id": c["aphiaID"], "scientific_name": c["name"]})
    assay, chembl = bio_scores(evidence, config, known_identities)
    def assess(candidate: dict) -> dict:
        aphia = candidate["aphia_id"]
        mfpi_value, food_trace, food_reason = food_axis(candidate, evidence, config, rows, primary, cross)
        mbpi, bio_trace, bio_sensitivity = assay.get(aphia, (None, [], {}))
        mcui, conservation_trace, conservation_reason = conservation_axis(candidate, evidence, config)
        national, mcui_basis = None, "iucn" if mcui is not None else None
        if config.get("national_red_list") and conservation_reason in config["national_red_list"]["applies_when_iucn_reason"]:
            national_value, national = national_axis(aphia, evidence, config)
            if national_value is not None:
                mcui, conservation_reason, mcui_basis = national_value, None, "national"
        trend_rule = config["conservation"].get("trend")
        trend = occurrence_trend(aphia, evidence["obis_trend"], trend_rule) if trend_rule else None
        substitute = None
        subs = config.get("mcui_substitutes")
        if subs and mcui is None and conservation_reason in subs["applies_when_reason"]:  # after 3.14: range state, then Rapid LC
            substitute = mcui_substitute(aphia, evidence, config, trend)
            if substitute and substitute["value"] is not None:
                mcui, conservation_reason, mcui_basis = substitute["value"], None, substitute["basis"]
        if trend:  # verified-pilot-3.4: an auxiliary MCUI element; it raises a computed MCUI, never creates or lowers one
            adjust = config["conservation"]["effort_adjustment"] if mcui is not None and trend["class"] == "decline_signal" else 0
            trend.update({"label": trend_rule["labels"][trend["class"]], "mcui_base": mcui, "mcui_adjustment": adjust})
            if adjust:
                mcui = float(min(100, mcui + adjust))
        w = config["bbvi"]["default_food_weight"]
        best = max(bio_trace, key=lambda i: i["adjusted"]) if bio_trace else None
        # verified-pilot-3: an MBPI value resting on fewer independent papers is shown for reference and kept out of BBVI
        min_dois = config["bbvi"].get("minimum_independent_mbpi_dois")
        single_source = bool(min_dois and best) and independent_sources(best) < min_dois
        both = mfpi_value is not None and mbpi is not None
        # 3.27 (team-lead decision 2026-10-03): a single-paper top item still gives a BBVI score, published with its label
        labelled = config["bbvi"].get("single_source_policy") == "score_with_label"
        bbvi = round1(w * mfpi_value + (1 - w) * mbpi) if both and (not single_source or labelled) else None
        partial_bio = [r for key in ("bioactivity", "peptide_bioactivity") for r in evidence.get(key, [])
                       if r.get("origin_aphia_id") == aphia and r.get("status") != "approved_for_score"]
        links = (chembl or {"species": {}})["species"].get(aphia)
        scores = {"MFPI": mfpi_value, "MBPI": mbpi, "MCUI": mcui, "BBVI": bbvi}
        assessed = bool(conservation_trace) and conservation_trace.get("iucn_state") == "assessed"
        status = {"MFPI": "산출됨" if mfpi_value is not None else "일부 근거 확인" if food_trace["sufficiency"]["present"] else "산출 보류",
                  "MBPI": "산출됨" if mbpi is not None else "일부 근거 확인" if partial_bio or (links and links["counts"].get("linked", 0) > links["counts"].get("rejected_by_review", 0))
                          else "정보충분도 낮음" if links is not None else "산출 보류",
                  "MCUI": "산출됨" if mcui is not None else "일부 근거 확인" if assessed else "산출 보류",
                  "BBVI": "산출됨" if bbvi is not None else "산출 보류"}
        reasons = {"MFPI": food_reason, "MBPI": None if mbpi is not None else "compound_origin_assay_chain_or_fixed_cohort_missing",
                   "MCUI": conservation_reason,
                   "BBVI": None if bbvi is not None else "mbpi_single_source" if both else "requires_MFPI_and_MBPI"}
        c = conservation_trace or {}
        national_steps = mcui_basis == "national" and bool((config.get("unexplored_candidates") or {}).get("national_mcui_sufficiency"))
        if national_steps:  # verified-pilot-3.2: the national assessment that gives the MCUI is the record counted
            c_steps = [True, national["category"] in config["conservation"]["category_scores"],
                       str(aphia) in config["national_red_list"].get("page_recheck", {}).get("rows", {})]
        elif mcui_basis == "range_state":  # after 3.14: the other state's list row is the record counted, read at the snapshot
            c_steps = [True, substitute["category"] in config["conservation"]["category_scores"], True]
        else:
            c_steps = [c.get("iucn_state") in ("assessed", "data_deficient"),
                       c.get("category") in config["conservation"]["category_scores"],
                       bool(c.get("current_status_check"))]
        sufficiency = {"MFPI": food_trace["sufficiency"], "MBPI":
                       {"required": ["origin", "structure_id", "quantitative_endpoint", "comparable_cohort"],
                        "best_record_steps": 4, "ratio": 1.0} if mbpi is not None else
                       max([bio_sufficiency(partial_bio)] + ([links["sufficiency"]] if links else []), key=lambda x: x["best_record_steps"]),
                       "MCUI": {"required": ["assessment_record", "numeric_category", "current_check"],
                                "ratio": round(sum(c_steps) / 3, 2), **({"basis": "national"} if national_steps else {}),
                                **({"basis": mcui_basis} if mcui_basis == "range_state" else {})}}
        sufficiency["mean_ratio"] = round(sum(sufficiency[k]["ratio"] for k in ("MFPI", "MBPI", "MCUI")) / 3, 2)
        sensitivity = {"food_weights": {str(x): round1(x * mfpi_value + (1 - x) * mbpi)
                                        for x in config["bbvi"]["sensitivity_food_weights"]} if bbvi is not None else {},
                       **bio_sensitivity}
        source_ids = {food_trace.get("source_id")} | {x["source_id"] for x in food_trace.get("yield_sensitivity", [])}
        source_ids |= {x["source_id"] for x in food_trace["supplemental_nutrition"]}
        source_ids |= {n["substitute"]["source_id"] for n in (food_trace.get("nutrients") or {}).values() if n.get("substitute")}
        if food_trace["observed_rows"]:
            source_ids.add("rda_db_10_4")
        source_ids |= {o["link_source_id"] for o in food_trace["observed_rows"] if o.get("link_source_id")}
        for key in ("edible_fraction", "aquaculture"):
            if food_trace.get(key):
                source_ids.add(food_trace[key]["source_id"])
        for cc in food_trace["cross_checks"]:
            source_ids |= set(config["nutrition"]["cross_check_source_ids"])
        if conservation_trace:
            source_ids.add(conservation_trace.get("source_id"))
            if conservation_trace.get("current_status_check"):
                source_ids.add(conservation_trace["current_status_check"]["source_id"])
            source_ids |= {p["source_id"] for p in conservation_trace.get("previous_assessments", [])}
        source_ids |= {r["source_id"] for r in partial_bio}
        for item in bio_trace:
            source_ids |= {r["source_id"] for r in evidence["bioactivity"] if r.get("activity_id") in item.get("activity_ids", [])}
            source_ids |= {r["source_id"] for r in evidence.get("peptide_bioactivity", []) if r["record_id"] in item.get("record_ids", [])}
            if item.get("stratum_kind") == "amp":
                source_ids.add(config["amp_bioactivity"]["cohort_source_id"])
            if item.get("stratum_kind") == "anticancer":
                source_ids.add(config["anticancer_bioactivity"]["cohort_source_id"])
            source_ids |= {r["source_id"] for r in evidence.get("amp_bioactivity", []) if r["record_id"] in item.get("record_ids", [])}
            source_ids |= {r["source_id"] for r in evidence.get("anticancer_bioactivity", []) if r["record_id"] in item.get("record_ids", [])}
            source_ids |= {r["source_id"] for r in item.get("potency_replications", []) if r["used"]}
            if item.get("stratum_kind") == "chembl":
                source_ids |= set(config["chembl_bioactivity"]["source_ids"])
            elif item.get("stratum_kind") not in ("peptide", "amp", "anticancer"):
                source_ids.add(evidence["reviewed_compound_structures"][item["compound_id"]]["source_id"])
        if links and links["counts"].get("linked"):
            source_ids |= set(config["chembl_bioactivity"]["source_ids"])
        if links and links.get("paper_search"):
            source_ids |= set(config["chembl_bioactivity"]["paper_source_ids"])
        if aphia == 371986:
            source_ids.add("worms_ecklonia")
        if national and national.get("source_id"):
            source_ids.add(national["source_id"])
        if substitute:
            source_ids |= set(substitute["source_ids"])
        if trend:
            source_ids.add(trend["source_id"])
        if bio_trace and config.get("peptide_bioactivity") and any(i.get("stratum_kind") == "peptide" for i in bio_trace):
            source_ids.add(config["peptide_bioactivity"]["cohort_source_id"])
        source_ids.discard(None)
        require(all(s in sources for s in source_ids), f"{aphia}: unregistered source")
        row = {"aphia_id": aphia, "scientific_name": candidate["scientific_name"], "korean_name": candidate.get("korean_name"),
                "scores": scores, "score_status": status, "withheld_reasons": reasons,
                "single_axis_views": {"food_only_MFPI": mfpi_value, "bioactivity_only_MBPI": mbpi},
                "information_sufficiency": sufficiency,
                "food_trace": food_trace, "bioactivity_trace": bio_trace, "bioactivity_partial": partial_bio,
                "conservation_trace": conservation_trace, "sensitivity": sensitivity,
                "source_ids": sorted(source_ids)}
        if min_dois:
            row["mbpi_label"] = config["bbvi"]["single_source_mbpi_label"] if single_source else None
        if labelled:
            row["bbvi_label"] = config["bbvi"]["single_source_bbvi_label"] if single_source and bbvi is not None else None
        if config.get("peptide_bioactivity"):  # verified-pilot-3 only; v2 output keeps its shape
            row["mbpi_stratum"] = None if best is None else best.get("stratum_kind", "small_molecule")
            row["bbvi_mbpi_from_peptide_stratum"] = bbvi is not None and row["mbpi_stratum"] == "peptide"
        if chembl is not None:
            row["chembl_links"] = links
        if config.get("national_red_list"):
            row["national_assessment"] = national
            row["mcui_basis"] = mcui_basis
        if subs:
            row["mcui_substitute"] = substitute
        if trend:
            row["occurrence_trend"] = trend
        if config.get("reference_combination"):  # verified-pilot-2.1: beside the scores, never in scores.BBVI, the matrix or rankings
            rc = config["reference_combination"]
            row["reference_combination"] = {
                "label": rc["label"], "formula": rc["formula"], "inputs": {"MFPI": mfpi_value, "MBPI": mbpi},
                "mfpi_cohort": food_trace["cohort_id"], "mbpi_stratum": best["stratum_id"],
                "mbpi_original_paper_dois": best["original_paper_dois"], "food_weight": w,
                "value": round1(w * mfpi_value + (1 - w) * mbpi),
                "sensitivity": {str(x): round1(x * mfpi_value + (1 - x) * mbpi) for x in config["bbvi"]["sensitivity_food_weights"]},
                "limits": rc["limits"], "used_for_score": False} if both and single_source and bbvi is None else None
        if config.get("peptide_raw_values"):  # shown as raw value and source; the peptide stratum is absent, so no score
            require(not config.get("peptide_bioactivity"), "raw-value display and the peptide stratum are exclusive")
            raw = [r for r in evidence.get("peptide_bioactivity", []) if r.get("origin_aphia_id") == aphia and r.get("status") == "approved_for_score"]
            row["peptide_raw_values"] = [{**r, "label": config["peptide_raw_values"]["label"], "used_for_score": False} for r in raw]
            row["source_ids"] = sorted({*row["source_ids"], *(r["source_id"] for r in raw)})
        if config.get("national_fact_supplement"):  # verified-pilot-2: national category is a fact beside MCUI, never a score
            fact = next((r for r in evidence.get("national_red_list", []) if r.get("aphia_id") == aphia and r.get("reviewed") is True), None)
            row["national_red_list_fact"] = fact and {**fact, "used_for_score": False}
            if fact:
                row["source_ids"] = sorted({*row["source_ids"], fact["source_id"]})
        return row
    output = [assess(c) for c in identities]
    operating = {c["aphia_id"] for c in identities}
    research = []
    for c in catalog.get("species", []):
        require(c["aphiaID"] not in operating, f"{c['aphiaID']}: research candidate duplicates an operating species")
        row = assess({"aphia_id": c["aphiaID"], "scientific_name": c["name"], "korean_name": c.get("label")})
        row["candidate_label"] = "조사 후보"  # a score never promotes a research candidate to the operating list
        research.append(row)
    rule = config.get("unexplored_candidates")  # verified-pilot-3.2: all 30 species, relatives with a high BBVI
    if rule:
        require(rule["relative_min_bbvi"] == config["matrix"]["bbvi_threshold"], "unexplored-candidate BBVI must be the matrix threshold")
        reg = rule["source"]
        require(reg["accessed"] == taxonomy.get("retrieved") and str(reg.get("url", "")).startswith("https://")
                and all(reg.get(k) for k in ("provider", "version", "terms", "license")) and reg["id"] not in sources,
                "taxonomy source registration must match taxonomy.json")
        sources = {**sources, reg["id"]: {k: v for k, v in reg.items() if k != "id"}}
    pool = output + research if rule else output
    for s in pool:
        s["unexplored_candidate"] = unexplored_flag(s["aphia_id"], pool, taxonomy.get("species", {}), config["unexplored_threshold"],
                                                    rule and rule["relative_min_bbvi"])
        if rule:  # low information sufficiency is its own label, never a score
            s["priority_survey"] = s["information_sufficiency"]["mean_ratio"] < config["unexplored_threshold"]
            if config["conservation"].get("no_assessment"):  # verified-pilot-3.4: figure stage 3, no IUCN or national MCUI
                why = ["low_information_sufficiency"] if s["priority_survey"] else []
                # not 'no MCUI': a failed lookup or a not-current assessment is a data problem, not a missing assessment
                gap = {"not_in_red_list": "no_conservation_assessment", "category_not_numeric": "conservation_data_deficient"}
                why += [gap[s["withheld_reasons"]["MCUI"]]] if s["scores"]["MCUI"] is None and s["withheld_reasons"]["MCUI"] in gap else []
                s["priority_survey"], s["priority_survey_reasons"] = bool(why), why
            if s["unexplored_candidate"]:
                s["source_ids"] = sorted({*s["source_ids"], rule["source"]["id"]})
    cohorts = [{"cohort_id": cid, "role": "primary", "criteria": c["spec"]["criteria"],
                "food_item_ids": [r["food_item_id"] for r in c["rows"]],
                "foods": [r["reported_food_name"] for r in c["rows"]], "size": len(c["rows"]),
                "source": f"RDA National Standard Food Composition DB 10.4 (retrieved {snapshot['retrieved']})",
                "operating_candidates": sorted({r["aphia_id"] for r in c["rows"] if r["aphia_id"] in operating}),
                "research_candidates": sorted({r["aphia_id"] for r in c["rows"] if r["aphia_id"] and r["aphia_id"] not in operating}),
                "exclusions": c["spec"]["rule"].get("exclude_food_item_ids", {})} for cid, c in primary.items()]
    cohorts += [{"cohort_id": cid, "role": "cross_check", "criteria": c["spec"]["criteria"],
                 "food_item_ids": [r["food_item_id"] for r in c["rows"]], "size": len(c["rows"])} for cid, c in cross.items()]
    return {"method_version": config["method_version"], "status": config["status"],
            "snapshot_date": evidence["snapshot_date"], "candidate_snapshot_date": candidates["checked_on"],
            "generated_at": evidence.get("inputs_as_of", evidence["snapshot_date"]) + "T00:00:00Z", "food_weight": config["bbvi"]["default_food_weight"],
            "comparison_cohorts": cohorts,
            "cohort_warning": "Small fixed cohorts give unstable ranks; minimum sizes are software thresholds, and sensitivity is not a confidence interval.",
            "posthoc": config["posthoc"], "method": config, "sources": sources, "species": output,
            "candidate_species": research,
            **({"chembl_common_taxon_limit": chembl["common_taxon_limit"]} if chembl else {}),
            **({k: evidence[k] for k in ("national_red_list_not_assigned", "national_red_list_search") if k in evidence}
               if config.get("national_red_list") or config.get("national_fact_supplement") else {})}


def render(report: dict) -> str:
    return json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def load_inputs(evidence=DEFAULT_EVIDENCE, candidates=DEFAULT_CANDIDATES, config=DEFAULT_CONFIG, taxonomy=DEFAULT_TAXONOMY):
    def read(p):
        return json.loads(Path(p).read_text(encoding="utf-8"))
    cfg = read(config)
    evidence = read(evidence)
    if cfg.get("evidence_supplement"):
        extra = read(ROOT / cfg["evidence_supplement"])
        require(extra.get("snapshot_date") == evidence["snapshot_date"], "supplement snapshot differs from evidence")
        require(not set(extra["sources"]) & set(evidence["sources"]), "supplement redefines a source")
        evidence = {**evidence, **{k: v for k, v in extra.items() if k not in ("schema_version", "snapshot_date", "sources")},
                    "sources": {**evidence["sources"], **extra["sources"]}}
    for path in cfg.get("peptide_supplements", []):  # extra reviewed peptide rows, same rules; only their sources and the cohort's
        extra = read(ROOT / path)
        # 3.5: a supplement may be dated after the evidence (rows reviewed later); the report's input date follows it
        require(extra.get("snapshot_date", "") >= evidence["snapshot_date"], "peptide supplement is older than evidence")
        used = {r["source_id"] for r in extra["peptide_bioactivity"]} | ({cfg["peptide_bioactivity"]["cohort_source_id"]} & set(extra["sources"]))
        require(not used & set(evidence["sources"]), "peptide supplement redefines a source")
        later = {"inputs_as_of": max(evidence.get("inputs_as_of", evidence["snapshot_date"]), extra["snapshot_date"])} \
            if extra["snapshot_date"] > evidence["snapshot_date"] else {}
        evidence = {**evidence, **later, "peptide_bioactivity": evidence.get("peptide_bioactivity", []) + extra["peptide_bioactivity"],
                    "sources": {**evidence["sources"], **{k: extra["sources"][k] for k in used}}}
    xo = (cfg.get("peptide_bioactivity") or {}).get("cross_origin_potency")
    if xo:  # research-only: synthetic-peptide potency measured from another origin; never scored as an item of its own
        extra = read(ROOT / xo["supplement"])
        require(extra.get("snapshot_date") == evidence["snapshot_date"], "potency replication snapshot differs from evidence")
        require(not set(extra["sources"]) & set(evidence["sources"]), "potency replication supplement redefines a source")
        evidence = {**evidence, "potency_replications": extra["potency_replications"], "sources": {**evidence["sources"], **extra["sources"]}}
    if cfg.get("national_fact_supplement"):  # only the national red-list keys and their sources, not the whole v3 supplement
        extra = read(ROOT / cfg["national_fact_supplement"])
        require(extra.get("snapshot_date") == evidence["snapshot_date"], "national fact snapshot differs from evidence")
        keys = ("national_red_list", "national_red_list_not_assigned", "national_red_list_search")
        used = {r["source_id"] for r in extra["national_red_list"]}
        require(not used & set(evidence["sources"]), "national fact supplement redefines a source")
        evidence = {**evidence, **{k: extra[k] for k in keys}, "sources": {**evidence["sources"], **{k: extra["sources"][k] for k in used}}}
    if cfg.get("peptide_raw_values"):  # verified-pilot-2.1: public-paper peptide values only, never an AHTPDB cohort or rank
        raw = cfg["peptide_raw_values"]
        rows, sources = [], {}
        # extra_supplements: raw values reviewed for 2.1 only, kept out of the v3 research supplement and its AHTPDB stratum
        for path in [raw["supplement"], *raw.get("extra_supplements", [])]:
            extra = read(ROOT / path)
            require(extra.get("snapshot_date") == evidence["snapshot_date"], "peptide raw-value snapshot differs from evidence")
            used = {r["source_id"] for r in extra["peptide_bioactivity"]}
            require(not used & set(raw["excluded_sources"]), "peptide raw values must come from the papers, not an excluded database")
            require(not used & (set(evidence["sources"]) | set(sources)), "peptide raw-value supplement redefines a source")
            rows += extra["peptide_bioactivity"]
            sources |= {k: extra["sources"][k] for k in used}
        evidence = {**evidence, "peptide_bioactivity": rows, "sources": {**evidence["sources"], **sources}}
    if cfg.get("chembl_bioactivity"):  # verified-pilot-3.1: species -> compound -> ChEMBL snapshot (scripts/collect_mbpi_links.py)
        snap = read(ROOT / cfg["chembl_bioactivity"]["snapshot"])
        require(snap.get("snapshot_date", "") >= evidence["snapshot_date"], "ChEMBL link snapshot is older than evidence")
        require(not set(snap["sources"]) & set(evidence["sources"]), "ChEMBL link snapshot redefines a source")
        added_snap = None
        if cfg["chembl_bioactivity"].get("snapshot_supplement"):  # 3.27: compounds of later links, same ChEMBL release
            added_snap = read(ROOT / cfg["chembl_bioactivity"]["snapshot_supplement"])
            require(added_snap["base_snapshot"] == cfg["chembl_bioactivity"]["snapshot"] and added_snap["snapshot_date"] >= snap["snapshot_date"]
                    and added_snap["chembl_version"] == snap["sources"]["chembl_mbpi"]["version"], "ChEMBL supplement is for another snapshot or release")
            require(not set(added_snap["compounds"]) & set(snap["compounds"]) and not set(added_snap["parent_names"]) & set(snap["parent_names"])
                    and not {a["activity_id"] for a in added_snap["activities"]} & {a["activity_id"] for a in snap["activities"]}
                    and set(added_snap["activity_comments"]) == {str(a["activity_id"]) for a in added_snap["activities"]},
                    "ChEMBL supplement repeats snapshot rows or misses an activity comment")
            require(added_snap["filters"] == snap["filters"], "ChEMBL supplement was collected with other filters")
            cohorts = dict(snap["cohorts"])
            for key, c in added_snap["cohorts"].items():  # a cohort the snapshot holds keeps its total; only new medians are added
                old = cohorts.get(key)
                require(old is None or old["total"] == c["total"], f"{key}: supplement cohort total differs from the snapshot")
                cohorts[key] = c if old is None else {**old, "below": {**old["below"], **c["below"]}, "equal": {**old["equal"], **c["equal"]}}
            added = defaultdict(list)
            for link in added_snap["species_links"]:
                added[link["aphia_id"]].append({k: link[k] for k in ("compound_qid", "inchikey", "statements")})
            require(set(added) <= {s["aphia_id"] for s in snap["species"]}, "ChEMBL supplement links an unknown species")
            snap = {**snap, "snapshot_date": added_snap["snapshot_date"],
                    "species": [{**s, "links": s["links"] + added.get(s["aphia_id"], [])} for s in snap["species"]],
                    **{k: {**snap[k], **added_snap[k]} for k in ("reference_dois", "compound_taxon_counts", "compounds", "parent_names",
                                                         "parent_max_phase", "targets")},
                    "activities": sorted(snap["activities"] + added_snap["activities"], key=lambda a: a["activity_id"]), "cohorts": cohorts,
                    # the services the supplement queried again carry its date; the ChEMBL release itself is unchanged
                    "sources": {k: ({**v, "accessed": added_snap["queried_on"]} | ({} if k == "chembl_mbpi" else
                                  {"version": f"{v['version']}; supplement queried {added_snap['queried_on']}"})
                                  if k in ("chembl_mbpi", "pubchem_inchikey_mbpi", "wikidata_p703_lotus") else v)
                                for k, v in snap["sources"].items()}}
        require(set(cfg["chembl_bioactivity"]["source_ids"]) == set(snap["sources"]), "ChEMBL stratum source list differs from its snapshot")
        # species with no P703 link were searched in CMNPD, PubChem taxonomy and Europe PMC; the record is shown as it is
        papers = read(ROOT / cfg["chembl_bioactivity"]["paper_links"])
        require(evidence["snapshot_date"] <= papers.get("snapshot_date", "") <= snap["snapshot_date"],
                "paper link record must date between the evidence and the ChEMBL snapshot")
        p703 = {s["aphia_id"] for s in snap["species"] for l in s["links"] for st in l["statements"] if st["taxon_qid"] != "original_paper"}
        require(not {p["aphia_id"] for p in papers["links"]} & p703, "original-paper links are only for species without a P703 link")
        require(set(cfg["chembl_bioactivity"]["paper_source_ids"]) == set(papers["sources"]), "paper link source list differs from its record")
        require(not set(papers["sources"]) & (set(evidence["sources"]) | set(snap["sources"])), "paper link record redefines a source")
        held = {(s["aphia_id"], l["inchikey"], ref) for s in snap["species"] for l in s["links"] for st in l["statements"]
                if st["taxon_qid"] == "original_paper" for ref in st["references"]}
        require(held == {(p["aphia_id"], p["inchikey"], "doi:" + p["doi"].lower()) for p in papers["links"]},
                "paper link record and ChEMBL snapshot (+ supplement) hold different original-paper links; re-run the collector")
        review = read(ROOT / cfg["chembl_bioactivity"]["link_review"])
        require(review["snapshot"] == cfg["chembl_bioactivity"]["snapshot"] and review["paper_links"] == cfg["chembl_bioactivity"]["paper_links"],
                "link review was made for another snapshot")
        accepted = defaultdict(int)
        for p in papers["links"]:
            accepted[p["aphia_id"]] += 1
        snap = {**snap, "paper_search": {s["aphia_id"]: {"searched_on": papers["searched_on"], "europepmc_hits": s["europepmc_hits"],
                                                         "papers_screened": s["papers_screened"], "accepted_links": accepted[s["aphia_id"]]}
                                         for s in papers["searched"]}}
        snap["link_review"] = review["links"]
        as_of = max(evidence.get("inputs_as_of", evidence["snapshot_date"]), snap["snapshot_date"], review["reviewed_on"])
        extra_sources = {}
        p703_rule = cfg["chembl_bioactivity"].get("paper_links_p703")
        if p703_rule:  # verified-pilot-3.20 team-lead decision: paper links for P703 species that name the species and the sample
            sup = read(ROOT / p703_rule)
            require(not set(sup["sources"]) & (set(evidence["sources"]) | set(snap["sources"]) | set(papers["sources"])),
                    "P703 paper-link supplement redefines a source")
            species = {s["aphia_id"]: s for s in snap["species"]}
            refs, reviews = dict(snap["reference_dois"]), defaultdict(lambda: {"dois": set(), "review": None, "link": None})
            for p in sup["links"]:
                v = p["verification"]
                require(p["aphia_id"] in p703 and p["inchikey"] in snap["compounds"] and v["species_named"] is True
                        and str(v.get("sample_origin", "")).strip() and v["single_defined_compound"] is True
                        and v["isolated_or_identified_from_species"] is True and v["inchikey_matches_pubchem"] is True,
                        f"{p['aphia_id']} {p['inchikey']}: P703 paper link misses a condition")
                ref = "doi:" + p["doi"].lower()
                refs[ref] = p["doi"].lower()
                r = reviews[(p["aphia_id"], p["inchikey"])]
                r["dois"].add(p["doi"].lower())
                r["link"], r["review"] = p, p["review"] or r["review"]
            for (aphia, key), r in reviews.items():
                require(r["review"] is not None, f"{aphia} {key}: P703 paper link has no review decision")
                s = species[aphia] = {**species[aphia], "links": [dict(l) for l in species[aphia]["links"]]}
                link = next((l for l in s["links"] if l["inchikey"] == key), None)
                require(link is None, f"{aphia} {key}: the species already links this compound")
                s["links"].append({"compound_qid": r["link"]["compound_qid"], "inchikey": key,
                                   "statements": [{"references": sorted("doi:" + d for d in r["dois"]), "taxon_qid": "original_paper"}]})
                snap["link_review"] = snap["link_review"] + [{"aphia_id": aphia, "scientific_name": r["link"]["scientific_name"],
                    "inchikey": key, "compound_chembl_id": r["link"]["compound_chembl_id"], "compound_name": r["link"]["compound_name_in_paper"],
                    "pubchem_cid": r["link"]["pubchem_cid"], "dois": sorted(r["dois"]), **r["review"]}]
            snap = {**snap, "species": [species[s["aphia_id"]] for s in snap["species"]], "reference_dois": refs}
            extra_sources, as_of = sup["sources"], max(as_of, sup["snapshot_date"])
        comments = cfg["chembl_bioactivity"].get("activity_comments")
        if comments:  # verified-pilot-3.20: a depositor's Inconclusive / Not Active flag keeps the row out of every species item
            book = read(ROOT / comments)
            book = {**book, "comments": {**book["comments"], **(added_snap or {}).get("activity_comments", {})}}  # 3.27: supplement rows
            require(book["for_snapshot"] == cfg["chembl_bioactivity"]["snapshot"]
                    and set(book["comments"]) == {str(a["activity_id"]) for a in snap["activities"]},
                    "activity comments do not cover the ChEMBL snapshot")
            drop = set(cfg["chembl_bioactivity"]["excluded_activity_comments"])
            cohorts = dict(snap["cohorts"])
            for key, c in book["cohort_counts"].items():  # medians that only exist once the flagged rows are gone
                require(cohorts[key]["total"] == c["total"], f"{key}: added cohort counts come from another release")
                cohorts[key] = {**cohorts[key], "below": {**cohorts[key]["below"], str(c["median"]): c["below"]},
                                "equal": {**cohorts[key]["equal"], str(c["median"]): c["equal"]}}
            snap = {**snap, "cohorts": cohorts,
                    "activities": [a for a in snap["activities"] if (book["comments"][str(a["activity_id"])] or "").lower() not in drop]}
            as_of = max(as_of, book["snapshot_date"])
        evidence = {**evidence, "chembl_links": snap, "inputs_as_of": as_of,
                    "sources": {**evidence["sources"], **snap["sources"], **papers["sources"], **extra_sources}}
    sub = cfg["nutrition"].get("substitutes")
    if sub:  # verified-pilot-3.3: uFiSh substitutes (scripts/collect_mfpi_substitutes.py) and reviewed aquaculture records
        snap = read(ROOT / sub["snapshot"])
        aqua = read(ROOT / sub["aquaculture_supplement"])
        for extra, what in ((snap, "uFiSh substitute snapshot"), (aqua, "aquaculture supplement")):
            require(extra.get("snapshot_date", "") >= evidence["snapshot_date"], f"{what} is older than evidence")
            require(not set(extra["sources"]) & set(evidence["sources"]), f"{what} redefines a source")
        require(set(snap["sources"]) == {sub["source_id"]}, "uFiSh substitute source differs from the rule")
        have = {r["aphia_id"] for r in evidence["food_support"] if r.get("kind") == "aquaculture"}
        require(all(r["kind"] == "aquaculture" and r["aphia_id"] not in have for r in aqua["food_support"]),
                "aquaculture supplement repeats a species or adds another kind")
        evidence = {**evidence, "mfpi_substitutes": snap, "food_support": evidence["food_support"] + aqua["food_support"],
                    "inputs_as_of": max(evidence.get("inputs_as_of", evidence["snapshot_date"]), snap["snapshot_date"], aqua["snapshot_date"]),
                    "sources": {**evidence["sources"], **snap["sources"], **aqua["sources"]}}
        if sub.get("mext"):  # verified-pilot-3.6: reviewed MEXT 2020 items (research/verified-indices/snapshots/mext-zinc-*.json)
            mx = read(ROOT / sub["mext"]["snapshot"])
            require(mx.get("snapshot_date", "") >= evidence["snapshot_date"], "MEXT snapshot is older than evidence")
            require(set(mx["sources"]) == {sub["mext"]["source_id"]} and sub["mext"]["source_id"] not in evidence["sources"],
                    "MEXT source differs from the rule or redefines a source")
            require(len({i["aphia_id"] for i in mx["items"]}) == len(mx["items"]), "MEXT snapshot links one item per species")
            evidence = {**evidence, "mfpi_mext": mx, "sources": {**evidence["sources"], **mx["sources"]},
                        "inputs_as_of": max(evidence["inputs_as_of"], mx["snapshot_date"])}
        if sub.get("literature"):  # after 3.12: a reviewed paper's analysis of the species as its row when RDA and MEXT have none
            lit = read(ROOT / sub["literature"]["snapshot"])
            require(lit.get("snapshot_date", "") >= evidence["snapshot_date"], "literature row snapshot is older than evidence")
            require(set(lit["sources"]) == set(sub["literature"]["source_ids"]) and not set(lit["sources"]) & set(evidence["sources"]),
                    "literature row sources differ from the rule or redefine a source")
            require(len({i["aphia_id"] for i in lit["items"]}) == len(lit["items"]), "one literature row per species")
            evidence = {**evidence, "mfpi_literature": lit, "sources": {**evidence["sources"], **lit["sources"]},
                        "inputs_as_of": max(evidence["inputs_as_of"], lit["snapshot_date"])}
    names = cfg["nutrition"].get("rda_name_links")
    if names:  # after 3.12: unlinked RDA rows linked through a Korean national name authority (MABIK 국명, then MFDS 성분학명)
        extra = read(ROOT / names)
        require(extra.get("snapshot_date", "") >= evidence["snapshot_date"], "RDA name-link supplement is older than evidence")
        require(not set(extra["sources"]) & set(evidence["sources"]), "RDA name-link supplement redefines a source")
        old = {l["food_item_id"]: l for l in evidence["rda_taxon_links"]}
        new = {l["food_item_id"]: l for l in extra["rda_taxon_links"]}
        require(all(k in old and old[k].get("reviewed") is not True and old[k].get("candidate_aphia_id") == l["aphia_id"]
                    and l.get("reviewed") is True and l.get("source_id") in extra["sources"] and l.get("link_evidence")
                    for k, l in new.items()), "a name link must review an unlinked candidate row of the evidence")
        evidence = {**evidence, "rda_taxon_links": [new.get(l["food_item_id"], l) for l in evidence["rda_taxon_links"]],
                    "inputs_as_of": max(evidence.get("inputs_as_of", evidence["snapshot_date"]), extra["snapshot_date"]),
                    "sources": {**evidence["sources"], **extra["sources"]}}
    amp = cfg.get("amp_bioactivity")
    if amp:  # verified-pilot-3.18: antimicrobial-peptide rows and their papers
        extra = read(ROOT / amp["supplement"])
        require(extra.get("snapshot_date", "") >= evidence["snapshot_date"], "AMP supplement is older than evidence")
        used = {r["source_id"] for r in extra["amp_bioactivity"]} | {amp["cohort_source_id"]}
        require(not used & set(evidence["sources"]), "AMP supplement redefines a source")
        evidence = {**evidence, "amp_bioactivity": extra["amp_bioactivity"],
                    "sources": {**evidence["sources"], **{k: extra["sources"][k] for k in used}},
                    "inputs_as_of": max(evidence.get("inputs_as_of", evidence["snapshot_date"]), extra["snapshot_date"])}
    ac = cfg.get("anticancer_bioactivity")
    if ac:  # verified-pilot-3.21: anticancer-peptide rows and their papers
        extra = read(ROOT / ac["supplement"])
        require(extra.get("snapshot_date", "") >= evidence["snapshot_date"], "anticancer supplement is older than evidence")
        used = {r["source_id"] for r in extra["anticancer_bioactivity"]} | {ac["cohort_source_id"]}
        require(not used & set(evidence["sources"]), "anticancer supplement redefines a source")
        evidence = {**evidence, "anticancer_bioactivity": extra["anticancer_bioactivity"],
                    "sources": {**evidence["sources"], **{k: extra["sources"][k] for k in used}},
                    "inputs_as_of": max(evidence.get("inputs_as_of", evidence["snapshot_date"]), extra["snapshot_date"])}
    fa = cfg["nutrition"].get("display_fatty_acids")
    if fa:  # 3.17: EPA/DHA of the same RDA rows, display only (scripts/collect_rda_fatty_acids.py)
        extra = read(ROOT / fa["snapshot"])
        require(extra.get("snapshot_date", "") >= evidence["snapshot_date"], "fatty-acid snapshot is older than evidence")
        require(set(extra["sources"]) == {fa["display_source_id"]} and fa["display_source_id"] not in evidence["sources"],
                "the fatty-acid snapshot must register its own display source and redefine none")
        evidence = {**evidence, "sources": {**evidence["sources"], **extra["sources"]},
                    "inputs_as_of": max(evidence.get("inputs_as_of", evidence["snapshot_date"]), extra["snapshot_date"])}
    subs = cfg.get("mcui_substitutes")
    if subs:  # after 3.14: range-state national lists and the Rapid LC snapshot (scripts/collect_mcui_rapid_lc.py)
        extra, lc = read(ROOT / subs["snapshot"]), read(ROOT / subs["rapid_lc_snapshot"])
        require(len({r["aphia_id"] for r in extra["range_state"]}) == len(extra["range_state"]),
                "one range-state row per species: choose the list under range_state_rule and record the others as limitations")
        for x, what in ((extra, "MCUI substitute record"), (lc, "Rapid LC snapshot")):
            require(x.get("snapshot_date", "") >= evidence["snapshot_date"], f"{what} is older than evidence")
            require(not set(x["sources"]) & set(evidence["sources"]), f"{what} redefines a source")
        require(set(lc["sources"]) == {subs["snapshot_source_id"]} and lc["thresholds"] == subs["thresholds"]
                and subs["method_source_id"] in extra["sources"], "Rapid LC snapshot or method source differs from the rule")
        evidence = {**evidence, "mcui_substitutes": extra, "mcui_rapid_lc": lc,
                    "sources": {**evidence["sources"], **extra["sources"], **lc["sources"]},
                    "inputs_as_of": max(evidence.get("inputs_as_of", evidence["snapshot_date"]), extra["snapshot_date"], lc["snapshot_date"])}
    trend = cfg["conservation"].get("trend")
    if trend:  # verified-pilot-3.4: OBIS per-cell counts (scripts/collect_mcui_trend.py)
        snap = read(ROOT / trend["snapshot"])
        require(snap.get("snapshot_date", "") >= evidence["snapshot_date"], "OBIS trend snapshot is older than evidence")
        require(set(snap["sources"]) == {trend["source_id"]} and trend["source_id"] not in evidence["sources"],
                "OBIS trend source differs from the rule or redefines a source")
        require(snap["query"]["periods"] == trend["periods"], "OBIS trend periods differ from the rule")
        evidence = {**evidence, "obis_trend": snap, "sources": {**evidence["sources"], **snap["sources"]},
                    "inputs_as_of": max(evidence.get("inputs_as_of", evidence["snapshot_date"]), snap["snapshot_date"])}
    return evidence, read(candidates), cfg, read(ROOT / cfg["nutrition"]["snapshot"]), read(taxonomy)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, default=DEFAULT_EVIDENCE)
    parser.add_argument("--candidates", type=Path, default=DEFAULT_CANDIDATES)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="compare existing output without writing")
    args = parser.parse_args()
    content = render(build(*load_inputs(args.evidence, args.candidates, args.config)))
    if args.check:
        require(args.out.read_text(encoding="utf-8") == content, "public report differs from reproducible build")
        print("Reproducible report matches committed output")
    else:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(content, encoding="utf-8")
        report = json.loads(content)
        print(f"Wrote {args.out}: " + str({a: sum(s['scores'][a] is not None for s in report['species']) for a in AXES}))


if __name__ == "__main__":
    main()
