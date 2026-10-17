# 검사 결과 (2026-10-17, 클라우드 세션, 기준 main `350d643`)

| 검사 | 결과 |
|---|---|
| CI 단위 검사 (`verify.yml` unit 단계 전체: `node verification/test_*.mjs`, `build_posthoc_scorecard.py --csv --check`, `build_aquaculture_tier.py --check`, `build_expedition_stops.py --check`, Python 3.12 unittest 484개) | 모두 통과 |
| `verification/uicheck.mjs` (Chromium 1194, `FIXTURE=dist/live-snapshot.json`) | 243 PASS / 4 FAIL |
| 새 검사 15개 (Map wheel 12, Map pinch 2, Map zoom is described 1) | 15 PASS |
| 콘솔 오류 (`No uncaught page errors or console.error`) | PASS |

FAIL 4개는 클라우드에서 바깥 지도 타일(NASA GIBS, GEBCO)이 막혀 생기는 환경 실패로, 이 변경 전에도 같은 4개가 실패한다: A-5 공유 링크(수심 복원), 위성 타일, 수심 타일, 저장된 '기본' 배경 → 위성.

## 새 검사 줄

```
PASS Map wheel: a plain wheel over the map is not taken (page scroll stays) and leaves the zoom
PASS Map wheel: a plain wheel shows one hint per burst (Ctrl + 스크롤로 지도를 확대합니다), hidden from screen readers and clicks
PASS Map wheel: the hint goes after 1.5 s and is not shown after 3 times
PASS Map wheel: Ctrl + wheel over the map is taken (no page zoom) and zooms in one step, the hash m= follows
PASS Map wheel: the zoom centres on the cursor (the place under it stays put)
PASS Map wheel: ten small touchpad deltas (8 px) add up to one step out
PASS Map wheel: a one-line Firefox wheel (deltaMode 1) is one step, ⌘ (metaKey) works too
PASS Map wheel: zoom stays within 3–8 (taken at the ends, no page zoom)
PASS Map wheel: Ctrl + wheel over the legend floating on the map zooms the map too
PASS Map wheel: Ctrl(⌘) + wheel outside the map is left to the browser (page zoom) and keeps the map zoom
PASS Map pinch (Safari gesture events, touchpad): scale 1.3 is one step in, a ctrlKey wheel during the gesture adds none
PASS Map pinch: gesture events while fingers are down (iPhone/iPad) are left to Leaflet touchZoom (no second zoom)
PASS Map wheel (DevTools input): Ctrl + wheel zooms the map, a plain wheel does not, the page scale is unchanged
PASS Map wheel: no hint on a touch device
PASS Map zoom is described: map aria-label and 그 밖의 기능 list name Ctrl(⌘) + 스크롤 · 터치패드 핀치 · +/− · keyboard; Leaflet keyboard and touch zoom on, scrollWheelZoom off
```
