"""Build dist/replication-search.json: where and when the top MBPI item of each species was searched for an independent
replication, display only.

research/verified-indices/prereg-replication-search-2026-10-15.md 6: the folded MBPI detail of a species says whether its
current top item was searched, on what date and in which sources (a source that would not open is named apart and never
counted as searched). A run that searched another item than the current one (넙치: the 2026-10-13 run searched MEVFVP; its
top item is P35 since 4.13) is shown as 'the current top item not yet searched'. Nothing here enters MFPI, MBPI, MCUI, BBVI,
the matrix, the map colours or a ranking: the indicator build does not read this file. An accepted replication counts only
after it is added to the indicator config as a replication row and the indices are rebuilt, so a run marked 'accepted'
whose species does not show a replicated top item in the report stops the build. Offline.

Usage: python scripts/build_replication_search.py [--check]
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RECORD = ROOT / "research/verified-indices/replication-search-2026-10-15.json"
DEFAULT_REPORT = ROOT / "dist/assessments.json"
DEFAULT_OUTPUT = ROOT / "dist/replication-search.json"
RECORD_SCHEMA = "replication-search-record-1"
SCHEMA = "replication-search-1"
RESULTS = {"searched_none", "accepted"}
SOURCE_STATUS = {"searched", "unavailable"}
DOI = re.compile(r"^10\.\d{4,9}/\S+$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def top_item(species: dict) -> dict | None:
    """The item MBPI is the maximum of: the first of equal items, as in the indicator build."""
    trace = species.get("bioactivity_trace") or []
    if not trace:
        return None
    best = max(trace, key=lambda x: x["adjusted"])
    return {"stratum_id": best["stratum_id"], "molecule": best.get("compound_id") or best.get("peptide_sequence")}


def build(record: dict, report: dict) -> dict:
    require(record.get("schema_version") == RECORD_SCHEMA, "unknown replication-search record schema")
    species = {s["aphia_id"]: s for s in report["species"] + report.get("candidate_species", [])}
    runs = sorted(record["runs"], key=lambda r: r["searched_on"])
    require(len({r["run_id"] for r in runs}) == len(runs), "duplicate run_id")
    seen: dict[int, list[dict]] = {}
    for run in runs:
        require(isinstance(run.get("searched_on"), str) and DATE.fullmatch(run["searched_on"]) is not None
                and run["searched_on"] <= record["snapshot_date"], f"{run.get('run_id')}: searched_on")
        require(all(isinstance(run.get(k), str) and run[k].strip() for k in ("rule", "record", "report_version")),
                f"{run['run_id']}: rule, record and report_version are required")
        ids = [r.get("aphia_id") for r in run["species"]]
        require(len(ids) == len(set(ids)), f"{run['run_id']}: a species is listed twice")
        for r in run["species"]:
            what = f"{run['run_id']} {r.get('aphia_id')}"
            require(r.get("aphia_id") in species, f"{what}: not one of the report's species")
            item = r.get("item") or {}
            require(isinstance(item.get("stratum_id"), str) and isinstance(item.get("molecule"), str) and item["molecule"],
                    f"{what}: the searched item (stratum_id, molecule) is required")
            sources = r.get("sources") or []
            require(sources and all(isinstance(x.get("name"), str) and x["name"].strip() and x.get("status") in SOURCE_STATUS
                                    for x in sources), f"{what}: every source needs a name and searched/unavailable")
            require(len({x["name"] for x in sources}) == len(sources), f"{what}: a source is listed twice")
            require(any(x["status"] == "searched" for x in sources), f"{what}: no source was actually searched")
            require(r.get("result") in RESULTS, f"{what}: result must be one of {sorted(RESULTS)}")
            if r["result"] == "accepted":
                require(isinstance(r.get("accepted_doi"), str) and DOI.fullmatch(r["accepted_doi"]) is not None,
                        f"{what}: an accepted replication needs its DOI")
            else:
                require(r.get("accepted_doi") is None, f"{what}: accepted_doi only with an accepted result")
            seen.setdefault(r["aphia_id"], []).append({**r, "searched_on": run["searched_on"], "run_id": run["run_id"]})
    rows = []
    for aphia, s in sorted(species.items()):
        current = top_item(s)
        state = (s.get("evidence_profile") or {}).get("top_item_replication")
        history = seen.get(aphia, [])
        for h in history:
            if h["result"] == "accepted" and h["item"] == current:
                require(state == "replicated", f"{aphia}: an accepted replication must be added to the indicator config and "
                        "the indices rebuilt before it is published")
        matching = [h for h in history if h["item"] == current]
        last = matching[-1] if matching else None
        status = ("replicated" if state == "replicated" else
                  "searched_none" if last and last["result"] == "searched_none" else
                  "not_current_item" if history else "no_record")
        row = {"aphia_id": aphia, "status": status, "current_item": current,
               "last_searched_on": last["searched_on"] if last else None,
               "sources_searched": [x["name"] for x in last["sources"] if x["status"] == "searched"] if last else [],
               "sources_unavailable": [x["name"] for x in last["sources"] if x["status"] == "unavailable"] if last else [],
               "earlier_item_searched_on": max(h["searched_on"] for h in history if h["item"] != current)
               if status == "not_current_item" else None,
               "runs": [{"run_id": h["run_id"], "searched_on": h["searched_on"], "result": h["result"],
                         "item_is_current": h["item"] == current, "accepted_doi": h.get("accepted_doi")} for h in history]}
        rows.append(row)
    return {"schema_version": SCHEMA, "snapshot_date": record["snapshot_date"], "report_version": report["method_version"],
            "prereg": record["prereg"], "scope_note": record["scope_note"], "display_only": True,
            "runs": [{"run_id": r["run_id"], "searched_on": r["searched_on"], "rule": r["rule"], "record": r["record"],
                      "report_version": r["report_version"], "species_count": len(r["species"])} for r in runs],
            "species": rows}


def render(out: dict) -> str:
    return json.dumps(out, ensure_ascii=False, indent=1) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", type=Path, default=DEFAULT_RECORD)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="compare existing output without writing")
    args = parser.parse_args()
    read = lambda p: json.loads(p.read_text(encoding="utf-8"))
    content = render(build(read(args.record), read(args.report)))
    if args.check:
        require(args.out.read_text(encoding="utf-8") == content, "replication search differs from reproducible build")
        print("Reproducible replication search matches committed output")
    else:
        args.out.write_text(content, encoding="utf-8")
        rows = json.loads(content)["species"]
        counts = {k: sum(r["status"] == k for r in rows) for k in ("searched_none", "not_current_item", "no_record", "replicated")}
        print(f"Wrote {args.out}: {len(rows)} species, {counts}")


if __name__ == "__main__":
    main()
