# 근거와 방법: 검증 성적표·05 신청서 약속 삭제 (2026-10-16)

근거와 방법 탭 맨 위의 검증 성적표 패널과 접힘 05 '신청서 약속은 어디까지 왔나요?'를 화면에서 지웠다. 데이터는 그대로다.

- 기준 커밋: main `63588b3` (PR #219 머지)
- 지침: 원본 [`prompt-original.md`](prompt-original.md), 저장소와 대조해 고친 최종본 [`prompt-final.md`](prompt-final.md)
  (원본과 다른 점 7가지는 최종본 맨 위). 가장 큰 차이: 성적표를 그리던 함수가 여정 카드의 MFPI·MBPI·MCUI 검증 배지도
  채우므로, 함수를 통째로 지우지 않고 배지만 채우는 `renderVerifyBadges()`로 줄였다.

## 바뀐 것

| 파일 | 내용 |
|---|---|
| `dist/index.html` | `#mt-scorecard` 전체, `#mt-acc-05` 전체 삭제. 03 MCUI 줄 `(대응표는 이 탭 위쪽, 검증 성적표 바로 아래)` → `(대응표는 이 탭 맨 위)`. `app.js`·`method.css` `?v=` 재계산 |
| `dist/app.js` | `renderScorecard()` → `renderVerifyBadges()`(표·요약·칩·개수·각주 코드 삭제). `renderMethodPage()`의 05 개수 줄·`data-alt-species` 채우기 삭제 |
| `dist/method.css` | `.mt-vc*`, `[data-oc]`, 성적표 미디어 규칙, `.pt-*`·`.promise-table` 삭제. 배지 색 규칙은 `.mt-vbadge[data-state]`만 남김 |
| `README.md` | '검증 성적표' 항목에 화면에서 뺐다는 한 줄 |

바뀌지 않은 것: `config/`, `scripts/`, `reports/`, `dist/*.json`(`git diff --stat`에 없음), 03 카드 판정 줄, 종 상세·비교 표 배지,
여정 카드 배지, 다른 탭, 첫 화면, `expedition.html`, 챗봇.

## 05·성적표를 가리키던 곳 (저장소 검색: `신청서 약속`, `구현 현황`, `mt-acc-05`, `검증 성적표`, `scorecard`)

| 위치 | 처리 |
|---|---|
| 05 표 '지표의 사후검증' 행의 '이 탭 맨 위 검증 성적표' | 05와 함께 삭제 |
| 03 '규칙 고정과 검증' MCUI 줄 괄호 | `(대응표는 이 탭 맨 위)`로 수정 |
| 챗봇 FAQ '검증은 통과했어요?' | 이미 `#method-03`을 가리킴, 수정 없음 |
| 성적표·05로 가는 `data-mt-go`·`href` | 없음 |
| `config/posthoc-scorecard.json` note, `scripts/build_posthoc_scorecard.py` docstring | '바꾸지 않을 것'에 따라 그대로 (화면 문구 아님) |
| `verification/2026-10-15-posthoc-scorecard/`, `2026-10-15-mcui-category/`, `2026-10-15-application-gaps/` | 지난 PR의 기록이라 그대로 (CI·uicheck가 돌리지 않음) |

## 검사

- 고친 검사
  - `verification/test_posthoc_scorecard_ui.mjs`(CI): 성적표 표 검사 → 성적표·05가 `index.html`·`app.js`·`method.css`에 없고, 대응표가 첫 블록이고,
    접힘이 01–04뿐이고, MCUI 줄 괄호가 바뀌었는지 확인. 배지 3개·점수 불변·스키마 검사는 유지.
  - `verification/uicheck.mjs`: '05 현황표 14행' 검사 → '성적표·05 없음, 접힘 01–04, 대응표가 첫 블록'. '대체생산' 검사에서 05 표 안의
    `data-alt-species` 조건(`현재 살오징어`)만 뺐다(나머지 조건 그대로).
- 지운 검사: 없다.
- 건너뛴 검사: 없다.
- 결과: CI `unit` 단계 명령 37개 모두 통과(Python 3.12 unittest 474건 OK, skipped 3), `test_detail_render.mjs` 통과,
  이 폴더의 `capture.mjs` 28/28(390·768·1100·1440px 모든 접힘을 연 상태에서 가로 넘침 0). uicheck 결과는 PR 본문에 적는다.

## 캡처

`before-*`는 main, `after-*`는 이 브랜치. `*-top.png` 탭 첫 화면, `*-folds.png` 접힘 목록.

```
FIXTURE=dist/live-snapshot.json node verification/2026-10-16-method-remove-scorecard/capture.mjs [출력 폴더] [before|after]
```
