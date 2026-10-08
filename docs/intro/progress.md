# 메인 지도 로딩·입장 화면 진행 기록

브랜치: `claude/project-thread-26k7tj`(이 작업 세션에 지정된 브랜치. 프롬프트의 `feat/site-intro` 대신 사용). 기준: `main` 9990275.

## C1 준비 — 완료

- 작업 환경: Claude 클라우드 세션(Linux), Node 22, Python 3.12, Chromium 141(`--no-sandbox` 래퍼), Playwright.
- 열린 PR(2026-10-08): #152 `verified-4.8 참문어`(app.js VERIFIED 목록과 `app.js?v=` 해시를 바꿀 가능성 → 둘 중 나중에 머지되는 쪽이 해시 재계산 필요), #155 `바다 탐험 8종`(탐험 파일만, 이 작업은 탐험 파일을 건드리지 않음).
- 스킬: `frontend-design`(웹 디자인)을 불러와 그 절차(계획 → 브리프 대조 → 구현 → 스크린샷 자기 비평)를 따름. 브라우저 검증은 저장소의 CDP 검사(`uicheck.mjs`)와 Playwright 스크린샷. Canva·Figma는 쓰지 않음(코드로 그린 그래픽만 쓰므로 필요 없었음).
- 기준선(main): 단위 검사 16개 `test_*.mjs` 모두 통과, Python 338개 통과(1 skip), `build_expedition_stops.py --check` 통과, `expedition_check` 56/56 통과, `uicheck` 142 PASS / 4 FAIL. 기존 실패 4개는 모두 이 환경에서 외부 지도 타일(NASA GIBS·GEBCO)이 막혀서 생기는 것: A-5 공유 링크 배경 복원, 위성 타일, 수심 타일, 2026-10-03 이전 저장값 → 위성. 운영 Supabase가 막혀 있어 `FIXTURE=dist/live-snapshot.json`으로 실행.

## C2 구조 확인 — 완료

프롬프트의 설명과 코드가 일치함. 추가로 확인한 것:
- `countries.json`은 105–150°E · 20–53°N으로 잘린 Natural Earth 경계라 지구 전체를 그릴 수 없음 → 한반도 중심의 가까운 시점(수직 원근 투영, 시야 반경 24°)으로 그려 잘린 가장자리가 구의 림 밖에 놓이게 함.
- 공개 셀은 `data.species[].cells`(`lat0`, `lon0`, `sizeDeg`)로 앱 안에 이미 있음 → 준비 이벤트에 실어 넘김(새로 계산·추정하지 않음).
- `uicheck`는 한 탭에서 해시 없는 첫 화면을 연 뒤 같은 탭에서 다시 불러오므로, 첫 열기에서만 입장 화면이 뜨고 이후는 `sessionStorage`로 건너뜀.

## C3 설계 — 완료

`docs/intro/design.md`.

## C4 구현 — 완료

- 새 파일 `dist/intro.js`(동기 로드, 순수 로직 + `// ---- browser ----` 아래 화면), `dist/intro.css`. `index.html`에 `?v=` 해시로 연결, `_headers` immutable 목록에 추가, `test_client_outdated.mjs` 해시 목록에 추가.
- `app.js`: `loadProgress('map',{geography})`(해안선 준비), `loadDone(state)`(성공 live·저장 사본 snapshot·발행 0종 empty·실패 error 모두). 그 외 동작 변경 없음.

## 다음

- C5 문구 점검, C6 테스트(`test_intro_ui.mjs`, uicheck 입장 화면 검사)와 브라우저 확인, C7 PR.
