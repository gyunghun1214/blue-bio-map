# '근거와 방법' 맨 위 MCUI SCALE 카드 삭제 (2026-10-17, LKH)

원본 프롬프트: `prompt-original.md`. main과 대조해 고친 실행판: `prompt-final.md`.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `dist/index.html` | `#mt-mcui-map` 카드 전체(라벨·제목·설명·대응표·자원 감소 줄·하단 4칸) 삭제. 03 '규칙 고정' MCUI 줄의 `(대응표는 이 탭 맨 위)` 삭제. `method.css?v=` 해시 갱신. |
| `dist/method.css` | 이 카드에만 쓰던 7/15 블록 17줄 삭제: `.mt-mcui-map`, `.mt-mm-head`, `.mt-mm-table`, `.mt-mm-stock`, `.mt-mm-notes`와 900px·600px 미디어 규칙. |
| `verification/uicheck.mjs` | 'Method tab … first block' 검사: 첫 블록 기대값 `mt-mcui-map` → `mt-hero`, 사라질 id에 `mt-mcui-map`, 사라질 문구에 'MCUI SCALE'·'대응표는 이 탭 맨 위' 추가. |
| `verification/test_posthoc_scorecard_ui.mjs` | 탭이 `.mt-hero`로 시작, `mt-mcui-map`·`mt-mm-`·'MCUI SCALE'·'대응표는 이 탭'이 index.html·method.css에 없음, 02의 'LC 10 · NT 35 · VU 60 · EN 80 · CR 100' 유지 확인. |

JS·데이터·문구 상수는 이 카드에 없었다(app.js·*.json 검색 0건). 숫자 옆 범주 표기(scoreText → mcuiCatTag), 동점 규칙(MCUI_TIE_RULE), 02·03 본문, 지표 흐름도, OUR RESEARCH SCOPE, 점수·데이터는 그대로다.
지난 기록 폴더(2026-10-15-mcui-category, 2026-10-16-method-remove-scorecard)는 당시 기록이라 고치지 않았다.

## 여백
카드가 있던 자리를 히어로가 그대로 받는다. 탭 바 아래 간격은 `#method`의 위 패딩과 같다: 1440px 56px, 1100·768px 44px, 390px 28px. 카드가 생기기 전(PR #208 이전)의 히어로 위치와 같다.

## 확인
`capture.mjs` 24/24 PASS (`results.json`, `after-*-method-top.png`): 4개 폭에서 첫 블록 = 히어로, 남은 문구·클래스 0, 02 대응 숫자·연구 범위 카드·흐름도 유지, 가로 넘침 0, 콘솔 오류 0.
