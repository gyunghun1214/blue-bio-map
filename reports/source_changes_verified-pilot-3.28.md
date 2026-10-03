# 자료원·근거 변경과 MBPI 영향: verified-pilot-3.27 → verified-pilot-3.28

`python scripts/lineage.py diff --from verified-pilot-3.27 --to verified-pilot-3.28`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 1개 (|변화| 큰 순), 변경 항목 3건.

- **톳(Sargassum fusiforme)** MBPI 65.0→86.6: 근거 기록 변경 — SEQ:GKY|ahtpdb-ace-ic50-hhl-cushman-cheung: 근거 가중 0.75 → 1.0 (독립 논문 1 → 2) [verified-pilot-3.28#0002]; SEQ:SKTY|ahtpdb-ace-ic50-hhl-cushman-cheung: 근거 가중 0.75 → 1.0 (독립 논문 1 → 2) [verified-pilot-3.28#0003]

## 이 실행의 변경 설명 (config `changes_from`)

verified-pilot-3.27 (2026-10-03). Potency replication under the existing rule, no rule, cohort or coefficient change: Chen et al. 2016 (J Food Process Preserv 40:492, synthetic standards, HHL) re-measured GKY 7.94 uM and SKTY 20.63 uM, two of the three 톳 peptides of Suetsuna 1998 (pIC50 gaps 0.307 and 0.270; GKY is 톳's top item, SVY 8.12 uM was not re-measured), and FY 4.83 uM (the 미역 FY item, gap 0.942, not its top item). 톳's top item now rests on two independent papers, so its MBPI loses the single-paper factor and its BBVI the '단일 논문' label. The paper was read through the user's university library login on 2026-10-03; in the same session Li et al. 2018 (Chemosphere) gave only dried-sample moisture, so 가시파래 MFPI stays withheld. See research/verified-indices/tot-replication-3.28-2026-10-03.md.
