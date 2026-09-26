"""Collect a safe OBIS query audit for all 22 candidates; never release locations.

The endpoint is queried at size=0, so counts are search hits, not reviewed
occurrences. A per-species error is recorded distinctly from a zero result.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json
import time

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "dist/candidate-catalog.json"
OUTPUT = ROOT / "tmp/expansion-30/obis-summary.json"
GEOMETRY = "POLYGON ((124 33, 132 33, 132 38.7, 124 38.7, 124 33))"


def fetch(url):
    for attempt in range(2):
        try:
            with urlopen(Request(url, headers={"User-Agent": "BlueBioMap-research-audit/0.3"}), timeout=25) as response:
                return json.load(response)
        except Exception:
            if attempt:
                raise
            time.sleep(1)


def audit(item):
    aid, name = item["aphiaID"], item["name"]
    taxon_url = f"https://www.marinespecies.org/rest/AphiaRecordByAphiaID/{aid}"
    url = "https://api.obis.org/v3/occurrence?" + urlencode({
        "taxonid": aid, "geometry": GEOMETRY, "size": 0
    })
    result = {"aphiaID": aid, "name": name, "taxonomyUrl": taxon_url,
              "queryUrl": url, "queriedAt": datetime.now(timezone.utc).isoformat(),
              "scope": "124–132°E, 33–38.7°N; OBIS taxonid including descendants; count only",
              "reportedTotal": None, "status": "collection_failed",
              "publicCellCount": 0, "limitations": "No individual record, license, duplicate, coordinate or sensitivity review; no location released."}
    try:
        taxon = fetch(taxon_url)
        if not (isinstance(taxon, dict) and taxon.get("AphiaID") == aid
                and taxon.get("scientificname") == name and taxon.get("status") == "accepted"
                and taxon.get("rank") == "Species"):
            result["status"] = "taxonomy_review_required"
            return result
        response = fetch(url)
        count = response.get("total")
        if not isinstance(count, int) or count < 0 or response.get("results") != []:
            result["status"] = "response_review_required"
            return result
        result["reportedTotal"] = count
        result["status"] = "zero_for_scope" if count == 0 else "query_count_unreviewed"
    except Exception as error:
        result["errorType"] = type(error).__name__
    return result


def main():
    species = json.loads(CATALOG.read_text(encoding="utf-8"))["species"]
    if len(species) != 22 or len({x["aphiaID"] for x in species}) != 22:
        raise ValueError("Expected exactly 22 distinct candidates")
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = {pool.submit(audit, x): x["aphiaID"] for x in species}
        by_id = {jobs[job]: job.result() for job in as_completed(jobs)}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"schemaVersion": "obis-count-audit-1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "species": [by_id[x["aphiaID"]] for x in species]},
        ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for x in species:
        row = by_id[x["aphiaID"]]
        print(x["aphiaID"], row["status"], row["reportedTotal"])


if __name__ == "__main__":
    main()
