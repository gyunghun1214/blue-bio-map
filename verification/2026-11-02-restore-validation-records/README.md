# 근거와 방법 탭 '04 검증 기록 8건' 항목 되살림 (2026-11-01)

결정: LKH, 2026-11-01 복원 결정(2026-10-31 삭제 결정 번복). 제출한 발표 자료 22장이 "전체 기록과 바꾼 규칙: 사이트 '근거와 방법' 04"라고
안내하고 25·30·31장도 검증 기록을 가리키는데, 슬라이드는 고칠 수 없어서 화면을 되돌린다.
점수·유형·지도·칩·연구 기록은 바뀌지 않는다(표는 `display_only` 파일 `dist/posthoc-scorecard.json`만 그린다).

## 되살린 것 (PR #291, 커밋 `46df5d6`을 되돌림)

- `dist/index.html`: `<details class="mt-acc" id="mt-acc-04">` 전체, 소제목의 '· 검증 기록'. 접이식 항목은 01·02·03·04.
- `dist/app.js`: `posthocScorecard`, `SCORECARD_OC`, `scorecardFile`, `CHECK_COUNT_LABEL`, `checkVersion`, `renderPosthocTable`,
  `openChecks`와 `[data-go-checks]` 클릭 처리, `renderMethodPage`의 `renderPosthocTable()` 호출, 종 상세의 '검증 기록 보기' 버튼 2곳
  (MBPI 검증 줄, MCUI 예비 평가 줄).
- `dist/app.js` 파일 불러오기: `posthoc-scorecard.json`과 변수 `scorecard`가 같은 자리(`cmnpd` 다음, `changelog` 앞). 뒤의 `changelog`,
  `aquaTier`, `namesEn`은 밀리지 않는다.
- `dist/live-data.js` 미리 받기 목록, `method.css`의 `.mt-ck*`, `theme.css`의 `.go-checks`, `mobile-type.css`·`pc-tidy.css`의 `.mt-ck*` 선택자.
- `dist/i18n-en.js` 문구 6개와 소제목 문구. 검사(`test_posthoc_scorecard_ui.mjs`, `test_verified_ui.mjs`, `uicheck.mjs`), `i18n_layout_check.mjs`의 `.mt-ck-wrap`.

## 옛 코드와 다르게 만든 것 (GitHub 링크 없음)

2026-11-01에 저장소를 비공개로 돌리기로 해서(`867f4cc`), 옛 표를 그대로 되살리면 기록 링크가 모두 404가 된다.

- 기록 파일: 링크 대신 파일 이름 글자(`<span class="mt-ck-file">`), 마우스를 올리면 전체 경로(`title`). `↗` 없음.
- 사전 등록 칸: `commitUrl`을 지우고 `사전 등록 커밋 6b06ca8` 글자만(슬라이드 22장 표기와 같음).
- '지표 규칙이 바뀐 이력 전체': 같은 사이트의 `method-changelog.json`(= `research/method-changelog.json`과 같은 파일)으로 연결.
- 표 아래 문구: "기록 파일은 프로젝트 GitHub 저장소에 있습니다" → "기록 파일 이름을 함께 적었습니다".
- 읽기 실패 문구에서 "기록은 저장소의 research/verified-indices에 있습니다"를 뺌.
- 영어 문구 3개를 새 한국어에 맞춤. `dist/posthoc-scorecard.json`의 `repository` 값은 그대로 두고 화면에서만 쓰지 않는다.

표의 디자인과 라벨은 삭제 전과 같다. 슬라이드 22장과는 표현만 다르고 내용은 같다(통과 1 · 같은 자료 확인 = 일관성 확인(독립 아님) 2 ·
빗나감 = 기준 미충족 3 · 사용 중단 = 미충족 후 사용 중단 1 · 검증 불성립 1, 합 8).

## 지금 main을 유지한 것

- `867f4cc`가 지운 푸터의 '의견 보내기'·'GitHub 이슈', 정밀 좌표 창 끝의 '의견 보내기': 충돌은 `?v=` 줄과 푸터 줄뿐이었고 모두 main 쪽을 받은 뒤
  `?v=`를 다시 계산했다(이슈 링크는 돌아오지 않음).
- `b68ee01` 성능 수정, `5eef89c` 등 삭제 이후의 다른 변경.
- `verification/2026-10-31-remove-validation-records/`: 되돌리기가 지운 폴더를 그대로 복구(삭제 기록도 이력).

## 고친 검사

- `test_posthoc_scorecard_ui.mjs`: 기록은 파일 이름 글자(링크 0개), 등록된 행의 사전 등록 커밋은 글자, 이력 줄은 `method-changelog.json`.
  새 검사: 표가 그린 내용에 `github.com`·`↗`가 없음, 건수 줄의 합이 8, 표 아래 문구·읽기 실패 문구에 '저장소'가 없음.
- `uicheck.mjs`: 04 항목 검사의 기록 링크 기대값 → 파일 이름(`title` = 전체 경로), GitHub 글자 없음, 이력 링크가 같은 사이트 파일이고 실제로 열림.
- `verification/i18n-ko-baseline.txt`: 지금 dist로 다시 뽑음. 되돌린 직후 기준과 다른 줄은 파일 이름 끝의 `↗`가 빠진 줄뿐.
- `867f4cc`가 고친 `uicheck.mjs`(푸터)·`test_operations.mjs`·`test_operator_notices.py` 기대값은 그대로.

## 스크린샷

`before-*`(main `4a0d1c9`) / `after-*`: 한국어·EN × 1440·390.
`method-folds` 접이식 묶음, `fold04-table` 04 표 전체, `detail-mbpi-line` 살오징어 MBPI 검증 줄, `detail-mcui-line` 미역 MCUI 예비 줄,
`after-click-*` '검증 기록 보기'를 누른 뒤 그 행(방법 탭, 04 열림, 행이 화면 안).
네 화면 모두 표 9행(8건 + 등록됨 1), 가로 넘침 없음, 12px 미만 글자 없음, 콘솔 오류 없음(클라우드에서 막은 바깥 요청만 실패).

## 글자 배치 검사 (`i18n_layout_check.mjs`)

기록 파일 이름은 띄어쓰기 없는 긴 한 덩어리라 좁은 칸에서 하이픈 자리에서 줄을 바꾼다. 옛 표에서는 `파일이름 ↗`(두 단어)라 '(라) 단어 쪼개짐'에
들지 않았는데, `↗`를 빼자 한국어 1440·1280x720에서 12건이 늘어 기준(13)을 넘었다(23). 표 모양은 삭제 전 그대로 두기로 했으므로
검사에서 `.mt-ck-file`만 이 항목에서 뺐다. 다른 글자는 그대로 센다. 고친 뒤 한국어 broken 11(main과 같음), 영어 9.

## 돌린 검사 (클라우드, Python 3.12, Playwright Chromium)

- CI 빠른 검사 목록 전체(`verify.yml`의 node 검사·`--check`·`python -m unittest`): 모두 통과.
- `node verification/test_i18n.mjs --browser`: 통과(한국어 화면이 기준 파일과 같음, 두 언어 링크 목록 같음).
- `node verification/i18n_layout_check.mjs`: 통과.
- `node verification/uicheck.mjs` (`FIXTURE=dist/live-snapshot.json`): 298 PASS / 4 FAIL. 실패 4건은 클라우드에서 막힌 바깥 지도 타일
  (위성 GIBS, 수심 GEBCO, 예전 '기본' 저장값 → 위성, 공유 링크 A-5의 지도 복원)로 PR #291 때와 같다. 결과: `uicheck-result.txt`.
- `git diff origin/main --stat -- dist/assessments.json dist/posthoc-scorecard.json dist/method-changelog.json config research`: 비어 있음.
