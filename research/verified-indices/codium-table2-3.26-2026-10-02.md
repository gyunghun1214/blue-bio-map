# verified-pilot-3.26 — 청각 양식 기록의 제약 문구 정정 (2026-10-02)

기록 문장 하나만 고쳤다. 규칙, 비교집단, 계수, feasible 판정은 바꾸지 않았다. **30종 점수 변화는 없다**(69/120 그대로).

- 설정: `config/verified-indices-v3.26.json`. 3.25에서 입력 하나만 바꿨다.
  - `nutrition.substitutes.aquaculture_supplement` → `mfpi-aquaculture-names-3.26-2026-10-02.json`
  - 3.25 공개본은 `archive/assessments-verified-pilot-3.25.json` 에 보관했다. 그 재현은 `VerifiedPilot325Tests` 가 검사한다.
- 새 입력은 3.25 파일을 복사해서(fork) 만들었다. 청각(145086) 기록의 `limitations` 한 필드만 다르다. 3.25 설정은 3.25 파일을 그대로 읽는다(검사로 고정).
- 결정 경위: 3.25 사후 검토(2026-10-02)에서 찾았고, 팀장 지시("다음 버전에 청각 36,110 문구 고쳐줘", 2026-10-02)로 고쳤다.

## 1. 무엇이 틀렸나

3.25의 청각 제약 문구는 Hwang, Baek, Park 2008(*J Appl Phycol* 20:469-475) Table 2의 1 m 수심 생산량 "36,110 kg 건중량/ha"를 저자의 잠재 생산량 추정치로 인용했다. 논문에 그렇게 인쇄된 것은 맞지만, 표 자체의 계산 규칙과 맞지 않는다.

- 표 각주: 건조 수율 5%(80 °C, 24시간). 1 ha에 길이 100 m 로프 100줄(1 m 간격).
- 따라서 ha당 생산량은 (로프 100 m당 건중량) × 100이다.

| 수심 | 생중량 (kg/m) | 건중량 (kg/100 m) | × 100줄 | 논문 표기 (kg 건중량/ha) |
|---|---|---|---|---|
| 0.5 m | 1.58 | 7.9 | 790 | 790 |
| 1 m | 7.22 | 36.1 | **3,610** | **36,110** |
| 2 m | 3.43 | 17.2 | 1,720 | 1,720 |
| 3 m | 1.03 | 5.15 | 515 | 515 |

- 나머지 세 수심은 규칙대로인데 1 m 행만 한 자리가 더 들어갔다. 본문의 최대 잠재 생산량 문장과 수입 열(433,320 = 36,110 × 12달러)도 같은 오류를 따른다.
- 확인 경로: Springer 원문(기관 구독 전문 열람), 2026-10-02. PDF는 받지 않았다.

## 2. 고친 문구

- 전: "... The 36,110 kg dry weight per hectare in Table 2 is the authors' potential-production estimate from the best rope biomass, not measured farm output."
- 후: "... Table 2's production per hectare is the authors' estimate (5% dry yield, 100 ropes of 100 m per hectare), not measured farm output. Its 1 m row prints 36,110 kg dry weight, but the table's own rule, which the other three rows follow, gives 3,610 (36.1 kg dry per 100 m of rope x 100 ropes); the text and the income column repeat the printed figure."
- 앞 문장(연구용 1주기·1개 장소의 수심 시험)은 그대로다. 양식 근거(feasible=true)는 종자부터 수확까지의 원문 기록에 근거하므로 이 숫자와 무관하다.

## 3. 확인

- `build_verified_indices.py --check`, `build_matrix_readiness.py --check` 통과. 3.25 대비 점수와 보류 사유가 바뀐 종은 0종이다.
- 바뀐 출력: 청각 `food_trace.aquaculture.limitations`, 모든 종 `food_trace.method_version`, 홍합 아연 대체치 문구의 버전 표기. `VerifiedPilot326Tests.test_nothing_else_changes` 가 이 범위를 고정한다.
- 3.25 결정 기록(`doyoun-replication-3.25-2026-10-02.md`)의 해당 줄 아래에 정정 표시를 달았다.
