# 자료원·근거 변경과 MBPI 영향: verified-4.16 → verified-4.17

`python scripts/lineage.py diff --from verified-4.16 --to verified-4.17`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 0개 (|변화| 큰 순), 변경 항목 0건.


## 이 실행의 변경 설명 (config `changes_from`)

verified-4.16 (2026-10-15; scores and rules as 4.14, evidence profile display kept). Team-lead decision of 2026-10-15, registered in research/verified-indices/prereg-4.17-2026-10-15.md in its own commit before the code. The 2026-10-15 search found no IUCN global or Korean national assessment for the 14 species with no MCUI (IUCN NE). (1) With no official assessment, the extinction-risk part of MCUI again comes from a preliminary assessment, in the 4.13 order: the range state's national list, then the Rapid LC check (mcui_scope.preliminary_bases); sub-national lists stay reference only. (2) Such species carry conservation_status.state preliminary_scored ('예비 평가(공식 평가 전)') and join the matrix and map colours (matrix.include_substitute_mcui). (3) An official IUCN or national result replaces the preliminary value as soon as it is published. Everything else is 4.14.
