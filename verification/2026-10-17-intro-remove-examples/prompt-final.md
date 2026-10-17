# 첫 화면 예시 카드 3개(`.gate-ex`) 제거 — 실행한 프롬프트(보완판)

LKH가 올린 `intro-remove-examples-claude-code.md`를 main `ddd8530`과 대조해 빠진 곳을 채운 판이다. 원래 지침은 그대로 두고, 대조에서 찾은 항목만 **[보완]**으로 더했다.

## 배경

첫 화면 버튼 아래 예시 종 카드 세 줄(`data-ex` = `use` 활용 지표 1위 / `conservation` 보전 지표 높음 / `stock` 어획량 감소 신호)을 첫 화면에서 통째로 없앤다. 첫 화면은 '문제 → 해결 → 바다 탐색하기'로 끝나게 한다. 화면 표시만 바꾼다.

## 할 것

1. `dist/index.html`: `<ul class="gate-ex" …>…</ul>` 전체를 지운다(CSS로 숨기기만 하지 않는다).
2. `dist/intro.js`
   - `renderExamples()`와 그 호출, `renderExamples()`만 쓰던 `exampleLinks()`를 지운다(`grep`으로 다른 사용처 확인).
   - `copyBoxes()`의 `.gate-ex li` 위치 모으기(`.concat(…)`)를 지운다. 나머지 글 상자 계산은 그대로.
   - **[보완]** 카드 클릭 처리 `q('.gate-ex').addEventListener('click', …)`를 지운다. 남기면 `q('.gate-ex')`가 `null`이라 첫 화면 연결 단계에서 오류가 나고, 그 뒤의 키보드 처리·움직임 스위치가 붙지 않는다.
   - **[보완]** 드래그 제외 목록 `NO_DRAG`에서 `.gate-ex`를 뺀다.
   - **[보완]** `enter(target, hash)`의 `hash` 경로(`applyHash`)는 남긴다. 버튼 동작과 무관하고, 첫 화면에 종 링크를 다시 둘 때 쓰는 일반 경로다. 주석만 '예시 카드' → '종 링크'로 바꾼다.
3. `dist/intro.css`: `.gate-ex…` 규칙을 모두 지우고, 묶인 선택자는 `.gate-ex`만 뺀다(`.gate-why,.gate-ex{…}` → `.gate-why{…}` 두 곳). `.gate:not(.is-ready) .gate-ex`, 휴대폰 미디어 쿼리의 세 줄, `(min-width:761px) and (max-height:640px){.gate-ex{display:none}}`도 지운다. **[보완]** 카드를 설명하던 주석 세 곳도 고친다.
4. 버튼 아래 여백이 어색하면 `.gate-actions`/`.gate-counts` 아래 여백만 조정한다.

## 절대 바꾸지 않을 것

- 첫 화면 다른 문구·버튼·`.gate-counts`·오른쪽 카드·'함께 읽는 공개 자료'
- 데이터: `app.js`의 `gateExamples()`와 첫 화면으로 넘기는 `examples`, `dist/*.json`. **[보완]** 원래 지침은 `scripts/`의 build 스크립트를 말했지만, 실제로 예시를 만드는 곳은 `dist/app.js`의 `gateExamples()`다. 이 함수도 그대로 둔다(`app.js` 해시도 바뀌지 않는다).
- 지구본 회전·드래그, 움직임 줄이기, `gate-enter`·`data-go`, 다른 탭, `expedition.html`, 멍이

## 검사

1. 카드에 묶인 검사의 기대값을 '카드가 없다'로 고친다. 지우거나 건너뛰지 않는다. **[보완]** 대조로 찾은 곳:
   - `verification/test_intro_ui.mjs`: `exampleLinks` 단위 검사(함수가 없어지므로 vm 내보내기 목록에서도 빼야 `ReferenceError`가 안 난다), 마크업 순서 검사(`… → cards`), 카드 마크업 검사, 약점 낱말 검사의 `exHtml`
   - `verification/uicheck.mjs`: G-1b(버튼 아래 카드 위치), G-1c(카드 내용), G-1d(지구본 계산의 카드 상자), **G-8(카드를 눌러 비교 탭으로 가는 흐름)**
2. 새 검사: 첫 화면에 `.gate-ex`·`[data-ex]`가 없고, 첫 화면 글자에 세 설명 문구가 없다(정적: `test_intro_ui.mjs`, 브라우저: uicheck G-1c·G-8).
3. CI 전체(`verify.yml`)와 로컬 uicheck를 돌린다.
4. 390·768·1100·1440px에서 가로 넘침·지구본 겹침·콘솔 오류·움직임 줄이기 확인(`capture.mjs`).
5. `intro.js`·`intro.css`의 `?v=` 해시를 다시 계산한다(LF 내용 sha256 앞 10자). `_headers`의 immutable 목록 확인.

## 남길 것

`verification/2026-10-17-intro-remove-examples/`에 README, 이 프롬프트, `capture.mjs`, 원본·보완 프롬프트, 전후 캡처. PR 본문 첫 줄: "첫 화면 예시 카드 3개(.gate-ex)만 제거. examples 데이터와 다른 화면은 그대로."
