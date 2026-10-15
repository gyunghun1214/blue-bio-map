"""Build dist/cmnpd-candidates.json: the CMNPD compounds reported for each of the 30 species, display only.

The species profile shows how many compounds CMNPD 1.0 reports for the species ('후보 화합물 탐색 · 점수 미사용'), and the
record keeps how many of those species -> compound pairs reach ChEMBL through the MBPI links (the link gap). MBPI is still
computed from ChEMBL, AHTPDB, DBAASP and CancerPPD only: the indicator build does not read this file, and nothing here enters
MFPI, MBPI, MCUI, BBVI, the matrix, the map colours or a chip. Only CMNPD IDs and counts are published (CC BY-NC-SA 4.0):
no compound name, structure, InChIKey or activity value. Offline.

Usage: python scripts/build_cmnpd_candidates.py [--check]
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RECORD = ROOT / "research/cmnpd/cmnpd-candidates-2026-10-15.json"
DEFAULT_REPORT = ROOT / "dist/assessments.json"
DEFAULT_OUTPUT = ROOT / "dist/cmnpd-candidates.json"
RECORD_SCHEMA = "cmnpd-candidates-record-1"
SCHEMA = "cmnpd-candidates-1"
LINKS = {"same_inchikey", "same_skeleton", "none"}
CMNPD_ID = re.compile(r"^CMNPD\d+$")
CHEMBL_ID = re.compile(r"^CHEMBL\d+$")


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def build(record: dict, report: dict) -> dict:
    require(record.get("schema_version") == RECORD_SCHEMA, "unknown CMNPD record schema")
    source = record["source"]
    require(source.get("license") == "CC BY-NC-SA 4.0" and source.get("license_url", "").startswith("https://"),
            "the CMNPD licence and its link are required")
    species = {s["aphia_id"] for s in report["species"] + report.get("candidate_species", [])}
    rows = record["species"]
    require([r["aphia_id"] for r in rows] == sorted(species), "the record must list each of the report's species once, by AphiaID")
    seen: set[tuple[str, str]] = set()
    out = []
    for r in rows:
        what = str(r["aphia_id"])
        require(isinstance(r.get("names_searched"), int) and r["names_searched"] >= 1, f"{what}: names_searched")
        compounds = r["compounds"]
        require((r["organism_id"] is None) == (not compounds), f"{what}: compounds need an organism ID and vice versa")
        require(r["organism_id"] is None or CMNPD_ID.fullmatch(r["organism_id"]) is not None, f"{what}: organism_id")
        for c in compounds:
            require(set(c) == {"cmnpd_id", "mbpi_link", "mbpi_chembl_id", "cmnpd_chembl_xref"}, f"{what}: only IDs and match results")
            require(CMNPD_ID.fullmatch(c["cmnpd_id"]) is not None and c["mbpi_link"] in LINKS, f"{what} {c['cmnpd_id']}: id or link")
            require(c["mbpi_chembl_id"] is None or (c["mbpi_link"] == "same_inchikey" and CHEMBL_ID.fullmatch(c["mbpi_chembl_id"])),
                    f"{what} {c['cmnpd_id']}: a ChEMBL-linked MBPI pair needs the same InChIKey")
            require(c["cmnpd_chembl_xref"] is None or CHEMBL_ID.fullmatch(c["cmnpd_chembl_xref"]) is not None,
                    f"{what} {c['cmnpd_id']}: cmnpd_chembl_xref")
            require((what, c["cmnpd_id"]) not in seen, f"{what} {c['cmnpd_id']}: listed twice")
            seen.add((what, c["cmnpd_id"]))
        linked = [c for c in compounds if c["mbpi_chembl_id"]]
        out.append({
            "aphia_id": r["aphia_id"],
            "organism_id": r["organism_id"],
            "names_searched": r["names_searched"],
            "compound_count": len(compounds),
            "compound_ids": [c["cmnpd_id"] for c in compounds],
            "mbpi_same_inchikey": sum(c["mbpi_link"] == "same_inchikey" for c in compounds),
            "mbpi_same_skeleton": sum(c["mbpi_link"] == "same_skeleton" for c in compounds),
            "chembl_linked": len(linked),
            "link_gap": len(compounds) - len(linked),
            # CMNPD itself lists a ChEMBL molecule for the compound, but the MBPI links do not reach it from this species
            "chembl_listed_unlinked": [{"cmnpd_id": c["cmnpd_id"], "chembl_id": c["cmnpd_chembl_xref"]}
                                       for c in compounds if c["cmnpd_chembl_xref"] and c["mbpi_chembl_id"] != c["cmnpd_chembl_xref"]],
        })
    total = lambda k: sum(s[k] for s in out)
    return {
        "schema_version": SCHEMA,
        "display_only": True,
        "used_in_scores": False,
        "snapshot_date": record["snapshot_date"],
        "source": {k: source[k] for k in ("provider", "version", "url", "license", "license_url", "citation_doi", "accessed")},
        "method": record["method"],
        "match_rule": record["match_rule"],
        "reference_check": record["reference_check"],
        "totals": {"species": len(out), "species_with_compounds": sum(1 for s in out if s["compound_count"]),
                   "pairs": total("compound_count"), "mbpi_same_inchikey": total("mbpi_same_inchikey"),
                   "mbpi_same_skeleton": total("mbpi_same_skeleton"), "chembl_linked": total("chembl_linked"),
                   "link_gap": total("link_gap"), "chembl_listed_unlinked": sum(len(s["chembl_listed_unlinked"]) for s in out)},
        "species": out,
    }


def render(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, indent=1) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="fail if the committed output differs")
    args = parser.parse_args()
    record = json.loads(DEFAULT_RECORD.read_text(encoding="utf-8"))
    report = json.loads(DEFAULT_REPORT.read_text(encoding="utf-8"))
    text = render(build(record, report))
    if args.check:
        current = DEFAULT_OUTPUT.read_text(encoding="utf-8") if DEFAULT_OUTPUT.exists() else ""
        require(current == text, f"{DEFAULT_OUTPUT.relative_to(ROOT)} is out of date; run scripts/build_cmnpd_candidates.py")
        print(f"{DEFAULT_OUTPUT.relative_to(ROOT)} is up to date")
        return
    DEFAULT_OUTPUT.write_text(text, encoding="utf-8")
    print(f"wrote {DEFAULT_OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
