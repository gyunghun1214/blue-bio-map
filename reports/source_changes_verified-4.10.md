# 자료원·근거 변경과 MBPI 영향: verified-4.9 → verified-4.10

`python scripts/lineage.py diff --from verified-4.9 --to verified-4.10`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 0개 (|변화| 큰 순), 변경 항목 0건.


## 이 실행의 변경 설명 (config `changes_from`)

verified-4.9 (2026-10-12). No score, label, type or flag changes. Adds a secondary, exploratory MBPI-Rx beside MBPI (mbpi_rx), registered in research/verified-indices/prereg-mbpi-rx-4.10-2026-10-12.md in its own commit before the code: the published MBPI rule over the items outside the two strata whose comparison groups collect food-protein functional peptides (the AHTPDB ACE peptide stratum and the xanthine-oxidase peptide literature cohort). The 4.3 floor does not apply, so a species left without an item gets null with a reason (11 of 30). Every stratum is classified before the run (52 rows); an unclassified stratum stops the build. The MBPI post-hoc check is re-run with MBPI-Rx for the same operating species and cases (posthoc.validation_sets.MBPI_RX, exploratory: the rule was proposed after the MBPI check failed, and its result could be and was computed before registration). It never changes an axis label, MBPI, BBVI or the matrix.
