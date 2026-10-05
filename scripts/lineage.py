"""MBPI score lineage: species -> compound -> assay record -> stratum percentile -> evidence weight -> score.

A recording layer only. It reads the published dist/assessments.json and the same inputs build_verified_indices.py
loads, and never computes or changes a score; the checks prove the tables reproduce the published MBPI.

  export     research/lineage/<run_id>/ species_compound_link.csv, bioassay_record.csv, score_contribution.csv, score_run.json
  explain    --aphia ID: one species' MBPI as a tree with source links (--json for the raw rows)
  diff       --from RUN --to RUN: score changes between two published runs -> reports/source_changes_<to>.md
  changelog  rebuild research/lineage/source_changelog.json from every published run in the git history
  validate   the six lineage checks -> reports/lineage_validation_<run_id>.md

A run is a method_version (e.g. verified-pilot-3.28) or any git revision of dist/assessments.json.
Usage: PYTHONUTF8=1 python scripts/lineage.py explain --aphia 836033
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_verified_indices as b  # noqa: E402

ROOT = b.ROOT
OUT = ROOT / "research" / "lineage"
REPORTS = ROOT / "reports"
CHANGELOG = OUT / "source_changelog.json"
REPORT_PATH = "dist/assessments.json"
ROW_KINDS = {"bioactivity": "compound", "peptide_bioactivity": "peptide", "amp_bioactivity": "amp",
             "anticancer_bioactivity": "anticancer", "xo_bioactivity": "xo"}
CLASS = {"peptide": "ACE 억제 (펩타이드)", "amp": "항균 (펩타이드 MIC)", "anticancer": "항암 (펩타이드 세포 IC50)", "xo": "잔틴 산화효소 억제 (펩타이드 IC50)", "compound": "원논문 화합물"}
AGGREGATION = "item = median p-value of its records -> percentile in the stratum cohort x evidence factor; species MBPI = round1(max item)"
CHANGE_TYPES = {"fallback": "대체", "dedup": "중복 해소", "identifier": "식별자 변경", "version": "버전 변경",
                "conversion": "환산 방식 변경", "evidence": "근거 기록 변경", "method": "계산 규칙 변경", "unexplained": "설명 안 됨"}
CASES = ("Conus magus", "Halichondria okadai", "Ecteinascidia turbinata")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True).stdout


def all_species(report: dict) -> list[dict]:
    return report["species"] + report.get("candidate_species", [])


def kind(item: dict) -> str:
    return item.get("stratum_kind", "compound")


def compound_key(item: dict) -> str:
    return item.get("compound_id") or f"SEQ:{item['peptide_sequence']}"


def record_ids(item: dict) -> list[str]:
    if kind(item) == "chembl":
        return [f"chembl:{x}" for x in item["activity_ids"]]
    return [f"{kind(item)}:{x}" for x in item.get("record_ids") or item.get("activity_ids") or []]


def item_value(item: dict) -> float | None:
    return next((item[k] for k in ("median_pchembl", "pIC50", "pMIC") if k in item), None)


def pvalue(r: dict) -> float | None:
    """The p-value the build ranks for one paper row: 6 - log10(uM), after the sequence-mass conversion when used."""
    if r.get("pchembl_value") is not None:
        return r["pchembl_value"]
    if r.get("status") != "approved_for_score" or r.get("value") is None:
        return None
    if r.get("unit") != "uM":
        r = b.converted_peptide(r)
    return round(6 - math.log10(r["value"]), 6)


# ---------- export -------------------------------------------------------------------

def tables(report: dict | None = None) -> dict:
    """The four lineage tables of the current run, from the published report and the build's own inputs."""
    report = report or json.loads((ROOT / REPORT_PATH).read_text(encoding="utf-8"))
    ev, _, cfg, _, _ = b.load_inputs()
    b.require(report["method_version"] == cfg["method_version"], "dist/assessments.json is not the current config's run")
    run_id, rule, snap = cfg["method_version"], cfg["chembl_bioactivity"], ev["chembl_links"]
    sources = ev["sources"]
    release = sources["chembl_mbpi"]["version"].split()[0]
    by_parent = defaultdict(list)
    for a in snap["activities"]:
        by_parent[a["parent_molecule_chembl_id"]].append(a)
    trail = {"links": [], "activities": {}, "by_parent": by_parent}
    items, _ = b.chembl_items(ev, cfg, trail=trail)
    published = {(s["aphia_id"], i["compound_id"], i["stratum_id"]) for s in all_species(report)
                 for i in s["bioactivity_trace"] if kind(i) == "chembl"}
    b.require({(a, i["compound_id"], i["stratum_id"]) for a, i in items} == published,
              "ChEMBL items of the inputs differ from the published report; rebuild dist/assessments.json first")
    strata = {t: b.chembl_stratum(v, rule["strata"]) for t, v in snap["targets"].items()}

    # ChEMBL activities the loader drops for their depositor comment (load_inputs), with the comment
    base = json.loads((ROOT / rule["snapshot"]).read_text(encoding="utf-8"))
    supplement = json.loads((ROOT / rule["snapshot_supplement"]).read_text(encoding="utf-8")) if rule.get("snapshot_supplement") else {}
    comments = json.loads((ROOT / rule["activity_comments"]).read_text(encoding="utf-8"))["comments"] | supplement.get("activity_comments", {})
    raw = base["activities"] + supplement.get("activities", [])
    later = {a["activity_id"] for a in supplement.get("activities", [])}
    kept = {a["activity_id"] for a in snap["activities"]}
    dropped = [a for a in raw if a["activity_id"] not in kept]

    # (a) species -> compound links
    review = {(r["aphia_id"], r["inchikey"]): r for r in snap["link_review"]}
    status = {(l["aphia_id"], l["inchikey"]): l["status"] for l in trail["links"]}
    links = {}
    for s in snap["species"]:
        taxa = {t["qid"]: t["name"] for t in s.get("wikidata_taxa", [])}
        for l in s["links"]:
            ident = snap["compounds"][l["inchikey"]]
            qids = sorted({st["taxon_qid"] for st in l["statements"]})
            paper = qids == ["original_paper"]
            names = sorted({taxa.get(q, q) for q in qids if q != "original_paper"})
            levels = sorted({"종 일치 (원논문 검수)" if q == "original_paper" else "종 일치" if taxa.get(q) == s["scientific_name"]
                             else "동의어 → 유효명 변환" if taxa.get(q) in s.get("worms_synonyms", []) else "하위·근연 분류군" for q in qids})
            r = review.get((s["aphia_id"], l["inchikey"]))
            ltype = ("직접 분리" if paper else "문헌 보고 (검수 채택)" if r and r["decision"] != "reject" else "추정 (문헌 자동 추출)")
            dois = sorted({snap["reference_dois"].get(x, "").lower() for st in l["statements"] for x in st["references"]} - {""})
            links[f"{s['aphia_id']}|{ident['parent_chembl_id'] or l['inchikey']}|{l['inchikey']}"] = {
                "link_id": f"{s['aphia_id']}|{ident['parent_chembl_id'] or l['inchikey']}|{l['inchikey']}",
                "aphia_id": s["aphia_id"], "compound_key": ident["parent_chembl_id"] or l["inchikey"], "inchikey": l["inchikey"],
                "pubchem_cid": ";".join(map(str, ident["pubchem_cids"])), "chembl_id": ident["parent_chembl_id"] or "",
                "link_source": "원논문 (CMNPD·Europe PMC 검색)" if paper else "Wikidata P703 (LOTUS)",
                "link_source_record_id": ";".join(f"{q}:P703:{l['compound_qid']}" for q in qids if q != "original_paper") or l["compound_qid"],
                "reference_doi_or_pmid": ";".join(dois), "link_type": ltype,
                "taxon_match_level": ";".join(levels), "original_taxon_name": ";".join(names) or s["scientific_name"],
                "link_status": status[(s["aphia_id"], l["inchikey"])],
                "review_class": (r or {}).get("class") or "", "uncertain": ltype.startswith("추정") or levels != ["종 일치"] and levels != ["종 일치 (원논문 검수)"]}

    # (b) assay records
    records = {}
    for a in raw:
        t, ident = a["target_chembl_id"], snap["targets"].get(a["target_chembl_id"], {})
        keys = sorted(k for k, c in snap["compounds"].items() if c["parent_chembl_id"] == a["parent_molecule_chembl_id"])
        records[f"chembl:{a['activity_id']}"] = {
            "assay_record_id": f"chembl:{a['activity_id']}", "compound_key": a["parent_molecule_chembl_id"], "inchikey": ";".join(keys),
            "source_db": "ChEMBL", "source_record_id": f"activity {a['activity_id']}; assay {a['assay_chembl_id']}; document {a['document_chembl_id']}",
            "target_id": t, "target_name": ident.get("pref_name", ""), "organism_of_target": ident.get("organism") or "",
            "assay_type": a["assay_type"], "activity_class": rule["strata"][strata[t]]["label"] if strata.get(t) else "층 밖 표적",
            "std_type": a["standard_type"], "std_value": "", "std_units": "", "std_relation": "=",  # snapshot keeps pChEMBL only
            "pchembl_value": a["pchembl_value"], "conversion_method": "원본 pChEMBL", "stratum_key": f"{release}:{t}|{a['standard_type']}",
            "reference_doi_or_pmid": f"ChEMBL document {a['document_chembl_id']}", "activity_comment": comments.get(str(a["activity_id"])) or "",
            "source_version": sources["chembl_mbpi"]["version"],
            "retrieved_at": supplement["queried_on"] if a["activity_id"] in later else base["queried_on"],
            "url": f"https://www.ebi.ac.uk/chembl/api/data/activity/{a['activity_id']}.json"}
    used_stratum = {r: i["stratum_id"] for s in all_species(report) for i in s["bioactivity_trace"] for r in record_ids(i)}
    paper_rows = {}
    for key, k in ROW_KINDS.items():
        for r in ev.get(key, []):
            rid = f"{k}:{r.get('activity_id') or r.get('record_id')}"
            paper_rows[rid] = (k, r)
            p = pvalue(r)
            src = sources.get(r["source_id"], {})
            converted = r.get("unit") not in (None, "uM", "nM") and p is not None
            records[rid] = {
                "assay_record_id": rid, "compound_key": f"SEQ:{r['sequence']}" if r.get("sequence") else r.get("compound_id") or f"MATERIAL:{rid}",
                "inchikey": r.get("compound_id", "") if not str(r.get("compound_id", "")).startswith("CID:") else "",
                "source_db": f"원논문 ({r['source_id']})", "source_record_id": str(r.get("activity_id") or r.get("record_id")),
                "target_id": r.get("target") or r.get("target_id") or r.get("target_species") or r.get("cell_line") or "",
                "target_name": r.get("target_strain") or r.get("cancer_type") or "", "organism_of_target": r.get("target_species") or "",
                "assay_type": " · ".join(str(r[x]) for x in ("method", "substrate", "medium", "test_system") if r.get(x)),
                "activity_class": CLASS[k], "std_type": r.get("endpoint", ""), "std_value": r.get("value", r.get("raw_value", "")),
                "std_units": r.get("unit", r.get("raw_unit", "")), "std_relation": r.get("relation", r.get("standard_relation", "")),
                "pchembl_value": "" if p is None else p,
                "conversion_method": "환산 불가" if p is None else "원본 pChEMBL" if r.get("pchembl_value") is not None else
                ("자체 환산: µg/mL → µM (서열 평균질량) → 6 − log10(µM)" if converted else "자체 환산: 6 − log10(µM)"),
                "stratum_key": used_stratum.get(rid, ""), "reference_doi_or_pmid": r.get("original_paper_doi") or src.get("url", ""),
                "activity_comment": "", "source_version": src.get("version", ""), "retrieved_at": src.get("accessed", ""),
                "url": f"https://doi.org/{r['original_paper_doi']}" if r.get("original_paper_doi") else src.get("url", "")}
            if r.get("origin_aphia_id"):
                lk = f"{r['origin_aphia_id']}|{records[rid]['compound_key']}|"
                link = links.setdefault(lk, {
                    "link_id": lk, "aphia_id": r["origin_aphia_id"], "compound_key": records[rid]["compound_key"], "inchikey": "",
                    "pubchem_cid": "", "chembl_id": "", "link_source": "원논문", "link_source_record_id": "", "reference_doi_or_pmid": "",
                    "link_type": "서열 기반 합성 펩타이드" if r.get("synthetic") else "직접 분리",
                    "taxon_match_level": "종 일치 (원논문 검수)", "original_taxon_name": r["origin_scientific_name"],
                    "link_status": "not_approved_for_score", "review_class": "", "uncertain": False})
                link["link_source_record_id"] = ";".join(sorted(set(filter(None, link["link_source_record_id"].split(";"))) | {records[rid]["source_record_id"]}))
                doi = r.get("original_paper_doi") or src.get("url", "")
                link["reference_doi_or_pmid"] = ";".join(sorted(set(filter(None, link["reference_doi_or_pmid"].split(";"))) | {doi}))
                if r.get("status") == "approved_for_score":
                    link["link_status"] = "accepted"
    for r in ev.get("potency_replications", []):
        src = sources.get(r["source_id"], {})
        records[f"replication:{r['record_id']}"] = {
            "assay_record_id": f"replication:{r['record_id']}", "compound_key": f"SEQ:{r['sequence']}", "inchikey": "",
            "source_db": f"원논문 ({r['source_id']})", "source_record_id": r["record_id"], "target_id": r.get("target", ""),
            "target_name": "", "organism_of_target": "", "assay_type": r.get("substrate", ""), "activity_class": "재현 측정 (근거 가중만)",
            "std_type": r.get("endpoint", ""), "std_value": r["value"], "std_units": r["unit"], "std_relation": r.get("relation", ""),
            "pchembl_value": round(6 - math.log10(r["value"]), 6), "conversion_method": "자체 환산: 6 − log10(µM)", "stratum_key": "",
            "reference_doi_or_pmid": r["original_paper_doi"], "activity_comment": "", "source_version": src.get("version", ""),
            "retrieved_at": src.get("accessed", ""), "url": f"https://doi.org/{r['original_paper_doi']}"}

    # (c) score contributions
    link_of = {(l["aphia_id"], l["compound_key"]): l["link_id"] for l in sorted(links.values(), key=lambda l: l["link_status"] != "accepted")}
    contrib = []

    def add(aphia, ckey, rid, included, reason="", item=None, role="value"):
        rec = records[rid]
        contrib.append({
            "aphia_id": aphia, "compound_key": ckey, "inchikey": rec["inchikey"], "link_id": link_of.get((aphia, ckey), ""),
            "assay_record_id": rid, "record_role": role, "item_id": f"{aphia}|{kind(item)}|{ckey}|{item['stratum_id']}" if item else "",
            "stratum_key": item["stratum_id"] if item else rec["stratum_key"], "record_value": rec["pchembl_value"],
            "item_value": item_value(item) if item else "", "percentile_in_stratum": item["percentile"] if item else "",
            "evidence_weight": item["evidence_factor"] if item else "",
            "evidence_detail": (f"link {item['link_factor']} x activity {item['activity_factor']} (DOI {len(item['original_paper_dois'])}, ChEMBL documents {len(item['document_chembl_ids'])})"
                                if item and kind(item) == "chembl" else
                                f"independent DOIs {len(item.get('independent_dois') or item['original_paper_dois'])}" if item else ""),
            "contribution_value": item["adjusted"] if item and included else "", "aggregation_rule": AGGREGATION if included else "",
            "included": included, "exclusion_reason": reason, "run_id": run_id})

    for s in all_species(report):
        aphia, seen = s["aphia_id"], set()
        for item in s["bioactivity_trace"]:
            ckey = compound_key(item)
            for rid in record_ids(item):
                add(aphia, ckey, rid, True, item=item)
                seen.add(rid)
            for rep in item.get("potency_replications", []):
                add(aphia, ckey, f"replication:{rep['record_id']}", rep["used"], "" if rep["used"] else f"replication not used: {rep['reason']}",
                    item=item if rep["used"] else None, role="replication")
        for (a, act), why in sorted(trail["activities"].items()):
            if a == aphia:
                add(aphia, why["parent"], f"chembl:{act}", False, why["reason"])
        for a in dropped:
            for l in links.values():
                if l["aphia_id"] == aphia and l["chembl_id"] == a["parent_molecule_chembl_id"] and l["link_status"].startswith("accepted"):
                    add(aphia, l["compound_key"], f"chembl:{a['activity_id']}", False, f"activity_comment: {comments.get(str(a['activity_id']))}")
                    break
        for rid, (k, r) in paper_rows.items():
            if r.get("origin_aphia_id") == aphia and rid not in seen:
                add(aphia, records[rid]["compound_key"], rid, False,
                    r.get("exclusion_reason") or ("no fixed bioactivity cohort" if r.get("status") == "approved_for_score" else f"status: {r.get('status')}"))
    # one row per (species, record): an activity reached through two links of one parent counts once
    contrib = list({(c["aphia_id"], c["assay_record_id"], c["item_id"]): c for c in contrib}.values())
    contrib.sort(key=lambda c: (c["aphia_id"], not c["included"], c["item_id"], c["assay_record_id"]))

    head = git("rev-parse", "--short", "HEAD").strip()
    dirty = bool(git("status", "--porcelain", "--", "scripts", "config", "research/verified-indices", REPORT_PATH).strip())
    used_sources = sorted({r["source_db"][6:-1] for r in records.values() if r["source_db"].startswith("원논문 (")}
                          | set(rule["source_ids"]) | set(rule["paper_source_ids"]))
    run = {"run_id": run_id, "method_version": run_id, "report_generated_at": report["generated_at"],
           "inputs_as_of": ev.get("inputs_as_of", ev["snapshot_date"]), "git_commit": head + ("+dirty" if dirty else ""),
           "sources": {k: {x: sources[k].get(x) for x in ("provider", "version", "accessed", "license")} for k in used_sources if k in sources},
           "parameters": {"bioactivity": cfg["bioactivity"], "chembl_minimum_cohort_records": rule["minimum_cohort_records"],
                          "chembl_filters": snap["filters"], "chembl_common_taxon_limit": report.get("chembl_common_taxon_limit"),
                          **{f"{k}_minimum": cfg[k].get("minimum_peptides") for k in ("peptide_bioactivity", "amp_bioactivity", "anticancer_bioactivity", "xo_bioactivity") if cfg.get(k)}},
           "activity_exclusions_before_snapshot": "ChEMBL rows outside the assay-type / potential-duplicate filters were counted, never stored "
                                                   "(snapshot activity_exclusions); they have no record here."}
    return {"run": run, "links": sorted(links.values(), key=lambda l: l["link_id"]),
            "records": sorted(records.values(), key=lambda r: r["assay_record_id"]), "contributions": contrib, "report": report}


def export(t: dict) -> Path:
    folder = OUT / t["run"]["run_id"]
    folder.mkdir(parents=True, exist_ok=True)
    for name, rows in (("species_compound_link", t["links"]), ("bioassay_record", t["records"]), ("score_contribution", t["contributions"])):
        with open(folder / f"{name}.csv", "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
    (folder / "score_run.json").write_text(json.dumps(t["run"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return folder


def recompute(contributions: list[dict]) -> dict[int, float]:
    """Species MBPI from the included value rows alone."""
    best = {}
    for c in contributions:
        if c["included"] and c["record_role"] == "value":
            best[c["aphia_id"]] = max(best.get(c["aphia_id"], -1), c["contribution_value"])
    return {a: b.round1(v) for a, v in best.items()}


# ---------- explain ------------------------------------------------------------------

def explain(t: dict, aphia: int) -> str:
    s = next((s for s in all_species(t["report"]) if s["aphia_id"] == aphia), None)
    b.require(s is not None, f"{aphia}: not a species of run {t['run']['run_id']}")
    rec = {r["assay_record_id"]: r for r in t["records"]}
    links = {l["link_id"]: l for l in t["links"]}
    rows = [c for c in t["contributions"] if c["aphia_id"] == aphia]
    mbpi = s["scores"]["MBPI"]
    lines = [f"{s.get('korean_name') or ''} {s['scientific_name']} (AphiaID {aphia}) · MBPI {mbpi if mbpi is not None else '산출 보류'}"
             f" · run {t['run']['run_id']} ({t['run']['git_commit']})", f"  규칙: {AGGREGATION}"]
    items = defaultdict(list)
    for c in rows:
        if c["included"]:
            items[c["item_id"]].append(c)
    order = sorted(items, key=lambda i: -items[i][0]["contribution_value"])
    for n, iid in enumerate(order):
        first, last = items[iid][0], n == len(order) - 1
        star = "★ 최댓값 = MBPI " if abs(b.round1(first["contribution_value"]) - (mbpi or -1)) < 1e-9 and n == 0 else ""
        bar, pad = ("└─", "   ") if last else ("├─", "│  ")
        lines.append(f"{bar} {star}{first['compound_key']}  층 {first['stratum_key']}")
        lines.append(f"{pad} 값 {first['item_value']} → 백분위 {first['percentile_in_stratum']} × 근거 {first['evidence_weight']} "
                     f"({first['evidence_detail']}) = {first['contribution_value']:.3f}")
        link = links.get(first["link_id"])
        if link:
            urls = [f"https://doi.org/{d}" for d in link["reference_doi_or_pmid"].split(";") if d.startswith("10.")]
            ids = ([f"https://www.ebi.ac.uk/chembl/explore/compound/{link['chembl_id']}"] if link["chembl_id"] else []) + \
                  [f"https://pubchem.ncbi.nlm.nih.gov/compound/{c}" for c in link["pubchem_cid"].split(";") if c]
            lines.append(f"{pad} 연결: {link['link_source']} · {link['link_type']} · {link['taxon_match_level']}"
                         f" ({link['original_taxon_name']}){' · 불확실 플래그' if link['uncertain'] else ''}")
            lines += [f"{pad}   {u}" for u in ids + urls]
        for c in items[iid]:
            r = rec[c["assay_record_id"]]
            raw = f"{r['std_type']} {r['std_relation']} {r['std_value']} {r['std_units']}".strip() if r["std_value"] != "" else f"{r['std_type']} pChEMBL"
            lines.append(f"{pad} {'재현' if c['record_role'] == 'replication' else '기록'} {c['assay_record_id']} · {r['target_name'] or r['target_id']} · "
                         f"{raw} → p {r['pchembl_value']} ({r['conversion_method']}) · {r['source_version']} 조회 {r['retrieved_at']}")
            lines.append(f"{pad}   {r['url']}")
    excluded = Counter(c["exclusion_reason"].split(":")[0] for c in rows if not c["included"])
    if excluded:
        lines.append("제외 기록 (점수 미사용, 삭제하지 않음): " + ", ".join(f"{k} {v}건" for k, v in excluded.most_common()))
    if not order:
        lines.append(f"점수 기여 항목 없음 · 보류 사유 {s['withheld_reasons'].get('MBPI')}")
    return "\n".join(lines)


# ---------- runs, diff and changelog ---------------------------------------------------

def published_runs() -> list[dict]:
    """Every published run, oldest first: the latest commit of each method_version of dist/assessments.json."""
    runs = {}
    entries = git("log", "--format=%H %cs", "--", REPORT_PATH).strip().splitlines()
    for line in reversed(entries):
        commit, day = line.split()
        version = json.loads(git("show", f"{commit}:{REPORT_PATH}")).get("method_version", "unknown")
        runs.pop(version, None)
        runs[version] = {"run_id": version, "commit": commit, "date": day}
    return list(runs.values())


def load_run(run: str) -> tuple[dict, str]:
    hit = next((r for r in published_runs() if r["run_id"] == run), None)
    commit = hit["commit"] if hit else git("rev-parse", run).strip()
    return json.loads(git("show", f"{commit}:{REPORT_PATH}")), commit


def view(report: dict) -> dict:
    out = {}
    for s in all_species(report):
        items = {}
        for i in s.get("bioactivity_trace") or []:
            stratum = i["stratum_id"].split(":", 1)[1] if kind(i) == "chembl" else i["stratum_id"]
            items[(kind(i), compound_key(i), stratum)] = i
        out[s["aphia_id"]] = {"name": f"{s.get('korean_name') or ''}({s['scientific_name']})".lstrip("("),
                              "MBPI": s["scores"].get("MBPI"), "items": items, "floor": bool(s.get("mbpi_floor"))}
    return out


def item_changes(a: dict | None, b_: dict | None) -> list[tuple[str, str, str, str]]:
    """(change_type, old_value, new_value, reason) for one item present in either run."""
    if a is None:
        return [("evidence", "", f"{item_value(b_)} @ {b_['percentile']}", f"항목 추가 (기록 {len(record_ids(b_))}건)")]
    if b_ is None:
        return [("evidence", f"{item_value(a)} @ {a['percentile']}", "", f"항목 제거 (기록 {len(record_ids(a))}건)")]
    out = []
    ra, rb = set(record_ids(a)), set(record_ids(b_))
    rel = lambda i: i["stratum_id"].split(":")[0] if kind(i) == "chembl" else None
    if ra != rb:
        out.append(("version" if rel(a) != rel(b_) else "evidence", f"{len(ra)}건", f"{len(rb)}건",
                    f"시험 기록 +{len(rb - ra)} −{len(ra - rb)}" + (f" ({rel(a)} → {rel(b_)})" if rel(a) != rel(b_) else "")))
    ids = lambda i: (i.get("inchikeys"), i.get("pubchem_cids"), i.get("compound_id"))
    if ids(a) != ids(b_):
        out.append(("identifier", str(ids(a)), str(ids(b_)), "화합물 식별자 (InChIKey/CID/ChEMBL parent) 변경"))
    conv = lambda i: [(m.get("unit"), m.get("converted_from")) for m in i.get("measurements", [])]
    if item_value(a) != item_value(b_) and ra == rb or conv(a) != conv(b_):
        out.append(("conversion", str(item_value(a)), str(item_value(b_)), "같은 기록의 환산값 또는 단위 변환 변경"))
    peers = lambda i: i.get("cohort_records") or i.get("peer_peptides") or i.get("peer_compounds")
    if a["percentile"] != b_["percentile"] and item_value(a) == item_value(b_):
        out.append(("version", str(a["percentile"]), str(b_["percentile"]), f"비교집단 변경: {peers(a)} → {peers(b_)}건, 백분위 {a['percentile']} → {b_['percentile']}"))
    if a["evidence_factor"] != b_["evidence_factor"]:
        dois = lambda i: len(i.get("independent_dois") or i.get("original_paper_dois") or [])
        out.append(("evidence", str(a["evidence_factor"]), str(b_["evidence_factor"]),
                    f"근거 가중 {a['evidence_factor']} → {b_['evidence_factor']} (독립 논문 {dois(a)} → {dois(b_)})"))
    if not out and a["adjusted"] != b_["adjusted"]:
        out.append(("method", str(a["adjusted"]), str(b_["adjusted"]), "같은 기록·값·비교집단에서 기여값 변경 (계산 규칙)"))
    return out


def compare(old: dict, new: dict, from_run: str, to_run: str) -> list[dict]:
    """Changelog entries between two published reports. A score change with no item difference is 'unexplained'."""
    va, vb, entries = view(old), view(new), []

    def entry(etype, eid, ctype, os_, ov, ns, nv, reason, sa=None, sb=None):
        delta = round(sb - sa, 1) if sa is not None and sb is not None else None
        entries.append({"change_id": f"{to_run}#{len(entries) + 1:04d}", "entity_type": etype, "entity_id": eid, "change_type": ctype,
                        "old_source": os_, "old_value": ov, "new_source": ns, "new_value": nv, "reason": reason, "run_id": to_run,
                        "from_run_id": from_run, "score_before": sa, "score_after": sb, "score_delta": delta})

    for sid in sorted(set(old.get("sources", {})) & set(new.get("sources", {}))):
        x, y = old["sources"][sid].get("version"), new["sources"][sid].get("version")
        if x != y:
            entry("source", sid, "version", sid, x, sid, y, "자료원 릴리스/조회 버전 변경")
    for aphia in sorted(set(va) | set(vb)):
        sa, sb = va.get(aphia, {}).get("MBPI"), vb.get(aphia, {}).get("MBPI")
        ia, ib = va.get(aphia, {}).get("items", {}), vb.get(aphia, {}).get("items", {})
        before = len(entries)
        for key in sorted(set(ia) | set(ib), key=str):
            a, c = ia.get(key), ib.get(key)
            for ctype, ov, nv, why in item_changes(a, c):
                scope = "" if aphia in va else "종이 실행 범위에 추가됨 · "
                entry("assay", f"{aphia}|{key[0]}|{key[1]}|{key[2]}", ctype, a and a["stratum_id"] or "", ov, c and c["stratum_id"] or "", nv,
                      scope + why, sa, sb)
        if sa != sb and len(entries) == before and vb.get(aphia, {}).get("floor"):  # 4.3: no item in any stratum -> labelled floor
            entry("species", str(aphia), "fallback", "", str(sa), "mbpi_floor", str(sb), "MBPI 하한값 규칙(4.3 사전 등록 1.5): 어느 층에도 항목 없음", sa, sb)
        elif sa != sb and len(entries) == before:
            entry("species", str(aphia), "unexplained", "", str(sa), "", str(sb), "점수 변화와 연결된 항목 변경 없음", sa, sb)
    return entries


def name_of(aphia: int, *reports: dict) -> str:
    for r in reports:
        hit = view(r).get(aphia)
        if hit:
            return hit["name"]
    return str(aphia)


def diff_markdown(old: dict, new: dict, entries: list[dict], from_run: str, to_run: str) -> str:
    va, vb = view(old), view(new)
    changed = sorted({a for a in set(va) | set(vb) if va.get(a, {}).get("MBPI") != vb.get(a, {}).get("MBPI")},
                     key=lambda a: -abs((vb.get(a, {}).get("MBPI") or 0) - (va.get(a, {}).get("MBPI") or 0)))
    by_species = defaultdict(list)
    for e in entries:
        if e["entity_type"] != "source":
            by_species[int(e["entity_id"].split("|")[0])].append(e)
    show = lambda v: "산출 보류" if v is None else f"{v:.1f}"
    out = [f"# 자료원·근거 변경과 MBPI 영향: {from_run} → {to_run}", "",
           f"`python scripts/lineage.py diff --from {from_run} --to {to_run}`로 생성. 변경 유형: "
           + ", ".join(f"`{k}` {v}" for k, v in CHANGE_TYPES.items()) + ".", "",
           f"MBPI가 바뀐 종 {len(changed)}개 (|변화| 큰 순), 변경 항목 {len(entries)}건.", ""]
    for a in changed:
        sa, sb = va.get(a, {}).get("MBPI"), vb.get(a, {}).get("MBPI")
        es = by_species[a]
        kinds = ", ".join(CHANGE_TYPES[k] for k in sorted({e["change_type"] for e in es}))
        out.append(f"- **{name_of(a, new, old)}** MBPI {show(sa)}→{show(sb)}: {kinds} — "
                   + "; ".join(f"{e['entity_id'].split('|', 2)[2] if e['entity_type'] == 'assay' else '종 전체'}: {e['reason']} [{e['change_id']}]" for e in es[:4])
                   + (f" 외 {len(es) - 4}건" if len(es) > 4 else ""))
    src = [e for e in entries if e["entity_type"] == "source"]
    if src:
        out += ["", "## 자료원 버전 변경", ""] + [f"- `{e['entity_id']}`: {e['old_value']} → {e['new_value']} [{e['change_id']}]" for e in src]
    note = (new.get("method") or {}).get("changes_from")
    if note:
        out += ["", "## 이 실행의 변경 설명 (config `changes_from`)", "", note]
    return "\n".join(out) + "\n"


def changelog() -> dict:
    runs, cache = published_runs(), {}
    load = lambda r: cache.setdefault(r["commit"], json.loads(git("show", f"{r['commit']}:{REPORT_PATH}")))
    pairs = []
    for x, y in zip(runs, runs[1:]):
        old, new = load(x), load(y)
        pairs.append({"from_run_id": x["run_id"], "to_run_id": y["run_id"], "from_commit": x["commit"][:7], "to_commit": y["commit"][:7],
                      "published_on": y["date"], "method_note": (new.get("method") or {}).get("changes_from"),
                      "entries": compare(old, new, x["run_id"], y["run_id"])})
    return {"about": "Machine-readable record of every published MBPI change: python scripts/lineage.py changelog. "
                     "change_type: " + ", ".join(f"{k} ({v})" for k, v in CHANGE_TYPES.items()),
            "runs": pairs}


# ---------- validation -----------------------------------------------------------------

def checks(t: dict, log: dict | None) -> list[dict]:
    report, run = t["report"], t["run"]["run_id"]
    recs = {r["assay_record_id"]: r for r in t["records"]}
    link_ids = {l["link_id"] for l in t["links"]}
    out = []

    def check(name, failures, total, note=""):
        out.append({"check": name, "total": total, "failures": failures, "passed": not failures, "note": note})

    got = recompute(t["contributions"])
    for s in all_species(report):  # 4.3: a floor MBPI has no contribution row; its value is the rule's floor
        if s.get("mbpi_floor") and s["aphia_id"] not in got:
            got[s["aphia_id"]] = s["mbpi_floor"]["value"]
    check("1. 재현성: 포함 기여 행으로 재계산한 MBPI == 발행 MBPI",
          [f"{s['aphia_id']}: {got.get(s['aphia_id'])} != {s['scores']['MBPI']}" for s in all_species(report)
           if got.get(s["aphia_id"]) != s["scores"]["MBPI"]], len(all_species(report)))
    check("2. 참조 무결성: 기여 행 → bioassay_record, species_compound_link",
          [f"{c['aphia_id']} {c['assay_record_id']}" for c in t["contributions"]
           if c["assay_record_id"] not in recs or (c["included"] and c["link_id"] not in link_ids)], len(t["contributions"]))
    check("3. 출처 필수: source_db, source_record_id, retrieved_at",
          [r["assay_record_id"] for r in t["records"] if not (r["source_db"] and r["source_record_id"] and r["retrieved_at"])], len(t["records"]))
    strata, bad = defaultdict(dict), []
    for c in t["contributions"]:
        if c["included"] and c["record_role"] == "value":
            strata[c["stratum_key"]][c["item_id"]] = (c["item_value"], c["percentile_in_stratum"])
    for key, items in strata.items():
        pts = sorted(items.values())
        bad += [f"{key}: percentile {p}" for _, p in pts if not 0 <= p <= 100]
        bad += [f"{key}: {x} @ {p} vs {y} @ {q}" for (x, p), (y, q) in zip(pts, pts[1:]) if x < y and p > q or x == y and p != q]
    check("4. 층 일관성: 백분위 0–100, 층 안 순위 == p값 순서", bad, len(strata),
          "항암 층은 비교집단에서 자기 자신을 뺀 백분위라 같은 값의 순위가 항목마다 다를 수 있다." if any("anticancer" in k for k in strata) else "")
    if log is None:
        check("5. 변경 기록 완전성", ["source_changelog.json 없음"], 0)
    else:
        missing = [f"{p['to_run_id']} {e['entity_id']}: {e['score_before']} → {e['score_after']}" for p in log["runs"]
                   for e in p["entries"] if e["change_type"] == "unexplained"]
        latest = log["runs"][-1]["to_run_id"] if log["runs"] else None
        if latest != run:
            missing.append(f"changelog의 마지막 실행 {latest} != 현재 실행 {run}: `python scripts/lineage.py changelog` 재실행 필요")
        check("5. 변경 기록 완전성: 점수가 바뀐 모든 종이 변경 항목과 연결됨 (설명 안 됨 0건)", missing,
              sum(len(p["entries"]) for p in log["runs"]), f"실행 쌍 {len(log['runs'])}개")
    names = {s["scientific_name"] for s in all_species(report)}
    present = [c for c in CASES if c in names]
    case_note = ("사후 검증 기원종이 이 실행에 없다 (posthoc-3.27 별도 스냅샷에서만 점수화). 스모크 테스트 skip."
                 if not present else "")
    failures = [c for c in present if "https://" not in explain(t, next(s["aphia_id"] for s in all_species(report) if s["scientific_name"] == c))]
    check("6. 사후 검증 사례 스모크 (ziconotide·trabectedin·eribulin 기원종)", failures, len(present), case_note)
    return out


def validation_markdown(t: dict, results: list[dict]) -> str:
    run = t["run"]
    out = [f"# 계보 검증: {run['run_id']} ({run['git_commit']})", "",
           f"`python scripts/lineage.py validate`로 생성. 종-화합물 연결 {len(t['links'])}건, 시험 기록 {len(t['records'])}건, "
           f"기여 행 {len(t['contributions'])}건 (포함 {sum(c['included'] for c in t['contributions'])}건).", "",
           "| 검사 | 결과 | 대상 | 실패 |", "| --- | --- | ---: | ---: |"]
    for r in results:
        state = "SKIP" if r["total"] == 0 and not r["failures"] and r["note"] else "PASS" if r["passed"] else "FAIL"
        out.append(f"| {r['check']} | {state} | {r['total']} | {len(r['failures'])} |")
    for r in results:
        if r["failures"] or r["note"]:
            out += ["", f"## {r['check']}", ""] + ([r["note"], ""] if r["note"] else []) + [f"- {f}" for f in r["failures"][:50]]
    reasons = Counter(c["exclusion_reason"].split(":")[0] for c in t["contributions"] if not c["included"])
    flagged = sum(l["uncertain"] for l in t["links"] if l["link_status"].startswith("accepted"))
    out += ["", "## 제외 기록 사유 (삭제하지 않고 included=false로 보존)", ""] + [f"- {k}: {v}건" for k, v in reasons.most_common()]
    out += ["", f"채택된 종-화합물 연결 중 불확실 플래그(추정 연결·동의어/하위 분류군 일치): {flagged}건. 점수에서 빼지 않고 정보충분도 판단용으로 남긴다."]
    return "\n".join(out) + "\n"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("export")
    e = sub.add_parser("explain")
    e.add_argument("--aphia", type=int, required=True)
    e.add_argument("--json", action="store_true")
    d = sub.add_parser("diff")
    d.add_argument("--from", dest="old", required=True)
    d.add_argument("--to", dest="new", required=True)
    sub.add_parser("changelog")
    sub.add_parser("validate")
    args = p.parse_args()
    if args.cmd == "diff":
        (old, _), (new, _) = load_run(args.old), load_run(args.new)
        x, y = old["method_version"], new["method_version"]
        entries = compare(old, new, x, y)
        REPORTS.mkdir(exist_ok=True)
        path = REPORTS / f"source_changes_{y}.md"
        path.write_text(diff_markdown(old, new, entries, x, y), encoding="utf-8")
        print(f"{len(entries)} changes; wrote {path.relative_to(ROOT)}")
        return
    if args.cmd == "changelog":
        log = changelog()
        CHANGELOG.parent.mkdir(parents=True, exist_ok=True)
        CHANGELOG.write_text(json.dumps(log, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{len(log['runs'])} run pairs, {sum(len(r['entries']) for r in log['runs'])} entries; wrote {CHANGELOG.relative_to(ROOT)}")
        return
    t = tables()
    if args.cmd == "export":
        print(f"wrote {export(t).relative_to(ROOT)}: {len(t['links'])} links, {len(t['records'])} records, {len(t['contributions'])} contributions")
    elif args.cmd == "explain":
        print(json.dumps([c for c in t["contributions"] if c["aphia_id"] == args.aphia], ensure_ascii=False, indent=1)
              if args.json else explain(t, args.aphia))
    else:
        log = json.loads(CHANGELOG.read_text(encoding="utf-8")) if CHANGELOG.exists() else None
        results = checks(t, log)
        REPORTS.mkdir(exist_ok=True)
        path = REPORTS / f"lineage_validation_{t['run']['run_id']}.md"
        path.write_text(validation_markdown(t, results), encoding="utf-8")
        for r in results:
            print(("PASS" if r["passed"] else "FAIL"), r["check"], len(r["failures"]), r["note"])
        print(f"wrote {path.relative_to(ROOT)}")
        if not all(r["passed"] for r in results):
            sys.exit(1)


if __name__ == "__main__":
    main()
