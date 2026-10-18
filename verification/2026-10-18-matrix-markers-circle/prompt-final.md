# 2×2 유형 표시 모양(▲ ◆ ● ■, 마름모 점)을 원 하나로 통일, 색으로만 구분 — Claude Code 작업 지침 (main `2c0e672` 대조 최종본)

원본: [`prompt-original.md`](prompt-original.md). 원본의 목표·범위·'바꾸지 않을 것'·완료 기준은 그대로 두고, 저장소와 대조해 드러난 아래 차이를 반영했다.

## 원본과 달라진 점 (검사 결과)

1. **모양을 고르는 곳은 함수 하나 + CSS 두 묶음이다.** `typeShape()`(app.js)는 `<i class="shape shape-<유형>">`만 만들고, 모양은
   `theme.css`의 `.shape-*` 규칙(▲·◆는 `clip-path:polygon`, ■는 각진 네모)과 `compare.css`의 사분면 이름·`.cp-shape`·`.mt-shape`
   유형별 규칙이 정한다. 그래서 함수는 그대로 두고 **CSS에서 모든 유형을 `border-radius:50%` 원으로** 만든다. 유형이 없는 종의
   빈 네모(`.shape-none`)는 점선 **고리**로 바꾼다.
2. **마름모 점은 `.stock` 클래스 + `::before` 45° 회전**이다(`compare.css`의 `.matrix-point.pilot.stock*` 다섯 줄과 774행, `theme.css` 1017–1018행).
   클래스를 붙이는 분기(`stockMcui(s)?' stock'`)와 CSS를 함께 지운다. 범례 `lg('stock',…)`와 `.lg-dot.stock`·`.mt-dot.stock`도 지운다.
3. **원본이 놓친 ◆ 두 곳.** 데이터 표 MCUI 숫자 옆 `<i class="cv-stock">◆</i>`, 종 프로필 '자원 감소 신호' 상자 제목의
   `<i class="sd-mark">◆</i>`. 둘 다 **원으로 바꾸지 않고 지운다.** 자원 감소 표시의 황색 `#f2b84b`가 '두 지표 모두 높음' 유형 색
   `#f2b233`과 거의 같아서, 황색 원을 두면 유형 표시로 읽힌다. 숫자 옆 괄호 `(LC + 자원 감소)`와 상자 제목 글자가 이미 같은 뜻을 전한다.
4. **원본이 놓친 문장 두 개.** 바뀌는 문장은 세 개가 아니라 네 개 + 멍이 안내 한 문장이다.
   - '읽는 법' 안 `#matrix-note`(app.js가 만듦): `마름모 점은 KOSIS 어획량 추세(자원 감소 신호)로 MCUI가 정해진 종입니다.`
     → `KOSIS 어획량 추세(자원 감소 신호)로 MCUI가 정해진 종은 MCUI 숫자 옆 괄호에 ‘자원 감소’로 적습니다.`
   - 사용법 안내 도우미(`chatbot.js` FAQ '2x2 아이콘 사용법'): `칸마다 유형 모양(▲ ◆ ● ■)과 위치 이름이` → `칸마다 유형 색 원(●)과 위치 이름이`.
     멍이의 모습·움직임은 건드리지 않고, 사실과 달라지는 안내 글자만 고친다.
5. **기대값을 고칠 검사는 하나다.** `verification/test_verified_ui.mjs` 268행이 표의 MCUI 숫자 뒤 `<i class="cv-stock"`를 기대한다.
   → `</small></span>`로 끝나는지 보고, `cv-stock|◆`가 없음을 더한다. `uicheck.mjs`에는 모양에 묶인 검사가 없다(`shape` 낱말은 지도 셀 개수).
6. **새 정적 검사** `verification/test_type_marks_circle.mjs`를 만들고 `verify.yml`에 한 줄 더한다. 화면 검사는
   `verification/2026-10-18-matrix-markers-circle/capture.mjs`(before/after 비교)로 한다.
7. 저장소에는 `prompts/` 폴더가 없다. 지침은 이 기록 폴더에 `prompt-original.md`·`prompt-final.md`로 둔다.

## 할 것 (최종)

| 곳 | 파일 | 바꿀 것 |
|---|---|---|
| 탐색 카드 이름 앞·판단 배지, 오른쪽 패널 유형 줄, 근거 서랍, '활용 × 보전' 2×2 범례, 셀 정보 유형 줄 | `theme.css` `.shape*` | 모든 유형 원, `.shape-none` 점선 고리 |
| 매트릭스 사분면 이름, 유형 카드, 비교 프로필·서랍 유형 줄 | `compare.css` 750–760행 | `::before`·`.cp-shape`·`.mt-shape` 원, 유형별 `clip-path`/`border-radius:2px` 네 줄 삭제 |
| 매트릭스 점 | `app.js` 점 버튼, `compare.css`·`theme.css` `.stock` | `' stock'` 클래스와 마름모 CSS 삭제(크기·링·점선 링·밀집·비킴 그대로) |
| 그래프 아래 범례 | `app.js` `syncCompareMatrix` | '자원 감소 신호' 항목 삭제, '선택한 종'·가중치 항목 그대로 |
| 데이터 표 MCUI | `app.js` `valueCell` | `cv-stock` ◆ 삭제 |
| 프로필 자원 감소 상자 | `app.js` `stockDeclineDetail` 제목 | `sd-mark` ◆ 삭제 |
| 문장 | `index.html` 2개, `app.js` `#matrix-note` 1개, `chatbot.js` 1개 | 위 4번과 원본 '할 것' 1·3의 전/후 그대로 |
| 주석 | `app.js`·`theme.css`·`compare.css` | 모양 설명 주석을 원 기준으로 |
| `?v=` | `index.html` | `app.js`·`theme.css`·`compare.css`·`chatbot.js` 다시 계산 |

나머지(바꾸지 않을 것, 접근성, 검사 1–5, 남길 것, 완료 기준)는 원본과 같다. 색·값·유형·점 위치는 before/after 측정값으로 같음을 확인한다.
