# 자료원·근거 변경과 MBPI 영향: verified-4.10 → verified-4.11

`python scripts/lineage.py diff --from verified-4.10 --to verified-4.11`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 6개 (|변화| 큰 순), 변경 항목 13건.

- **참굴(Magallana gigas)** MBPI 96.3→72.2: 근거 기록 변경 — SEQ:LQP|ahtpdb-ace-ic50-hhl-cushman-cheung: 근거 가중 1.0 → 0.75 (독립 논문 2 → 1) [verified-4.11#0012]
- **갑오징어(Acanthosepion esculentum)** MBPI 87.7→65.8: 근거 기록 변경 — SEQ:FMRF|ChEMBL_37:CHEMBL5952|Ki: 근거 가중 1.0 → 0.75 (독립 논문 2 → 1) [verified-4.11#0013]
- **톳(Sargassum fusiforme)** MBPI 86.6→65.0: 근거 기록 변경 — SEQ:GKY|ahtpdb-ace-ic50-hhl-cushman-cheung: 근거 가중 1.0 → 0.75 (독립 논문 2 → 1) [verified-4.11#0010]; SEQ:SKTY|ahtpdb-ace-ic50-hhl-cushman-cheung: 근거 가중 1.0 → 0.75 (독립 논문 2 → 1) [verified-4.11#0011]
- **감태(Ecklonia cava)** MBPI 67.5→56.8: 근거 기록 변경 — CID:10429214|wijesinghe-2011-cell-free-ACE-IC50: 항목 제거 (기록 1건) [verified-4.11#0004]; CID:145937|wijesinghe-2011-cell-free-ACE-IC50: 항목 제거 (기록 1건) [verified-4.11#0005]; CID:23427055|wijesinghe-2011-cell-free-ACE-IC50: 항목 제거 (기록 1건) [verified-4.11#0006]; CID:3008868|wijesinghe-2011-cell-free-ACE-IC50: 항목 제거 (기록 1건) [verified-4.11#0007] 외 1건
- **큰가리비(Mizuhopecten yessoensis)** MBPI 36.4→27.3: 근거 기록 변경 — SEQ:VW|ahtpdb-ace-ic50-hhl-cushman-cheung: 근거 가중 1.0 → 0.75 (독립 논문 2 → 1) [verified-4.11#0009]
- **미역(Undaria pinnatifida)** MBPI 95.3→89.2: 근거 기록 변경 — SEQ:FY|ahtpdb-ace-ic50-hhl-cushman-cheung: 근거 가중 1.0 → 0.75 (독립 논문 2 → 1) [verified-4.11#0001]; SEQ:IW|ahtpdb-ace-ic50-hhl-cushman-cheung: 근거 가중 1.0 → 0.75 (독립 논문 3 → 1) [verified-4.11#0002]; SEQ:IY|ahtpdb-ace-ic50-hhl-cushman-cheung: 근거 가중 1.0 → 0.75 (독립 논문 3 → 1) [verified-4.11#0003]

## 이 실행의 변경 설명 (config `changes_from`)

verified-4.10 (2026-10-13). Rule corrections from the 2026-10-13 data audit, registered in research/verified-indices/prereg-4.11-2026-10-13.md in its own commit before the code (team-lead decision 2026-10-13). (1) A potency replication joins independent_dois only when it measured a purified isolate of the scored species itself (bioactivity.replication_origin_rule); synthetic peptides, other organisms and fragments replicate potency only. Peptides of three residues or fewer carry a 'not species-specific' caveat. (2) bioactivity.minimum_compounds_per_stratum 3 -> 30, as every other stratum. (3) Each species carries mbpi_breadth (item count, median, top-two mean; exploratory, display only). (4) A sub-national red-list category gives an MCUI only when the pre-registered back-test passed; otherwise it is shown as reference and the next basis applies. (5) A Rapid LC check is not scored when the OBIS reporting-rate ratio is at or below the decline ratio, confirmed or not; the OBIS decline-signal adjustment is suspended (effort_adjustment 0) because its post-hoc check failed.
