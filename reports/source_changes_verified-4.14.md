# 자료원·근거 변경과 MBPI 영향: verified-4.13 → verified-4.14

`python scripts/lineage.py diff --from verified-4.13 --to verified-4.14`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 0개 (|변화| 큰 순), 변경 항목 0건.


## 이 실행의 변경 설명 (config `changes_from`)

verified-4.13 (2026-10-14). Method review of 2026-10-14, registered in research/verified-indices/prereg-4.14-2026-10-14.md in its own commit before the code (team-lead decision 2026-10-14). (1) Each species carries conservation_status: one state (official_scored, official_dd, official_ne, other_region_only, self_preliminary_only, not_found, lookup_failed) and every official assessment kept apart by scope; a zero-result search is never NE. (2) The extinction-risk part of MCUI uses only the IUCN global assessment and the Korean national list; another country's or a sub-national list and the Rapid LC check are reference items without an MCUI number (mcui_scope). (3) With no extinction-risk MCUI, a stock-decline score is used only as a lower bound at or above the matrix MCUI threshold. (4) BBVI mixes the unrounded MFPI and MBPI and is rounded once; types use the unrounded BBVI (scores_unrounded). (5) Neutral research type names; the 50 lines are exploratory. (6) MBPI breadth adds independent papers, max, mean and the tested material; display only.
