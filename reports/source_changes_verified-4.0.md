# 자료원·근거 변경과 MBPI 영향: verified-pilot-3.28 → verified-4.0

`python scripts/lineage.py diff --from verified-pilot-3.28 --to verified-4.0`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 1개 (|변화| 큰 순), 변경 항목 3건.

- **우뭇가사리(Gelidium elegans)** MBPI 산출 보류→13.5: 근거 기록 변경 — CHEMBL510103|CHEMBL378|IC50: 항목 추가 (기록 1건) [verified-4.0#0003]

## 자료원 버전 변경

- `pubchem_inchikey_mbpi`: queried 2026-09-29 to 2026-09-30; supplement queried 2026-10-03 → queried 2026-09-29 to 2026-09-30; supplement queried 2026-10-04 [verified-4.0#0001]
- `wikidata_p703_lotus`: query service, queried 2026-09-29 to 2026-09-30; supplement queried 2026-10-03 → query service, queried 2026-09-29 to 2026-09-30; supplement queried 2026-10-04 [verified-4.0#0002]

## 이 실행의 변경 설명 (config `changes_from`)

verified-pilot-3.28 (2026-10-03). Team-lead decisions of 2026-10-04: (1) the indicator set is published as 정식 산출 under frozen rules (status 'released'); every validation result stays on screen (MFPI method check passed; MBPI drug-origin post-hoc failed, shown as '검증 미통과'; MCUI is the official assessment category mapped by conservation.category_scores, its OBIS trend element failed its check). (2) Gap filling under three approved extensions, each labelled: MFPI rows converted with other samples' fresh moisture (가시파래: RDA DB 10.4 dried row L0270010001a at the median 93.1% of three papers; 감태: Kawashima et al. 1983 activation analysis at the median 85.5% of Yamada & Kinoshita 2004), with the 3.27 aquaculture records of both species; MCUI from the Fisheries Agency of Japan rarity evaluation 2017 'ランク外' read as LC-equivalent (넙치, 대구); MBPI through the Korean 'Gelidium amansii' -> Gelidium elegans name mapping (우뭇가사리: pheophorbide A, Park, Kim & Han 2022, ChEMBL CHEMBL510103 HIV-1 IC50, with the 2026-10-04 supplement of the same ChEMBL_37 release). No cohort, weight, coefficient or threshold changes. Filled cells 92 -> 100. See research/verified-indices/formal-release-4.0-2026-10-04.md.
