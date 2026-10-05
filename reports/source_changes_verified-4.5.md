# 자료원·근거 변경과 MBPI 영향: verified-4.4 → verified-4.5

`python scripts/lineage.py diff --from verified-4.4 --to verified-4.5`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 2개 (|변화| 큰 순), 변경 항목 3건.

- **갑오징어(Acanthosepion esculentum)** MBPI 0.0→65.8: 근거 기록 변경 — SEQ:FMRF|ChEMBL_37:CHEMBL5952|Ki: 항목 추가 (기록 3건) [verified-4.5#0003]
- **방어(Seriola quinqueradiata)** MBPI 0.0→7.5: 근거 기록 변경 — SEQ:QHWSYGLSPG|ChEMBL_37:CHEMBL1855|IC50: 항목 추가 (기록 1건) [verified-4.5#0001]

## 이 실행의 변경 설명 (config `changes_from`)

verified-4.4 (2026-10-05). Team-lead decision cards of 2026-10-05 ("score 방어 by sbGnRH; score 갑오징어 by FMRFamide; reflect as 4.5 at once"), applied as fixed in research/verified-indices/prereg-4.5-2026-10-05.md before the values were written: no new rule. (1) MBPI: the 4.3 one-condition relaxation (d) now also covers 방어 and 갑오징어. 방어's sbGnRH (pGlu-HWSYGLSPG-NH2) is encoded with its processing signals by the species' reference genome (BDMU01000006.1, a Goto Island specimen); the identical synthetic peptide's wild-type human GnRH-receptor binding IC50 684 nM (Lu et al. 2007, open access, read in full) ranks in the ChEMBL GnRHR x IC50 cohort. 갑오징어's FMRFamide (FMRF-NH2) is encoded 11 times with processing signals by the species' own transcriptome (GGQU01104929.1, a Qingdao specimen); its own ChEMBL rows (human NPFF2 Ki 6.6 nM best) rank in the NPFF2 x Ki cohort with the peptide's rows excluded (prereg-4.5 2.3). Both are clade-common peptides (pan-perciform hormone variant; phylum-wide invertebrate neuropeptide): the team lead ruled they fall outside the letter of the 1.6 ban (vertebrate-common substances), and the commonness is stated in each item's caveat. The 1.6 ban itself, the cohort filters and every other value are unchanged; the floor rule stays registered but no species of this run uses it. (2) Presentation: a relaxed item's caveat now lives on its evidence row (species-specific wording); 참문어's caveat text is unchanged. An item's measurements list only the best target x endpoint's rows; the other targets stay visible beside it with their percentiles.
