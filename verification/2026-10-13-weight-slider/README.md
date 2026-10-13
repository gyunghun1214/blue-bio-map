# BBVI 통합 가중치 슬라이더 (2026-10-13)

프롬프트: 프로젝트 파일 `prompts/bbvi-weight-slider-claude-code-v2.md` (LKH의 `blue_bio_mbpi_mfpi_weight_slider_prompt.md`를 실제 코드에 맞춰 고친 것).

## 0. w가 쓰이는 곳 (작업 전 목록, main d49e4ed 기준)

| 곳 | 지금 동작 | 이번 변경 |
|---|---|---|
| `app.js` `bbviWeight` 선언 | 전역 하나, 0.5 | 그대로. 값은 정수 단계(0–20)에서만 들어감 |
| `pilotScore(s,'BBVI')` | 보고서가 '산출됨'이라 한 BBVI만 `round((w·MFPI+(1−w)·MBPI)·10)/10`로 다시 섞음 | 그대로 (w = 0.5에서 보고서 BBVI와 같음) |
| `matrixType` → 매트릭스 점·유형별 목록·지도 셀 색 | 화면 BBVI로 2×2 유형 | `matrixTypeAt(s,bbvi)`로 나눠 공식 유형(`officialType`)도 같은 규칙으로 계산 |
| 비교 표 BBVI 칸·정렬 | 화면 BBVI | 공식값이 아닐 때 칸 아래 `(공식 55.1)` |
| 종 프로필·비교 대화상자·종 상세 `ax-card`·지도 셀 툴팁 | 화면 BBVI | 공식값이 아닐 때 공식값 병기 |
| `#bbvi-weight` input (비교 기준 팝오버) | 0–1 소수, 라벨 "기본 통합 BBVI 식량 가중치 0.50" | 0–20 정수 단계, "MBPI 0.50 · MFPI 0.50", 두 색 트랙, 프리셋 3개 |
| `cmp-weight-reset`, `updateBasisNow`, `updateWeightControl` | "기본값 0.50으로", 버튼 글자 "· 식량 0.70" | "공식값 0.50으로"(공식값이면 비활성), "· MBPI 0.30 · MFPI 0.70"(폰은 MFPI만) |
| `readHash/writeHash/applyHash`, 링크 복사 | 가중치 없음 | `w=0.70`(공식값이면 생략), 잘못된 값은 공식값, `w`만 있는 링크도 적용 |
| 미탐색 후보 `unexplored_candidate`, 범례 "w = 0.5 기준" | 보고서 값이라 w와 무관 | 그대로 (uicheck가 개수 고정 확인) |
| 보고서 `food_weight`, `method.bbvi.default_food_weight`, 종별 `sensitivity.food_weights` | 화면은 `data.assessmentInfo.foodWeight`만 표시에 사용 | 공식 가중치를 여기서 읽음, 0.25·0.75 값은 새 검사의 기준값 |
| 챗봇 FAQ `bbvi` | 식량 가중치 슬라이더 안내 | 프리셋·공식값 고정·탐색 보기 안내 추가 |
| 근거와 방법 흐름도 BBVI 상자, `#method-03` | 산식만 | aria-label에 "공식 w = 0.50", 카드에 '공식 산출은 w = 0.50 고정' 한 줄 |
| 검사: `uicheck.mjs`(BBVI 30종 슬라이더, 정렬 뒤 input 재그리기), `test_verified_ui.mjs`(`bbviWeight=.8`), `test_matrix_map.mjs`(`setWeight`) | | 그대로 통과. 새 검사 추가 |

## 바뀐 동작

- 패널: 현재 두 가중치, 두 색 트랙(왼쪽 보라 MBPI | 오른쪽 MFPI, 가운데 흰 눈금 = 공식값), 끝 라벨, 프리셋(신약 중심 MBPI 0.8 · 균형 0.5 · 식량 중심 MFPI 0.8), 안내 문구, 공식값과 유형이 다른 종 목록(최대 6종 + 외 N종), MBPI 하한값 종이 있을 때만 하한값 안내.
- 공식값이 아닐 때만: 탐색 보기 배지(패널, 매트릭스 위, 데이터 표 위, 탐색 지도 '활용 × 보전' 작은 범례 위 · 각각 '공식값으로' 버튼), 공식값 병기, 유형이 바뀐 점에 점선 고리와 범례 항목.
- 매트릭스 점은 다시 그린 뒤 옛 위치에서 새 위치로 300ms 미끄러짐(움직임 줄이기 설정이면 바로).
- 드래그 중 다시 그리기는 한 프레임에 한 번.
- 실제 자료(verified-4.11): BBVI 30종, 한 축만 있는 종 0, MBPI 하한값 종 0. 공식 유형과 달라지는 종은 MFPI 0.8에서 13종, MBPI 0.8에서 2종.

## 검사 결과 (클라우드, Python 3.12, Playwright Chromium)

- 새 `verification/test_weight_slider.mjs`(CI unit 단계 추가): 21단계 합 1.00, w 0/0.5/1 = MBPI/보고서 BBVI/MFPI(30종), w 0.25/0.75 = 보고서 민감도(±0.1, 양쪽 모두 소수 한 자리 반올림), 보류 BBVI 유지, 공식값 병기, 유형 바뀐 종 = 독립 계산, 하한값 안내, 링크 `w` 읽기·쓰기 → PASS
- CI node 검사 전부 PASS, `python3.12 -m unittest` 372개 OK(skip 1)
- uicheck(PR #178·#179가 들어간 main e2289bd·1737abf를 merge한 뒤): 188 PASS / 4 FAIL. FAIL 4건은 클라우드에서 지도 타일 호스트(GIBS·GEBCO)가 막혀 생기는 환경 실패(위성·수심 타일, A-5 공유 링크의 수심 복원)와 저장된 '기본' 기본값 검사의 타이밍 경합으로 main에서도 같음. 새 uicheck 3건: 슬라이더 전체 흐름(탐색 지도 종 카드 포함), `#…&w=0.70`/`w=abc` 링크 복원, 390px 넘침 없음.
- 최신 main을 받은 뒤 고친 것: 탐색 지도 종 카드(시안2의 '활용 값 · 판단문')도 가중치를 따라 다시 그림.
- `verification/2026-10-compare-redesign/measure.mjs`: main과 비교해 w 0.50에서 화면 데이터 동일(가중치 라벨 글자만 다름), 0.25·0.75에서는 추가된 공식값 병기 외 동일.

## 캡처

`01`–`06` 1440px, `07`–`09` 390px: 공식값 패널, 식량 중심 패널·매트릭스, 신약 중심 패널, 식량 중심 데이터 표, 탐색 지도 배지, 폰 패널·매트릭스·공식값 패널. 다시 찍기: `node verification/2026-10-13-weight-slider/capture.mjs verification/2026-10-13-weight-slider`
