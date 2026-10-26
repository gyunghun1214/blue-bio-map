# 탐색 지도 위 글씨 겹침 정리 (2026-10-26)

LKH 프롬프트(지도 위 UI 겹침)에 따른 수정 기록. 브랜치 `fix/map-overlap`, 기준 main 235f47c.

## 무엇을 바꿨나

- `dist/theme.css`
  - `.map-chip`: 칩 전체 말줄임 → flex로 바꾸고 종 이름(`<b>`)만 말줄임. 점·구분점·셀 수·기록 수는 줄지 않는다.
  - 741~1179px 칩: `max-width`에서 오른쪽 위 묶음 너비(`--tr-w`)를 뺀다. 다 들어가지 않으면 `.mc-low`로 오른쪽 위 묶음 아래(`--tr-b`)로 내려 폭을 다 쓴다.
  - 1180px 이상 칩: `max-width`에서 모드·기간 묶음 너비(`--tl-w`)를 뺀다. 다 들어가지 않으면 `.mc-low`로 오른쪽 위 두 줄 아래로.
  - `.map-ui-tr`(≤1179px, 휴대폰 포함): `max-width:55%` → 왼쪽 위 묶음 옆 남은 폭(`100% − 여백 − --tl-w`). 버튼은 오른쪽에서 다음 줄로 내려가고 모드 버튼·위성·수심 글자 크기는 그대로.
  - 지운 고정 숫자 규칙: `@media (max-width:1549px){#explore .map-chip{top:calc(var(--pt) + 110px)}}`, `@media (min-width:1180px) and (max-width:1439px){#explore .map-chip{top:62px}}`, 이미 덮여 쓰이지 않던 `@media (min-width:1180px){#explore .map-chip{top:16px;…}}`.
- `dist/app.js`
  - `--tl-h`만 넘기던 ResizeObserver 하나가 `.map-ui-tl`·`.map-ui-tr`·`.map-stage`를 함께 보고 `--tl-h`·`--tl-w`·`--tr-w`·`--tr-b`를 넘긴 뒤 `placeChip()`을 부른다(새 관찰기 없음).
  - `placeChip()`: 칩을 위 자리에 두고 종 이름이 잘리면 `.mc-low`로 내린다. 내려가서도 잘리면 `.mc-cut`(이때만 마우스를 받아 title이 보인다).
  - `setMapChip`: title = 칩 전체 문구 + 기존 title('기록 연도 …'). 영어 화면은 조각마다 칩과 같은 사전으로 옮긴다.
- `verification/uicheck.mjs`: O-1(14개 너비 × EN·KO × 두 모드 × 방어·꼬시래기 겹침 0건). 'Value map icon' 검사는 휠 앞뒤 지도 위치를 휠 바로 앞과 비교(첫 클릭이 연 겹쳐 보기의 긴 칩이 내려가며 지도 맞춤이 조금 바뀌는 것은 휠 탓이 아니다).
- `verification/test_map_boundary.mjs`: 칩 title 기대값.

## 겹침 결과 (수정 전 → 후, 서로 겹친 요소 쌍 수)

Chromium headless, 창 높이 900px, 자료는 `dist/live-snapshot.json`, 종은 방어와 영어 칩이 가장 긴 꼬시래기(Gracilaria vermiculophylla). 기간 목록 닫힘. 1180px 이상에서 `#value-mini`가 `.map-ui-bl` 안에 든 것은 포함 관계라 세지 않았다.

| 언어 | 모드 | 390 | 760 | 800 | 900 | 1000 | 1024 | 1180 | 1280 | 1440 | 1550 | 1600 | 1700 | 1800 | 1920 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| KO | 출현 기록 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| KO | 활용 × 보전 | 1→0 | 1→0 | 1→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| EN | 출현 기록 | 1→0 | 1→0 | 1→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 | 1→0 | 1→0 | 1→0 | 1→0 | 1→0 |
| EN | 활용 × 보전 | 2→0 | 2→0 | 2→0 | 1→0 | 1→0 | 1→0 | 2→0 | 1→0 | 0→0 | 1→0 | 1→0 | 1→0 | 1→0 | 1→0 |

수정 전에 상자만 겹치고 글씨는 안 겹치던 것: 390px `#period-filter × #value-mini`(작은 표 상자가 묶음 폭 전체), 390px EN `.map-mode × .basemap-switch` 10px(테두리만), 800px 방어 `#map-chip × #value-mini`.

## 칩 이름이 잘리는 곳 (수정 후)

EN 1180px 꼬시래기(두 모드): 'Gracilaria vermicul… · 15 public cells · 1,004 records'. 숫자는 그대로이고, 마우스를 올리면 title에 전체 문구와 기록 연도가 보인다.

## 칩 자리 (수정 후, U = 모드 묶음 옆 위 줄, L = 오른쪽 위 묶음 아래)

- KO 방어: 1180~1440 L, 1550 이상 U. 741~1179는 출현 기록 900~1024·활용 1000~1024 U, 그 밖은 L.
- EN: 1180px 이상 전부 L(영어 모드·기간 버튼이 넓다). 741~1179는 출현 기록 1024px(방어)만 U.

## 스크린샷

`docs/claude-project/screenshots/map-overlap-{before,after}-en-1600-amberjack.png`, `…-en-800-occurrence.png`, `…-en-800-value.png`.
