# 휴대폰에서 멍이 버튼·첫 안내 말풍선이 내용을 가리지 않게 (2026-10-25)

휴대폰(아래 탭바가 있는 740px 이하)에서 멍이 버튼이 스크롤 중 가장자리로 접히고, 맨 아래 여백과 첫 안내 말풍선 위치를 고쳤다. 멍이 기능·대화 내용·PC(741px 이상) 화면은 그대로다.

- 기준 커밋: main `5b0beb9` (PR #265 병합)
- 지침: [`prompt-original.md`](prompt-original.md) (LKH가 보낸 `prompts/mascot-mobile-overlap-claude-code.md`, 저장소에는 `prompts/` 폴더가 없다)

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `dist/chatbot.js` | 접기(`.bbc-tucked`)와 그 리스너, 접힌 버튼 누르기, 접힌 상태에서 끌기 시작, 휴대폰 말풍선 자리(옮긴 버튼), 카드 줄 가로 스크롤로 말풍선 접기 |
| `dist/chatbot.css` | `@media (max-width:740px)` 한 묶음: 접힌 모양·전환, body 아래 여백, 종 카드 줄 끝 여백, 말풍선을 버튼 위로 |
| `dist/index.html` | `chatbot.js`·`chatbot.css`의 `?v=`(LF로 맞춘 내용 sha256 앞 10자, `test_client_outdated.mjs` 통과) |
| `verification/uicheck.mjs` | M-6 기대값 고침, M-6b 더함(아래 '검사') |
| `verification/2026-10-25-mascot-mobile-overlap/` | 이 README, 점검 스크립트(`check.mjs`·`common.mjs`), 전/후 캡처와 `result.json` |

`theme.css`(`body{padding-bottom:var(--bbc-bar)}` 줄 포함)·`compare.css`·다른 탭·`expedition.html`·`scripts/`·`config/`·`dist/*.json`은 고치지 않았다. 새 화면 문구·`aria-label`·`title`은 없다. 저장 형식(`bbChatFabPos`, `bbChatHintSeen`)과 `chatbotReadFabPos`·`chatbotClampFab`·`chatbotFabAnchor`·`chatbotPanelPlace`의 입출력도 그대로다(`test_chatbot_drag.mjs` 통과).

## 더한 class·리스너와 최종 값

| 항목 | 값 |
|---|---|
| `.bbc-tucked` (`.bbc`에) | 스크롤이 시작되면 붙고, 멈추고 **700ms**(`TUCK_MS`) 뒤 뗀다. 모양: `transform:translateX(55%)`(버튼 폭 48px의 55% = 26.4px), `opacity:.55`. 크기는 그대로라 누르는 영역 48px는 같다 |
| `.bbc-left` | 왼쪽 절반으로 옮긴 버튼(`placeMoved`의 좌우 판단 = `chatbotFabAnchor`의 `h`와 같은 기준). 접으면 `translateX(-55%)`. 위·아래로 옮긴 버튼도 같은 방식(좌우만 본다) |
| `.bbc-still` | 접을 때 '움직임 줄이기'(사이트 스위치 `bbvm-reduce-motion=1`)면 붙여 전환을 끈다. 시스템 설정(`prefers-reduced-motion:reduce`)이면 전환 규칙 자체가 없다. 아니면 `transform`·`opacity` 0.2s |
| `document` `scroll` (capture, passive) | 페이지와 각 탭의 스크롤 상자, 종 카드 줄(`#species-list`) 가로 스크롤을 한 리스너로 받는다. `requestAnimationFrame`으로 한 프레임에 한 번만 클래스·타이머를 만지고 레이아웃은 읽지 않는다 |
| 지도 `movestart`/`moveend` | 끄는 동안 접혀 있고(손가락을 대고 멈춰 있어도), `moveend` 뒤 700ms에 돌아온다. 지도(`map`)는 자료를 받은 뒤 생기므로 첫 `pointerdown`(capture) 때 한 번 연결한다 |
| 접지 않는 때 | 대화창이 열렸을 때, 열기 직전 깡충 중, 끄는 중, 버튼이 `:focus-visible`일 때. 버튼이 키보드 포커스를 받으면 바로 펼친다 |
| 접힌 버튼 누르기 | 휴대폰 폭에서 누르기를 시작할 때 접혀 있었으면 이번 누르기는 펼치기만 한다(대화창은 안 열림). 다시 누르면 지금처럼 깡충 뒤 열린다. 접힌 채 창이 741px 이상으로 넓어지면 `place()`(resize)가 바로 펼친다: CI에서 390px 검사 직후 1560px로 바꾼 M-7의 첫 누르기가 펼치기로만 먹힌 것을 고쳤다 |
| 접힌 상태에서 끌기 | 끌기 시작점에서 밀어 넣은 만큼(`transform`)을 빼고 원래 자리 기준으로 옮긴다. 문턱을 넘으면 펼치고 지금처럼 끈다 |
| body 아래 여백(740px 이하) | `calc(var(--bbc-bar) + 48px + 16px)` = 탭바 + 버튼 높이 + 띄움. `chatbot.css` 휴대폰 미디어 쿼리 안에서 덮어쓴다. `#compare`의 담기 트레이 여백(`96px + 탭바`)은 탭 자체에 있어 그대로다. 버튼을 위쪽으로 옮긴 사람에게는 남는 여백이지만 단순하게 그대로 둔다 |
| 종 카드 줄 끝 여백 | `#explore .species-list{padding-right:calc(12px + 56px)}`. 끝까지 넘기면 마지막 카드 오른쪽 끝이 322px, 버튼 왼쪽 끝이 326px |
| 첫 안내 말풍선(740px 이하, 옮기지 않은 버튼) | 버튼 바로 위: 오른쪽 끝을 버튼 오른쪽 끝에 맞추고 아래 끝은 버튼 위 8px(`bottom:calc(16px + 탭바 + 48px + 8px)`), `max-width:calc(100vw - 32px)`. 옮긴 버튼은 지금처럼 옆에, 휴대폰에서 옆 자리가 120px보다 좁으면 위(버튼이 아래쪽 절반) 또는 아래(위쪽 절반)로. 390px 폭에서는 옆 자리가 늘 120px보다 넓어 이 경우가 생기지 않는다 |
| 말풍선 접기 | 지금의 세로 스크롤·멍이 밖 누르기(카드 누르기 포함)에 더해 종 카드 줄 가로 스크롤에서도 바로 접힌다. 문구·7초·한 번만(`bbChatHintSeen`)은 그대로 |

## 가리던 요소 (390×844, `result.json`)

멍이 버튼 사각형과 겹치는 보이는 `a, button, summary, [role=button], input`(멍이·아래 탭바 제외, 겹친 칸의 점 9개를 `elementsFromPoint`로 찍어 실제로 가려진 것만).

| 화면 | 전(main `5b0beb9`) | 후 |
|---|---|---|
| 탐색 지도 첫 화면(멈춘 상태) | 둘째 종 카드(홍합) | 둘째 종 카드(홍합). 멈춰 있을 때 자리는 그대로이고, 카드 줄을 넘기거나 페이지를 내리는 동안은 접힌다 |
| 탐색 지도 종 카드 줄 끝까지 넘김 | 마지막 종 카드(갑오징어, 오른쪽 끝 378px) | 없음(오른쪽 끝 322px) |
| 탐색 지도 · 종 상세 맨 아래 | 없음 | 없음 |
| 비교와 지표 맨 아래 | 없음 | 없음 |
| 근거와 방법 맨 아래 | 없음 | 없음 |
| 첫 안내 말풍선 | 버튼 왼쪽 같은 높이(722–766px), 종 카드 줄 위 | 버튼 위(672–716px), 오른쪽 끝이 버튼과 같은 374px |

맨 아래에서는 main도 링크·버튼이 버튼 밑에 들어가지 않았다(꼬리말 글 오른쪽 끝만 걸쳤다). 이번 여백으로 꼬리말이 버튼 위쪽에서 끝난다(캡처). 휴대폰 종 상세 시트(`#ev-drawer.open`)가 열리면 멍이는 원래 숨는다(`theme.css`).

## 캡처

`before/`(main `5b0beb9`)와 `after/`, 같은 자료(`dist/live-snapshot.json`)·위성 타일 없이.

- 390px: `390-explore-first-hint`(첫 진입·말풍선), `390-explore-scrolling`(스크롤 중·접힘), `390-explore-cards-end`(카드 줄 끝), `390-explore-detail-bottom`, `390-compare-bottom`, `390-method-bottom`
- 1440px: `1440-explore`·`1440-compare`·`1440-method` — 전후 픽셀이 같다(PIL 차이 없음). 버튼 `right 445px`·`bottom 16px` 전후 같음

## 검사

- 고친 검사: `uicheck.mjs` M-6(휴대폰 손가락 끌기). 스크롤 300ms 뒤에 버튼 자리를 재던 것을 1100ms 뒤로(접힘이 풀린 뒤). 기대값(`m.right===16` 등)은 그대로다. M-1·M-5의 `m.bottom===16`은 PC(1560px)라 접힘이 없어 그대로 둔다.
- 더한 검사: `uicheck.mjs` M-6b(390px: 스크롤하면 접힘·폭 48·가로 넘침 없음, 접힌 버튼 탭은 펼치기만, 멈추면 돌아옴). 이 폴더의 `check.mjs` 22개(Playwright, 390×844 `isMobile`·`hasTouch`): 네 화면 맨 아래 가림 없음, 카드 줄 끝, 말풍선 위치, PC 그대로(1440px, main과 버튼 자리 비교), 접기(직후 붙음·폭 48·55%·.55·1초 뒤 뗌), 접힌 버튼 탭, 키보드 포커스면 안 접음, 카드 줄 가로 스크롤·지도 손가락 끌기 중 접힘, 접힌 상태에서 끌어 옮기기, 왼쪽 위로 옮긴 버튼은 왼쪽으로 접힘, 카드 줄 가로 200px로 말풍선 접힘·`bbChatHintSeen` 저장, 움직임 줄이기(시스템·사이트 스위치) 전환 없음, 360·390·768·1440px 스크롤 중 가로 넘침 없음, 콘솔 오류 없음.
- 지운 검사·건너뛴 검사: 없다.
- 실행: `node verification/2026-10-25-mascot-mobile-overlap/check.mjs` → 22/22. CI 단위 검사(`verify.yml`의 node·python 55줄, unittest 포함) 통과. `uicheck.mjs` 결과는 PR 본문에 적는다.

## 확인하지 못한 것

- 실제 휴대폰(iOS Safari·Android Chrome)은 이 작업 환경에서 열 수 없어 확인하지 못했다. 관성 스크롤 중 깜빡임, iOS 주소창이 줄었다 늘어날 때 탭바와의 겹침은 Chromium 휴대폰 흉내(390×844, 터치)로만 봤다. 접힌 버튼은 `position:fixed`라 가로 스크롤을 만들지 않는 것을 Chromium에서 확인했다.
