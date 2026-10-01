"""Refresh research/verified-indices/taxonomy.json for the 8 operating species and the catalog's research candidates
(network, WoRMS AphiaClassificationByAphiaID). The builder reads only the written file.

Usage: PYTHONUTF8=1 python scripts/collect_taxonomy.py
"""
import json
import time
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research" / "verified-indices" / "taxonomy.json"
RANKS = ("phylum", "class", "order", "family", "genus")
UA = {"User-Agent": "BlueBioValueMap-research/1.0 (research@example.org)", "Accept": "application/json"}


def classification(aphia: int) -> dict:
    url = f"https://www.marinespecies.org/rest/AphiaClassificationByAphiaID/{aphia}"
    for wait in (60, 300, 900, None):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                node = json.loads(r.read())
            break
        except OSError:
            if wait is None:
                raise
            time.sleep(wait)
    out = {}
    while node:
        rank = node["rank"].lower().split()[0]  # WoRMS writes algal phyla as "Phylum (Division)"
        if rank in RANKS:
            out[rank] = node["scientificname"]
        node = node.get("child")
    return out


def main() -> None:
    operating = [c["aphia_id"] for c in json.loads((ROOT / "research/verified-indices/candidates.json").read_text(encoding="utf-8"))["candidates"]]
    catalog = [s["aphiaID"] for s in json.loads((ROOT / "dist/candidate-catalog.json").read_text(encoding="utf-8"))["species"]]
    species = {}
    for aphia in operating + catalog:
        species[str(aphia)] = classification(aphia)
        time.sleep(0.5)
    OUT.write_text(json.dumps({"source": "WoRMS AphiaClassificationByAphiaID REST", "retrieved": date.today().isoformat(),
                               "species": species}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {OUT}: {len(species)} species")


if __name__ == "__main__":
    main()
