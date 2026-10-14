# 자료원·근거 변경과 MBPI 영향: verified-4.11 → verified-4.12

`python scripts/lineage.py diff --from verified-4.11 --to verified-4.12`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 0개 (|변화| 큰 순), 변경 항목 0건.


## 이 실행의 변경 설명 (config `changes_from`)

verified-4.11 (2026-10-14). MCUI gains a second element, a stock-decline signal from KOSIS coastal and offshore fishery production (DT_1EW0004, national, 2015-2024 confirmed years), registered in research/verified-indices/prereg-4.12-2026-10-14.md in its own commit before the code (team-lead decision 2026-10-14). Decline D = 1 - mean(2022-2024) / mean(2015-2017); 30% / 50% / 80% give 35 / 60 / 80 (bands borrowed from IUCN criterion A, not an IUCN assessment), capped at 60 for a broader KOSIS item; no score for no matching item, three or more blank years, a recent aquaculture share of 50% or more, or a baseline under 100 t. MCUI = max(extinction-risk MCUI, stock-decline score); the extinction-risk basis and every other index are unchanged.
