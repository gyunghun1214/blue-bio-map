# 새로고침(F5)하면 첫 로딩 화면부터 다시 보이기 — 최종 지침 (main `c8ed72c`와 대조해 고친 판)

원본: [`prompt-original.md`](prompt-original.md). 실행 전에 main(`c8ed72c`, PR #237 8초 인트로 포함)과 Chromium 141로
확인한 결과, 원본은 방향은 맞지만 아래 네 곳이 실제와 달라서 고쳤다.

| 원본 | 실제 확인 | 이 판 |
|---|---|---|
| 진입 버튼이 탭을 정한다(“지금 `enter()`·`arrival()` 그대로”) | `enter('explore')`는 `setView`를 부르지 않는다. 비교와 지표에서 새로고침하면 `app.js`가 해시의 `v=compare`를 진입 화면 아래에서 적용하므로, ‘바다 탐색하기’를 눌러도 비교와 지표에 남는다. 자료가 늦게 오면 누른 뒤에 탭이 바뀌기도 한다(`startHash`) | 새로고침으로 진입 화면을 띄울 때 주소의 `v`(탭) 하나만 지운다(쿼리·해시 모두). 종·지도 위치·배경 지도 등 나머지는 그대로 |
| `hashchange` 때문에 진입 화면이 닫힐 수 있다 | `app.js`는 해시를 `history.replaceState`(`writeHash`)로만 쓴다. `location.hash=` 대입은 `dist/*.js` 어디에도 없다 | 리스너는 그대로 둔다. 새 검사로 8초 동안 닫히지 않음을 확인 |
| ‘같은 탭에서 주소를 다시 입력’ = `navigate` | Chromium은 주소창에서 **같은 주소(해시 포함)**로 다시 열면 새로고침으로 처리하고 `type`을 `'reload'`로 적는다(옛 `performance.navigation.type`은 0) | 브라우저가 적는 `type`을 따른다. 이 경우도 로딩 화면부터(README에 적음) |
| (없음) | `app.js`의 `reloadOnceForNewData`는 자료 파일이 화면 코드보다 새 버전이면 `location.reload()`를 한 번 부른다. 이것도 `'reload'`다. 배포 직후 공유 링크를 연 사람이나 ↻(자료 다시 불러오기)를 누른 사람에게 8초 인트로가 뜬다 | 그 직전에 한 번 쓰는 표시 `sessionStorage['bbvm-app-reload']='1'`을 남기고, `intro.js`는 표시가 있는 새로고침을 ‘앱이 한 새로고침’으로 보아 이전 규칙을 따른다. 다만 진입 화면이 떠 있을 때(첫 방문, 로고, 방문자의 F5)는 표시를 남기지 않아 그 화면이 처음부터 다시 나온다 |

그 밖에 원본이 놓친 검사: `test_shared_link.mjs`(호출 문자열을 그대로 비교), `test_client_outdated.mjs`(sessionStorage 키 목록),
`uicheck.mjs`의 공유 링크 검사 6곳(`location.hash=…;location.reload()`로 링크를 열고 있음), M-4(멍이 위치 새로고침),
`offline_check.mjs` O-8(이름은 새로고침이지만 실제로는 주소를 다시 여는 검사), 날짜 폴더 스크립트 3개. 저장소에 `prompts/` 폴더는 없어서
지침은 이 폴더에 둔다. README의 `?v=` 규칙은 53행이 아니라 65행이다.

- 저장소 `gyunghun1214/blue-bio-map`, 최신 `main`에서 시작. 작업 브랜치는 세션 지정 브랜치.
- 머지 = 자동 배포. LKH 상시 승인: 충돌·오류는 알아서 풀고 ready for review → 머지 직전 main 다시 확인 → 직접 머지.

## 바뀌는 규칙

`performance.getEntriesByType('navigation')[0].type`(없으면 옛 `performance.navigation.type===1`)으로 정한다.

| 여는 방법 | `type` | 지금 | 바꾼 뒤 |
|---|---|---|---|
| 처음 방문(해시 없음) | `navigate` | 진입 화면 | 그대로 |
| **새로고침**(F5, Ctrl+F5, Shift+F5, ⌘R, 주소창 ↻, 휴대폰 당겨서 새로고침) | `reload` | 지도로 바로 | **진입 화면(로딩부터)** |
| 주소창에서 같은 주소(해시 포함)로 다시 Enter | Chromium은 `reload` | 지도로 바로 | 진입 화면(브라우저가 새로고침으로 적음) |
| 공유 링크(`#s=…`, `?v=compare` 등)를 새로 열기 | `navigate` | 지도로 바로 | 그대로 |
| 진입한 탭에서 해시 없는 주소를 다시 열기 | `navigate` | 지도로 바로 | 그대로 |
| 뒤로·앞으로 가기 | `back_forward` | 지도로 바로 | 그대로 |
| 로고(`a.brand`, `a.x-brand`) | `navigate` | 진입 화면 | 그대로 |
| 앱이 스스로 하는 새로고침(`reloadOnceForNewData`) | `reload` + 표시 | 앞 화면 그대로 | 그대로: 지도를 보던 중이면 표시를 보고 이전 규칙, 진입 화면이 떠 있었으면 표시 없이 진입 화면 다시 |

## 할 것

### 1. `dist/intro.js` 순수 부분 (node 검사 대상)

- `shouldShowGate(hash, storage, navType)`: `navType==='reload'`이면 `true`. 아니면 지금 규칙 그대로(인자 없이 부른 결과 불변).
- `navigationType(perf)`: navigation 항목의 `type` → 없으면 옛 `perf.navigation?.type===1`이면 `'reload'` → 그 밖·오류는 `'navigate'`.
- `APP_RELOAD_KEY='bbvm-app-reload'`와 `visitorNav(navType, storage)`: 표시를 읽으면 지우고, 표시가 있는 `'reload'`는 `'navigate'`로 바꾼다.
  저장소 오류면 `navType` 그대로.
- `withoutTab(search, hash)`: 쿼리와 해시에서 `v`만 지운 `search+hash` 문자열. `v`가 없으면 원래 문자열 그대로(다시 인코딩하지 않음).
- 맨 위 설명 주석, `shouldShowGate` 위 규칙 주석, `HOME_KEY` 주석(“reload” 표현)을 새 규칙에 맞게 고친다.

### 2. `dist/intro.js` 브라우저 부분

- `nav=visitorNav(navigationType(performance),store)`를 구해 `shouldShowGate(location.hash+'&'+location.search.slice(1),store,nav)`에 넘긴다.
- 새로고침으로 진입 화면을 띄울 때(`show&&nav==='reload'`): `store.removeItem(GATE_KEY)`(진입하면 `enter()`가 다시 저장),
  `history.replaceState(history.state,'',location.pathname+withoutTab(location.search,location.hash))`(바뀔 때만). `app.js`보다 먼저
  (`<head>` 동기 실행) 하므로 `app.js`의 `readHash()`는 `v` 없는 주소를 읽고, 종·지도 위치 등은 진입 화면 아래에서 그대로 적용한다.
- `hashchange` 리스너는 바꾸지 않는다(위 확인). 새로고침으로 뜬 진입 화면이 떠 있는 동안 사용자가 링크를 열면 지금처럼 닫힌다.
- 스크롤: 새로고침 때 브라우저가 스크롤을 되살려 진입 화면 뒤 페이지가 내려가 있지 않은지 확인한다. 되살린다면 진입 화면이 떠 있는
  동안만 `history.scrollRestoration='manual'`로 막고 나갈 때 되돌린다. 안 되살리면 손대지 않는다.

### 3. `dist/app.js` (최소)

- `reloadOnceForNewData`가 `location.reload()` 바로 앞에서 `sessionStorage.setItem('bbvm-app-reload','1')`(try/catch). `<html>`에
  `gate-on`이 있고 `gate-leaving`이 없으면(진입 화면이 떠 있음) 표시를 남기지 않는다. 해시 형식,
  `applyHash`·`setView`·`writeHash`는 그대로.

### 4. 로딩 화면은 처음 방문과 똑같이

- `INTRO_TIMELINE`(8초) 처음부터, 새로고침용 짧은 판 없음. 움직임 줄이기면 `crossfadeAt` 판. `.gate-retry`·`.gate-skip`·`skipIntro` 그대로.

## 바꾸지 않을 것

공유 링크·뒤로/앞으로·로고 규칙, 문구, `INTRO_TIMELINE`·`WAVE`, 지구 그리기, 버튼과 행선지, `app.js`의 해시 형식과 `applyHash`·`setView`,
다른 탭 화면, `expedition.html`, 멍이, `scripts/`, `config/`, `dist/*.json`.

## 검사

1. 단위(node)
   - `test_intro_ui.mjs`: 원본의 `shouldShowGate`·`navigationType` 경우 전부 + `visitorNav`(표시 있음/없음/저장소 오류) + `withoutTab`
     (해시·쿼리·둘 다·`v` 없음·다른 키 보존) + 브라우저 부분 정적 검사(호출에 `nav`, 새로고침일 때만 `GATE_KEY` 지움·`replaceState`,
     `hashchange` 리스너 불변). 기존 메시지 ‘a reload opens the map as before’는 실제 뜻(주소를 다시 열기)으로 고친다.
   - `test_shared_link.mjs`: 호출 문자열 기대값을 `…,store,nav)`로 고친다.
   - `test_client_outdated.mjs`: 새로고침할 때 표시가 남고, 안 할 때는 안 남는다. 키 목록 비교는 `reload:` 키만.
2. 브라우저 — CI의 `uicheck.mjs`
   - 공유 링크를 `location.hash=…;location.reload()`로 열던 검사 6곳(가중치 링크 2, t=value 2, A-5, G-4)은 새로 열기(about:blank →
     링크)로 바꾼다. 기대값은 그대로.
   - M-4: 새로고침 뒤 진입 화면을 Enter로 지나서 같은 값을 확인.
   - G-7 ‘a reload after coming back’은 실제로 주소를 다시 여는 검사라 이름만 고친다.
   - 새 G-11: 비교와 지표·지도 위치를 바꾼 뒤 F5 → 1초 안 로딩(준비 전, `entered` 지워짐, 주소에 `v` 없음·`s`/`m` 그대로) → 8초 동안
     닫히지 않고 준비 → Enter → 탐색 지도, 같은 종·지도 위치. 탐색 지도에서 F5 → ‘지표 살펴보기’ → 비교와 지표. 진입 뒤 다른 페이지
     → 뒤로 → 진입 화면 없음. 앱이 한 새로고침(표시) → 진입 화면 없음, 표시 지워짐. 진입 화면이 떠 있을 때 앱이 한 새로고침 → 진입 화면 다시.
3. 브라우저 — `offline_check.mjs`: O-8 이름 고침, 새 O-8b(오프라인 시연에서 F5 → 진입 화면, 오프라인 문구, Enter → 오프라인 지도).
   `docs/offline-demo.md` 항목 수 고침.
4. 이 폴더의 `check.mjs`(Playwright): 위 경우 전부 + Ctrl+F5, 근거와 방법에서 F5 → ‘전체 출처·방법 보기’, 공유 링크 새 탭·같은 탭,
   같은 주소 다시 열기(Chromium `reload`), 실제 자료 버전 올림으로 일어나는 자동 새로고침, 움직임 줄이기, 390px, 스크롤 위치,
   새로고침 진입 화면 중 링크 열기, 콘솔 오류. 캡처 몇 장.
5. 날짜 폴더 스크립트 중 새로고침 = 지도로 바로를 기대하는 것(`2026-10-18-intro-ripple-8s/check.mjs` 5번, `2026-10-landing-globe/landing_check.mjs`
   ‘Same tab, reload’, `2026-10-18-mobile-polish/hint.mjs`)은 기대를 새 규칙으로 고친다. 프로젝트 폴더의 `shared-link-mobile/repro.mjs`
   A2(새로고침)도 고쳐 다시 돌린다. 지우거나 건너뛰지 않는다.
6. CI 전체(`verify.yml`의 node 검사, `build_expedition_stops.py --check`, Python 3.12 `unittest`)와 로컬 `uicheck.mjs`, `offline_check.mjs`.
7. `intro.js`·`app.js`의 `?v=`를 LF로 맞춘 sha256 앞 10자로 다시 계산(`test_client_outdated.mjs`). 둘 다 `dist/_headers` immutable 목록에 있음.
8. 실제 기기(Windows Chrome·Edge F5/Ctrl+F5, macOS Safari ⌘R, iOS Safari·Android Chrome 당겨서 새로고침)는 클라우드에서 확인할 수 없다.
   README에 ‘확인 못 함’으로 적고 LKH에게 확인을 부탁한다.

## 남길 것

- `verification/2026-10-18-reload-shows-intro/README.md`: 기준 커밋, 원본·최종 지침, 원인 두 가지, 바뀐 규칙 표, `hashchange` 확인과
  고른 방법, `v`만 지우는 이유, 앱 새로고침 표시, 기기·브라우저별 확인 표, 고친/지운/건너뛴 검사(없으면 ‘없다’), 검사 결과.
- `README.md` 시작 화면 줄과 `docs/intro/design.md` 건너뛰기 규칙에 새로고침 규칙 한 줄.
- 프로젝트 폴더 `/mnt/project-files/reload-shows-intro/`에 README·최종 지침·캡처 사본.
- PR 본문(귀속 줄 다음) 첫 줄: “새로고침하면 로딩 화면부터 다시 보임. 공유 링크·뒤로 가기는 지금처럼 지도로 바로.”

## 완료 기준

- [ ] 지도·비교·근거 탭 어디서든 F5 → 로딩(문구 → 물방울 → 물결)부터, 이어서 진입 화면
- [ ] 진입하면 새로고침 전의 종·지도 위치 유지, 탭은 누른 버튼대로
- [ ] 공유 링크 새로 열기, 뒤로 가기, 앱이 스스로 한 새로고침은 지금처럼 지도로 바로
- [ ] 새로고침 후 진입 화면이 저절로 닫히지 않음(`hashchange`)
- [ ] CI 전체 통과, uicheck·offline_check 통과(클라우드 지도 타일 환경 실패 4건 제외), 콘솔 오류 없음
