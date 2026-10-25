# 영어 화면 용어 사전

영어 화면(`?lang=en`)은 아래 말로 통일한다. 한국어 원문에 왼쪽 용어가 들어 있으면, 영어 번역에도 오른쪽 용어가 들어 있어야 한다
(`node verification/test_i18n.mjs`의 (바) 검사가 이 표를 읽는다). 한 칸에 영어가 여럿이면(`/`로 나눔) 그중 하나만 있으면 된다.
표 형식(`| 한국어 | English |`)을 지킨다. 지표 약어(BBVI·MCUI·MBPI·MFPI)는 영어에서도 그대로 쓰고, 첫 등장에만 풀어 쓴다.
나라 이름은 자료의 `country`(영어) 필드를, 학명·식별자·출처 제목·기관 이름은 원어 그대로 쓴다.

| 한국어 | English |
|---|---|
| 탐색 지도 | Explore map |
| 비교와 지표 | Compare & indices |
| 근거와 방법 | Evidence & methods |
| 바다 탐험 | Ocean expedition |
| 탐색 후보 | Species / explore candidate |
| 활용가치 | Use value |
| 보전 시급성 | Conservation urgency |
| 신약 잠재력 | Bioactive (drug-discovery) potential / Bioactive potential |
| 식량 잠재력 | Food potential |
| 활용 × 보전 매트릭스 | Use × conservation matrix |
| 활용 × 보전 | Use × conservation |
| 활용 연구 검토 | Research on uses |
| 활용·보전 병행 검토 | Use and conservation together |
| 보전 연구 우선 검토 | Conservation research first |
| 기초조사 검토 | Baseline survey |
| 활용 지표 높음 | Use index high |
| 보전 지표 높음 | Conservation index high |
| 두 지표 모두 높음 | Both indices high |
| 두 지표 모두 낮음 | Both indices low |
| 정보충분도 | Data sufficiency |
| 우선 조사 대상 | Priority for survey |
| 미탐색 후보 | Unexplored candidate |
| 출현 기록 | Occurrence records / occurrence record |
| 출현기록 | Occurrence records / occurrence record |
| 공개 1° 셀 | Public 1° grid cell / public 1° grid cells |
| 단일 논문 | Single study / single study |
| 하한값 | Lower bound / lower bound |
| 예비평가 | Preliminary assessment / preliminary assessment |
| 예비 평가 | Preliminary assessment / preliminary assessment |
| 지방 목록 | Regional list / regional list |
| 연구 프로토타입 | Research prototype / research prototype |
| 저장 사본 | Saved snapshot / saved snapshot |
| 연결 중 | Connecting / connecting |
| 의견 보내기 | Send feedback |
| 탐색용 기준선 | Exploratory reference line / exploratory reference line |
| 근거 자세히 보기 | Evidence details |
| 사용법 안내 도우미 | Guide helper |
| 백분위 | percentile |
| 비교집단 | comparison set / comparison sets |
| 근거 계수 | evidence factor |
| 가식부 | edible portion |
| 사전 등록 | pre-registration / pre-registered |
| 어획량 감소 신호 | catch decline signal |
| 관심대상 | Least Concern |
| 준위협 | Near Threatened |
| 취약 | Vulnerable |
| 위급 | Critically Endangered |
| 미평가 | Not Evaluated / not evaluated |
| 방법 4.19판 | Method v4.19 |

IUCN 범주는 코드와 IUCN 영어 이름을 함께 쓴다: LC Least Concern · NT Near Threatened · VU Vulnerable · EN Endangered ·
CR Critically Endangered · DD Data Deficient · NE Not Evaluated. ('위기'는 다른 뜻으로도 쓰여 표에 넣지 않았다. EN 범주일 때는 Endangered.)

## 번역 규칙 (요약)

- 경고·단서는 같은 강도로 옮긴다: 추정 → estimated, 가능성 → may / possible, 예비 → preliminary, 약 → about.
- `proven`, `confirmed`, `guaranteed`, `definitely`, `safe`, `validated`는 원문에 검증·확인·보장·안전에 해당하는 말이 있을 때만 쓴다.
- 숫자·단위·연도·종 수·%는 원문과 같게 둔다(천 단위 쉼표는 써도 된다).
- 원문에 없는 주장을 더하지 않는다. 영어 일반명은 `dist/species-names-en.json`(WoRMS·FAO 확인)에 있는 것만 쓴다.
