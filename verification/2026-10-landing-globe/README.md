# 첫 화면(#site-gate) 시안 구도 재구성 — 진행 기록

"이어서"라고 하면 이 파일부터 읽는다. 시안: 저장소 위 폴더 `../첫화면_디자인시안.png`(1672×941).

## 단계 0 — 완료

- `git remote -v` = gyunghun1214/blue-bio-map. 추적 파일 수정 없음(추적 안 되는 `verification/artifacts/`는 9월 패널 검토 스크린샷이라 그대로 둠).
- `git fetch` 후 `origin/main`에서 `design/landing-globe` 생성. **시작 커밋 `cb4428b`**(프롬프트 기준과 같음 → intro.*·index.html 머리·G-1~G-6 변화 없음). 실수로 main에 push하지 않게 upstream 해제.
- PR #162(오프라인 모드)는 만들지 않음. 새 자료는 모두 저장소 안 파일(`dist/vendor/globe-v1/`).

## 단계 1 — 구조 확인(cb4428b) — 완료

프롬프트의 표와 코드가 일치함을 확인(intro.js `APP_HASH_KEYS`·`shouldShowGate`·`GATE_STEPS`·`gateTick`·`gateNote`·`keyAction`·`hold()`·`enter()`, app.js `loadProgress`/`loadDone`·`setView(view,toTop)`·`writeHash`, uicheck G-1~G-6, test_intro_ui (1)~(9)).

- 고칠 파일: `dist/intro.js`, `dist/intro.css`, `dist/index.html`(#site-gate 마크업과 두 `?v=`), `verification/test_intro_ui.mjs`, `verification/uicheck.mjs`(G-1 문장), `docs/intro/design.md`·`progress.md`. 새 파일: `dist/vendor/globe-v1/`(자료 2개 + SOURCE.txt), `scripts/prepare_globe.py`. app.js는 고치지 않는다(`setView`가 이미 전역).
- 배치: 기존 `.gate-hero` 안을 헤더 줄(브랜드 · 탐색 지도 · 비교와 지표 · 움직임 줄이기 스위치) / 왼쪽 본문(`.gate-center`) / 정보 카드 / 하단 띠로 다시 짠다. 검사가 읽는 클래스·id는 그대로.
- 구 그리기: 정사영 + 고정 회전 중심. 육지·수심 면은 벡터로 채우되, 지평선 뒤 꼭짓점은 테두리 원으로 밀어 붙여(다각형이 통째로 빠지지 않음) 채우고, 선은 지평선에서 끊는다. 투영 좌표는 회전이 고정이라 자료가 들어올 때 한 번만 계산하고, 창 크기가 바뀌면 크기만 다시 곱한다(매 프레임 투영 없음).
- 바꿔야 할 검사 기대값: test_intro_ui (3) 종 수 문장, (6) 투영 함수, (8) 출처 이름(링크 글자·방법 탭 허용), uicheck G-1 종 수 문장. G-2·G-3·G-5·G-6은 그대로 통과해야 한다.

## 단계 2 — 갈 곳을 고르는 진입 — 완료

- `enter(target)`: 'explore'(기본)·'compare'·'method'. 순수 함수 `arrival(target,touch)`가 탭·포커스·스크롤을 정하고, 브라우저는 기존 finish 뒤 `setView(view,!scroll)`만 부른다(해시·종·칩·지도 좌표는 앱 그대로).
- 포커스: 탐색 지도 `#search`, 비교와 지표 `#cmp-search`, 근거와 방법 `#all-sources`. 터치는 탐색 지도처럼 비교와 지표도 `<main>`(휴대폰 키보드가 갑자기 뜨지 않게 — 기존 규칙을 같은 뜻으로 넓힘).
- 출처 보기: app.js의 기존 "출처" 링크와 같은 방식(`setView('method',false)` 뒤 `.source-section`으로 스크롤, 그 안의 `#all-sources`에 포커스). 감속이면 `behavior:'auto'`.
- 버튼은 `data-go="explore|compare|method"`로 연결(마크업은 단계 3). 뒤로 가기·로고로 첫 화면 복귀는 넣지 않음(같은 탭 한 번 규칙 G-3과 충돌, 뒤 화면의 replaceState 해시와 섞임).
- 시험: test_intro_ui (5)에 `arrival` 표(터치/비터치, 알 수 없는 값 → 탐색 지도), 대상 id가 index.html에 있는지, `setView`가 전역 함수인지.

## 시안 측정(2026-10-13, 이 저장소 `fitlimb` 방식: 줄마다 첫 밝은 점 → 최소제곱 원)

- 구: 중심 (75.9% W, 72.6% H), 반지름 높이의 77.4%(잔차 중앙값 1.6 px, 점 210개). 프롬프트 값(75%·71%·76%)과 2% 안.
- 한반도(36°N 127.5°E)는 시안에서 (67.6%, 43.0%) → 정사영 회전 중심 **141°E 14°N**.
- 글자 띠(px, 1672×941): 브랜드 21–56 · 소제목 185–202 · 제목 239–336/359–456(줄 간격 120) · 설명 496–519/532–552 · 버튼 602–661 · 종 수 719–732 · 하단 글 884–899. 카드 1323–1532 × 455–578.
