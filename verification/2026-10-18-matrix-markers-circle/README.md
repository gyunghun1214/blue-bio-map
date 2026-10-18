# 유형 표시 모양을 원으로 통일 (2026-10-18)

탐색 지도와 비교와 지표에서 2×2 유형 표시(▲ ◆ ● ■, 매트릭스의 마름모 점)를 모두 원으로 바꿨다. 유형은 색(`matrixTypeColour`),
매트릭스에서의 위치, 옆에 붙은 유형 글자로 구분된다. 색·값·유형 판정·점 위치·데이터는 그대로다.

- 기준 커밋: main `2c0e672` (PR #232 머지). 작업 중 main에 PR #234(탐색 후보 카드 배지, `4c4cc8d`)가 들어와 병합했고, `index.html` 충돌은 main 쪽을 받은 뒤 문장 두 개와 `?v=`를 다시 맞췄다. 병합 뒤 검사·after 캡처를 다시 돌린 결과가 아래 표다
- 지침: 원본 [`prompt-original.md`](prompt-original.md), 저장소와 대조해 고친 최종본 [`prompt-final.md`](prompt-final.md)
  (저장소에는 `prompts/` 폴더가 없어서 이 폴더에 둠). 원본과 가장 큰 차이: 원본이 놓친 ◆ 두 곳(데이터 표 MCUI 옆, 프로필 자원 감소 상자 제목)과
  바뀌어야 할 문장 두 개(`#matrix-note`, 사용법 안내 도우미 FAQ 한 문장).
- 확인 스크립트: [`capture.mjs`](capture.mjs) (before/after 측정·캡처, after에서 판정 → [`results.json`](results.json) 16 PASS / 0 FAIL),
  정적 검사 `verification/test_type_marks_circle.mjs`(CI `verify.yml`에 추가)

## 모양을 쓰던 곳과 바꾼 방법

검색: `dist/`의 `▲ ■ ◆ ◇ ◼ ▴ △ □`, `shape|diamond|rhomb|마름모|triangle|square`, `clip-path`, `rotate(45`, `<polygon`, `matrixType*`.

| 곳 | 모양을 만든 코드 | 바꾼 것 |
|---|---|---|
| 탐색 지도 종 목록 카드 이름 앞(`.sc-shape`)·판단 배지(`.cv-shape`), 오른쪽 패널 유형 줄(`.sp-shape`), '활용 × 보전' 2×2 범례(`.vm-shape`), 셀 종 목록(`.vs-shape`), 셀 정보 유형 줄 | `app.js` `typeShape()` → `theme.css` `.shape-conservation_priority`(`clip-path` 세모), `.shape-alternative_production`(`clip-path` 마름모), `.shape`(네모), `.shape-baseline_survey`(원) | `.shape`에 `border-radius:50%`, 유형별 세 규칙 삭제. 함수는 그대로(모양은 CSS 한 곳에서 정해짐) |
| 유형이 없는 종 | `.shape-none` 점선 네모 | 점선 고리(원) |
| 매트릭스 사분면 이름 앞 | `compare.css` `.quadrant.typed strong::before` + 유형별 `clip-path`/`border-radius:2px` | 18px 원 하나, 유형별 네 줄 삭제 |
| 비교 탭 유형 카드(`.mt-shape`), 프로필 유형 줄·근거 서랍 유형(`.cp-shape`) | 같은 유형별 네 줄 | 20px(서랍 16px) 원 |
| 매트릭스 점: 자원 감소 신호 종 | `app.js` 점 클래스 `' stock'` + `compare.css` `.matrix-point.pilot.stock*` 6줄(`::before` 45° 회전, 황색 테두리), `theme.css` `.matrix-point.pilot.stock` | 클래스와 CSS 삭제 → 다른 종과 같은 원(14px, 선택 시 20px + 링) |
| 그래프 아래 범례 '◆ 자원 감소 신호' | `app.js` `syncCompareMatrix` `lg('stock',…)`, `.lg-dot.stock`(두 CSS) | 항목·CSS 삭제. '선택한 종', 가중치 '공식값과 유형이 다른 종' 항목은 그대로 |
| 데이터 표 MCUI 숫자 옆 ◆ | `app.js` `valueCell`의 `<i class="cv-stock">◆</i>`, `.cv-stock` | 삭제. `60.0 (LC + 자원 감소)` 괄호와 셀 `aria-label`이 같은 뜻을 전함 |
| 프로필 '자원 감소 신호' 상자 제목 ◆ | `app.js` `stockDeclineDetail`의 `<i class="sd-mark">◆</i>`, `.sd-mark` 두 줄 | 삭제(제목 글자 '자원 감소 신호 · KOSIS 어획량 추세'는 그대로) |
| `.mt-dot.stock` | CSS만 남아 있던 규칙(쓰는 곳 없음) | 삭제 |
| 주석 | `app.js` 2곳, `theme.css` 3곳, `compare.css` 4곳 | 원 기준으로 고침 |

◆·자원 감소 표시를 황색 원으로 바꾸지 않은 이유: 자원 감소 황색 `#f2b84b`가 '두 지표 모두 높음' 유형 색 `#f2b233`과 거의 같아 유형 표시로 읽힌다.

손대지 않은 것: 지도 셀 색, 밀집 구간 상자·'N종 · 펼치기'·비킴 선, 선택 링, 가중치 점선 링(`.lg-dot.wmove`), ⚠ 출현 추세 표시,
`expedition.html`의 '◇ 탐험 연출 항로'(범위 밖), 분류군 아이콘, `method.css`의 흐름도 상자 `.bx.stock`(점 모양이 아님), 데이터 파일.

'근거와 방법'의 '유형과 셀 색' 표는 색 칸(스와치)이라 그대로다.

## 바뀐 문장 (네 개 + 안내 도우미 한 문장)

| 곳 | 전 | 후 |
|---|---|---|
| 비교 탭 '읽는 법' (`index.html`) | 두 값은 따로 봅니다 · 점 색은 유형, 마름모 점은 자원 감소 신호로 정한 MCUI입니다 | 두 값은 따로 봅니다 · 점 색은 유형입니다 · 자원 감소 신호로 정한 MCUI는 숫자 옆 괄호와 점 툴팁에 적습니다 |
| 비교 탭 '읽는 법' 안 `#matrix-note` (`app.js`) | 마름모 점은 KOSIS 어획량 추세(자원 감소 신호)로 MCUI가 정해진 종입니다. | KOSIS 어획량 추세(자원 감소 신호)로 MCUI가 정해진 종은 MCUI 숫자 옆 괄호에 ‘자원 감소’로 적습니다. |
| 근거와 방법 '자료를 읽을 때' (`index.html`) | 자원 감소 신호(KOSIS 어획량 추세)로 MCUI가 정해진 종은 마름모 점입니다. | 자원 감소 신호(KOSIS 어획량 추세)로 MCUI가 정해진 종은 MCUI 숫자 옆 괄호에 ‘자원 감소’로 적습니다. |
| 사용법 안내 도우미 '2x2 아이콘 사용법' (`chatbot.js`) | 칸마다 유형 모양(▲ ◆ ● ■)과 위치 이름이 | 칸마다 유형 색 원(●)과 위치 이름이 |

## 접근성 (색만으로 전달하지 않음)

- 탐색 카드 판단 배지(`활용 지표 높음` 등)와 매트릭스 사분면 이름에는 유형 글자가 항상 붙어 있다. 오른쪽 패널·프로필 유형 줄도 같다.
- 매트릭스 점은 사분면 위치가 곧 유형이고, 점 `title`·`aria-label` 끝에 유형 이름(`/ 활용·보전 병행 검토`)이 있다. 점의 이름·툴팁에 모양 낱말은 원래 없었다.
- 자원 감소 신호는 글자로 남는다: 점 `aria-label` `보전 지표 60.0 (LC + 자원 감소) · MCUI 자원 감소 신호 · 어획량 −79.8%`, 표 숫자 옆 `(LC + 자원 감소)`.
- 원 둘레의 어두운 테두리(`box-shadow 0 0 0 1.5px`)는 그대로라 유형 색끼리 맞닿아도 점이 구분된다.

## 검사

| 항목 | 결과 |
|---|---|
| CI `verify.yml`의 node 검사 전부(새 `test_type_marks_circle.mjs` 포함), `build_posthoc_scorecard.py --csv --check`, `build_aquaculture_tier.py --check`, `build_expedition_stops.py --check`, Python unittest(3.12) | 통과 |
| `capture.mjs` after | 16 PASS / 0 FAIL ([`results.json`](results.json)) |
| `uicheck.mjs` (클라우드) | 245 PASS / 4 FAIL(#234 병합 뒤, 새 카드 배지 검사 포함). 4건은 위성(GIBS)·수심(GEBCO) 타일이 클라우드에서 막혀 생기는 환경 실패(A-5 공유 링크, 위성, 수심, 2026-10-03 전 '기본' 저장)로 main에서도 같다 |
| `expedition_check.mjs`, `offline_check.mjs` | 75 PASS / 0 FAIL, 21 PASS / 0 FAIL |

`capture.mjs`가 보는 것: 모든 매트릭스 점이 `::before` 없는 원 버튼 · 우뭇가사리·참조기 점이 다른 점과 같은 크기·자기 유형 색 ·
살오징어(선택) 큰 원 + `aria-label`의 '자원 감소' · 사분면 이름 네 원 같은 크기 · 탐색 카드·패널·2×2 범례·유형 카드·프로필·표의 유형 표시가
모두 원(`clip-path` 없음, 회전 없음) · 카드 목록·사분면·범례·유형 카드·데이터 표·프로필·지도 범례·오른쪽 패널에 `▲ ■ ◆ ◇ △ □` 없음 ·
범례에 '자원 감소 신호' 없음 · 표의 살오징어 `60.0 (LC + 자원 감소)`에 ◆ 없음 · 두 탭 문장 · 30개 점의 유형·색·위치가 before와 같음 ·
가중치 슬라이더 양 끝에서 유형이 바뀐 22종의 색이 바뀌고 원으로 남음 · 밀집 구간 펼친 목록의 표시가 원 · 390px 점 원 ·
390·768·1100·1440px 가로 넘침 0 · 콘솔 오류 0.

- 고친 검사: `verification/test_verified_ui.mjs` 268행(표 MCUI 숫자 뒤 `<i class="cv-stock"` 기대 → `</small></span>`로 끝남 + `cv-stock|◆` 없음)
- 지운 검사: 없다
- 건너뛴 검사: 없다

## 캡처

| 전 | 후 |
|---|---|
| [`before-1440-compare-matrix.png`](before-1440-compare-matrix.png) | [`after-1440-compare-matrix.png`](after-1440-compare-matrix.png) |
| [`before-explore-list.png`](before-explore-list.png) | [`after-explore-list.png`](after-explore-list.png) |
| [`before-390-compare-matrix.png`](before-390-compare-matrix.png) | [`after-390-compare-matrix.png`](after-390-compare-matrix.png) |
| [`before-1440-explore-value.png`](before-1440-explore-value.png) | [`after-1440-explore-value.png`](after-1440-explore-value.png) |
| [`before-1440-compare-read.png`](before-1440-compare-read.png) | [`after-1440-compare-read.png`](after-1440-compare-read.png) |
| [`before-1440-compare-table.png`](before-1440-compare-table.png) | [`after-1440-compare-table.png`](after-1440-compare-table.png) |
| [`before-1440-compare-cluster.png`](before-1440-compare-cluster.png) | [`after-1440-compare-cluster.png`](after-1440-compare-cluster.png) |

## 다시 돌리기

```
python -m http.server 8765 --bind 127.0.0.1 --directory dist
FIXTURE=dist/live-snapshot.json node verification/2026-10-18-matrix-markers-circle/capture.mjs verification/2026-10-18-matrix-markers-circle after
```
before는 `2c0e672`에서 같은 명령에 `before`를 주어 만든다.
