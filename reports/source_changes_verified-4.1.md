# 자료원·근거 변경과 MBPI 영향: verified-4.0 → verified-4.1

`python scripts/lineage.py diff --from verified-4.0 --to verified-4.1`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 1개 (|변화| 큰 순), 변경 항목 3건.

- **꽃게(Portunus trituberculatus)** MBPI 산출 보류→30.3: 근거 기록 변경 — SEQ:MSMRRGWRFLRGGVGGWCR|amp-dbaasp-mic-broth-escherichia-coli: 항목 추가 (기록 1건) [verified-4.1#0002]; SEQ:MSMRRGWRFLRGGVGGWCR|amp-dbaasp-mic-broth-staphylococcus-aureus: 항목 추가 (기록 1건) [verified-4.1#0003]

## 자료원 버전 변경

- `hong_2025_ijms_mts`: 2025 → 2025 (PMID 40943465, PMC12429151) [verified-4.1#0001]

## 이 실행의 변경 설명 (config `changes_from`)

verified-4.0 (2026-10-04). Team-lead request of 2026-10-04 to find ways to fill the last blanks. One cell pair moves: 꽃게 (Portunus trituberculatus) enters the AMP stratum with MCCC1-MTS (Hong et al. 2025, MIC 14.1 uM against Escherichia coli and Staphylococcus aureus, Mueller-Hinton broth microdilution, synthetic peptide above 90% purity). verified-4.0 held the record back because the group's patent KR20250095776A names a different crab for the same sequence; the origin is now settled on public sequence records (the 19-mer is the N-terminus of the species' own MCCC1 gene model UniProt A0A5B7CYN9 and is absent from the Chionoecetes opilio record A0A8J5CHQ3; its average mass reproduces the paper's own ug/mL to uM conversion), and the draft-gene-model and patent caveats are shown with the value. No cohort, weight, coefficient or threshold changes; no other species moves. Filled cells 100 -> 102. See research/verified-indices/formal-release-4.1-2026-10-04.md.
