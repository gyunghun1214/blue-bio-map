## 작업: '근거와 방법' 탭 맨 위 MCUI SCALE 카드(#mt-mcui-map) 삭제 — 검사 후 고친 실행판 (2026-10-17)

원본 프롬프트(prompt-original.md)를 main 350d643과 대조한 결과와 고친 점:
- 카드는 dist/index.html의 정적 마크업(#mt-mcui-map, .mt-mm-*)과 dist/method.css의 7/15 블록뿐이다. 대응표를 그리는 JS·데이터 바인딩·문구 상수는 없다(app.js, *.json 검색 0건). → "JS 삭제" 항목은 할 일이 없음을 확인만 한다.
- '02 / 산출 방법' MCUI 항목에 "범주 → 숫자는 LC 10 · NT 35 · VU 60 · EN 80 · CR 100"이 있으므로 03의 "(대응표는 이 탭 맨 위)"만 지우면 정보는 남는다(원본과 같음).
- 원본에 빠진 것: 이 카드를 기대하는 검사 2곳.
  · verification/uicheck.mjs: 'Method tab … MCUI table is the first block' → 첫 블록이 .mt-hero이고 #mt-mcui-map·'MCUI SCALE'이 없음을 확인하도록 바꾼다.
  · verification/test_posthoc_scorecard_ui.mjs: `<div class="mt-mcui-map"` 시작 기대, '(대응표는 이 탭 맨 위)' 기대 → 탭이 `<div class="mt-hero">`로 시작하고, 'mt-mcui-map'·'mt-mm-'·'MCUI SCALE'·'대응표는 이 탭 맨 위'가 index.html·method.css 어디에도 없음을 확인하도록 바꾼다.
  · 규칙: 기대값은 고치되 검사를 지우거나 건너뛰지 않는다. 주석 `2026-10-17 (LKH)`.
  · 지난 기록(verification/2026-10-15-mcui-category/, 2026-10-16-method-remove-scorecard/)은 당시 기록이므로 그대로 둔다.
- method.css를 고치므로 index.html의 `method.css?v=`를 sha256 앞 10자리로 다시 계산한다(test_intro_ui·test_client_outdated 규칙).
- 여백: #method의 위 패딩(56px / ≤1280px 44px / 폰 28px)은 탭 공통 여백이고, 카드가 빠지면 .mt-hero가 그 자리에서 시작한다. 탭 바에 붙지도, 두 배로 벌어지지도 않으므로 패딩은 그대로 두고 캡처로 확인한다.
- MCUI 숫자 옆 범주 표기(scoreText → mcuiCatTag), MCUI_TIE_RULE, 02·03 본문, 지표 흐름도, OUR RESEARCH SCOPE, 점수·데이터는 바꾸지 않는다.

### 검증
- 1440px·390px에서 '근거와 방법' 첫 요소가 .mt-hero(EVIDENCE & METHODS)인지, 콘솔 오류 0인지 캡처로 확인.
- dist 전체 "MCUI SCALE"·"대응표는 이 탭 맨 위"·"mt-mcui-map"·"mt-mm-" 0건.
- node verification/test_*.mjs 전부, Python 단위검사(3.12), uicheck.
