"""영어 화면의 종 일반명 사전(dist/species-names-en.json) 만들기 (2026-10-24, 2026-10-25 동의어·고른 이름 추가, 표준 라이브러리만).

대상은 dist/assessments.json의 species + candidate_species(종 수는 자료에서 읽는다). 이름은 지어내지 않고 아래 출처에서만 받는다.
  1. WoRMS 영어 vernacular (REST AphiaVernacularsByAphiaID, language_code 'eng')
  2. 1이 없으면 같은 종의 이전 학명(WoRMS AphiaSynonymsByAphiaID, 계급 Species만)의 영어 vernacular. 아종·속 이름은 빌리지 않는다.
  3. FAO ASFIS 영어 이름(학명이 정명과 똑같은 줄, 없으면 동의어와 똑같은 줄; ASFIS 파일은 --asfis로 준다)
기본 고르기: WoRMS preferred → ASFIS(정명 줄) → WoRMS 정명 이름 → WoRMS 동의어 이름 → ASFIS(동의어 줄), 같은 단계에서는 짧은 것.
사람이 고른 이름은 research/i18n/species-names-choices.json({AphiaID: {"en", "reason"}})이 먼저다. 그 이름도 위 후보 안에 있어야 한다.
이름이 하나도 없는 종은 "en": null, "kind": "scientific"(영어 화면에는 학명이 이름으로 보인다).
받은 원본은 research/i18n/species-names-raw-YYYY-MM-DD.json(WoRMS 응답 그대로, ASFIS는 맞춘 줄과 파일 sha256만).

  python scripts/build_species_names_en.py --asfis ASFIS_sp.zip   # 네트워크로 WoRMS를 받고, ASFIS는 내려받은 파일에서
  python scripts/build_species_names_en.py --rebuild              # 저장한 최신 원본 + 고른 이름으로 dist 파일을 다시 쓴다(네트워크 없음)
  python scripts/build_species_names_en.py --check                # 위와 같이 다시 만들어 dist 파일과 같은지 본다(CI)

네트워크로 WoRMS를 받을 수 없으면 멈춘다(이름을 기억으로 채우지 않는다). 클라우드 세션에서는 막혀 있어 PC에서 돌린다.
"""
import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSESS = ROOT / "dist" / "assessments.json"
OUT = ROOT / "dist" / "species-names-en.json"
RAW = ROOT / "research" / "i18n"
CHOICES = RAW / "species-names-choices.json"
REST = "https://www.marinespecies.org/rest/"


def targets():
    d = json.loads(ASSESS.read_text(encoding="utf-8"))
    rows = [(int(s["aphia_id"]), s.get("scientific_name") or "") for s in (d.get("species") or []) + (d.get("candidate_species") or [])]
    if not rows:
        sys.exit("assessments.json에 종이 없습니다")
    return rows


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "blue-bio-map i18n names"})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read().decode("utf-8")
                return json.loads(body) if r.status == 200 and body.strip() else []
        except urllib.error.HTTPError as e:
            if e.code == 204:  # 이름 없음
                return []
            if e.code in (429, 500, 502, 503) and i < 3:
                time.sleep(2 ** (i + 1))
                continue
            raise


def synonyms(aphia):
    out, off = [], 1
    while True:
        page = get(f"{REST}AphiaSynonymsByAphiaID/{aphia}?offset={off}") or []
        out += page
        if len(page) < 50:
            return out
        off += 50


def read_asfis(path):
    """ASFIS 파일(.csv 또는 그 csv가 든 .zip) → (줄 목록, 학명 열, 영어 열, 열 목록, sha256). 열 이름은 판마다 달라 찾는다."""
    data = Path(path).read_bytes()
    if path.lower().endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            name = next(n for n in z.namelist() if n.lower().endswith((".csv", ".txt")))
            text = z.read(name).decode("utf-8-sig", errors="replace")
    else:
        text = data.decode("utf-8-sig", errors="replace")
    dialect = csv.Sniffer().sniff(text[:5000], delimiters=",;\t")
    rows = list(csv.DictReader(io.StringIO(text), dialect=dialect))
    cols = list(rows[0].keys()) if rows else []
    if not any("scientific" in c.lower() for c in cols) or not any("english" in c.lower() for c in cols):
        sys.exit(f"ASFIS 열을 찾지 못했습니다: {cols}")
    return rows, cols, hashlib.sha256(data).hexdigest()


def col(row, word):
    return next(((v or "").strip() for k, v in row.items() if word in k.lower()), "")


def sentence(name):
    name = " ".join(name.split())
    return name[:1].upper() + name[1:]


def candidates(raw, aphia, sci):
    """출처 순서대로 (단계, 이름, 출처) 목록. 단계 숫자가 작을수록 먼저."""
    k = str(aphia)
    out = []
    eng = [v for v in raw["vernaculars"].get(k) or [] if v.get("language_code") == "eng" and v.get("vernacular")]
    for v in eng:
        out.append((0 if v.get("isPreferredName") in (1, True) else 2, sentence(v["vernacular"]), "WoRMS"))
    syn = [s for s in raw["synonyms"].get(k) or [] if s.get("rank") == "Species" and s.get("scientificname")]
    if not eng:
        for s in syn:
            for v in raw["synonym_vernaculars"].get(str(s.get("AphiaID"))) or []:
                if v.get("language_code") == "eng" and v.get("vernacular"):
                    out.append((3, sentence(v["vernacular"]), f"WoRMS (synonym {s['scientificname']})"))
    rows = (raw.get("asfis") or {}).get("rows") or []
    exact = [r for r in rows if col(r, "scientific") == sci and col(r, "english")]
    for r in exact:
        out.append((1, sentence(col(r, "english")), "FAO ASFIS"))
    if not exact and not eng:
        names = {s["scientificname"] for s in syn}
        for r in rows:
            if col(r, "scientific") in names and col(r, "english"):
                out.append((4, sentence(col(r, "english")), f"FAO ASFIS (as {col(r, 'scientific')})"))
    return out


def build(raw, choices):
    out = {}
    for aphia, sci in targets():
        k = str(aphia)
        cand = candidates(raw, aphia, sci)
        if not cand:
            out[k] = {"en": None, "kind": "scientific", "source": "", "alt": [], "checked": raw["checked"]}
            continue
        pick = choices.get(k, {}).get("en")
        if pick:
            hit = [c for c in cand if c[1].lower() == pick.lower()]
            if not hit:
                sys.exit(f"고른 이름 {pick!r}({k})이 받은 후보에 없습니다: {sorted({c[1] for c in cand})}")
            best = min(hit)
        else:
            best = min(cand, key=lambda c: (c[0], len(c[1]), c[1]))
        alt = sorted({c[1] for c in cand if c[1].lower() != best[1].lower()}, key=str.lower)
        out[k] = {"en": best[1], "kind": "common", "source": best[2], "alt": alt, "checked": raw["checked"]}
    return out


def write(out):
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def latest_raw():
    saved = sorted(RAW.glob("species-names-raw-*.json"))
    if not saved:
        sys.exit("research/i18n에 원본이 없습니다")
    return json.loads(saved[-1].read_text(encoding="utf-8"))


def read_choices():
    return json.loads(CHOICES.read_text(encoding="utf-8")) if CHOICES.exists() else {}


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--asfis", help="FAO ASFIS 파일(.csv 또는 .zip)")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--rebuild", action="store_true")
    a = ap.parse_args(argv)
    if a.check or a.rebuild:
        again = build(latest_raw(), read_choices())
        if a.rebuild:
            write(again)
            print(f"{sum(v['kind'] == 'common' for v in again.values())}/{len(again)}종 영어 이름")
            return 0
        cur = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else None
        if again != cur:
            sys.exit("dist/species-names-en.json이 저장한 원본·고른 이름과 다릅니다(--rebuild로 다시 쓴다)")
        print(f"OK {len(cur)}종 이름")
        return 0
    today = dt.date.today().isoformat()
    raw = {"checked": today, "rest": REST, "records": {}, "vernaculars": {}, "synonyms": {}, "synonym_vernaculars": {}}
    try:
        for aphia, _ in targets():
            k = str(aphia)
            raw["records"][k] = get(f"{REST}AphiaRecordByAphiaID/{aphia}")
            raw["vernaculars"][k] = get(f"{REST}AphiaVernacularsByAphiaID/{aphia}")
            raw["synonyms"][k] = synonyms(aphia)
            for s in raw["synonyms"][k]:
                sid = str(s.get("AphiaID"))
                if sid not in raw["synonym_vernaculars"]:
                    raw["synonym_vernaculars"][sid] = get(f"{REST}AphiaVernacularsByAphiaID/{sid}")
    except (urllib.error.URLError, OSError) as e:
        sys.exit(f"WoRMS에 접속하지 못했습니다: {e}. 이름을 채우지 않고 멈춥니다.")
    raw["asfis"] = None
    if a.asfis:
        rows, cols, sha = read_asfis(a.asfis)
        names = {sci for _, sci in targets()} | {s.get("scientificname") for v in raw["synonyms"].values() for s in v}
        raw["asfis"] = {"file": Path(a.asfis).name, "sha256": sha, "columns": cols, "rows": [r for r in rows if col(r, "scientific") in names]}
    RAW.mkdir(parents=True, exist_ok=True)
    (RAW / f"species-names-raw-{today}.json").write_text(json.dumps(raw, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    out = build(raw, read_choices())
    write(out)
    print(f"{sum(v['kind'] == 'common' for v in out.values())}/{len(out)}종 영어 이름")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
