# 자료원·근거 변경과 MBPI 영향: verified-4.18 → verified-4.19

`python scripts/lineage.py diff --from verified-4.18 --to verified-4.19`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 0개 (|변화| 큰 순), 변경 항목 0건.


## 이 실행의 변경 설명 (config `changes_from`)

verified-4.18 (2026-10-15). Registered in research/verified-indices/prereg-4.19-2026-10-15.md in its own commit before the code (first registered as a 4.18 candidate before PR #198 took that number; rules and expected results unchanged), after 4.17 and 4.18 left 멍게 as the only species without MCUI. The 4.11 rule 5a (mcui_substitutes.preliminary_trend_block) is withdrawn: an OBIS reporting-rate ratio at or below the decline ratio no longer blocks a met Rapid LC check, because the 4.11 rule 5b post-hoc test found the OBIS decline signal does not separate threatened from LC species (the +10 adjustment stays off). As up to 4.10, only the decline_signal class blocks the check. 멍게 (Halocynthia roretzi, no IUCN, Korean or Japanese assessment covers tunicates) gets the Rapid LC check as a preliminary assessment (LC 10, shown by name in the species detail only). Every other species is 4.18's.
