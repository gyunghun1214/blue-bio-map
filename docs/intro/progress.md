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

## C5 문구 점검 — 완료

- 입장 화면 문구에 '서식', '살고 있다', '분포한다', 과장 표현, 'OceanX'가 없음(`test_intro_ui.mjs` (8)이 검사).
- "관측 기록이 있는 바다를 공개 집계 격자로" — 기록 위치 요약이지 서식지가 아님을 유지. 종 수는 앱이 불러온 `publishedCount`·`candidateCount`에서만 채움.
- 자료 이름(WoRMS·OBIS·GBIF·IUCN 적색목록·ChEMBL·식품성분표)은 README와 app.js에 실제로 나오는 것만(같은 테스트가 검사).

## C6 검증 — 완료

- 새 `verification/test_intro_ui.mjs`(CI 단위 검사에 추가): 건너뛰기 규칙, 실제 준비 단계, 최소 0.6초·최대 7초, 네 가지 불러오기 결과 모두 입장 가능, Enter 규칙, 투영, 마크업(기본 숨김·동기 로드·`?v=`), 문구, app.js 이벤트.
- `uicheck.mjs`에 입장 화면 검사 8개(G-1…G-6): 첫 열기 → 뒤 화면·챗봇 inert → 3/3 → 버튼 포커스 → Enter로 입장·포커스 검색창·같은 탭 기억, 공유 링크는 바로 열림, 390px 넘침 없음과 버튼, 불러오기 실패에서도 입장과 안내. 테스트 전용 우회 없음.
- 결과(이 환경, `FIXTURE=dist/live-snapshot.json`): uicheck **150 PASS / 4 FAIL**(4개는 C1 기준선과 같은 외부 타일 차단 항목), expedition_check 56/56, `test_*.mjs` 17개 통과, Python 338개 통과(1 skip), `build_expedition_stops.py --check` 통과.
- 브라우저(Playwright, Chromium 141) 직접 확인, 스크린샷 `verification/2026-10-08-intro/`:
  - 데스크톱 1440×900: 로딩 → 입장(버튼 포커스) → Enter → 지도, 포커스 검색창, 같은 탭 새로고침은 바로 지도.
  - 휴대폰 390×844(터치): 가로 넘침 없음, 탭으로 입장, 포커스 `<main>`(키보드가 뜨지 않음).
  - 모션 감소: 궤도·흔들림·점 깜빡임 없음, 입장 즉시 전환, "움직임 줄이기" 눌린 상태로 시작.
  - 느린 네트워크(운영 API 9초 지연): 7.5초에 입장 화면이 열리고 "자료를 계속 불러오는 중입니다. 먼저 들어가도 됩니다".
  - 운영 DB 연결 실패: 저장 사본으로 열리고 "운영 DB에 연결하지 못해 2026-10-01 기준 공개 자료 사본으로 엽니다".
  - JavaScript 꺼짐: 입장 화면 없이 기존 지도 페이지.
- 메인 페이지에 더해진 크기: `intro.js` 13.2 KB(gzip 5.6 KB) + `intro.css` 9.2 KB(gzip 3.1 KB) + `index.html` 마크업 약 4 KB. 해안선은 앱이 이미 받은 것을 이벤트로 넘겨 다시 받지 않음.
- 스크린샷은 저장소 크기를 줄이려고 256색 PNG로 저장(그라데이션에 약간의 띠가 보일 수 있음, 실제 화면은 아님).

## C7 PR — 완료

- draft PR #156. 머지하지 않음(머지 = Cloudflare 운영 배포).

## 남은 한계

- 구의 해안선은 `countries.json`(105–150°E · 20–53°N로 잘린 파일) 범위만 그린다. 가장자리는 림 그림자로 가렸지만 범위 밖 대륙은 없다.
- #152(verified-4.8)가 먼저 머지되면 `app.js?v=` 해시가 충돌한다. 나중에 머지되는 쪽에서 해시만 다시 계산하면 된다.
- 운영 Supabase가 막힌 환경이라 실제 운영 API로는 CI(Windows)에서 확인된다.
