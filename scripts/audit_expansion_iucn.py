"""Audit IUCN-published GBIF checklist, do not infer official NE from absence."""
import concurrent.futures
import datetime
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
CATALOG = json.loads((BASE / "dist/candidate-catalog.json").read_text())["species"]
DATASET = "19491596-35ae-4a91-9a98-85cf505f1bd3"
ROOT = "https://api.gbif.org/v1/"


def get(path):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(ROOT + path, headers={
                "User-Agent": "BlueBioMap-iucn-audit/0.1"}), timeout=45) as response:
                return json.load(response)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def audit(s):
    name = s["name"]
    path = "species?" + urllib.parse.urlencode({"datasetKey": DATASET, "name": name, "limit": 100})
    data = get(path)
    matches = [r for r in data.get("results", []) if r.get("canonicalName") == name
               and r.get("rank") == "SPECIES" and r.get("taxonomicStatus") == "ACCEPTED"
               and r.get("datasetKey") == DATASET]
    if not matches:
        return {"aphiaID": s["aphiaID"], "name": name,
                "status": "no_exact_accepted_match_in_checklist",
                "search_url": ROOT + path, "record": None,
                "note": "No exact match is not an official NE assessment."}
    if len(matches) != 1:
        return {"aphiaID": s["aphiaID"], "name": name,
                "status": "ambiguous_checklist_matches", "count": len(matches),
                "search_url": ROOT + path, "record": None}
    record = matches[0]
    key = record["key"]
    distributions = get(f"species/{key}/distributions")
    global_rows = [r for r in distributions.get("results", [])
                   if r.get("locality") == "Global"]
    status = "global_category_found" if len(global_rows) == 1 else "global_category_needs_review"
    r = global_rows[0] if len(global_rows) == 1 else {}
    return {"aphiaID": s["aphiaID"], "name": name, "status": status,
            "checklist_record_url": ROOT + f"species/{key}",
            "checklist_distribution_url": ROOT + f"species/{key}/distributions",
            "record": {"taxonID": record.get("taxonID"), "scientificName": record.get("scientificName"),
                       "reference": record.get("references"), "locality": r.get("locality"),
                       "category": r.get("threatStatus"), "citation": r.get("source")},
            "note": "IUCN-published checklist is assessment metadata; original assessment criteria/date/content are not independently reviewed."}


def main():
    output = []
    dest=BASE / "tmp/expansion-30/iucn-audit.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(audit, s): s for s in CATALOG}
        for future in concurrent.futures.as_completed(futures):
            s = futures[future]
            try:
                item = future.result()
            except Exception as e:
                item = {"aphiaID": s["aphiaID"], "name": s["name"],
                        "status": "lookup_failed", "record": None,
                        "error": type(e).__name__ + ": " + str(e)[:120]}
            output.append(item)
            print(item["name"], item["status"], flush=True)
            dest.write_text(json.dumps({
                "checked_on": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "source_dataset": "https://www.gbif.org/dataset/" + DATASET,
                "species": sorted(output, key=lambda r: r["aphiaID"])},
                ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
