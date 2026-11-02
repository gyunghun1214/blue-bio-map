#!/usr/bin/env python3
"""주간 점검 (AI 정리): 라이브 사이트가 main과 같은지, 바깥 링크, 자동 검사 결과를 모아 한 장의 보고서로 만든다.
표준 라이브러리만 쓴다. 자세한 설명: docs/ai-maintenance.md

    python scripts/weekly_check.py live --out weekly-out/live.json
    python scripts/weekly_check.py report --links weekly-out/links.csv --live weekly-out/live.json \
        --verify success --out weekly-out

live    라이브 주소에서 몇 개 파일을 받아 저장소 dist/ 의 같은 파일과 sha256을 비교하고, /api/ask 의 AI 켜짐 여부를 본다.
report  링크 표(scripts/check_links.py 결과), 라이브 결과, 자동 검사(verify.yml) 결과를 합쳐 report.md · report.json 을
        쓴다. '고칠 것'은 (1) 자동 검사 실패 (2) 라이브가 열리지 않거나 main과 다름 (3) 새로 깨지거나 이동된 링크
        (config/weekly-check.json 의 known_links 에 있는 것은 뺀다). 고칠 것이 있으면 AI(GitHub Models, Actions의
        GITHUB_TOKEN, 권한 models: read)가 사람이 읽을 한국어 정리를 덧붙인다. AI는 표를 바꾸지 않고, 표에 없는 숫자가
        나오면 그 정리는 버린다.

이 스크립트는 사이트 파일(dist/)을 고치지 않는다.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
SITE = "https://blue-bio-map.blue-bio-map.workers.dev/"
# 라이브와 main을 비교할 파일: 화면 코드, 점수 자료, 배포 표시, 안내 챗봇, 바다 탐험 화면.
LIVE_FILES = ("app.js", "assessments.json", "release.json", "chatbot.js", "expedition.js")
KNOWN = ROOT / "config" / "weekly-check.json"
MODELS_URL = "https://models.github.ai/inference/chat/completions"
MODELS = ("openai/gpt-4.1", "openai/gpt-4.1-mini")
UA = {"User-Agent": "BlueBioValueMap-weekly-check/1.0"}


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def get(url: str, timeout: float = 30) -> tuple[int | str, bytes]:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:  # noqa: BLE001 - any network failure is a result, not a crash
        return f"{type(e).__name__}: {e}"[:200], b""


def check_live(site: str, dist: Path = DIST, fetch=get) -> dict:
    site = site.rstrip("/") + "/"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")  # 캐시 피하기
    rows = []
    status, _ = fetch(f"{site}?fresh={stamp}")
    rows.append({"path": "/", "status": status, "match": None})
    for name in LIVE_FILES:
        status, body = fetch(f"{site}{name}?fresh={stamp}")
        local = (dist / name).read_bytes() if (dist / name).exists() else None
        match = None if status != 200 or local is None else sha256(body) == sha256(local)
        rows.append({"path": "/" + name, "status": status, "match": match})
    status, body = fetch(f"{site}api/ask")
    try:
        ai = bool(json.loads(body or b"{}").get("ai")) if status == 200 else None
    except ValueError:
        ai = None
    return {"site": site, "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "files": rows, "api_ask": {"status": status, "ai": ai}}


def read_links(path: Path) -> list[dict]:
    if not path or not path.exists():
        return []
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def load_known(path: Path = KNOWN) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8")).get("known_links", {})


def find_problems(links: list[dict], live: dict | None, verify: str, known: dict) -> dict:
    """Split everything into 고칠 것 (problems) and 참고 (notes). Pure function, tested."""
    problems, notes = [], []
    if verify not in ("success", "skipped", ""):
        problems.append({"kind": "검사", "what": f"자동 검사(verify.yml) 결과: {verify}",
                         "hint": "Actions에서 실패한 단계 기록을 열어 원인을 확인한다. 브라우저 검사는 가끔 한 번 더 돌리면 통과한다."})
    if live:
        for r in live.get("files", []):
            if r["status"] != 200:
                problems.append({"kind": "라이브", "what": f"{r['path']} 응답 {r['status']}",
                                 "hint": "Cloudflare 대시보드에서 마지막 배포가 성공했는지 본다."})
            elif r["match"] is False:
                problems.append({"kind": "라이브", "what": f"{r['path']} 이 main의 dist/ 와 다름",
                                 "hint": "main 병합 뒤 배포가 실패했거나 늦어진 것일 수 있다. Cloudflare에서 Retry."})
        ask = live.get("api_ask", {})
        if ask.get("status") != 200:
            problems.append({"kind": "라이브", "what": f"/api/ask 응답 {ask.get('status')}",
                             "hint": "Worker 배포 상태를 확인한다."})
        elif ask.get("ai") is False:
            notes.append({"kind": "참고", "what": "멍이 AI 답변 꺼짐(/api/ask ai:false). 준비된 답으로만 안내 중.",
                          "hint": "Worker 비밀 값 ANTHROPIC_API_KEY 가 없거나 만료된 경우다. 의도한 것이면 그대로 둔다."})
    for r in links:
        if r.get("result") not in ("깨짐", "이동됨"):
            continue
        item = {"kind": "링크", "what": f"{r['result']} {r.get('status', '')} {r['url']}",
                "where": r.get("locations", "")[:300], "final_url": r.get("final_url", "")}
        if r["url"] in known:
            notes.append({**item, "kind": "알려진 링크", "hint": known[r["url"]]})
        else:
            item["hint"] = ("이동됨: 새 주소로 바꿔도 되는지 원문을 열어 확인한다." if r["result"] == "이동됨"
                            else "깨짐: 원문이 옮겨졌는지 찾아보고, 없으면 같은 자료의 다른 공식 주소를 찾는다.")
            problems.append(item)
    counts = {}
    for r in links:
        counts[r.get("result", "")] = counts.get(r.get("result", ""), 0) + 1
    return {"problems": problems, "notes": notes, "link_counts": counts}


def numbers_not_in(text: str, source: str) -> list[str]:
    """Numbers in the AI text that never appear in what it was given (a simple invention guard)."""
    seen = set(re.findall(r"\d+(?:\.\d+)?", source))
    return sorted({n for n in re.findall(r"\d+(?:\.\d+)?", text) if n not in seen and len(n) > 1})


def ai_summary(brief: dict, token: str | None, post=None) -> tuple[str | None, str]:
    if not token:
        return None, "토큰 없음"
    system = ("너는 해양생물 지도 사이트 'Blue-bio Value Map'의 주간 점검 보조다. 자동 점검에서 나온 '고칠 것' 목록이 주어진다. "
              "할 일: 팀이 볼 한국어 정리를 쓴다. 규칙: (1) 목록에 있는 사실만 쓰고, 목록에 없는 숫자·주소·원인은 만들지 않는다. "
              "(2) 무엇을 먼저 볼지 순서를 정하고 항목마다 한 줄로 확인 방법을 쓴다. (3) 고칠지 말지는 사람이 정한다. "
              "(4) 사이트 점수나 화면 문구를 바꾸라고 하지 않는다. 형식: 마크다운, 맨 위 두 줄 요약, 그 아래 '먼저 볼 것' 목록. 300자~900자.")
    payload = json.dumps(brief, ensure_ascii=False)
    body = {"messages": [{"role": "system", "content": system}, {"role": "user", "content": payload}],
            "temperature": 0.2, "max_tokens": 1200}
    errors = []
    for model in MODELS:
        req = urllib.request.Request(MODELS_URL, data=json.dumps({**body, "model": model}).encode(), method="POST",
                                     headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json",
                                              "Accept": "application/json"})
        try:
            if post:
                raw = post(req)
            else:
                with urllib.request.urlopen(req, timeout=120) as r:
                    raw = r.read()
            text = json.loads(raw)["choices"][0]["message"]["content"].strip()
        except urllib.error.HTTPError as e:
            errors.append(f"{model}: HTTP {e.code}")
            continue
        except Exception as e:  # noqa: BLE001
            errors.append(f"{model}: {type(e).__name__}")
            continue
        extra = numbers_not_in(text, payload)
        if not text:
            errors.append(f"{model}: 빈 답")
        elif extra:
            errors.append(f"{model}: 목록에 없는 숫자 {extra[:5]} → 버림")
        else:
            return text, model
    return None, "; ".join(errors)[:400]


def render(result: dict, live: dict | None, verify: str, run_url: str, ai_text: str | None, ai_model: str) -> str:
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    p, n, c = result["problems"], result["notes"], result["link_counts"]
    lines = [f"# 주간 점검 {day}", ""]
    lines.append(f"- 고칠 것 **{len(p)}건** · 참고 {len(n)}건" + (f" · [실행 기록]({run_url})" if run_url else ""))
    lines.append(f"- 자동 검사: {verify or '실행 안 함'}")
    if live:
        same = sum(1 for r in live["files"] if r["match"] is True)
        total = sum(1 for r in live["files"] if r["match"] is not None)
        lines.append(f"- 라이브: main과 같은 파일 {same}/{total} · /api/ask {live['api_ask']['status']}")
    if c:
        lines.append("- 링크: " + " · ".join(f"{k} {v}" for k, v in sorted(c.items())))
    lines.append("- 이 점검은 사이트를 고치지 않습니다. 고칠 것은 사람이 확인하고, 켜 두었다면 Claude가 수정안 PR(초안)을 씁니다.")
    lines.append("")
    if ai_text:
        lines += ["## AI 정리", "", ai_text, "", f"<sub>정리: {ai_model} (GitHub Models). 아래 표가 기준입니다.</sub>", ""]
    elif p:
        lines += [f"<sub>AI 정리 없음({ai_model}). 아래 표만 보면 됩니다.</sub>", ""]
    if p:
        lines += ["## 고칠 것", "", "| 종류 | 내용 | 확인 방법 |", "|---|---|---|"]
        lines += [f"| {x['kind']} | {cell(x['what'])}{' · ' + cell(x['where']) if x.get('where') else ''} | {cell(x['hint'])} |" for x in p]
        lines.append("")
    if n:
        lines += ["## 참고 (이미 알고 있거나 의도한 것)", ""]
        lines += [f"- {x['kind']}: {x['what']} — {x['hint']}" for x in n]
        lines.append("")
    return "\n".join(lines)


def cell(s: str) -> str:
    return str(s).replace("|", "\\|").replace("\n", " ")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("live")
    a.add_argument("--site", default=SITE)
    a.add_argument("--out", required=True)
    b = sub.add_parser("report")
    b.add_argument("--links", default="")
    b.add_argument("--live", default="")
    b.add_argument("--verify", default="")
    b.add_argument("--out", required=True)
    b.add_argument("--no-ai", action="store_true")
    args = ap.parse_args(argv)

    if args.cmd == "live":
        live = check_live(args.site)
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(live, ensure_ascii=False, indent=1), encoding="utf-8")
        for r in live["files"]:
            print(r["path"], r["status"], {True: "같음", False: "다름", None: "-"}[r["match"]])
        print("/api/ask", live["api_ask"])
        return 0

    live = json.loads(Path(args.live).read_text(encoding="utf-8")) if args.live and Path(args.live).exists() else None
    result = find_problems(read_links(Path(args.links) if args.links else None), live, args.verify, load_known())
    ai_text, ai_model = None, "고칠 것 없음"
    if result["problems"]:
        ai_text, ai_model = (None, "AI 끔") if args.no_ai else ai_summary(
            {"problems": result["problems"], "link_counts": result["link_counts"]}, os.environ.get("GITHUB_TOKEN"))
    run_url = ""
    if os.environ.get("GITHUB_RUN_ID"):
        run_url = f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ.get('GITHUB_REPOSITORY')}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.md").write_text(render(result, live, args.verify, run_url, ai_text, ai_model), encoding="utf-8")
    (out / "report.json").write_text(json.dumps({**result, "ai_model": ai_model}, ensure_ascii=False, indent=1), encoding="utf-8")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"problems={len(result['problems'])}\n")
    print(f"고칠 것 {len(result['problems'])} · 참고 {len(result['notes'])} · AI {ai_model}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
