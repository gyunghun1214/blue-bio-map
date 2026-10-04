# 자료원·근거 변경과 MBPI 영향: verified-4.1 → verified-4.2

`python scripts/lineage.py diff --from verified-4.1 --to verified-4.2`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 0개 (|변화| 큰 순), 변경 항목 0건.


## 이 실행의 변경 설명 (config `changes_from`)

verified-4.1 (2026-10-04). Team-lead decision of 2026-10-04: the competition deadline (2026-10-30) falls before every official route that could fill the ten empty MCUI cells (IUCN 2026-2 on 2026-11-19; the Japanese 5th marine red list from FY2026), so the conservation axis accepts one more basis: an official SUB-NATIONAL red list (prefecture, federal subject, province) of a state in the species' native range. It ranks below every national basis and never overrides one; DD and regional extinction give no score; several regions are reduced by the median (the lower-risk of the two middle categories when the count is even). Every value carries a '지방 목록 참고값' label, its own matrix marker and the result of a pre-registered over-statement back-test (research/verified-indices/prereg-subnational-mcui-2026-10-04.md, committed before the rows were collected). The extension was decided after seeing which cells it would fill; that is stated in the record and on the method tab. No cohort, weight, coefficient or threshold of any other axis changes.
