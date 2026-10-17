# 첫 화면 예시 카드 3개(`.gate-ex`) 제거 — Claude Code 작업 지침

## 배경

첫 화면(`.gate`, `index.html` + `intro.js` + `intro.css`)의 '바다 탐색하기 / 지표 살펴보기' 버튼 아래에는 예시 종 카드 세 줄이 있다.

| `data-ex` | 이름(데이터로 채움) | 설명 | 값(데이터로 채움) |
|---|---|---|---|
| `use` | 참굴 | 활용 지표 1위 | BBVI 72 |
| `conservation` | 해삼 · 전복 | 보전 지표 높음 | IUCN EN |
| `stock` | 살오징어 | 어획량 감소 신호 | KOSIS −79.8% |

첫 화면은 '문제 → 해결 → 바다 탐색하기' 흐름으로 읽혀야 한다. 그런데 이 카드들이 그 뒤에 붙어서 버튼 아래가 복잡해진다. 같은 정보는 탐색 지도와 비교 탭에 이미 있다. 이 작업은 **세 카드를 첫 화면에서 통째로 없애는 것**이다. **화면 표시만 바꾼다.**

- 저장소: `gyunghun1214/blue-bio-map`, 최신 `main`에서 시작
- 작업 브랜치: 세션에 지정된 브랜치. 없으면 `ui/intro-remove-examples`

## 할 것

1. **`index.html`**: `<ul class="gate-ex" aria-label="이 지도에서 바로 열어 볼 수 있는 종">…</ul>` 전체를 지운다(`li[data-ex]` 세 개 포함). CSS로 숨기기만 하지 않는다. 빈 목록이 DOM이나 스크린리더에 남지 않게 하기 위해서다.
2. **`intro.js`**
   - `renderExamples()` 함수와 그 호출을 지운다.
   - `exampleLinks()`처럼 `renderExamples()`만 쓰던 보조 함수가 있으면 함께 지운다. 다른 곳에서도 쓰면 남긴다(지우기 전에 `grep`으로 확인한다).
   - 지구본 배치 계산(`layout()` 근처)에서 `.gate-ex li`의 위치를 모으는 `.concat([...el.querySelectorAll('.gate-ex li')]…)` 부분을 지운다. 나머지 글 상자(`.gate-why-k`, `.gate-problems li`, `.gate-lead`, `.gate-more`, `.gate-note`, `.gate-counts`) 계산은 그대로 둔다.
3. **`intro.css`**
   - `.gate-ex`로 시작하는 규칙(`.gate-ex`, `.gate-ex.is-on`, `.gate-ex li`, `.gate-ex li:hover`, `.gate-ex p`, `.gate-ex-name`, `.gate-ex-fact`, `.gate-ex-val`, 미디어 쿼리 안의 같은 규칙)을 지운다.
   - 여러 선택자를 묶은 규칙에서는 `.gate-ex`만 빼고 나머지는 남긴다. 예: `.gate-why,.gate-ex{max-width:…}` → `.gate-why{max-width:…}`, `.gate:not(.is-ready) .gate-ex{pointer-events:none}`은 줄째 지운다.
4. 카드가 빠진 뒤 버튼 줄 아래 여백이 어색하게 남거나, 지구본이 글 위로 올라오지 않는지 확인한다. 필요하면 `.gate-actions` / `.gate-counts`의 아래 여백만 조정한다.

## 절대 바꾸지 않을 것

- 첫 화면의 다른 문구: 제목, '문제' 세 줄, '해결' 문장, 버튼, `.gate-counts`, 오른쪽 '한반도 주변 해역' 카드, 아래 '함께 읽는 공개 자료'
- **데이터**: `examples`를 만드는 build 스크립트(`scripts/`)와 `dist/*.json`의 `examples` 값은 그대로 둔다. 화면에서 그리지 않을 뿐이다. 나중에 되살릴 수 있게 하고, 공식값 검사와 엮이지 않게 하기 위해서다.
- 지구본 회전·드래그, '움직임 줄이기' 스위치, `gate-enter`·`data-go` 동작
- 다른 탭(`#explore`, `#compare`, `#method`), `expedition.html`, 멍이

## 검사

1. 먼저 카드에 묶인 검사를 찾는다. `verification/` 아래에서 `gate-ex`, `data-ex`, `활용 지표 1위`, `보전 지표 높음`, `어획량 감소 신호`, `renderExamples`로 검색한다(`test_intro_ui.mjs`, `uicheck.mjs` 등).
   - 찾으면 **기대값을 고친다.** 카드가 없는지 보도록 바꾼다. 검사를 지우거나 건너뛰지 않는다.
   - `examples` **데이터**를 확인하는 build 검사는 고치지 않는다(데이터는 그대로이므로 그대로 통과해야 한다).
2. 새 검사 하나를 더한다. 첫 화면에 `.gate-ex`와 `[data-ex]`가 없고, 첫 화면 `textContent`에 위 세 설명 문구가 없는지 확인한다.
3. CI 전체(`verify.yml`의 `node verification/test_*.mjs`, `python scripts/build_expedition_stops.py --check`, `python -m unittest discover -s verification -p 'test_*.py'`)와 로컬 `verification/uicheck.mjs`를 돌린다.
4. 직접 확인한다.
   - 390·768·1100·1440px에서 가로 넘침이 없다(`scrollWidth <= clientWidth`).
   - 각 폭에서 지구본이 제목·문제·해결·버튼과 겹치지 않는다.
   - 콘솔 오류가 없다(지운 요소를 찾는 `q('.gate-ex')`가 남아 `null` 오류가 나지 않는지 본다).
   - '움직임 줄이기'를 켠 상태에서도 첫 화면이 정상으로 보인다.
5. `intro.js`·`intro.css`를 고쳤으므로 `index.html`의 `?v=` 해시를 다시 계산한다(README 53행 규칙, LF로 맞춘 파일 내용 sha256 앞 10자, `test_client_outdated.mjs`). 두 파일이 `dist/_headers`의 immutable 목록에 있는지도 확인한다.

## 남길 것

- `verification/2026-10-17-intro-remove-examples/README.md`(다른 날짜 폴더 형식)
  - 기준 커밋, 이 프롬프트 경로(`prompts/intro-remove-examples-claude-code.md`)
  - 바뀐 파일과 지운 선택자·함수 목록
  - 전/후 캡처: `before-1440-intro.png`, `after-1440-intro.png`, `after-390-intro.png`
  - 고친 검사 / 지운 검사 / 건너뛴 검사(없으면 '없다')
- PR 본문 첫 줄: "첫 화면 예시 카드 3개(.gate-ex)만 제거. examples 데이터와 다른 화면은 그대로."

## 완료 기준

- [ ] 첫 화면에 참굴·해삼·전복·살오징어 예시 카드가 보이지 않고, DOM에도 `.gate-ex`가 없다
- [ ] 첫 화면의 다른 문구와 버튼 동작이 전후로 같다
- [ ] `dist/*.json`의 `examples` 값은 바뀌지 않았다
- [ ] 지구본이 글과 겹치지 않고, 콘솔 오류가 없다
- [ ] CI 전체 통과, uicheck 통과, 가로 넘침 없음
