"""Build a public, source-linked matrix gate audit from the two reviewed reports.

This is a status artifact. It never computes an indicator or substitutes a missing
value with zero. A real matrix point is eligible only if BBVI and MCUI exist.
"""
import argparse
import json
import re
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


def _eligible(scores, mcui_basis, rule=None, bbvi_label=None):
    # verified-pilot-2.1 to 3.1: a Korean national-assessment MCUI is a separate stratum and never shares the IUCN-based matrix.
    # verified-pilot-3.2: it is placed with its own marker (method.matrix.national_mcui) and stays labelled as national.
    national_ok = bool(rule and rule.get("include_national_mcui"))
    # after 3.14: a substitute MCUI joins (separate marker) only for the bases the rule lists; 3.15 lists the range-state
    # national list and keeps the preliminary Rapid LC off, since its back-test failed
    substitutes = (rule or {}).get("include_substitute_mcui") or []
    # 3.27: a labelled single-paper BBVI joins (hollow marker) only when the rule says so
    single_ok = not bbvi_label or bool((rule or {}).get("include_single_source_bbvi"))
    return (scores["BBVI"] is not None and scores["MCUI"] is not None and (national_ok or mcui_basis != "national")
            and (mcui_basis not in ("range_state", "preliminary") or mcui_basis in substitutes) and single_ok)


def matrix_type(scores, rule):
    """BBVI x MCUI type at the published default BBVI weight; a value on the threshold counts as high."""
    if not rule or scores["BBVI"] is None or scores["MCUI"] is None:
        return None
    high_use, high_need = scores["BBVI"] >= rule["bbvi_threshold"], scores["MCUI"] >= rule["mcui_threshold"]
    return rule["types"][("high" if high_use else "low") + "_bbvi_" + ("high" if high_need else "low") + "_mcui"]["id"]


def _layers(s, rule):
    """verified-pilot-3.2 map fields: the matrix type and the priority-survey and unexplored-candidate labels, never a score.
    From 3.4 the priority label carries its reasons (low information sufficiency, no conservation assessment)."""
    if not rule:
        return {}
    eligible = _eligible(s["scores"], s.get("mcui_basis"), rule, s.get("bbvi_label"))
    return {"matrix_type": matrix_type(s["scores"], rule) if eligible else None,
            "priority_survey": s.get("priority_survey", False), "unexplored_candidate": s.get("unexplored_candidate"),
            **({"priority_survey_reasons": s["priority_survey_reasons"]} if "priority_survey_reasons" in s else {})}


# ---- matrix_rule: the current rule apart from its history ----
# The config's notes grew by appending each version's change, so one note held rules that later versions withdrew (e.g.
# 3.15 'a preliminary Rapid LC gives no MCUI' beside 4.17's scored preliminary assessments). The published matrix_rule
# keeps only the sentences in force for the report's version; every other sentence, and every earlier value of every
# field, goes to matrix_rule.history with the versions it was in force. The config and dist/assessments.json keep the
# record text unchanged.
# Each item: `text` as it stands in the config (None for wording this builder adds), `in_config` = versions whose config
# note holds the text, `active` = versions in which the rule it states is in force, `now` = the current wording when the
# text carries a version tag, `status` = what happened to it afterwards (history only).
_PRELIMINARY = ("With no IUCN global or Korean national assessment, a preliminary assessment gives the MCUI in this order: "
                "the range state's national list, then the Rapid LC check where the OBIS reporting rate did not reach the "
                "decline ratio. It joins the matrix and the map colours drawn like any other MCUI; its basis and the label "
                "'{label}' are shown in the species detail, and an official IUCN or Korean national result replaces it once "
                "published. A sub-national list stays a reference item without an MCUI number.")
RULE_TEXT = {
    "substitute_mcui_note": [
        {"text": "An official national list of another range state is placed with the separate marker used for the Korean "
                 "national MCUI and labelled by its basis.",
         "in_config": ("verified-pilot-3.15", None), "active": [("verified-pilot-3.15", "verified-4.14")],
         "status": "4.14: 다른 나라 국가 목록은 참고 항목(MCUI 없음). 4.17: 예비 평가로 다시 MCUI를 주지만 다른 MCUI와 같은 점으로 그리고, "
                   "근거는 종 상세에만 적는다."},
        {"text": "A preliminary Rapid LC gives no MCUI: its post-hoc back-test failed (it called the EN species 해삼 and 전복 "
                 "likely LC), so it is shown on the species as reference information only (team-lead decision 2026-10-02).",
         "in_config": ("verified-pilot-3.15", None),
         "active": [("verified-pilot-3.15", "verified-4.3"), ("verified-4.14", "verified-4.17")],
         "status": "4.3에서 철회(점수화), 4.14에서 다시 적용, 4.17에서 다시 철회: 공식 평가가 없으면 예비 평가로 MCUI를 준다."},
        {"text": "4.2: a sub-national category joins on the same terms, with its own marker and the pre-registered back-test "
                 "result beside it; it is never ranked with IUCN-based MCUI.",
         "in_config": ("verified-4.2", None), "active": [("verified-4.2", "verified-4.11")],
         "status": "4.11: 역검증을 통과한 지방 목록만 MCUI. 4.14부터 지방 목록은 참고 항목(MCUI 없음)이며 4.17도 그대로다."},
        {"text": "4.3: a scored Rapid LC (team-lead decision 2026-10-05) joins with its own marker and its failed back-test "
                 "label;",
         "in_config": ("verified-4.3", None), "active": [("verified-4.3", "verified-4.14")],
         "status": "4.14: Rapid LC는 참고 항목. 4.17: 예비 평가로 다시 MCUI를 주지만 따로 표시하지 않고, 근거와 '예비 평가' 라벨은 종 상세에 적는다."},
        {"text": None, "active": [("verified-4.11", "verified-4.14")],
         "now": "A sub-national category gives an MCUI only when its pre-registered back-test passed; otherwise it is shown as "
                "reference and the next basis applies. A Rapid LC check is not scored when the OBIS reporting-rate ratio is "
                "at or below the decline ratio."},
        {"text": None, "active": [("verified-4.14", "verified-4.17")],
         "now": "Another state's national list, a sub-national list and the Rapid LC check are reference items without an "
                "MCUI number; a species with no IUCN global or Korean national category has no type."},
        {"text": None, "active": [("verified-4.17", None)], "now": _PRELIMINARY},
        {"text": "a floor MBPI (0) gives a labelled BBVI that joins like a single-paper BBVI.",
         "in_config": ("verified-4.3", None), "active": [("verified-4.3", None)],
         "now": "A floor MBPI (0) gives a labelled BBVI that joins like a single-paper BBVI."},
    ],
    "threshold_rule": [
        {"text": "A value at or above the threshold is high.", "in_config": ("verified-pilot-3.2", None),
         "active": [("verified-pilot-3.2", None)]},
        {"text": "BBVI is compared as published, rounded to one decimal (the screen's BBVI at the current weight is rounded the "
                 "same way); MCUI category scores are whole numbers.",
         "in_config": ("verified-pilot-3.2", "verified-4.14"), "active": [("verified-pilot-3.2", "verified-4.14")],
         "status": "4.14: BBVI는 반올림 전 값으로 비교한다."},
        {"text": "4.14: BBVI is compared unrounded (scores_unrounded.BBVI; the screen re-mixes the unrounded MFPI and MBPI at "
                 "its weight), and is rounded only for display; MCUI values are whole numbers.",
         "in_config": ("verified-4.14", None), "active": [("verified-4.14", None)],
         "now": "BBVI is compared unrounded (scores_unrounded.BBVI; the screen re-mixes the unrounded MFPI and MBPI at its "
                "weight), and is rounded only for display; MCUI values are whole numbers."},
        {"text": "The 50 lines are exploratory dividing lines, not validated thresholds.", "in_config": ("verified-4.14", None),
         "active": [("verified-4.14", None)]},
    ],
    "single_source_bbvi_note": [
        {"text": "Since 3.27 a BBVI whose top MBPI item rests on one paper is placed with a hollow marker and its label; it is "
                 "not ranked apart, but the page keeps the label wherever the value appears.",
         "in_config": ("verified-pilot-3.27", None), "active": [("verified-pilot-3.27", None)],
         "now": "A BBVI whose top MBPI item rests on one paper is placed with a hollow marker and its label; it is not ranked "
                "apart, but the page keeps the label wherever the value appears."},
    ],
}


def _vkey(version):
    nums = [int(n) for n in re.findall(r"\d+", version)]
    return tuple(nums) + ((0,) if len(nums) == 1 else ())


def _within(version, span):
    start, end = span
    return _vkey(start) <= _vkey(version) and (end is None or _vkey(version) < _vkey(end))


def _span_text(span):
    return f"{span[0]} ~ {span[1] + ' 전' if span[1] else '현재'}"


def current_rule(rule, method, version):
    """The rule in force at `version` (no withdrawn sentence, no version tag) and its history."""
    if version and _vkey(version) >= _vkey("verified-4.17"):
        scope = method.get("mcui_scope") or {}
        if (scope.get("preliminary_bases"), scope.get("reference_bases")) != (["range_state", "preliminary"], ["sub_national"]):
            raise ValueError("mcui_scope changed: rewrite the current substitute_mcui_note wording in RULE_TEXT")
    current, withdrawn = dict(rule), []
    for field, items in RULE_TEXT.items():
        if field not in rule:
            continue
        held = [i for i in items if i["text"] and _within(version, i["in_config"])]
        if " ".join(i["text"] for i in held) != rule[field]:
            raise ValueError(f"matrix.{field} has a sentence RULE_TEXT does not classify; add it before publishing")
        live = [i for i in items if any(_within(version, s) for s in i["active"])]
        label = (method.get("mcui_scope") or {}).get("preliminary_label", "")
        current[field] = " ".join(i["now"].format(label=label) if i.get("now") else i["text"] for i in live)
        withdrawn += [{"field": field, "text": i["text"], "in_force": [_span_text(s) for s in i["active"]], "now": i["status"]}
                      for i in held if i not in live]
    scored = (method.get("mcui_scope") or {}).get("scored_bases")
    if scored is not None and "include_substitute_mcui" in rule:
        # 4.14 on: a basis the MCUI scope does not score cannot place a point, so the current rule does not list it
        current["include_substitute_mcui"] = [b for b in rule["include_substitute_mcui"] if b in scored]
    return current, withdrawn


def _field_history(current, version):
    """Every earlier value of each matrix_rule field, from the public configs up to `version`."""
    from build_method_changelog import public_configs
    runs = {}
    for v, path in public_configs():
        if _vkey(v) > _vkey(version):
            break
        m = _read(path).get("matrix")
        if not m:
            continue
        for k, value in m.items():
            seq = runs.setdefault(k, [])
            if seq and seq[-1]["value"] == value:
                seq[-1]["to"] = v
            else:
                seq.append({"field": k, "value": value, "from": v, "to": v})
    return [r for seq in runs.values() for r in seq if r["value"] != current.get(r["field"])]


def matrix_rule(rule, method, version):
    current, withdrawn = current_rule(rule, method, version)
    current["history"] = {
        "note": "현재 규칙에서 뺀 옛 규칙 문장과, 각 필드가 버전별로 가졌던 이전 값입니다. 원문은 설정 파일과 "
                "dist/assessments.json의 method.matrix에 그대로 있고, 버전별 변경 이유는 research/method-changelog.json에 있습니다.",
        "withdrawn_sentences": withdrawn,
        "field_versions": _field_history(current, version),
    }
    return current


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
    labelled = (assessments["method"].get("bbvi") or {}).get("single_source_policy") == "score_with_label"
    if any(s["scores"]["BBVI"] is not None and s.get("mbpi_label") and not (labelled and s.get("bbvi_label")) for s in assessed):
        raise ValueError("BBVI from a single-source MBPI")  # 3.27: allowed only as a labelled score under the config's policy
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
                     # 4.3: a floor MBPI (0, no qualifying item) keeps every open step of its evidence chain
                     "bioactivity_missing_steps": [] if scores["MBPI"] is not None and not s.get("mbpi_floor") else _bio_blockers(partial),
                     **({"mbpi_label": s["mbpi_label"]} if s.get("mbpi_floor") else {}),
                     "bioactivity_leads": [{"record_id": p["record_id"], "source_url": assessments["sources"][p["source_id"]]["url"],
                                            "chain": p.get("chain", {}), "exclusion_reason": p.get("exclusion_reason")}
                                           for p in partial],
                     "source_urls": sorted(set(links)), "mcui_basis": s.get("mcui_basis"),
                     **({"bbvi_label": s.get("bbvi_label")} if labelled else {}),
                     "matrix_eligible": _eligible(scores, s.get("mcui_basis"), rule, s.get("bbvi_label")), **_layers(s, rule)})
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
                     "bioactivity_missing_steps": [] if scores["MBPI"] is not None and not (reviewed and reviewed.get("mbpi_floor")) else list(STEPS),
                     **({"mbpi_label": reviewed["mbpi_label"]} if reviewed and reviewed.get("mbpi_floor") else {}),
                     "bioactivity_leads": [], "source_urls": sorted(set(urls)),
                     "mcui_basis": reviewed and reviewed.get("mcui_basis"),
                     **({"bbvi_label": reviewed and reviewed.get("bbvi_label")} if labelled else {}),
                     "matrix_eligible": _eligible(scores, reviewed and reviewed.get("mcui_basis"), rule, reviewed and reviewed.get("bbvi_label")),
                     **_layers(reviewed or {"scores": scores}, rule)})
    if len({r["aphia_id"] for r in rows}) != 30:
        raise ValueError("duplicate AphiaID")
    for row in rows:
        if set(row["scores"]) != set(AXES):
            raise ValueError("missing score axis")
        if row["scores"]["BBVI"] is not None and (row["scores"]["MFPI"] is None or row["scores"]["MBPI"] is None):
            raise ValueError("BBVI without both inputs")
        if row["matrix_eligible"] != _eligible(row["scores"], row["mcui_basis"], rule, row.get("bbvi_label")):
            raise ValueError("matrix gate mismatch")
        if rule and (row["matrix_type"] is not None) != row["matrix_eligible"]:
            raise ValueError("matrix type without an eligible point")
    return {"schema_version": 1, "method_version": assessments["method_version"],
            "assessments_snapshot": assessments["snapshot_date"], "candidate_snapshot": catalog["reviewedOn"],
            "matrix_points": sum(r["matrix_eligible"] for r in rows), "species": rows,
            **({"matrix_rule": matrix_rule(rule, assessments["method"], assessments["method_version"])} if rule else {})}


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
