# 자료원·근거 변경과 MBPI 영향: verified-4.3 → verified-4.4

`python scripts/lineage.py diff --from verified-4.3 --to verified-4.4`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 1개 (|변화| 큰 순), 변경 항목 1건.

- **참문어(동아시아 종)(Octopus sinensis)** MBPI 0.0→70.5: 근거 기록 변경 — SEQ:CYFRNCPIG|ChEMBL_37:CHEMBL1921|EC50: 항목 추가 (기록 2건) [verified-4.4#0001]

## 이 실행의 변경 설명 (config `changes_from`)

verified-4.3 (2026-10-05). Team-lead order of 2026-10-05 ("find a way to resolve the cells filled by a fallback, then fill them"), applied as fixed in research/verified-indices/prereg-4.4-2026-10-05.md before the values were written: no new rule. (1) MBPI: the 4.3 one-condition relaxation (d) is used for the first time. 참문어's cephalotocin (synthetic CYFRNCPIG-NH2, human V1b and V2 receptor EC50, Kim et al. 2022) is ranked in the ChEMBL cohort of the same target and endpoint; its origin is settled on the Octopus sinensis reference genome (NW_021826408.1, a Zhoushan specimen), which encodes the mature peptide with its amidation and cleavage signal (4.1 precedent: a public sequence record of the species' own sample). (2) MBPI: four partial records added (방어 1, 갑오징어 3); each fails two or more conditions, so 방어 and 갑오징어 keep the floor. (3) MCUI: an official-list re-check (2026-10-05) found no category for the six Rapid LC species and no global or national one for 미역; values and labels stay, and the re-check with the next official dates is shown. No cohort, weight, coefficient, threshold or other value changes.
