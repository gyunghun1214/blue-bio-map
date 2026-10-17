# 탐색 지도 점·버블 색을 이전 빨간색으로 되돌림 (2026-10-17)

탐색 지도 '출현 기록' 보기의 도식적 점, 축소 지도의 숫자 버블, 범례 견본을 청회색으로 바뀌기 바로 전의 빨간색으로 되돌렸다.
위치·크기·버블 묶음·숫자·구간·셀 유형 색·데이터는 그대로다.

- 기준 커밋: main `6e362fa` (PR #220 머지). 작업 중 main에 PR #215(`0b24d15`)가 들어와 병합했고, `index.html` `?v=` 충돌은 main 쪽을 받은 뒤 '청회색' 6곳과 `?v=`를 다시 맞췄다. 병합 뒤 검사·캡처를 다시 돌린 결과가 아래 표다.
- 지침: 원본 [`prompt-original.md`](prompt-original.md), 저장소와 대조해 고친 최종본 [`prompt-final.md`](prompt-final.md)
  (같은 최종본을 프로젝트 공유 폴더 `prompts/explore-dots-red-revert-claude-code-v2.md`에도 둠. 저장소에는 `prompts/` 폴더가 없다).
  가장 큰 차이: 청회색은 남색 지도 작업(PR #170)이 아니라 **탐색 지도 3열 시안 PR #218**(커밋 `bcbe7ab`, 머지 `55d5d87`, 2026-10-15)에서 들어왔다.
  `git log -S '청회색'`이 가리키는 커밋도 이것 하나다. PR #170은 점을 더 밝은 빨강 `#ff6464`로 바꿨을 뿐이다.

## 이전 색의 출처: `bcbe7ab^` (`bcbe7ab` 바로 앞)

| 요소 | 이전 빨간 값 (`bcbe7ab^`) | 바꾸기 전 청회색 (`6e362fa`) | 출처 파일:행 (`bcbe7ab^`) |
|---|---|---|---|
| 점 채움 | `#ff6464` (`DOT_RED`) | `#A9C6D4` (`DOT_FILL`) | `dist/app.js`의 `const DOT_RED` |
| 점 테두리 | `#ffffff`, 두께 .65, 불투명도 .9 | `#ffffff`, .65, .85 | `dist/app.js` `dotStyle` |
| 점 채움 불투명도 | .88 | .9 | 같은 줄 |
| 버블 채움 | `#ff6464` | `#A9C6D4` | `dist/app.js` 버블 `L.circleMarker` |
| 버블 테두리 | `#ff8d84` | `#C9DCE5` | 같은 줄 |
| 버블 진하기 단계 | `BUBBLE_FILL={4:.3,6:.45,8:.6,10:.75}` | 같음(#218에서 안 바뀜) | `dist/app.js` `BUBBLE_FILL` |
| 버블 숫자 | 흰 글자(상속) + 짙은 빨강 그림자 `rgba(60,0,10,.95)` | `#04121E` + 밝은 그림자 | `dist/theme.css:647` |
| 버블 그림자 | `drop-shadow(0 0 6px rgba(255,84,84,.6))` + 아래 그림자 | 아래 그림자만 | `dist/theme.css:648` |
| 범례 버블 견본 | 테두리 `#ff8d84`, 채움 `rgba(255,100,100,.45)`, 붉은 빛 | `#C9DCE5`, `rgba(169,198,212,.55)` | `dist/theme.css:676` |
| 범례 점 견본 | `var(--coral)`=`#ff6464` 점 무늬, `rgba(255,100,100,.1)` | `#A9C6D4` 점 무늬 | `dist/theme.css:677`, 좁은 화면 `:104` |
| 셀 틀 옅은 채움 | `#ff6464` 불투명도 .1 | `#A9C6D4` .08 | `dist/app.js` `cellFrame` |
| '출현 기록' 4° 셀 점선 테두리 | `#ff6464` (셀 틀 채움색을 씀) | `#A9C6D4` | `dist/app.js` 4° 분기 `color:s.fillColor` |

- CSS는 값을 다시 적지 않았다. #218이 `dist/theme.css` 끝쪽에 덧붙인 `/* occurrence marks: neutral blue-grey, no glow */` 여섯 줄을 지우니,
  파일에 그대로 남아 있던 위 표의 빨간 규칙(647·648·676·677·104행)이 다시 적용된다.
- 진하기 단계 수는 이전과 같다(4단계). 단계를 새로 채운 것은 없다.
- 버블 테두리 두께는 #218에서 2.2 → 2로 바뀌었지만 색이 아니라서 2로 두었다. 점 반경·버블 반경은 손대지 않았다.
- hover·선택 상태의 별도 점 색은 이전에도 없었다. 노란 실선·점선 테두리는 '활용 × 보전' 보기에서만 그려지고 그 보기에는 점이 없다(`dist/app.js` `valueCellStyle`, `hoverSpecies`).
- '출현 기록' 보기의 4° 셀 점선 테두리는 점 색을 따라가므로 함께 빨간색이 됐다(#218 전과 같음). '활용 × 보전' 보기의 4° 테두리(유형 색)는 그대로다.

## 바뀐 것

| 파일 | 내용 |
|---|---|
| `dist/app.js` | `DOT_FILL '#A9C6D4'` → `DOT_RED '#ff6464'`, 점 불투명도 .9/.88, 버블 테두리 `#ff8d84`, 셀 틀 채움 .1. 화면 문구 '청회색' 7곳 → '붉은' |
| `dist/theme.css` | #218의 청회색 덮어쓰기 6줄(주석 포함) 삭제 |
| `dist/index.html` | 범례·'근거와 방법 > 자료를 읽을 때'의 '청회색' 6곳 → '붉은'. `app.js`·`theme.css`·`chatbot.js` `?v=` 재계산 |
| `dist/chatbot.js` | 사용법 안내 도우미 답 2개(개요, `red-dots`)를 `bcbe7ab^` 문장으로 |
| `verification/test_map_boundary.mjs` | 점 색·팝업 문구·4° 테두리 기대값을 `bcbe7ab^` 값으로 |
| `verification/uicheck.mjs` | 지도 설명·셀 팝업 문구 기대값 2곳을 `bcbe7ab^` 값으로 |

바뀌지 않은 것: `config/`, `scripts/`, `dist/*.json`, 점 위치·크기, 버블 묶음·크기·숫자·구간, `matrixTypeColour`, 유형 미산출 회색,
선택·hover 노란 테두리, 클릭한 셀의 밝은 점선(`PICKED_OUTLINE`), 조사량 음영, 배경 지도, 패널·헤더, 다른 탭, 첫 화면, `expedition.html`, `og.png`.
왼쪽 위 칩의 유형 색 점과 아래 캡션의 빨간 점(`.map-caption .dot`, 원래부터 `--coral`)도 그대로다.

## 문구 전/후

새 문구는 만들지 않았다. 모든 '붉은' 문장은 `bcbe7ab^`에 같은 글자로 있던 것이다(바뀐 파일의 '붉은' 앞뒤 40자 조각 14개를 `bcbe7ab^`에서 모두 찾음).

| 위치 | 전 | 후 |
|---|---|---|
| 범례 설명·접힌 범례(3곳), 셀 팝업(2), 버블 툴팁, 검토 문구(2), 범례 안내 문단 | 청회색 점 / 청회색 점 무늬 | 붉은 점 / 붉은 점 무늬 |
| 근거와 방법 > 자료를 읽을 때 (3곳) | 청회색 점, 청회색 버블 | 붉은 점, 붉은 버블 |
| 도우미 개요 답 | …청회색 점은 실제 발견 좌표가 아니에요. | …붉은 점은 실제 발견 좌표가 아니에요. |
| 도우미 `red-dots` | 청회색 점(예전 붉은 점)… 청회색 버블… | 붉은 점은… 붉은 버블… (질문 목록에서 '청회색 점이…' 줄도 빠짐) |

`og:image:alt`는 이미 '붉은 점'이라 그대로다. 지금 화면에 '청회색'은 남아 있지 않다(`capture.mjs` 확인).

## 대비

클라우드에서는 위성(GIBS)·수심(GEBCO) 타일이 막혀 캡처가 타일 없는 어두운 바탕(`basic`)에서 찍혔다. 대비는 바탕 대표 색 위에 버블 채움을 겹쳐 계산했다.

| 바탕(추정) | 버블 위 흰 숫자, 진하기 .3 / .45 / .6 / .75 | 점(.88) 대 바탕 |
|---|---|---|
| 위성 남색 틴트 바다 `#0d2236` | 10.5 / 7.9 / 5.9 / 4.5 | 4.6 |
| 수심 깊은 바다 `#12304a` | 9.2 / 7.2 / 5.6 / 4.3 | 3.9 |
| 타일 없음 `#16283a` | 9.8 / 7.5 / 5.7 / 4.4 | 4.3 |
| 연안 밝은 물 `#2f5f7a` | 5.9 / 5.2 / 4.5 / 3.8 | 2.1 |

- 가장 진한 단계(셀당 100건 이상, .75)에서는 숫자 바탕만으로 4.5에 못 미치는 곳이 있다(3.8–4.5). 숫자마다 짙은 빨강 그림자(흰 글자 대비 17.5)가
  둘러 있어 읽히지만, 엄밀한 AA 판정은 이 단계에서 경계선이다. 이 값은 #218 전과 같다. 지침대로 다른 색은 고치지 않고 여기와 PR에 적는다.
- 참고: 청회색 때 짙은 숫자는 옅은 단계(.3)에서 2.4–2.7이었다.

## 같은 화면의 붉은 계열 (팀 판단용)

'보전 지표 높음'(`conservation_priority`) 유형 색이 `#d7392f`(빨강)이다. 이 유형인 종(예: 우뭇가사리)을 고르면 왼쪽 위 칩 점, 오른쪽 카드 삼각형,
목록 카드 삼각형이 `#d7392f`이고 지도의 점이 `#ff6464`라서 **같은 화면에 빨강 두 가지가 함께 나온다**(`after-1440-conservation-priority-species.png`).
'활용 × 보전' 셀 색과는 보기 전환이 달라 지도 위에서 겹치지 않는다. 다른 색은 고치지 않았다.

## 검사

| 검사 | 결과 |
|---|---|
| CI(`verify.yml`) node 검사 전부 + `build_posthoc_scorecard.py --csv --check` + `build_expedition_stops.py --check` | 통과 |
| `python3.12 -m unittest discover -s verification -p 'test_*.py'` | 474개 통과(건너뜀 2, 원래부터) |
| `node verification/test_detail_render.mjs` (CI 밖) | 통과 |
| `verification/uicheck.mjs` (FIXTURE=dist/live-snapshot.json) | 213 통과 / 4 실패. 실패 4건은 타일이 막힌 클라우드 환경 실패(위성 GIBS, 수심 GEBCO, 저장된 '기본' 기본값, `A-5 shared link`의 배경 복원)로 이전 실행과 같다 |
| 이 폴더 `capture.mjs after` | 22건 모두 통과(`results.json`): 축소 버블·확대 점 빨강, 숫자 흰색, 범례 견본 빨강, 칩 점 = 유형 색, 기간 필터·링크로 다시 연 화면·움직임 줄이기에서 빨강, 4° 테두리 빨강, 390·768·1100·1440px 가로 넘침 0, 페이지 오류 0, '청회색' 없음 |

고친 검사: `test_map_boundary.mjs`(기대값 3곳), `uicheck.mjs`(기대값 2곳) — 모두 `bcbe7ab^`의 기대값으로 되돌림. 지운 검사: 없다. 건너뛴 검사: 없다.

## 캡처

`before-*`는 바꾸기 전 main, `after-*`는 바꾼 뒤. 배경 지도 타일이 막혀 위성·수심 대신 타일 없는 바탕이다(위성 배경 캡처는 남기지 못함).

- `before-1440-explore.png` / `after-1440-explore.png`: 첫 화면(참굴)
- `before-1440-bubbles.png` / `after-1440-bubbles.png`: 축소(버블)
- `before-1440-dots.png` / `after-1440-dots.png`: 확대(점)
- `after-1440-legend-open.png`: 펼친 범례 견본
- `after-1440-cell-popup.png`: 셀 팝업
- `after-1440-wide-cells.png`: 해삼 4° 셀
- `after-1440-conservation-priority-species.png`: 우뭇가사리(보전 지표 높음)
- `before-390-explore.png` / `after-390-explore.png`: 휴대폰
- 측정값: `before-measured.json`, `after-measured.json`

다시 찍기: dist/를 127.0.0.1:8765로 띄운 뒤 `FIXTURE=dist/live-snapshot.json node verification/2026-10-17-explore-dots-red/capture.mjs verification/2026-10-17-explore-dots-red after`
