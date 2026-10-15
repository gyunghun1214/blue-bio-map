# 검증 성적표 확인 (2026-10-15)

근거와 방법 탭 맨 위의 '검증 성적표'와 지표 배지. 점수·유형·지도 색은 바꾸지 않았다.

## outcome_class 대응표 (verified-4.19)

| 검증 | 저장된 result (그대로) | outcome_class | 화면 표시 | 결과 뒤 조치 |
|---|---|---|---|---|
| MFPI | passed | 통과 | 통과 | 해당 없음(점수에 사용) |
| MBPI | failed | 실패 | 기준 미충족 | 유지(BBVI에 사용, 종 상세에 결과 표시) |
| MBPI_RX | failed | 실패 | 기준 미충족 | 참고로 내림(처음부터 점수 미사용) |
| MCUI | reproduced_n2 | 일관성 확인(독립 아님) | 일관성 확인(독립 아님) | 해당 없음 |
| MCUI_stock_decline | consistent_same_data | 일관성 확인(독립 아님) | 일관성 확인(독립 아님) | 해당 없음 |
| MCUI_preliminary | failed | 실패 | 기준 미충족 | 유지(4.17부터 예비 평가로 사용, 4.19 기준 10종) |
| MCUI_preliminary_criterion_A | failed | 검증 불성립 | 검증 불성립(표본 부족) | 도입하지 않음 |
| MCUI_trend | failed | 실패 후 사용 중단 | 기준 미충족 · 사용 중단 | 점수에서 뺌(4.11) |

규칙(config/posthoc-scorecard.json `outcome_rule`): passed → 통과 · consistent_same_data/reproduced_n2 → 일관성 확인(독립 아님) ·
not_computable → 검증 불성립 · failed 중 조치가 '점수에서 뺌' → 실패 후 사용 중단 · failed 중 미리 정한 최소 표본에 못 미침 → 검증 불성립
(기준 A: 판정 가능 4종 < 8종) · 나머지 failed → 실패.

지표 배지: 통과한 검증이 있으면 '검증 통과'(MFPI), 없고 일관성 확인이 있으면 '제한적 확인'(MCUI), 둘 다 없으면 '검증 미통과'(MBPI;
화면에서는 사이트 공통 문구 규칙 plainWords로 '방법 검증 기준 미충족').

## 점수 diff

`dist/assessments.json`, `dist/matrix-readiness.json`, `dist/expedition-stops.json`: origin/main(5e317a7)과 바이트 동일
(sha256 1944f163… / bae6626e…, `git diff` 0줄). 지표 생성기는 성적표 파일을 읽지 않는다(test_posthoc_scorecard).

## 검사

- capture.mjs: 1440·375 11 PASS / 0 FAIL (results.json)
- 단위 시험 453 OK, node 시험 전부 통과, uicheck 200 PASS / 4 FAIL(위성·수심 타일 차단 환경 4건, 기존과 같음)
