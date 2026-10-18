# 새로고침하면 로딩 화면부터 다시 (2026-10-18)

지도에 들어간 뒤 새로고침(F5)하면 로딩 화면 없이 바로 지도가 열리던 것을, 첫 방문처럼 **로딩 화면(로고 아래 문구 → 물방울 → 물결 →
진입 화면, 8초)부터** 다시 보이게 바꿨다. 탐색 지도 · 비교와 지표 · 근거와 방법 어디서든 같다. 진입하면 새로고침 전에 보던 종과 지도 위치가
그대로이고, 탭은 누른 버튼(바다 탐색하기 → 탐색 지도, 지표 살펴보기 → 비교와 지표, 전체 출처·방법 보기 → 근거와 방법)이 정한다.
공유 링크를 새로 열기, 뒤로·앞으로 가기, 로고는 전과 같다.

- 기준 커밋: main `c8ed72c` (PR #237 머지, 8초 인트로 `INTRO_TIMELINE`).
- 지침: 원본 [`prompt-original.md`](prompt-original.md)(LKH가 올린 `reload-shows-intro-claude-code.md`. 원본이 가리키는 `prompts/` 폴더는
  저장소에 없다), main과 대조해 보완한 [`prompt-final.md`](prompt-final.md). 원본과 다르게 한 곳은 넷이다.
  1. **해시를 그대로 두면 '바다 탐색하기'가 비교와 지표로 돌아간다.** `enter('explore')`는 `setView`를 부르지 않아, app.js가 주소의
     `v=compare`로 연 탭이 진입 화면 아래에 그대로 남는다. 그래서 새로고침일 때 주소에서 **탭(`v`)만** 빼고 종(`s`)·지도 위치(`m`)·나머지는 둔다.
  2. **`hashchange`는 일어나지 않는다.** app.js는 주소를 `history.replaceState`로만 쓴다(`writeHash`). `dist/*.js` 어디에도 `location.hash=`가
     없다(`test_intro_ui.mjs`가 확인). intro.js가 `v`를 빼는 것도 `replaceState`다. 그래서 `hashchange` 리스너는 고치지 않았다.
     새로고침 진입 화면이 떠 있는 동안 사용자가 링크를 열면 첫 방문 화면과 같이 화면을 닫고 링크를 연다(검사함).
  3. **Chromium은 주소창에서 같은 주소를 다시 열면 '새로고침'으로 알릴 때가 있다.** 원본 표의 '주소를 다시 입력해 열기 = navigate'와 다르다.
     규칙은 브라우저가 알려 주는 종류를 그대로 따른다(아래 '여는 방법별 결과').
  4. **app.js도 페이지를 새로고침한다.** 자료 파일이 화면 코드보다 새 버전이면 `reloadOnceForNewData`가 `location.reload()`를 한 번 부른다
     (배포 직후 열려 있던 탭에서 ↻를 누른 경우 등). 이것도 '새로고침'이라, 지도를 보던 사람에게 8초 인트로가 뜰 뻔했다. 그 직전에 한 번 쓰는
     표시(`sessionStorage['bbvm-app-reload']`)를 남겨, intro.js가 그 새로고침은 그 전 열기와 같은 규칙으로 연다. 진입 화면이 떠 있던 중이면
     표시를 남기지 않아 진입 화면이 처음부터 다시 나온다.

  원본이 놓친 검사: `uicheck.mjs`의 공유 링크 검사 6곳이 링크를 `location.hash=…;location.reload()`로 열고 있었다(새 규칙에서는 진입 화면이
  떠서 실패한다). 그 밖에 M-4, G-7의 이름, `offline_check.mjs` O-8, 날짜 폴더 스크립트 3개, 프로젝트 폴더의 `shared-link-mobile/repro.mjs` A2.

## 원인과 바뀐 규칙

원인은 원본 지침대로 둘이다. ① 진입하면 `enter()`가 `sessionStorage['bbvm-intro-entered']`를 남기고, 새로고침해도 남는다. ② 진입 뒤 app.js가
주소에 `#s=…&v=…&m=…`를 쓰고, `hasAppHash()`가 이것을 공유 링크로 본다. 이제 intro.js가 페이지를 어떻게 열었는지(Navigation Timing `type`)를
먼저 보고, 새로고침이면 ①·②와 상관없이 진입 화면을 로딩부터 보인다.

| 여는 방법 | 브라우저가 알리는 종류 | 전 | 후 |
|---|---|---|---|
| 처음 방문(해시 없음) | `navigate` | 진입 화면 | 진입 화면(그대로) |
| **새로고침**(F5, Ctrl+F5, Shift+F5, 주소창 ↻, 휴대폰 당겨서 새로고침) | `reload` | 지도로 바로 | **로딩부터 진입 화면** |
| 공유 링크를 새로 열기(새 탭, 다른 페이지에서) | `navigate` | 지도로 바로 | 그대로 |
| 지도를 보던 탭에서 공유 링크 열기(`#` 뒤만 바뀜) | 같은 페이지 | 링크의 탭·종 | 그대로 |
| 뒤로·앞으로 가기 | `back_forward` | 지도로 바로 | 그대로 |
| 로고(`a.brand`) | `navigate` + 한 번 쓰는 신호 | 진입 화면 | 그대로 |
| 앱이 스스로 하는 새로고침(지도를 보던 중) | `reload` + 표시 | 지도로 바로 | 그대로 |
| 앱이 스스로 하는 새로고침(진입 화면이 떠 있던 중) | `reload` | 그 전 규칙대로 | 진입 화면 다시(로딩부터) |

새로고침으로 진입 화면을 보일 때 intro.js가 하는 일(`dist/intro.js` 브라우저 부분):

- `bbvm-intro-entered`를 지운다. 진입하면 `enter()`가 다시 남긴다.
- 주소에서 `v`만 뺀다(`withoutTab`, 쿼리와 해시 모두, `replaceState`). app.js는 진입 화면 아래에서 종·지도 위치를 그대로 적용한다.
- 휴대폰 화면에서 Chromium이 뒤 페이지 스크롤을 되살렸다(시험에서 y=211). 진입 화면이 떠 있는 동안 `history.scrollRestoration`을
  `'manual'`로 두고, 화면이 닫히면(`release()`) `'auto'`로 돌린다. 진입한 뒤는 전처럼 `finish()`의 `scrollTo(0,0)`.
- 로딩 화면은 첫 방문과 같은 `INTRO_TIMELINE` 8초다. 새로고침용 짧은 판은 없다. 움직임 줄이기면 전처럼 물결 없는 판(`crossfadeAt`).

새로고침 진입 화면을 링크로 닫으면 그 탭은 첫 방문 화면을 링크로 닫았을 때처럼 '아직 들어가지 않은 탭'이다. 그 뒤 같은 탭에서 `#` 없는 주소를
열면 진입 화면이 나온다.

## 바뀐 파일

| 파일 | 바꾼 것 |
|---|---|
| `dist/intro.js` | 순수 부분: `shouldShowGate(hash, storage, navType)`(세 번째 인자 `'reload'`면 `true`, 없으면 전과 같음), `navigationType(perf)`(Navigation Timing 2 → 옛 `performance.navigation.type===1` → `'navigate'`), `APP_RELOAD_KEY`와 `visitorNav(navType, storage)`(표시를 읽으면 지우고, 표시가 있는 `'reload'`는 `'navigate'`), `withoutTab(search, hash)`. 브라우저 부분: 위 '하는 일', `release()`의 스크롤 복원. 맨 위 설명과 `HOME_KEY` 주석. `hashchange` 리스너·`INTRO_TIMELINE`·`WAVE`·문구·버튼·지구 그리기는 그대로 |
| `dist/app.js` | `reloadOnceForNewData`에서 `location.reload()` 바로 앞 한 줄(진입 화면이 없거나 닫히는 중이면 표시)과 주석. 해시 형식·`applyHash`·`setView`·`writeHash`는 그대로 |
| `dist/index.html` | `intro.js?v=`, `app.js?v=`(LF로 맞춘 내용의 sha256 앞 10자). 둘 다 `dist/_headers`의 immutable 목록에 있다 |
| `README.md`, `docs/intro/design.md` | 시작 화면 줄·건너뛰기 규칙에 새로고침 규칙 |
| `docs/offline-demo.md` | 오프라인 시연에서도 새로고침하면 첫 화면부터, 점검 항목 수 21 → 23 |

그대로 둔 것: 공유 링크·뒤로/앞으로·로고 규칙(`hasAppHash`, `APP_HASH_KEYS`, `HOME_KEY`), 문구, 시간표, 다른 탭 화면, `expedition.html`, 멍이,
`scripts/`, `config/`, `dist/*.json`.

## 검사

| 구분 | 내용 |
|---|---|
| 고친 검사 | `test_intro_ui.mjs`: 로고 신호 메시지('a reload opens the map as before' → 실제 뜻인 '주소를 다시 열기'), vm 내보내기. `test_shared_link.mjs`: 호출 문자열 `…,store,nav)`. `test_client_outdated.mjs`: 키 목록 비교는 `reload:` 키만 |
| 고친 검사 | `uicheck.mjs`: 공유 링크를 `location.hash=…;location.reload()`로 열던 6곳(가중치 링크 2, `t=value` 2, A-5, G-4)을 새로 열기(`about:blank` → 링크, `openLink`)로. 기대값은 그대로. M-4: 새로고침 뒤 진입 화면을 Enter로 지나 같은 값 확인. G-7: 실제로는 주소를 다시 여는 검사라 이름만 |
| 고친 검사 | `offline_check.mjs` O-8: 실제로는 같은 탭에서 주소를 다시 여는 검사라 이름만. 날짜 폴더 `2026-10-18-intro-ripple-8s/check.mjs` 5번, `2026-10-landing-globe/landing_check.mjs` 'Same tab, reload', `2026-10-18-mobile-polish/hint.mjs`, 프로젝트 폴더 `shared-link-mobile/repro.mjs` A2: 새로고침 = 진입 화면으로 기대를 고침(A2는 진입 화면 뒤 그 탭의 버튼까지) |
| 새 검사 | `test_intro_ui.mjs` (1b): 원본 지침의 `shouldShowGate`·`navigationType` 경우 전부, 세 번째 인자 없을 때 결과가 전과 같음, `visitorNav`, `withoutTab`, app.js 표시 줄, 브라우저 부분 정적 검사(`nav` 전달, 새로고침일 때만 `GATE_KEY` 지움·`replaceState`, `release()` 스크롤 복원, `location.hash=` 없음). `test_client_outdated.mjs`: 새로고침 때 표시, 안 할 때 없음, 진입 화면이 떠 있으면 표시 없음, 닫히는 중이면 표시 |
| 새 검사 | `uicheck.mjs` G-11(6개): 비교와 지표에서 F5 → 로딩부터 · 8초 동안 닫히지 않음 · Enter → 같은 종·지도 위치의 탐색 지도, 탐색 지도에서 F5 → 지표 살펴보기, 바다 탐험 → 뒤로, 앱이 한 새로고침. `offline_check.mjs` O-8b(2개): 오프라인 시연에서 F5 → 오프라인 문구가 있는 진입 화면 → Enter → 오프라인 지도. 이 폴더의 [`check.mjs`](check.mjs)(35개) |
| 지운 검사 / 건너뛴 검사 | 없다 |

## 결과

- CI와 같은 단위 검사: `verify.yml`의 node 검사 전부, `build_posthoc_scorecard.py --csv --check`, `build_aquaculture_tier.py --check`,
  `build_expedition_stops.py --check` 통과. Python 3.12 `unittest` 484개 통과(건너뜀 3은 원래 있던 것: shapely 없음, lineage 메모, git 전체 이력).
- 이 폴더 [`check.mjs`](check.mjs): 35/35([`results.json`](results.json)).
- 프로젝트 폴더 `shared-link-mobile/repro.mjs`: 63/63. A2(새로고침) 9건 모두 진입 화면이 로딩부터 나오고, 그 탭의 버튼을 누르면 같은 탭·종·`m=`.
- `uicheck.mjs`, `expedition_check.mjs`, `offline_check.mjs`, 날짜 폴더 스크립트 3개: 실행 중.

## 여는 방법별 결과 (이 폴더 `check.mjs`, Chromium 141)

| 여는 방법 | 브라우저가 알린 종류 | 진입 화면 |
|---|---|---|
| F5(`page.reload`) — 비교와 지표 · 탐색 지도 · 근거와 방법 | `reload` | 나옴(로딩부터) |
| Ctrl+F5(캐시를 건너뛰는 새로고침) | `reload` | 나옴 |
| 390px 휴대폰 화면, 스크롤 내린 비교와 지표에서 F5 | `reload` | 나옴, 뒤 페이지는 맨 위 |
| 움직임 줄이기(시스템 설정 / 화면의 스위치)에서 F5 | `reload` | 나옴 |
| 지도를 보던 탭에서 공유 링크(`#` 뒤만 바뀜) | 같은 페이지 | 안 나옴, 링크의 탭·종 |
| 공유 링크를 같은 탭에서 새 페이지로(`about:blank` → 링크) | `navigate` | 안 나옴 |
| 공유 링크를 새 탭에서(390) | `navigate` | 안 나옴 |
| 바다 탐험 → 뒤로 | `back_forward` | 안 나옴 |
| `#` 있는 같은 주소를 주소창에서 다시 열기 | 이번 검사(뒤로 간 다음): 같은 페이지 / 앞선 시험: `reload` | 같은 페이지면 안 나옴 / `reload`면 나옴 |
| `#` 없는 주소를 다시 열기(들어간 뒤) | `navigate` | 안 나옴 |
| F5 뒤 진입 화면이 떠 있을 때 링크 열기 | `reload` → 링크 | 링크가 화면을 닫음 |
| 앱이 스스로 한 새로고침(지도를 보던 중, ↻로 새 버전 발견) | `reload` + 표시 | 안 나옴, 표시는 한 번 쓰고 지움 |
| 앱이 스스로 한 새로고침(첫 방문 진입 화면이 떠 있던 중) | `reload` | 나옴, 한 번만(되풀이 없음) |

## 기기·브라우저별 확인

| 기기·브라우저 | 방법 | 결과 |
|---|---|---|
| Chromium 141(클라우드, Playwright) 1440·390 | F5(`page.reload`), Ctrl+F5(캐시 무시 새로고침), 앱 안의 `location.reload()` | 확인: 로딩부터 진입 화면, 진입하면 같은 종·지도 위치 |
| Windows Chrome·Edge | F5, Ctrl+F5, 주소창 ↻ | **확인 못 함**(클라우드에 없음) |
| macOS Safari·Chrome | ⌘R | **확인 못 함** |
| iOS Safari, Android Chrome | 당겨서 새로고침 | **확인 못 함** |

실제 키보드 F5와 휴대폰 당겨서 새로고침은 클라우드 브라우저에서 누를 수 없다. 둘 다 표준상 `type`이 `reload`인 새로고침이고, Safari 15 이상도
같은 표준(Navigation Timing 2)을 쓴다(그 전 판은 옛 `performance.navigation.type`). 배포 뒤 위 네 줄을 직접 확인해야 한다.

## 다시 돌리기

`dist/`를 `python3 -m http.server 8765 --bind 127.0.0.1 --directory dist`로 띄우고
`FIXTURE=dist/live-snapshot.json node verification/2026-10-18-reload-shows-intro/check.mjs <출력 폴더>`(Playwright, `CHROME_PATH` 선택).
