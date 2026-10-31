# 근거와 방법 탭 '04 검증 기록' 항목 내림 (2026-10-31)

결정: LKH, 2026-10-31. 점수·유형·지도·칩·연구 기록은 바뀌지 않는다(표는 `display_only` 파일만 그렸다).

## 바뀐 것

- `dist/index.html`: `<details id="mt-acc-04">` 전체, 소제목의 '· 검증 기록'을 지움. 접이식 항목은 01·02·03.
- `dist/app.js`: `posthocScorecard`, `SCORECARD_OC`, `scorecardFile`, `CHECK_COUNT_LABEL`, `checkVersion`, `renderPosthocTable`,
  `openChecks`와 `[data-go-checks]` 클릭 처리, `renderMethodPage`의 표 그리기, 파일 불러오기 목록의 `posthoc-scorecard.json`
  (변수 `scorecard`도 같은 자리에서 뺌), 종 상세의 '검증 기록 보기' 버튼 2곳.
- `dist/live-data.js`: 미리 받기 목록의 `posthoc-scorecard.json`.
- CSS: `method.css`의 `.mt-ck*`, `theme.css`의 `.go-checks`, `mobile-type.css`·`pc-tidy.css`에 남아 있던 `.mt-ck*` 선택자.
- `dist/i18n-en.js`: 쓰지 않게 된 문구 6개를 지우고 소제목 문구를 새 한국어에 맞춤. `i18n.js`의 `i18n-en.js?v=`, 각 HTML의 `?v=`를 새 해시로.
- `verification/i18n-ko-baseline.txt`: 지운 글만 빠지고 소제목 한 줄만 바뀜(바꾸기 전 dist로 다시 뽑은 결과가 기존 기준 파일과 같음을 먼저 확인).

## 남긴 것

- 종 상세의 `mbpi-check`('MBPI 검증: 기준 미충족…')와 `mcui-prelim`('예비 평가…역검증에서…') 글(버튼만 지움), `validationResult`, `assessments.json`의 `posthoc`.
- `dist/posthoc-scorecard.json`, `config/posthoc-scorecard.json`, `scripts/build_posthoc_scorecard.py`, CI의 `--check`, `research/`.
- `renderVerifyBadges`.
- `openChangelog`의 `$('mt-acc-04')`: `#mt-changelog`가 화면에 없어서 `linkDecisions`가 바로 끝나고 `.md-link`가 만들어지지 않는다. 실행되는 길이 없어 그대로 둠.

## 고친 검사

- `test_posthoc_scorecard_ui.mjs`: 파일 검사(스키마·결과·5분류)와 배지 검사는 그대로, 표 그리기 검사 대신 '항목·버튼·CSS·영어 문구·불러오기가 없다'는 검사로.
- `test_verified_ui.mjs`: `MBPI_CHECK`, `PRELIM_LINE`에서 버튼 부분만 뺌.
- `uicheck.mjs`: 04 항목 검사 → '#mt-acc-04·표·검증 기록 글·버튼 없음, 03에서 끝남, posthoc-scorecard.json 요청 없음, 안내 두 줄은 그대로'. 접이식 01–03, 390px `acc` '01,02,03', 미역 MBPI 줄·감태 MBPI 줄 기대값, 3.27 사례 검사(방법 탭에 '기준 미충족' 없음).
- `i18n_layout_check.mjs`: 스크롤 상자 목록의 `.mt-ck-wrap`.

## 스크린샷

`before-*`/`after-*`: 한국어·EN × 1440·390, 방법 탭 접이식 묶음(`method-folds`), 미역 상세의 MCUI 예비 줄(`detail-mcui-line`)과 MBPI 검증 줄(`detail-mbpi-line`).
03 아래에서 출처 칸까지 간격은 전후 모두 44px. 콘솔 오류는 클라우드에서 막힌 바깥 지도 타일뿐(전후 같음), `posthoc-scorecard.json` 요청은 전 1회 → 후 0회.
