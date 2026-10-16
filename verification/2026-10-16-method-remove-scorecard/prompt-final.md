# '근거와 방법' 탭 검증 성적표·05 항목 삭제 — 최종 작업 지침 (2026-10-16)

원본 지침: `prompt-original.md`(같은 폴더). 작업 전에 main `63588b3`과 대조해 아래를 고쳤다.

## 원본에서 고친 점 (저장소 대조 결과)

1. **여정 카드 배지는 남긴다.** 원본은 "`app.js`에서 이 패널을 그리는 함수를 지운다"고 했지만, 그 함수 `renderScorecard()`는
   성적표 표와 함께 '지표 흐름' 01·02·03 카드의 검증 배지(`.mt-vbadge[data-ind]`: 검증 통과 · 방법 검증 기준 미충족 ·
   제한적 확인)도 채운다. 함수를 통째로 지우면 배지가 영영 `hidden`이 된다. 배지는 원본 삭제 목록에 없으므로
   배지만 채우는 함수(`renderVerifyBadges()`)로 줄이고, `posthoc-scorecard.json` 읽기(`live-data.js` 미리 읽기 포함)는 남긴다.
2. **`data-alt-species`는 05 표에만 있다.** `renderMethodPage()`의 '현재 살오징어' 채우기와 `promise-count` 계산은 05 표 전용이라
   함께 지운다. uicheck의 'Both-high species' 검사가 `altName==='현재 살오징어'`를 요구하므로 그 조건만 뺀다(나머지 조건은 그대로).
3. **CSS 공유 규칙 정리.** `:is(.mt-vc-ind li,.mt-vbadge)[data-state=…]`는 배지도 쓰므로 `.mt-vbadge[data-state=…]`로 줄인다.
   `[data-oc]` 색 규칙과 `.mt-vc*`는 성적표 전용이라 지운다. `.mt-tagbox`·`.mt-vbadge`는 남긴다.
   `.type-table-wrap`·`.type-table`은 03의 유형 표와 공유하므로 남기고, `.pt-*`·`.promise-table`만 지운다.
4. **검사 범위.** "verification/에서 검색한 검사"를 CI와 uicheck가 실제로 돌리는 것으로 한정한다:
   `test_posthoc_scorecard_ui.mjs`(CI)와 `uicheck.mjs`. 날짜 폴더(`2026-10-15-posthoc-scorecard/`, `2026-10-15-mcui-category/`,
   `2026-10-15-application-gaps/`)의 `capture.mjs`·README·results는 지난 PR의 기록이므로 고치지 않는다(어떤 검사도 돌리지 않음).
5. **05·성적표를 가리키는 곳 검색 결과.** 챗봇 FAQ('검증은 통과했어요?')는 이미 `#method-03`을 가리킨다. 성적표나 05로 가는
   `data-mt-go`·링크는 없다. 남는 문구는 05 표 안의 '이 탭 맨 위 검증 성적표'(행과 함께 삭제)와 03 MCUI 줄 괄호(아래에서 수정)뿐이다.
   `config/posthoc-scorecard.json`의 note와 `scripts/build_posthoc_scorecard.py` docstring의 '검증 성적표'는 '바꾸지 않을 것'에 따라 둔다.
   README의 '검증 성적표' 항목은 화면 설명이므로 "화면에서는 2026-10-16에 뺐고 파일·검사는 유지"로 고친다.
6. **`build_posthoc_scorecard.py --csv` 규칙은 유지.** CI가 `--check`를 계속 돌리고 배지가 그 파일을 읽으므로, 버전을 올릴 때 다시
   실행해야 한다는 규칙은 그대로 유효하다.
7. **여백.** `#mt-mcui-map`이 탭의 첫 블록이 된다. `#method`의 위 여백(56px)과 대응표의 아래 여백(56px/900px 이하 40px)이 성적표와
   같으므로 CSS 변경 없이 캡처로 확인만 한다.

## 할 것

### 1. 검증 성적표 패널 삭제
- `dist/index.html`의 `<div class="mt-vc" id="mt-scorecard" …>` 전체(눈썹 'VALIDATION SCORECARD', 제목, 칩 `#mt-vc-ind`,
  요약 `#mt-vc-sum`, 개수 `#mt-vc-counts`, 표·caption, `#mt-vc-foot`)를 지운다.
- `dist/app.js`: `renderScorecard()`를 `renderVerifyBadges()`로 바꿔 표·요약·칩·개수·각주 코드를 지우고 배지 채우기만 남긴다.
  파일이 없으면 배지를 숨긴다(지금과 같음). `SCORECARD_OC`·`scorecardFile()`의 스키마 검사는 그대로 둔다.
- `dist/method.css`: `.mt-vc*`, `[data-oc]`, 900px·600px 미디어 블록의 `.mt-vc*` 규칙을 지운다.

### 2. 05 '신청서 약속은 어디까지 왔나요?' 삭제
- `dist/index.html`의 `<details class="mt-acc" id="mt-acc-05">` 전체.
- `dist/app.js` `renderMethodPage()`의 `promise-count`·`data-alt-species` 줄(`altFirst`는 종 상세에서 쓰므로 남긴다).
- `dist/method.css`의 '신청서 약속 대비 구현 현황표 (fold 05)' 블록과 740px 카드 블록.
- 01~04 번호·문구는 그대로.

### 3. 같이 고칠 것
- 03 '규칙 고정과 검증' MCUI 줄: `(대응표는 이 탭 위쪽, 검증 성적표 바로 아래)` → `(대응표는 이 탭 맨 위)`.
- `index.html`의 `app.js`·`method.css` `?v=` 해시를 LF 내용 sha256 앞 10자로 다시 계산(README '공개 배포' 절).

### 4. 바꾸지 않을 것
`config/`, `scripts/`, `dist/*.json`, `reports/`. 03 카드 판정 줄, 종 상세·비교 표의 검증 배지, 여정 카드 배지, 다른 탭, 첫 화면,
`expedition.html`, 멍이(챗봇).

## 검사
1. `verification/test_posthoc_scorecard_ui.mjs`: 성적표 표 검사를 "패널·05가 DOM과 코드에 없다"로 바꾸고, 배지·점수 불변·스키마 검사는 유지.
2. `verification/uicheck.mjs`: 05 현황표 검사를 "05·현황표·성적표가 없다, 04가 마지막 접힘"으로 바꾸고, 대체생산 검사에서 `altName` 조건만 뺀다.
3. CI 전체(`verify.yml`의 node 검사, `PYTHONUTF8=1 python3.12 -m unittest discover -s verification -p 'test_*.py'`, `build_*.py --check`)와 uicheck.
4. 이 폴더의 `capture.mjs`: 전(main)·후 1440·390 캡처, 390·768·1100·1440px 가로 넘침 0, 성적표·05 DOM 없음, 배지 3개 표시, 대응표가 첫 블록.

## 남길 것
- 이 폴더의 `README.md`: 기준 커밋, 지침 경로(원본·최종), 전/후 캡처, 고친 검사 / 지운 검사 / 건너뛴 검사.
- PR 본문 첫 줄: "근거와 방법 탭에서 검증 성적표 패널과 05 신청서 약속 항목 삭제. 데이터는 그대로."

## 완료 기준
- [ ] 검증 성적표 패널이 화면과 DOM 어디에도 없다
- [ ] '05 신청서 약속은 어디까지 왔나요?' 항목이 화면과 DOM 어디에도 없다
- [ ] MCUI 줄의 괄호가 `(대응표는 이 탭 맨 위)`로 바뀌었다
- [ ] 성적표를 가리키는 화면 문구·링크가 남지 않는다
- [ ] 여정 카드 배지 3개는 그대로 보인다
- [ ] 데이터 파일은 바뀌지 않았다(`git diff --stat -- config scripts reports 'dist/*.json'` 0줄)
- [ ] CI 전체 통과, uicheck 통과(지도 타일 환경 실패 제외), 가로 넘침 없음
