"""영어 화면의 종 일반명 사전(dist/species-names-en.json) 만들기 (2026-10-24, 표준 라이브러리만).

대상은 dist/assessments.json의 species + candidate_species(종 수는 자료에서 읽는다). 이름은 지어내지 않고 아래 출처에서만 받는다.
  1. WoRMS 영어 vernacular (REST AphiaVernacularsByAphiaID, language_code 'eng'; isPreferredName이 있으면 그것, 없으면 첫 이름)
  2. FAO ASFIS 영어 이름 (학명이 똑같이 맞는 줄만; ASFIS 파일은 --asfis로 준다)
  3. 둘 다 없으면 비운다 → 영어 화면에는 학명만 보인다.
받은 원본은 research/i18n/에 날짜를 붙여 저장한다(worms-vernaculars-YYYY-MM-DD.json, ASFIS는 쓴 파일의 sha256과 맞춘 줄).
assessments.json의 english_name 필드는 섞인 값이 있어 쓰지 않는다(노트에 비교만 적는다).

  python scripts/build_species_names_en.py --asfis ASFIS_sp_2025.csv   # 네트워크로 WoRMS를 받고, ASFIS는 내려받은 파일에서
  python scripts/build_species_names_en.py --check                      # 저장한 원본으로 다시 만들어 dist 파일과 같은지 본다(네트워크 없음)

네트워크로 WoRMS를 받을 수 없으면 멈춘다(이름을 기억으로 채우지 않는다).
"""
import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSESS = ROOT / "dist" / "assessments.json"
OUT = ROOT / "dist" / "species-names-en.json"
RAW = ROOT / "research" / "i18n"
WORMS = "https://www.marinespecies.org/rest/AphiaVernacularsByAphiaID/{}"


def targets():
    d = json.loads(ASSESS.read_text(encoding="utf-8"))
    rows = [(int(s["aphia_id"]), s.get("scientific_name") or "") for s in (d.get("species") or []) + (d.get("candidate_species") or [])]
    if not rows:
        sys.exit("assessments.json에 종이 없습니다")
    return rows


def fetch_worms(aphia):
    req = urllib.request.Request(WORMS.format(aphia), headers={"Accept": "application/json", "User-Agent": "blue-bio-map i18n names"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode("utf-8")
            return json.loads(body) if r.status == 200 and body.strip() else []
    except urllib.error.HTTPError as e:
        if e.code == 204:  # 이름 없음
            return []
        raise


def read_asfis(path):
    """ASFIS 파일(.csv 또는 그 csv가 든 .zip)에서 {학명: 영어 이름}. 열 이름은 판마다 달라 'Scientific'·'English'가 든 열을 찾는다."""
    data = Path(path).read_bytes()
    if path.lower().endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            name = next(n for n in z.namelist() if n.lower().endswith((".csv", ".txt")))
            text = z.read(name).decode("utf-8-sig", errors="replace")
    else:
        text = data.decode("utf-8-sig", errors="replace")
    dialect = csv.Sniffer().sniff(text[:5000], delimiters=",;\t")
    rows = list(csv.DictReader(io.StringIO(text), dialect=dialect))
    cols = rows[0].keys() if rows else []
    sci = next((c for c in cols if "scientific" in c.lower()), None)
    eng = next((c for c in cols if "english" in c.lower()), None)
    if not sci or not eng:
        sys.exit(f"ASFIS 열을 찾지 못했습니다: {list(cols)}")
    return {r[sci].strip(): r[eng].strip() for r in rows if r.get(sci) and r.get(eng) and r[eng].strip()}, hashlib.sha256(data).hexdigest()


def pick_worms(rows):
    eng = [v for v in rows if v.get("language_code") == "eng" and v.get("vernacular")]
    if not eng:
        return None
    pref = [v for v in eng if v.get("isPreferredName") in (1, True)]
    return (pref or eng)[0]["vernacular"].strip()


def build(worms_raw, asfis, checked):
    out = {}
    for aphia, sci in targets():
        name = pick_worms(worms_raw.get(str(aphia)) or [])
        if name:
            out[str(aphia)] = {"en": name, "source": "WoRMS vernacular", "checked": checked}
        elif sci and asfis.get(sci):
            out[str(aphia)] = {"en": asfis[sci], "source": "FAO ASFIS", "checked": checked}
    return out


def write(out):
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--asfis", help="FAO ASFIS 파일(.csv 또는 .zip)")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)
    if a.check:
        if not OUT.exists():
            print("species-names-en.json 없음(영어 화면은 학명만)")
            return 0
        if json.loads(OUT.read_text(encoding="utf-8")) == {}:
            print("species-names-en.json 비어 있음(영어 화면은 학명만)")
            return 0
        saved = sorted(RAW.glob("species-names-raw-*.json"))
        if not saved:
            sys.exit("research/i18n에 원본이 없습니다")
        raw = json.loads(saved[-1].read_text(encoding="utf-8"))
        again = build(raw["worms"], raw["asfis"], raw["checked"])
        cur = json.loads(OUT.read_text(encoding="utf-8"))
        if again != cur:
            sys.exit("dist/species-names-en.json이 저장한 원본과 다릅니다")
        print(f"OK {len(cur)}종 이름")
        return 0
    today = dt.date.today().isoformat()
    worms = {}
    for aphia, _ in targets():
        try:
            worms[str(aphia)] = fetch_worms(aphia)
        except (urllib.error.URLError, OSError) as e:
            sys.exit(f"WoRMS에 접속하지 못했습니다({aphia}): {e}. 이름을 채우지 않고 멈춥니다.")
    asfis, sha = ({}, None)
    if a.asfis:
        table, sha = read_asfis(a.asfis)
        asfis = {sci: table[sci] for _, sci in targets() if sci in table}
    RAW.mkdir(parents=True, exist_ok=True)
    raw = {"checked": today, "worms_url": WORMS, "worms": worms, "asfis_file": a.asfis and Path(a.asfis).name, "asfis_sha256": sha, "asfis": asfis}
    (RAW / f"species-names-raw-{today}.json").write_text(json.dumps(raw, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    out = build(worms, asfis, today)
    write(out)
    print(f"{len(out)}/{len(targets())}종 이름 (WoRMS {sum(v['source'].startswith('WoRMS') for v in out.values())}, ASFIS {sum(v['source'].startswith('FAO') for v in out.values())})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
