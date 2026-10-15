# `verified-4.15` — 보전 평가 공백을 '우선 조사'로 드러내기 (2026-10-15)

계기: 팀장(LKH)이 2026-10-15 매트릭스 밖 14종을 숨은 '미배치'가 아니라 신청서의 '정보충분도 낮음 · 우선 조사'로 보이라고 요청했다. 핵심 문장은 "30종 중 14종이 보전 평가 공백이라는 것 자체가 이 프로토타입의 첫 발견이다". 프롬프트를 `main`(4728045, `verified-4.14`)과 대조해 고친 v2는 프로젝트 파일 `prompts/information-gap-rail-claude-code-v2.md`에 있다.

**표시 규칙만 바꾼 버전이다.** 설정 문장(`method.matrix`)이 바뀌어 `matrix-readiness.json`의 `matrix_rule`이 달라지므로 버전 올림 규칙을 따랐다. 사전 등록은 하지 않았다. 점수·유형·기준값을 정하는 규칙이 하나도 바뀌지 않기 때문이다.

## 바뀌지 않은 것

30종의 MFPI·MBPI·MCUI·BBVI, `scores_unrounded`, `conservation_status`, `priority_survey_reasons`, `information_sufficiency`, 매트릭스 유형(활용 연구 6 · 병행 1 · 보전 연구 3 · 기초조사 6), 매트릭스 점 16개와 위치, 구분선 50, 식품 가중치 0.5, `cell_colour_precedence`, 사후 검증 블록. `Verified415Tests.test_no_score_or_rule_changes`가 4.14 설정으로 만든 보고서와 종마다 비교한다. 4.14 공개본은 `archive/assessments-verified-4.14.json`에 보관했고 4.14 설정으로 바이트 단위 재현한다(`Verified414Tests`). 계보 `diff --from verified-4.14 --to verified-4.15` 점수 변화 0건.

**하지 않은 것.** MCUI가 없는 종에 0점, LC 상당 10점, 근연종 값, Rapid LC 값을 넣지 않았다. 레일의 점에는 세로 위치가 없고 사분면 안에 찍지 않는다. 국가평가 마커·단일 논문 마커는 그대로다.

## 바뀐 것

- 설정 `method.matrix.information_gap`: id `information_gap`, 이름 '보전 평가 공백 · 우선 조사', 상태 '정보충분도 낮음 · 우선 조사(보전 평가 공백)', 사유 문구 두 가지(korea_status_unconfirmed 8종 · no_conservation_assessment 6종), 다음 조사 문구, 다른 나라·지역 평가 참고 문구, 강조 툴팁 '활용 지표는 높지만 보전 평가가 없음'.
- `types_note`: "information_gap은 다섯 번째 사분면이 아니라 MCUI가 없는 종의 별도 표시다." `types`에는 키를 더하지 않았다(화면이 `types`를 돌며 사분면을 만든다).
- `untyped_label`: '보전 평가 공백 · 우선 조사'(지도 회색 셀 범례). 셀 색 우선순위는 그대로다.
- `substitute_mcui_note`: 서식국 국가 목록(3.15)·지방 목록(4.2)·Rapid LC 점수화(4.3) 문장에 '4.14에서 철회'를 붙였다. 옛 문장이 현재 규칙으로 읽히지 않게 하려는 것이다.
- `matrix-readiness.json` 행: 모든 행에 `type`(유형 id, `information_gap`, 또는 null). 공백 14행에 `information_sufficiency`(`level: low`, `basis: MCUI`, 보고서의 `mcui_ratio` 0 · `mean_ratio`), `gap_reason_ko`, `next_survey_ko`, 다른 나라·지역 평가가 있는 8행에 `reference_note_ko`. 문구는 설정에서 읽는다.
- 화면: 비교와 지표 매트릭스 아래 레일, 매트릭스 머리와 '근거와 방법' 30종 카드의 분해 한 줄, 종 프로필·데이터 표·탐색 지도·방법 탭의 문구, '근거와 방법' 03의 '왜 14종은 점수를 만들지 않았나' 문단(숫자는 `posthoc.validation_sets`에서 읽음), 챗봇 '왜 미역은 매트릭스에 없어요?'.

## '정보충분도'의 뜻

화면에는 4.14 전부터 '정보충분도'(필수 입력 평균 비율, 50% 미만이면 우선 조사)가 있다. 공백 14종의 평균은 61~67%로 그 기준은 넘지만 보전(MCUI) 입력은 0%다. 그래서 '정보충분도 낮음'은 **보전 축 기준**이라고 함께 적는다(화면: '보전(MCUI) 입력 0% · 전체 평균 67%').

## 숫자

전체 30종(운영 8 · 조사 후보 22) = 매트릭스 16종 + 보전 평가 공백 14종(운영 3 · 후보 11). 공식 가중치 0.5에서 BBVI 50 이상인 공백 종은 미역 67.9 · 톳 64.2 · 감태 59.6 · 꼬시래기 59.6 · 가시파래 53.7 · 넙치 51.3의 6종이다. 해조류는 9종 중 8종이 공백이다(매트릭스에는 우뭇가사리만).
