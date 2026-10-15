# `verified-4.15` — MCUI가 없는 14종을 '공식 보전 평가 대상 외'로 보이기 (2026-10-15)

계기: 팀장(LKH)이 2026-10-15 매트릭스 밖 14종을 숨은 '미배치'로 두지 말고 화면에 드러내라고 요청했다. 프롬프트를 `main`(4728045, `verified-4.14`)과 대조해 고친 v2는 프로젝트 파일 `prompts/information-gap-rail-claude-code-v2.md`에 있다. 같은 날 팀장 피드백으로 화면 문구를 '정보충분도 낮음 · 우선 조사(보전 평가 공백)'에서 확인된 사실만 적는 '공식 보전 평가 대상 외'로 바꿨다.

**표시 규칙만 바꾼 버전이다.** 설정 문장(`method.matrix`, `mcui_scope.state_labels`)이 바뀌어 `matrix-readiness.json`의 `matrix_rule`이 달라지므로 버전 올림 규칙을 따랐다. 사전 등록은 하지 않았다. 점수·유형·기준값을 정하는 규칙이 하나도 바뀌지 않기 때문이다.

## 바뀌지 않은 것

30종의 MFPI·MBPI·MCUI·BBVI, `scores_unrounded`, `conservation_status`의 상태와 평가 목록(라벨 문구만 바뀜), `priority_survey_reasons`, `information_sufficiency`, 매트릭스 유형(활용 연구 6 · 병행 1 · 보전 연구 3 · 기초조사 6), 매트릭스 점 16개와 위치, 구분선 50, 식품 가중치 0.5, `cell_colour_precedence`, 사후 검증 블록. `Verified415Tests.test_no_score_or_rule_changes`가 4.14 설정으로 만든 보고서와 종마다 비교한다. 4.14 공개본은 `archive/assessments-verified-4.14.json`에 보관했고 4.14 설정으로 바이트 단위 재현한다(`Verified414Tests`). 계보 `diff --from verified-4.14 --to verified-4.15` 점수 변화 0건.

**하지 않은 것.** MCUI가 없는 종에 0점, LC 상당 10점, 근연종 값, Rapid LC 값, 다른 나라 평가를 넣지 않았다(팀장 결정 2026-10-15: 예비 평가와 다른 나라 평가는 참고로만). 매트릭스 아래 줄의 점에는 세로 위치가 없고 사분면 안에 찍지 않는다. 국가평가 마커·단일 논문 마커는 그대로다.

## 공식 평가 확인 (2026-10-15)

[확인 기록](mcui-official-search-2026-10-15.md)(다른 스레드가 팀장 PC의 Chrome으로 조사). IUCN 적색목록 2026-1 색인을 속·학명·이명으로 질의했고 14종 모두 미평가(NE)였다. 국가생물적색자료집 통합본(2019–2024)과 국립생물자원관 평가 현황표 기준으로 해조류·해산어·갑각류·멍게류는 평가 대상 분류군이 아니고(13종), 시카메굴(연체동물)은 목록에 없다. 설정 `information_gap.official_check`에 날짜·출처·종 목록을 적고, 각 종의 사유 문구는 이 목록에서 정한다.

## 바뀐 것

- 설정 `method.matrix.information_gap`: id `information_gap`, 이름·상태 '공식 보전 평가 대상 외', `official_check`, 사유 문구(national_out_of_scope 'IUCN 미평가(NE) · 국가 적색목록 평가 대상 분류군 아님', national_not_listed 'IUCN 미평가(NE) · 국가 적색목록 미수록'), 배치 조건 'IUCN 또는 국가 적색목록에 평가가 공표되면 매트릭스에 배치', 다른 나라·지역 평가 참고 문구, 강조 툴팁 '활용 지표 높음 · 공식 보전 평가 대상 외'.
- `types_note`: "information_gap은 다섯 번째 사분면이 아니라 MCUI가 없는 종의 별도 표시다." `types`에는 키를 더하지 않았다(화면이 `types`를 돌며 사분면을 만든다).
- `untyped_label`과 `mcui_scope.state_labels`의 other_region_only·self_preliminary_only: '공식 보전 평가 대상 외 · …'. 셀 색 우선순위는 그대로다.
- `substitute_mcui_note`: 서식국 국가 목록(3.15)·지방 목록(4.2)·Rapid LC 점수화(4.3) 문장에 '4.14에서 철회'를 붙였다.
- `matrix-readiness.json` 행: 모든 행에 `type`(유형 id, `information_gap`, 또는 null). 해당 14행에 `information_sufficiency`(보고서의 비율을 옮김, 화면에는 쓰지 않음), `gap_reason_ko`, `official_check_ko`, `next_survey_ko`, 다른 나라·지역 평가가 있는 8행에 `reference_note_ko`. 문구는 설정에서 읽는다.
- 화면: 비교와 지표 매트릭스 아래 줄, 매트릭스 머리와 '근거와 방법' 30종 카드의 분해 한 줄, 종 프로필·데이터 표·탐색 지도·방법 탭의 문구, '근거와 방법' 03의 'MCUI가 없는 종은 왜 사분면 밖에 있나요?' 문단(예비 평가를 공식 평가로 대체한 경위는 접힌 상세, 숫자는 `posthoc.validation_sets`에서 읽음), 챗봇 '왜 미역은 매트릭스에 없어요?'.

## 숫자

전체 30종(운영 8 · 조사 후보 22) = 매트릭스 16종 + 공식 보전 평가 대상 외 14종(운영 3 · 후보 11). 공식 가중치 0.5에서 BBVI 50 이상인 종은 미역 67.9 · 톳 64.2 · 감태 59.6 · 꼬시래기 59.6 · 가시파래 53.7 · 넙치 51.3의 6종이다. 해조류는 9종 중 8종이 매트릭스 밖이다(매트릭스에는 우뭇가사리만).

## 남은 것

탐색 지도의 선택 층 '우선 조사 대상(정보충분도 낮음 또는 보전 평가 없음)'(3.4부터, 기본 꺼짐)은 이번 범위 밖이라 그대로 두었다. IUCN 2026-2(2026-11-26 공개 예정)와 국립해양생물자원관의 해양생물 적색목록이 공표되면 해당 종을 다시 확인한다.
