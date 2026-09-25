"""Research-only OBIS/WoRMS audit for the 22 taxonomy candidates.

Writes into tmp/ only. It NEVER changes dist/, the public DB, or visible map cells.
Run from the repository root: python scripts/collect_expansion_research.py
"""
from __future__ import annotations

import collections
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "dist" / "candidate-catalog.json"
OUT = ROOT / "tmp" / "expansion-30"
GEOMETRY = "POLYGON ((124 33, 132 33, 132 38.7, 124 38.7, 124 33))"


def get(url: str) -> dict | list:
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={
                "User-Agent": "BlueBioMap-research-audit/0.1 (noncommercial research)"
            }), timeout=45) as response:
                return json.load(response)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def audit(candidate: dict) -> dict:
    aid = candidate["aphiaID"]
    taxon = get(f"https://www.marinespecies.org/rest/AphiaRecordByAphiaID/{aid}")
    if (not isinstance(taxon, dict) or taxon.get("status") != "accepted"
            or taxon.get("rank") != "Species"
            or taxon.get("scientificname") != candidate["name"]):
        return {"aphiaID": aid, "name": candidate["name"],
                "status": "taxonomy_review_required", "reported": {
                    "status": taxon.get("status") if isinstance(taxon, dict) else None,
                    "rank": taxon.get("rank") if isinstance(taxon, dict) else None,
                    "name": taxon.get("scientificname") if isinstance(taxon, dict) else None,
                }}
    url = "https://api.obis.org/v3/occurrence?" + urlencode({
        "taxonid": aid, "geometry": GEOMETRY, "size": 1000
    })
    response = get(url)
    records = response.get("results")
    if not isinstance(records, list):
        raise ValueError(f"OBIS response missing results for {aid}")
    (OUT / f"{aid}-raw.json").write_text(
        json.dumps(response, ensure_ascii=False), encoding="utf-8")
    datasets = {}
    reasons = collections.Counter()
    for record in records:
        did = record.get("dataset_id")
        if not did:
            reasons["dataset_id_missing"] += 1
            continue
        if did not in datasets:
            try:
                meta = get(f"https://api.obis.org/v3/dataset/{quote(str(did))}")
                datasets[did] = (meta.get("results") or [{}])[0]
            except Exception:
                datasets[did] = {"metadata_error": True}
        rights = str(datasets[did].get("intellectualrights") or "")
        if not rights:
            reasons["license_missing"] += 1
        if record.get("speciesid") != aid:
            reasons["taxon_mismatch"] += 1
        if record.get("decimalLatitude") is None or record.get("decimalLongitude") is None:
            reasons["coordinates_missing"] += 1
    (OUT / f"{aid}-datasets.json").write_text(
        json.dumps(datasets, ensure_ascii=False), encoding="utf-8")
    return {"aphiaID": aid, "name": candidate["name"], "status": "research_only",
            "queried_at": datetime.now(timezone.utc).isoformat(),
            "query_url": url, "reported_total": response.get("total"),
            "retrieved": len(records), "truncated": (response.get("total") or 0) > len(records),
            "datasets": [{"id": did, "title": m.get("title"),
                          "intellectualrights": m.get("intellectualrights"),
                          "metadata_error": bool(m.get("metadata_error"))}
                         for did, m in datasets.items()], "review_flags": dict(reasons),
            "release_decision": "withheld_pending_license_taxon_coordinate_sensitivity_review"}


def main() -> None:
    candidates = json.loads(CATALOG.read_text(encoding="utf-8"))["species"]
    if len(candidates) != 22 or len({s["aphiaID"] for s in candidates}) != 22:
        raise ValueError("expected 22 distinct candidates")
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    for c in candidates:
        try:
            item = audit(c)
        except Exception as error:
            item = {"aphiaID": c["aphiaID"], "name": c["name"],
                    "status": "collection_failed", "error_type": type(error).__name__}
        report.append(item)
        print(f'{c["aphiaID"]} {item["status"]}', flush=True)
        (OUT / "audit.json").write_text(json.dumps({
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "scope": "research only; no public occurrence cells or indicator scores",
            "species": report
        }, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
