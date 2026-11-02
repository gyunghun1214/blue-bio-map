"""분기 자료 확인: 공개 자료를 다시 받아 사이트에 쓴 값(dist/assessments.json, 스냅샷 2026-10-15 · 방법 4.19)과 비교하고,
AI가 바뀐 곳을 한국어로 정리한 '검토 대기 목록'을 만든다. dist/ 안의 파일은 읽기만 하고 고치지 않는다.
사람이 목록을 보고 원문을 확인한 뒤에만 기존 수집 스크립트(collect_*.py, build_*.py)로 실제 갱신을 한다.

확인하는 것(인증키 없이 받을 수 있는 공개 자료만):
  - WoRMS: 30종 학명이 지금도 승인명인지, 기록이 스냅샷 뒤에 고쳐졌는지 (AphiaRecordByAphiaID)
  - IUCN 적색목록 범주: GBIF에 실린 IUCN 체크리스트 사본으로 30종 범주를 다시 읽음 (species/{key}/iucnRedListCategory)
  - IUCN 체크리스트 사본의 갱신일 (새 적색목록 판이 나왔는지 알리는 신호)
  - OBIS·GBIF 출현 기록 수: 자체 예비평가(Rapid LC)에 쓴 16종을 저장된 같은 조건으로 다시 셈
KOSIS 어업생산 통계는 인증키가 있어야 해서 넣지 않았다(키를 넣으면 다음에 더할 수 있음).

AI 정리는 GitHub Models(Actions의 GITHUB_TOKEN, 권한 models: read)를 쓴다. AI는 표를 바꾸지 않고 설명만 쓴다.
AI 호출이 안 되면 표만으로 목록을 만든다.

Usage:
  python scripts/refresh_check.py --out refresh-out            # 네트워크로 확인
  python scripts/refresh_check.py --out refresh-out --no-ai    # AI 정리 없이
  python scripts/refresh_check.py --fixture f.json --out x     # 저장된 응답으로(시험용, 네트워크 없음)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSESSMENTS = ROOT / "dist" / "assessments.json"
WORMS = "https://www.marinespecies.org/rest"
GBIF = "https://api.gbif.org/v1"
OBIS = "https://api.obis.org/v3"
IUCN_ON_GBIF = "19491596-35ae-4a91-9a98-85cf505f1bd3"  # IUCN Red List checklist dataset on GBIF
MODELS_URL = "https://models.github.ai/inference/chat/completions"
MODELS = ("openai/gpt-4.1", "openai/gpt-4.1-mini")
UA = {"User-Agent": "BlueBioValueMap-refresh-check/1.0 (github.com/gyunghun1214/blue-bio-map)", "Accept": "application/json"}
# Relative change in a re-counted record total that is listed as '바뀜'. Smaller drifts are listed as '같음(작은 차이)'.
COUNT_CHANGE = 0.10
IUCN_CODES = {"EXTINCT": "EX", "EXTINCT_IN_THE_WILD": "EW", "CRITICALLY_ENDANGERED": "CR", "ENDANGERED": "EN",
              "VULNERABLE": "VU", "NEAR_THREATENED": "NT", "LEAST_CONCERN": "LC", "DATA_DEFICIENT": "DD",
              "NOT_EVALUATED": "NE", "NOT_APPLICABLE": "NA"}


class Fetcher:
    """Network GET with retries, or answers from a fixture file {url: json | null} for offline tests."""

    def __init__(self, fixture: dict | None = None):
        self.fixture = fixture
        self.calls = 0

    def get(self, url: str):
        self.calls += 1
        if self.fixture is not None:
            if url not in self.fixture:
                raise LookupError(url)
            return self.fixture[url]
        last = None
        for wait in (5, 20, 60, None):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                    body = r.read()
                    time.sleep(0.3)
                    return json.loads(body) if body.strip() else None
            except urllib.error.HTTPError as e:
                if e.code in (204, 404):
                    return None
                last = e
            except (OSError, ValueError) as e:
                last = e
            if wait is None:
                break
            time.sleep(wait)
        raise RuntimeError(f"{url}: {last}")


def species_list(data: dict) -> list[dict]:
    return data["species"] + data["candidate_species"]


def shown_iucn(sp: dict) -> str:
    """IUCN category the site uses for this species ('NE' when it is not in the Red List)."""
    ct = sp.get("conservation_trace") or {}
    state = ct.get("iucn_state")
    if state == "assessed":
        return ct.get("category") or "?"
    if state == "data_deficient":
        return "DD"
    return "NE"


def row(sp: dict, source: str, item: str, before, now, result: str, note: str = "", affects: str = "") -> dict:
    return {"aphia_id": sp["aphia_id"], "korean_name": sp["korean_name"], "scientific_name": sp["scientific_name"],
            "source": source, "item": item, "before": before, "now": now, "result": result, "note": note, "affects": affects}


def check_worms(f: Fetcher, sp: dict, snapshot: str) -> list[dict]:
    try:
        rec = f.get(f"{WORMS}/AphiaRecordByAphiaID/{sp['aphia_id']}")
    except Exception as e:  # noqa: BLE001 - one failed source must not stop the other 29 species
        return [row(sp, "WoRMS", "학명 상태", "accepted", None, "확인 불가", str(e)[:200])]
    if not rec:
        return [row(sp, "WoRMS", "학명 상태", "accepted", None, "확인 불가", "기록 없음")]
    out = []
    status, valid = rec.get("status"), rec.get("valid_name")
    if status != "accepted" or (valid and valid != sp["scientific_name"]):
        out.append(row(sp, "WoRMS", "승인 학명", sp["scientific_name"], f"{valid} ({status}, AphiaID {rec.get('valid_AphiaID')})",
                       "바뀜", "WoRMS가 다른 이름을 승인명으로 씀", "학명 표시 · 종 연결(AphiaID)"))
    else:
        out.append(row(sp, "WoRMS", "승인 학명", sp["scientific_name"], valid, "같음"))
    modified = (rec.get("modified") or "")[:10]
    if modified and modified > snapshot:
        out.append(row(sp, "WoRMS", "기록 수정일", f"스냅샷 {snapshot}", modified, "바뀜",
                       "스냅샷 뒤에 WoRMS 기록이 고쳐짐(이름·분류·출처 중 무엇인지 원문 확인)", "학명·분류 표시"))
    return out


def gbif_key(f: Fetcher, sp: dict) -> int | None:
    stored = ((sp.get("mcui_substitute") or {}).get("record") or {}).get("gbif") or {}
    if stored.get("taxon_key"):
        return stored["taxon_key"]
    m = f.get(f"{GBIF}/species/match?" + urllib.parse.urlencode({"name": sp["scientific_name"], "strict": "true"}))
    return (m or {}).get("acceptedUsageKey") or (m or {}).get("usageKey")


def check_iucn(f: Fetcher, sp: dict) -> list[dict]:
    before = shown_iucn(sp)
    try:
        key = gbif_key(f, sp)
        if not key:
            return [row(sp, "IUCN(GBIF 사본)", "적색목록 범주", before, None, "확인 불가", "GBIF 분류 목록에 이 학명이 없음")]
        got = f.get(f"{GBIF}/species/{key}/iucnRedListCategory")
    except Exception as e:  # noqa: BLE001
        return [row(sp, "IUCN(GBIF 사본)", "적색목록 범주", before, None, "확인 불가", str(e)[:200])]
    now = (got or {}).get("code") or IUCN_CODES.get(((got or {}).get("category") or "").upper()) or "NE"
    if now == before:
        return [row(sp, "IUCN(GBIF 사본)", "적색목록 범주", before, now, "같음")]
    return [row(sp, "IUCN(GBIF 사본)", "적색목록 범주", before, now, "바뀜",
                "GBIF 사본 기준. IUCN 적색목록 원문에서 같은 학명·평가 연도를 확인한 뒤에만 반영",
                "보전 시급성(MCUI) · 활용·보전 사분면")]


def count_obis(f: Fetcher, query: dict) -> int:
    q = {k: v for k, v in query.items() if k != "size"}
    page = f.get(OBIS + "/occurrence?" + urllib.parse.urlencode({**q, "size": 1}))
    return int((page or {}).get("total", 0))


def count_gbif(f: Fetcher, query: dict) -> int:
    page = f.get(GBIF + "/occurrence/search?" + urllib.parse.urlencode({**query, "limit": 0}))
    return int((page or {}).get("count", 0))


def check_counts(f: Fetcher, sp: dict) -> list[dict]:
    rec = (sp.get("mcui_substitute") or {}).get("record") or {}
    out = []
    for source, counter in (("OBIS", count_obis), ("GBIF", count_gbif)):
        stored = rec.get(source.lower()) or {}
        if not stored.get("query"):
            continue
        before = stored.get("count")
        try:
            now = counter(f, stored["query"])
        except Exception as e:  # noqa: BLE001
            out.append(row(sp, source, "출현 기록 수(예비평가 조건)", before, None, "확인 불가", str(e)[:200]))
            continue
        change = (now - before) / before if before else (1.0 if now else 0.0)
        pct = f"{change * 100:+.1f}%"
        result = "바뀜" if abs(change) >= COUNT_CHANGE else "같음"
        note = pct if result == "바뀜" else f"{pct} (작은 차이)" if now != before else ""
        out.append(row(sp, source, "출현 기록 수(예비평가 조건)", before, now, result, note,
                       "자체 예비평가(Rapid LC) 입력값" if result == "바뀜" else ""))
    return out


def check_red_list_edition(f: Fetcher, checked_on: str) -> dict:
    try:
        ds = f.get(f"{GBIF}/dataset/{IUCN_ON_GBIF}") or {}
    except Exception as e:  # noqa: BLE001
        return {"result": "확인 불가", "note": str(e)[:200]}
    stamp = (ds.get("pubDate") or ds.get("modified") or "")[:10]
    return {"title": ds.get("title"), "updated": stamp, "our_check": checked_on,
            "result": "바뀜" if stamp and stamp > checked_on else "같음"}


def ai_summary(table: dict, token: str | None) -> tuple[str | None, str | None]:
    """Korean notes for the human reviewer. Returns (text, model) or (None, reason)."""
    if not token:
        return None, "토큰 없음"
    changed = [r for r in table["rows"] if r["result"] != "같음"]
    brief = {"run": table["run"], "baseline": table["baseline"], "red_list_edition": table["red_list_edition"],
             "counts": table["counts"], "rows_to_review": changed}
    system = ("너는 해양생물 지도 'Blue-bio Value Map' 팀의 자료 담당 보조다. 분기마다 공개 자료를 다시 받아 사이트 값과 비교한 표가 주어진다. "
              "할 일: 사람 검토자가 볼 한국어 정리를 쓴다. 규칙: (1) 표에 있는 사실만 쓰고, 표에 없는 숫자·종·출처는 만들지 않는다. "
              "(2) 점수를 다시 계산하거나 반영 여부를 결정하지 않는다. 결정은 사람이 한다. (3) 바뀐 항목마다 어느 원문에서 무엇을 확인하면 되는지, "
              "사이트의 어느 값(affects)에 닿는지 한 줄씩 쓴다. (4) '확인 불가'는 다시 돌려 볼 항목으로 따로 묶는다. "
              "(5) 바뀐 것이 없으면 그렇다고 짧게 쓴다. 형식: 마크다운, 맨 위 세 줄 요약, 그 아래 '먼저 볼 것' 목록. 400자~1200자.")
    body = {"messages": [{"role": "system", "content": system},
                         {"role": "user", "content": json.dumps(brief, ensure_ascii=False)}],
            "temperature": 0.2, "max_tokens": 1500}
    last = None
    for model in MODELS:
        req = urllib.request.Request(MODELS_URL, data=json.dumps({**body, "model": model}).encode(), method="POST",
                                     headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json",
                                              "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                text = json.loads(r.read())["choices"][0]["message"]["content"].strip()
            if text:
                return text, model
        except Exception as e:  # noqa: BLE001
            last = f"{model}: {e}"
    return None, last


def numbers_not_in(text: str, source: str) -> list[str]:
    """Numbers in the AI text that never appear in the table it was given (a simple invention guard)."""
    seen = set(re.findall(r"\d+(?:\.\d+)?", source))
    return sorted({n for n in re.findall(r"\d+(?:\.\d+)?", text) if n not in seen and len(n) > 1})


def render(table: dict) -> str:
    rows = table["rows"]
    changed = [r for r in rows if r["result"] == "바뀜"]
    failed = [r for r in rows if r["result"] == "확인 불가"]
    same = [r for r in rows if r["result"] == "같음"]
    run, base, ed = table["run"], table["baseline"], table["red_list_edition"]
    lines = [f"# 분기 자료 확인 · 검토 대기 ({run['date']})", "",
             f"- 실행: {run['at']} · {run['trigger']}" + (f" · [실행 기록]({run['url']})" if run.get("url") else ""),
             f"- 비교 기준: 사이트 자료 스냅샷 {base['snapshot']} · 방법 {base['method_version']} · {base['species']}종",
             f"- 결과: 확인 {len(rows)}건 중 **바뀜 {len(changed)}** · 확인 불가 {len(failed)} · 같음 {len(same)}",
             "- 이 목록은 사이트 숫자를 바꾸지 않습니다. 사람이 원문을 확인하고 반영을 정한 뒤, 기존 수집 스크립트로 갱신 PR을 따로 엽니다.", ""]
    if ed:
        lines += [f"- IUCN 적색목록 GBIF 사본 갱신일: {ed.get('updated') or '확인 불가'} (우리 마지막 확인 {ed.get('our_check')}) → **{ed['result']}**", ""]
    lines += ["## AI 정리", ""]
    if table.get("ai_text"):
        lines += [table["ai_text"], "", f"<sub>정리: {table['ai_model']} (GitHub Models). 표가 기준이며, AI는 표를 바꾸지 않습니다.</sub>"]
        if table.get("ai_unmatched_numbers"):
            lines += ["", f"> 표에 없는 숫자가 AI 정리에 있습니다({', '.join(table['ai_unmatched_numbers'][:10])}). 아래 표를 기준으로 보세요."]
    else:
        lines += [f"AI 정리를 받지 못했습니다({table.get('ai_model') or '이유 없음'}). 아래 표만 보면 됩니다."]
    lines += ["", "## 사람이 확인할 것", ""]

    def table_md(rs: list[dict]) -> list[str]:
        out = ["| 종 | 자료 | 항목 | 사이트 값 | 지금 값 | 메모 | 닿는 화면 값 |", "|---|---|---|---|---|---|---|"]
        for r in rs:
            cells = [f"{r['korean_name']} *{r['scientific_name']}*", r["source"], r["item"], r["before"], r["now"], r["note"], r["affects"]]
            out.append("| " + " | ".join("" if c is None else str(c).replace("|", "/") for c in cells) + " |")
        return out

    if changed:
        lines += table_md(changed) + [""]
    else:
        lines += ["바뀐 항목이 없습니다.", ""]
    if failed:
        lines += ["### 확인 불가(다시 돌려 볼 것)", ""] + table_md(failed) + [""]
    lines += ["### 검토 순서", "",
              "- [ ] 바뀐 항목마다 원문(IUCN 적색목록·WoRMS·OBIS·GBIF)을 직접 열어 확인",
              "- [ ] 반영할 항목은 해당 수집 스크립트를 다시 돌려 별도 PR로 갱신(점수·화면 확인 포함)",
              "- [ ] 반영하지 않을 항목은 이 PR에 이유를 한 줄 남김",
              "- [ ] 이 PR은 기록만 남기므로 병합하거나 닫아도 사이트는 바뀌지 않음", "",
              "<details><summary>같음 " + str(len(same)) + "건 펼치기</summary>", ""] + table_md(same) + ["", "</details>", ""]
    return "\n".join(lines)


def run(fetcher: Fetcher, data: dict, use_ai: bool, token: str | None, meta: dict) -> dict:
    sps = species_list(data)
    snapshot = data["generated_at"][:10]
    rows: list[dict] = []
    for sp in sps:
        rows += check_worms(fetcher, sp, snapshot)
        rows += check_iucn(fetcher, sp)
        rows += check_counts(fetcher, sp)
    rechecks = [((sp.get("conservation_trace") or {}).get("recheck") or {}).get("checked_on") for sp in sps]
    checked_on = max([d for d in rechecks if d] or [snapshot])
    table = {"run": meta, "baseline": {"snapshot": snapshot, "method_version": data.get("method_version"), "species": len(sps)},
             "red_list_edition": check_red_list_edition(fetcher, checked_on), "rows": rows,
             "counts": {k: sum(r["result"] == k for r in rows) for k in ("바뀜", "확인 불가", "같음")}}
    text, model = ai_summary(table, token) if use_ai else (None, "AI 끔")
    table["ai_text"], table["ai_model"] = text, model
    if text:
        table["ai_unmatched_numbers"] = numbers_not_in(text, json.dumps({k: v for k, v in table.items() if k != "ai_text"},
                                                                         ensure_ascii=False) + meta.get("date", ""))
    return table


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="refresh-out")
    ap.add_argument("--fixture", help="JSON {url: response} for offline runs")
    ap.add_argument("--no-ai", action="store_true")
    ap.add_argument("--trigger", default=os.environ.get("GITHUB_EVENT_NAME", "manual"))
    args = ap.parse_args(argv)
    data = json.loads(ASSESSMENTS.read_text(encoding="utf-8"))
    fixture = json.loads(Path(args.fixture).read_text(encoding="utf-8")) if args.fixture else None
    now = datetime.now(timezone.utc)
    server, repo, run_id = (os.environ.get(k) for k in ("GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID"))
    labels = {"schedule": "정기 실행(분기)", "workflow_dispatch": "수동 실행", "pull_request": "시험 실행(PR, 검토 대기 PR은 만들지 않음)"}
    meta = {"date": now.strftime("%Y-%m-%d"), "at": now.strftime("%Y-%m-%d %H:%M UTC"),
            "trigger": labels.get(args.trigger, args.trigger),
            "url": f"{server}/{repo}/actions/runs/{run_id}" if server and repo and run_id else ""}
    token = None if args.no_ai or fixture is not None else os.environ.get("GITHUB_TOKEN")
    table = run(Fetcher(fixture), data, not args.no_ai and token is not None, token, meta)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "review.json").write_text(json.dumps(table, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (out / "review.md").write_text(render(table), encoding="utf-8")
    c = table["counts"]
    print(f"바뀜 {c['바뀜']} · 확인 불가 {c['확인 불가']} · 같음 {c['같음']} · AI {table['ai_model']} -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
