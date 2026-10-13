# 자료원·근거 변경과 MBPI 영향: verified-4.8 → verified-4.9

`python scripts/lineage.py diff --from verified-4.8 --to verified-4.9`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 1개 (|변화| 큰 순), 변경 항목 1건.

- **갑오징어(Acanthosepion esculentum)** MBPI 65.8→87.7: 근거 기록 변경 — SEQ:FMRF|ChEMBL_37:CHEMBL5952|Ki: 근거 가중 0.75 → 1.0 (독립 논문 1 → 2) [verified-4.9#0001]

## 이 실행의 변경 설명 (config `changes_from`)

verified-4.8 (2026-10-10). One rule addition and one species' two cells. The ACE stratum's replication device (2.3 cross_origin_potency: another paper's measurement of the same synthetic sequence adds its DOI to independent_dois without changing the value) is extended to the relaxation-(d) stratum as cross_origin_replication, on the pChEMBL scale and with the same gap of 1.0. Team-lead decision 2026-10-10, registered in research/verified-indices/prereg-4.9-2026-10-10.md before the values were published. 갑오징어 (1666974) FMRFamide, human NPFF2 Ki 6.6 nM: Bonini et al. 2000 J Biol Chem 275:39324 (10.1074/jbc.M004385200) measured FMRF-NH2 at the same receptor as Ki 4.0 +/- 0.2 nM (Table I), another author group, pKi gap 0.218, and the paper is in neither the cohort nor ChEMBL_37. Its DOI joins independent_dois, so the evidence factor goes 0.75 -> 1.0: MBPI 65.8 -> 87.7, BBVI 54.2 -> 65.1, and the single-paper label drops (26 -> 25 species). The scored value, its percentile and its cohort are unchanged. Kotani et al. 2001 (10.1038/sj.bjp.0704038, Ki 10.5 nM) is recorded as a candidate that is NOT used: the review the ChEMBL row comes from cites the value with reference numbers that do not resolve in its own reference list, and the ChEMBL assay text matches that paper's own group, so it may be the origin of the scored value.
