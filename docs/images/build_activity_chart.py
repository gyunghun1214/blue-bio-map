"""README의 '날마다 main 브랜치에 들어간 커밋' 그림을 git 기록에서 다시 만든다 (2026-10-31).

    python docs/images/build_activity_chart.py            # 이 저장소, HEAD 기준
    python docs/images/build_activity_chart.py --repo <클론 경로> --ref origin/main

- git 기록 전체가 있는 클론에서 돌린다(얕은 클론은 커밋이 모자란다: `git fetch --filter=tree:0 --depth=5000 origin main`).
- 기간은 첫 커밋 날(2026-09-22)부터 발표 기준판 뒤 마지막 작업 날(2026-10-30)까지 한국 시간으로 고정한다.
  그 뒤 커밋이 늘어도 그림은 바뀌지 않는다. 기간을 바꾸려면 --since/--until.
- 병합 커밋도 센다(GitHub 저장소 첫 화면의 커밋 수와 같은 셈). 병합된 PR은 'Merge pull request #N' 커밋만 센다.
- 밝은 화면용·어두운 화면용 SVG 두 장을 쓰고, 주별 합계를 표준 출력에 찍는다(README '주별 합계' 표).
"""
import argparse
import datetime as dt
import subprocess
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
KST = dt.timezone(dt.timedelta(hours=9))

# 표시할 날: 저장소 기록이 있는 일만 고른다(README '만든 과정' 표와 같은 날짜)
MILESTONES = [
    ("2026-09-25", "첫 공개 배포"),
    ("2026-10-02", "첫 사후 검증"),
    ("2026-10-04", "첫 사전 등록"),
    ("2026-10-15", "검증 기록 표"),
    ("2026-10-27", "발표 기준판"),
]

THEMES = {
    # GitHub 밝은·어두운 화면 바탕에 맞춘 글자색. 막대는 한 계열(파랑)이라 범례가 없다.
    "light": dict(surface="#ffffff", ink="#1f2328", ink2="#59636e", ink3="#818b98", grid="#d1d9e0", bar="#2a78d6", mark="#9198a1"),
    "dark": dict(surface="#0d1117", ink="#f0f6fc", ink2="#9198a1", ink3="#7d8590", grid="#3d444d", bar="#3987e5", mark="#656c76"),
}
FONT = "-apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif"


def commits_per_day(repo, ref, since, until):
    out = subprocess.run(["git", "-C", str(repo), "log", ref, "--format=%ct"], check=True, capture_output=True, text=True).stdout
    days = Counter()
    for line in out.split():
        d = dt.datetime.fromtimestamp(int(line), KST).date()
        if since <= d <= until:
            days[d] += 1
    n = (until - since).days + 1
    return [(since + dt.timedelta(i), days.get(since + dt.timedelta(i), 0)) for i in range(n)]


def pr_merges(repo, ref, since, until):
    """병합된 PR 수: 'Merge pull request #N' 커밋(브랜치에 main을 받아 온 병합 커밋은 세지 않는다)"""
    out = subprocess.run(["git", "-C", str(repo), "log", ref, "--merges", "--format=%ct %s"], check=True, capture_output=True, text=True).stdout
    n = 0
    for line in out.splitlines():
        ts, _, subject = line.partition(" ")
        if subject.startswith("Merge pull request #") and since <= dt.datetime.fromtimestamp(int(ts), KST).date() <= until:
            n += 1
    return n


def text_width(s, size=12):
    """글자 폭 어림: 한글 1em, 숫자·영문 0.6em, 빈칸 0.3em (이름표 겹침 검사용)"""
    return sum(size * (1.0 if ord(ch) > 0x2E80 else 0.3 if ch == " " else 0.6) for ch in s)


def bar_path(x, y, w, h, r=4):
    """4px 둥근 끝, 바닥은 각진 막대"""
    if h <= 0:
        return ""
    r = min(r, h, w / 2)
    return (f"M{x:.1f},{y + h:.1f} V{y + r:.1f} Q{x:.1f},{y:.1f} {x + r:.1f},{y:.1f} H{x + w - r:.1f} "
            f"Q{x + w:.1f},{y:.1f} {x + w:.1f},{y + r:.1f} V{y + h:.1f} Z")


def svg(series, total, merged, theme):
    c = THEMES[theme]
    W, H = 900, 320
    left, right, top, bottom = 44, 884, 112, 270
    peak = max(n for _, n in series)
    ymax = 50 * (peak // 50 + 1)
    band = (right - left) / len(series)
    bw = min(24.0, band - 4)
    y = lambda v: bottom - (bottom - top) * v / ymax
    x_of = {d: left + i * band for i, (d, _) in enumerate(series)}
    first, last = series[0][0], series[-1][0]
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" '
           f'aria-labelledby="t d" font-family="{FONT}">',
           f'<title id="t">날마다 main 브랜치에 들어간 커밋 ({first:%Y-%m-%d} ~ {last:%m-%d}, 합계 {total:,}개)</title>',
           f'<desc id="d">하루 최대 {peak}개({max(series, key=lambda s: s[1])[0]:%m-%d}). 표시한 날: '
           + ", ".join(f"{d[5:].replace('-', '/')} {t}" for d, t in MILESTONES) + ".</desc>",
           f'<rect width="{W}" height="{H}" fill="{c["surface"]}"/>',
           f'<text x="{left}" y="34" font-size="17" font-weight="700" fill="{c["ink"]}">날마다 main 브랜치에 들어간 커밋</text>',
           f'<text x="{left}" y="58" font-size="13" fill="{c["ink2"]}">{first:%Y-%m-%d} ~ {last:%m-%d} · 커밋 {total:,}개'
           f' · 병합된 PR {merged}개 · 한국 시간 기준</text>']
    for v in range(0, ymax + 1, 50):
        out.append(f'<line x1="{left}" x2="{right}" y1="{y(v):.1f}" y2="{y(v):.1f}" stroke="{c["grid"]}" stroke-width="1"/>')
        out.append(f'<text x="{left - 8}" y="{y(v) + 4:.1f}" font-size="12" text-anchor="end" fill="{c["ink3"]}">{v}</text>')
    rows, placed = [84, 100], []  # 이름표 두 줄. placed: (왼쪽, 오른쪽, 줄)
    for d, label in MILESTONES:
        day = dt.date.fromisoformat(d)
        if day not in x_of:
            continue
        mx = x_of[day] + band / 2
        text = f"{day.month}/{day.day} {label}"
        w = text_width(text)
        x0, anchor = (mx + 4, "start") if mx + 4 + w <= W - 8 else (mx - 4 - w, "end")
        # 앞 이름표 폭 안에 이 날의 선이 지나가면 그 이름표보다 아래 줄에 둔다(선이 글자를 가로지르지 않게)
        low = max([r + 1 for a, b, r in placed if a <= mx <= b], default=0)
        r = next(r for r in range(low, len(rows)) if all(b < x0 - 6 or a > x0 + w + 6 for a, b, rr in placed if rr == r))
        placed.append((x0, x0 + w, r))
        ly = rows[r]
        out.append(f'<line x1="{mx:.1f}" x2="{mx:.1f}" y1="{ly + 5}" y2="{bottom}" stroke="{c["mark"]}" stroke-width="1" stroke-dasharray="3 3"/>')
        tx = mx + 4 if anchor == "start" else mx - 4
        out.append(f'<text x="{tx:.1f}" y="{ly}" font-size="12" text-anchor="{anchor}" fill="{c["ink2"]}">{text}</text>')
    for d, n in series:
        bx = x_of[d] + (band - bw) / 2
        p = bar_path(bx, y(n), bw, bottom - y(n))
        if p:
            out.append(f'<path d="{p}" fill="{c["bar"]}"><title>{d:%m-%d} 커밋 {n}개</title></path>')
    pd, pn = max(series, key=lambda s: s[1])
    out.append(f'<text x="{x_of[pd] + band / 2:.1f}" y="{y(pn) - 6:.1f}" font-size="12" font-weight="700" text-anchor="middle" '
               f'fill="{c["ink"]}">{pn}</text>')
    out.append(f'<line x1="{left}" x2="{right}" y1="{bottom}" y2="{bottom}" stroke="{c["ink3"]}" stroke-width="1"/>')
    for d, _ in series:
        if d.weekday() == 0 or d == first:
            out.append(f'<text x="{x_of[d] + band / 2:.1f}" y="{bottom + 20}" font-size="12" text-anchor="middle" '
                       f'fill="{c["ink3"]}">{d.month}/{d.day}</text>')
    out.append(f'<text x="{right}" y="{H - 8}" font-size="12" text-anchor="end" fill="{c["ink3"]}">'
               f'git log에서 만듦 · docs/images/build_activity_chart.py</text>')
    out.append("</svg>")
    return "\n".join(out) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=str(HERE.parents[1]))
    ap.add_argument("--ref", default="HEAD")
    ap.add_argument("--since", default="2026-09-22")
    ap.add_argument("--until", default="2026-10-30")
    a = ap.parse_args()
    since, until = dt.date.fromisoformat(a.since), dt.date.fromisoformat(a.until)
    series = commits_per_day(a.repo, a.ref, since, until)
    total, merged = sum(n for _, n in series), pr_merges(a.repo, a.ref, since, until)
    for theme in THEMES:
        (HERE / f"activity-{theme}.svg").write_text(svg(series, total, merged, theme), encoding="utf-8")
    print(f"커밋 {total} · 병합된 PR {merged} · 날 {len(series)} · 커밋 있는 날 {sum(1 for _, n in series if n)} · 최대 {max(n for _, n in series)}")
    week = Counter()
    for d, n in series:
        week[d - dt.timedelta(days=d.weekday())] += n
    for w in sorted(week):
        end = min(w + dt.timedelta(days=6), until)
        print(f"| {max(w, since):%m-%d} ~ {end:%m-%d} | {week[w]} |")


if __name__ == "__main__":
    main()
