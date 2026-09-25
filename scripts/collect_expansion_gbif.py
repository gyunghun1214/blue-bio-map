"""Research-only GBIF audit. Raw records stay in local tmp/, never in dist/."""
import collections
import concurrent.futures
import datetime
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
CATALOG = json.loads((BASE / "dist/candidate-catalog.json").read_text())["species"]
ROOT = BASE / "tmp/expansion-30/gbif"
ROOT.mkdir(parents=True, exist_ok=True)
SOURCE = "https://api.gbif.org/v1/occurrence/search"
SCOPE = {"decimalLatitude": "33,38.7", "decimalLongitude": "124,132", "hasCoordinate": "true"}
LAND = json.loads((BASE / "dist/countries.json").read_text())["features"]
REJECT_ISSUES = {"ZERO_COORDINATE", "COORDINATE_OUT_OF_RANGE", "COORDINATE_INVALID",
                 "COORDINATE_UNCERTAINTY_METERS_INVALID", "COUNTRY_COORDINATE_MISMATCH",
                 "TAXON_MATCH_HIGHERRANK", "PRESUMED_NEGATED_LATITUDE", "PRESUMED_NEGATED_LONGITUDE"}
VERIFIED_SYNONYMS = {"Saccharina japonica": {"Laminaria japonica"}}  # WoRMS accepted synonym
ALLOW_LICENSE = {"http://creativecommons.org/publicdomain/zero/1.0/legalcode": "CC0 1.0",
                 "http://creativecommons.org/licenses/by/4.0/legalcode": "CC BY 4.0"}


def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={
                "User-Agent": "BlueBioMap-research-audit/0.2 (noncommercial research)"
            }), timeout=50) as resp:
                return json.load(resp)
        except Exception:
            if i == 2:
                raise
            time.sleep(1 + 2 * i)


def ring_contains(ring, x, y):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > y) != (yj > y)) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def on_land(lon, lat):
    for feature in LAND:
        geo = feature["geometry"]
        polygons = geo["coordinates"] if geo["type"] == "MultiPolygon" else [geo["coordinates"]]
        for rings in polygons:
            if rings and ring_contains(rings[0], lon, lat) and not any(
                ring_contains(hole, lon, lat) for hole in rings[1:]
            ):
                return True
    return False


def audit(species):
    name = species["name"]
    params = {"scientificName": name, **SCOPE, "limit": 300}
    rows = []
    expected = None
    for offset in range(0, 200000, 300):
        url = SOURCE + "?" + urllib.parse.urlencode({**params, "offset": offset})
        page = get(url)
        if expected is None:
            expected = page["count"]
        rows.extend(page["results"])
        if page["endOfRecords"] or not page["results"]:
            break
    truncated = expected != len(rows)
    # Restricted raw: contains exact coordinates and occurrence IDs.
    (ROOT / f'{species["aphiaID"]}-raw.json').write_text(
        json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    reasons = collections.Counter()
    datasets = {}
    cells = collections.Counter()
    seen = set()
    for row in rows:
        ds = row.get("datasetKey")
        if ds:
            d = datasets.setdefault(ds, {"key": ds, "url": "https://www.gbif.org/dataset/" + ds,
                                         "title": row.get("datasetName"), "licenses": set(),
                                         "retrieved": 0, "eligible": 0})
            d["retrieved"] += 1
            d["licenses"].add(row.get("license") or "unreported")
        key = row.get("key")
        if key is None or key in seen:
            reasons["duplicate_or_missing_record_key"] += 1
            continue
        seen.add(key)
        if row.get("species") not in ({name} | VERIFIED_SYNONYMS.get(name, set())) or row.get("taxonRank") not in ("SPECIES", "SUBSPECIES", "VARIETY"):
            reasons["species_mismatch"] += 1
            continue
        if row.get("occurrenceStatus") != "PRESENT":
            reasons["absence_or_unknown_status"] += 1
            continue
        if row.get("license") not in ALLOW_LICENSE:
            reasons["license_not_public"] += 1
            continue
        lat, lon = row.get("decimalLatitude"), row.get("decimalLongitude")
        if (not isinstance(lat, (int, float)) or not isinstance(lon, (int, float))
                or not (33 <= lat <= 38.7 and 124 <= lon <= 132)):
            reasons["coordinates_missing_or_outside_scope"] += 1
            continue
        if set(row.get("issues") or []) & REJECT_ISSUES:
            reasons["coordinate_or_taxon_issue"] += 1
            continue
        uncertainty = row.get("coordinateUncertaintyInMeters")
        if uncertainty is None or not isinstance(uncertainty, (int, float)) or uncertainty < 0:
            reasons["uncertainty_unknown"] += 1
            continue
        if uncertainty > 10000:
            reasons["uncertainty_above_10km"] += 1
            continue
        if on_land(lon, lat):
            reasons["land_coordinate"] += 1
            continue
        if not row.get("eventDate"):
            reasons["event_date_missing"] += 1
            continue
        if not ds:
            reasons["dataset_missing"] += 1
            continue
        reasons["eligible_pre_sensitivity"] += 1
        datasets[ds]["eligible"] += 1
        cells[f'N{math.floor(lat)}E{math.floor(lon)}'] += 1
    assert sum(reasons.values()) == len(rows), (name, reasons, len(rows))
    for d in datasets.values():
        d["licenses"] = sorted(d["licenses"])
    return {"aphiaID": species["aphiaID"], "name": name,
            "queried_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "url": SOURCE + "?" + urllib.parse.urlencode({**params, "limit": 0}),
            "scope": SCOPE, "reported_total": expected, "retrieved": len(rows),
            "truncated": truncated, "exclusion_counts": dict(reasons),
            "datasets": sorted(datasets.values(), key=lambda d: -d["retrieved"]),
            "preliminary_cell_count": len(cells),
            "release_decision": "withheld_pending_sensitivity_and_independent_coordinate_review"}


def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(audit, s): s for s in CATALOG}
        result = []
        for future in concurrent.futures.as_completed(futures):
            s = futures[future]
            try:
                entry = future.result()
            except Exception as e:
                entry = {"aphiaID": s["aphiaID"], "name": s["name"],
                         "error": type(e).__name__ + ": " + str(e)[:120],
                         "release_decision": "collection_failed"}
            result.append(entry)
            print(s["name"], entry.get("retrieved", entry.get("error")), flush=True)
            (ROOT / "summary.json").write_text(json.dumps(
                {"generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                 "method": "research only; no public release; raw in ignored local tmp/",
                 "species": sorted(result, key=lambda x: x["aphiaID"])},
                ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Preserve dataset-level rights separately from the rights of individual records.
    keys = {d["key"] for item in result for d in item.get("datasets", [])}
    def dataset_meta(key):
        try:
            r = get("https://api.gbif.org/v1/dataset/" + key)
            return key, {"title": r.get("title"), "license": r.get("license"),
                         "doi": r.get("doi"), "url": "https://www.gbif.org/dataset/" + key}
        except Exception as e:
            return key, {"error": type(e).__name__}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        metadata = dict(pool.map(dataset_meta, keys))
    for item in result:
        for d in item.get("datasets", []):
            d["metadata"] = metadata[d["key"]]
    (ROOT / "summary.json").write_text(json.dumps({
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "method": "Research only. Published cells require additional sensitivity, source and duplicate review.",
        "species": sorted(result, key=lambda x: x["aphiaID"])},
        ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
