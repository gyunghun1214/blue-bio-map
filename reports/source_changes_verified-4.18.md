# 자료원·근거 변경과 MBPI 영향: verified-4.17 → verified-4.18

`python scripts/lineage.py diff --from verified-4.17 --to verified-4.18`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 1개 (|변화| 큰 순), 변경 항목 1건.

- **청각(Codium fragile)** MBPI 0.4→0.6: 근거 기록 변경 — CHEMBL5287816|CHEMBL4303835|IC50: 근거 가중 0.5625 → 0.75 (독립 논문 1 → 2) [verified-4.18#0001]

## 이 실행의 변경 설명 (config `changes_from`)

verified-4.17 (2026-10-15). Team-lead decision of 2026-10-15 on the six items left open in research/verified-indices/prereg-4.13-2026-10-14.md section 5, registered in research/verified-indices/prereg-4.18-2026-10-15.md in its own commit before the code ("proceed as recommended"). Five of them keep the rules as they were and change no number: a range-only MIC, a buffer (PBS) MIC, a new enzyme stratum outside ChEMBL, a market sample with no scientific name, and a linked original paper by the same group with undisclosed methods all stay out of the scores and remain visible as partial records with their reason. The sixth changes one rule: a 3.20 original-paper link may now also be added to a compound the species already links, where it joins that link's DOI set (chembl_bioactivity.paper_links_p703, 4.18 file). The paper must meet the same five 3.20 conditions and carry an accepting link review; the link factor stays 0.75 for one DOI and 1.0 for two or more. 청각 siphonaxanthin gains Yim et al. 2020 (Mar Drugs 18:603, 10.3390/md18120603: C. fragile cultured at Wando, collected August 2019, supercritical CO2 extract purified by preparative HPLC) beside the 1979 Phytochemistry structure paper: link factor 0.75 -> 1.0, MBPI 0.4 -> 0.6, BBVI 18.5 -> 18.6. Yim et al. 2021 (Int J Mol Sci 22:6481), named in the 4.13 decision, is NOT used: its Methods give no collection site or date. The activity factor (one ChEMBL document) and the single-paper BBVI label are unchanged, and no other species moves. Every other rule and coefficient equals 4.17.
