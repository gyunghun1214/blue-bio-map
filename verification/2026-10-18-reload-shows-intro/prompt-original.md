# 새로고침(F5)하면 첫 로딩 화면부터 다시 보이기 — Claude Code 작업 지침

## 배경

지도에 들어간 뒤 F5(새로고침)를 누르면 로딩 화면과 지구 진입 화면 없이 **바로 지도가 열린다.** 새로고침하면 사이트를 처음 열었을 때처럼 **로딩 화면(로고 아래 단계 문구 + 물방울 · 물결)부터** 다시 나와야 한다.

배포본 `intro.js`(2026-10-18)를 확인한 결과, 원인은 두 가지다. 둘 다 진입 화면을 건너뛰게 만든다.

1. **sessionStorage 기억**: `enter()`가 `bbvm-intro-entered`(`GATE_KEY`)를 `'1'`로 저장한다. sessionStorage는 새로고침해도 남는다. 그래서 `shouldShowGate()`가 `storage.getItem(GATE_KEY)!=='1'`에서 `false`를 돌려준다.
2. **주소의 앱 해시**: 지도에 들어가면 `app.js`가 주소에 `#m=…`(지도 위치), `#s=…`(종), `v=`(탭) 같은 값을 쓴다. `hasAppHash()`는 `APP_HASH_KEYS`(`s v t b m p u`)가 하나라도 있으면 "공유 링크"로 보고 진입 화면을 건너뛴다. 그래서 새로고침한 주소에도 해시가 있어 건너뛴다.

지금 코드의 주석("used once: a reload or Back after it opens the map as before")을 보면, 새로고침하면 지도로 바로 가는 것은 의도된 동작이었다. 이번에 이 결정을 바꾼다.

- 저장소: `gyunghun1214/blue-bio-map`, 최신 `main`에서 시작
- 작업 브랜치: 세션에 지정된 브랜치. 없으면 `ui/reload-shows-intro`

## 바뀌는 규칙

페이지를 어떻게 열었는지(Navigation Timing의 `type`)에 따라 진입 화면을 정한다.

| 여는 방법 | `type` | 지금 | 바꾼 뒤 |
|---|---|---|---|
| 처음 방문(해시 없음) | `navigate` | 진입 화면 | 진입 화면(그대로) |
| **새로고침**(F5, Ctrl+F5, Shift+F5, 휴대폰 당겨서 새로고침, 주소창 ↻) | `reload` | 지도로 바로 | **진입 화면(로딩부터)** |
| 공유 링크(`#s=…`, `?v=compare` 등)를 새로 열기 | `navigate` | 지도로 바로 | 지도로 바로(그대로) |
| 같은 탭에서 진입 후 주소를 다시 입력해 열기 | `navigate` | 지도로 바로 | 지도로 바로(그대로) |
| 뒤로·앞으로 가기 | `back_forward` | 지도로 바로 | 지도로 바로(그대로) |
| 로고(`a.brand`)를 눌러 돌아오기 | `navigate` | 진입 화면 | 진입 화면(그대로) |

**새로고침만 바꾼다.** 공유 링크를 받은 사람이 바로 그 종·탭을 보는 동작은 유지한다.

## 할 것

### 1. `intro.js` 순수 함수 (node에서 검사되는 부분)

- `shouldShowGate(hash, storage)`에 세 번째 인자 `navType`을 더한다.
  - `navType==='reload'`이면 해시와 저장값에 상관없이 `true`를 돌려준다.
  - 그 밖에는 지금 규칙을 그대로 따른다. 인자를 넘기지 않은 기존 호출과 기존 검사는 결과가 같아야 한다.
- `navType`을 읽는 작은 순수 함수 `navigationType(perf)`를 더한다.
  - `perf.getEntriesByType('navigation')[0]?.type`을 먼저 쓴다.
  - 그것이 없으면 옛 `perf.navigation?.type===1`을 `'reload'`로 본다.
  - 둘 다 없거나 오류가 나면 `'navigate'`를 돌려준다. 그러면 지금 동작과 같아진다.
- 위쪽 설명 주석과 `HOME_KEY` 근처 주석을 새 규칙에 맞게 고친다("새로고침하면 진입 화면부터 다시, 뒤로 가기와 공유 링크는 지도로 바로").

### 2. `intro.js` 브라우저 부분

- `show=shouldShowGate(location.hash+'&'+location.search.slice(1),store)` 호출에 `navigationType(performance)`를 넘긴다.
- 새로고침으로 진입 화면을 보일 때는 `store.removeItem(GATE_KEY)`로 기억을 지운다. 진입한 뒤에는 `enter()`가 다시 저장한다.
- **해시는 지우지 않는다.** `app.js`는 진입 화면 아래에서 해시의 종·지도 위치·탭을 그대로 적용한다. 진입 버튼을 누르면 사용자가 보던 종·지도 위치로 돌아간다. 다만 탭은 누른 버튼(`바다 탐색하기` → 탐색 지도, `지표 살펴보기` → 비교와 지표)이 정한다. 지금 `enter()`·`arrival()` 동작 그대로다.
- **`hashchange` 확인(중요)**: 진입 화면이 떠 있는 동안 `hashchange`에서 앱 해시가 보이면 `fail()`로 진입 화면을 닫는다. 새로고침 + 해시 상황에서 `app.js`가 시작할 때 `location.hash`를 다시 써서 `hashchange`가 일어나면, 진입 화면이 곧바로 닫힌다.
  - 먼저 `app.js`가 시작할 때 해시를 `location.hash=`로 쓰는지, `history.replaceState`로 쓰는지 확인한다. `replaceState`는 `hashchange`를 일으키지 않는다.
  - `hashchange`가 일어난다면, 리스너가 **사용자가 해시를 바꾼 경우에만** 닫게 고친다. 예: 진입 화면이 뜰 때의 해시를 기억하고, 앱 해시 중 `s`·`v`처럼 종·탭을 정하는 키가 바뀌었을 때만 닫는다. `m=`(지도 위치)만 바뀐 것은 무시한다. 어떤 방법을 골랐는지 README에 적는다.
- 브라우저가 새로고침 때 스크롤 위치를 되살리지 않는지 확인한다. 진입 화면이 떠 있는 동안 뒤 페이지가 스크롤되어 있으면 안 된다. 진입 뒤에는 `finish()`의 `scrollTo(0,0)`가 지금처럼 맨 위로 보낸다.

### 3. 로딩 화면은 처음 방문과 똑같이

- 새로고침했을 때도 `INTRO_TIMELINE`(8초: 문구 → 물방울 → 물결 → 진입 화면)을 처음부터 그대로 보인다. 새로고침용 짧은 판을 따로 만들지 않는다.
- '움직임 줄이기'가 켜져 있으면 지금처럼 물결 없이 서서히 바뀌는 판(`crossfadeAt`)으로 보인다.
- 지구 화면을 못 불러왔을 때의 다시 시도·건너뛰기(`.gate-retry`, `.gate-skip`)와, 키보드로 진입 화면에 포커스를 옮기면 바로 끝나는 동작(`skipIntro`)은 그대로 둔다.

## 절대 바꾸지 않을 것

- 공유 링크를 새로 열었을 때 진입 화면을 건너뛰는 동작(`hasAppHash`, `APP_HASH_KEYS`)
- 뒤로·앞으로 가기, 로고 클릭(`HOME_KEY`) 동작
- 로딩·진입 화면의 문구, 시간표(`INTRO_TIMELINE`, `WAVE`), 지구 그리기, 버튼과 그 행선지
- `app.js`의 해시 형식과 `applyHash`·`setView` 동작. 위 2번의 `hashchange` 문제 때문에 꼭 고쳐야 한다면 최소한만 고치고 README에 적는다.
- 다른 탭의 화면, `expedition.html`, 멍이, `scripts/`, `config/`, `dist/*.json`

## 검사

1. 먼저 관련 검사를 찾는다. `verification/` 아래에서 `shouldShowGate`, `GATE_KEY`, `bbvm-intro-entered`, `hasAppHash`, `reload`, `HOME_KEY`로 검색한다(`test_intro_ui.mjs`, `uicheck.mjs` 등).
   - 새로고침하면 지도로 바로 가는 것을 기대하는 검사가 있으면 **기대값을 고친다.** 지우거나 건너뛰지 않는다.
2. 새 단위 검사(`test_intro_ui.mjs`, node)
   - `shouldShowGate('#m=5/36/128', 저장값 '1', 'reload')` → `true`
   - `shouldShowGate('#s=836033&v=compare', null, 'reload')` → `true`
   - `shouldShowGate('#s=836033', null, 'navigate')` → `false`(공유 링크 그대로)
   - `shouldShowGate('', 저장값 '1', 'navigate')` → `false`
   - `shouldShowGate('#m=5/36/128', 저장값 '1', 'back_forward')` → `false`
   - 세 번째 인자가 없을 때 기존 결과와 같다
   - `navigationType`: navigation 항목 `reload` → `'reload'`, 옛 `navigation.type===1` → `'reload'`, 아무것도 없음·예외 → `'navigate'`
3. 새 브라우저 검사(Playwright/uicheck 방식)
   - 첫 방문 → 진입 → 지도를 옮겨 해시에 `m=`가 생긴 것을 확인 → `page.reload()` → `html.gate-on`이 있고 `.gate-loader`가 보이며, 1초 안에는 `.gate.is-ready`가 아니다(로딩부터 시작).
   - 위 상태에서 약 8초 뒤 `.is-ready`가 되고, 진입 화면이 그 사이에 닫히지 않는다(`hashchange` 문제 확인).
   - 진입 버튼을 누르면 지도가 열리고, 새로고침 전과 같은 지도 위치·선택 종이다.
   - 새 페이지에서 `#s=…` 공유 링크를 열면 진입 화면 없이 지도가 열린다.
   - 진입 뒤 다른 페이지(`expedition.html`)로 갔다가 뒤로 가면 진입 화면 없이 지도다.
   - '움직임 줄이기'를 켠 상태에서 새로고침해도 진입 화면이 나온다.
4. CI 전체(`verify.yml`의 `node verification/test_*.mjs`, `python scripts/build_expedition_stops.py --check`, `python -m unittest discover -s verification -p 'test_*.py'`)와 로컬 `verification/uicheck.mjs`를 돌린다.
5. 직접 확인한다.
   - Windows Chrome·Edge: F5, Ctrl+F5, 주소창 ↻
   - macOS Safari·Chrome: ⌘R
   - 휴대폰(iOS Safari, Android Chrome): 당겨서 새로고침
   - 비교와 지표 탭에서 새로고침한 경우도 로딩부터 나온다.
   - 콘솔 오류가 없다.
6. `intro.js`(고쳤다면 `app.js`도)를 고쳤으므로 `index.html`의 `?v=` 해시를 다시 계산한다(README 53행 규칙, LF로 맞춘 파일 내용 sha256 앞 10자, `test_client_outdated.mjs`). `dist/_headers`의 immutable 목록에 있는지도 확인한다.

## 남길 것

- `verification/2026-10-18-reload-shows-intro/README.md`(다른 날짜 폴더 형식)
  - 기준 커밋, 이 프롬프트 경로(`prompts/reload-shows-intro-claude-code.md`)
  - 원인 두 가지(sessionStorage, 앱 해시)와 바뀐 규칙 표
  - `hashchange` 확인 결과와 고른 방법
  - 기기·브라우저별 확인 표
  - 고친 검사 / 지운 검사 / 건너뛴 검사(없으면 '없다')
- PR 본문 첫 줄: "새로고침하면 로딩 화면부터 다시 보임. 공유 링크·뒤로 가기는 지금처럼 지도로 바로."

## 완료 기준

- [ ] 지도·비교 탭 어디서든 F5를 누르면 로딩 화면(문구 → 물방울 → 물결)부터 나오고, 진입 화면이 이어서 열린다
- [ ] 진입하면 새로고침 전에 보던 종·지도 위치가 유지된다
- [ ] 공유 링크를 새로 열기와 뒤로 가기는 지금처럼 지도로 바로 간다
- [ ] 새로고침 후 진입 화면이 저절로 닫히지 않는다(`hashchange`)
- [ ] CI 전체 통과, uicheck 통과, 콘솔 오류 없음
