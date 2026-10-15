# 자료원·근거 변경과 MBPI 영향: verified-4.14 → verified-4.15

`python scripts/lineage.py diff --from verified-4.14 --to verified-4.15`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 0개 (|변화| 큰 순), 변경 항목 0건.


## 이 실행의 변경 설명 (config `changes_from`)

verified-4.14 (2026-10-14). Display rules only, no score changed (team request 2026-10-15, the application's information-sufficiency promise). (1) matrix.information_gap: a species with a BBVI and no MCUI (no IUCN global or Korean national category, mcui_scope) is shown on its own rail under the matrix, at its BBVI only, labelled 'information sufficiency low (conservation axis) · priority survey'; it gets no MCUI, no type and no map colour, as in 4.14. (2) matrix.types_note says information_gap is not a fifth quadrant. (3) matrix.untyped_label names the grey cell after the gap. (4) matrix.substitute_mcui_note marks the range-state, 4.2 sub-national and 4.3 scored Rapid LC sentences as withdrawn in 4.14. MFPI, MBPI, MCUI, BBVI, scores_unrounded and every matrix type are identical to 4.14.
