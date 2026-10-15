# 자료원·근거 변경과 MBPI 영향: verified-4.14 → verified-4.16

`python scripts/lineage.py diff --from verified-4.14 --to verified-4.16`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 0개 (|변화| 큰 순), 변경 항목 0건.


## 이 실행의 변경 설명 (config `changes_from`)

verified-4.14 (2026-10-15). Display only; no score, rule, cohort, factor, weight or threshold changed (research/verified-indices/formal-release-4.16-2026-10-15.md, LKH's request 2026-10-15). Each species carries evidence_profile: the amount of MBPI evidence (scored items, independent papers over all items, related papers no score uses) kept apart from whether the top item was independently replicated (replicated, attempted_not_counted with the reasons, none), the top item's percentile and evidence factor, and the MBPI without its top item. verified-4.15 was left to a parallel change.
