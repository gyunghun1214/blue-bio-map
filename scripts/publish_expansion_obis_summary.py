"""Attach OBIS count-only audit to public candidate evidence without locations."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp/expansion-30/obis-summary.json"
TARGET = ROOT / "dist/expansion-evidence.json"
ALLOWED = {"collection_failed", "taxonomy_review_required", "response_review_required",
           "zero_for_scope", "query_count_unreviewed"}


def publish(report, evidence):
    rows = report["species"]
    existing = evidence["species"]
    if (report.get("schemaVersion") != "obis-count-audit-1" or len(rows) != 22
            or len(existing) != 22 or {x["aphiaID"] for x in rows} != {x["aphiaID"] for x in existing}
            or len({x["aphiaID"] for x in rows}) != 22):
        raise ValueError("OBIS audit must match the 22 published candidates")
    by_id = {x["aphiaID"]: x for x in rows}
    for species in existing:
        source = by_id[species["aphiaID"]]
        if (source["name"] != species["name"] or source["status"] not in ALLOWED
                or source.get("publicCellCount") != 0):
            raise ValueError("OBIS identity or release status mismatch")
        count = source.get("reportedTotal")
        if source["status"] in ("zero_for_scope", "query_count_unreviewed"):
            if not isinstance(count, int) or count < 0 or (count == 0) != (source["status"] == "zero_for_scope"):
                raise ValueError("Invalid OBIS count")
        elif count is not None:
            raise ValueError("Failed query cannot have a count")
        # Explicit allowlist: raw record fields and coordinates never reach dist/.
        species["obis"] = {key: source.get(key) for key in (
            "status", "reportedTotal", "queriedAt", "taxonomyUrl", "queryUrl", "scope", "limitations", "errorType")}
        species["gbif"]["limitations"] = "GBIF 개별 기록 잠정 필터만 검토. 위치/연도/원기록 ID는 공개하지 않음. OBIS 조회 건수는 별개이며 합산하지 않음."
    evidence["sourceNotes"]["obis"] = "OBIS count-only queries; species-level records, rights, duplicates and precise positions not reviewed; no cells released"
    evidence["obisAuditDate"] = report["generatedAt"][:10]
    return evidence


def main():
    report = json.loads(SOURCE.read_text(encoding="utf-8"))
    evidence = json.loads(TARGET.read_text(encoding="utf-8"))
    updated = publish(report, evidence)
    TARGET.write_text(json.dumps(updated, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("Published 22 count-only OBIS audit states; zero new map cells")


if __name__ == "__main__":
    main()
