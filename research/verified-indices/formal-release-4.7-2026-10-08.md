# `verified-4.7` — 출처 정정과 근거 출처 목록 보강 (2026-10-08)

계기: 2026-10-08 출처·링크 점검(링크 611개 확인, DOI 260개 해석, 출처 DOI 95개를 Crossref와 대조).

결과: **점수·라벨·매트릭스 유형·우선 조사 대상·근거 값은 하나도 바뀌지 않는다.** 바뀐 것은 공개 출처 목록(`sources`)의 메타데이터와 종별 출처 목록(`source_ids`)뿐이다.

## 1. 근거에 쓴 출처를 종 출처 목록에 모두 넣음 (`source_ids_from_traces`)

공개된 근거 기록(영양·생리활성·보전·대체 평가·추세)이 이름을 대는 등록 출처를 그 종의 `source_ids`에도 넣는다. 4.6까지는 쓰였지만 종 상세 '원문·이용조건'과 `matrix-readiness.json`의 출처 링크에 빠져 있었다.

- IUCN 재확인 검색(`iucn_redlist_recheck`) 12종, RDA 지방산 표(`rda_db_10_4_fatty_acids`) 10종
- 해삼 `yun_2018_holotoxin`·`pubchem_pugrest`, 큰가리비 효능 재현 비교 논문 3편(`lin_2018_chlorella`·`kapel_2006_alfalfa`·`nomura_2002_thresher`), 참굴 `fao_korea_oyster`, 방어 `kosis_fish_aquaculture` 등

## 2. 출처 메타데이터 정정 (`source_corrections`, 공개 목록에만 적용)

| 출처 | 바꾼 항목 |
|---|---|
| `zhang_2022_rockfish_ts40` | title |
| `zhang_2022_ulva_htdt` | title |
| `zhu_2017_sinonovacula_sch` | title |
| `li_2025_yield` | title |
| `valenzuela_2022_yield` | title |
| `undaria_2018_paper` | title |
| `halocynthia_2006_paper` | title |
| `gelidium_2018_extract` | title |
| `sargassum_2024_fractions` | title |
| `magallana_2013_peptide` | title |
| `apostichopus_2024_paper` | title |
| `huang_2017_mmr_shp` | title |
| `ding_2011_cjnm_qpk` | doi_status |
| `worms_classification` | url |
| `cellosaurus_mbpi` | url |
| `europepmc_fulltext_p703` | url |
| `europepmc_mbpi` | url, title, license |
| `cmnpd_mbpi` | title, license |
| `gbif_iucn_checklist` | license_url |
| `iucn_redlist_recheck` | license, license_url |
| `ufish_1` | license |
| `rda_10_4_ulva_prolifera_dried` | url |

- 제목: 인용 문구가 논문 내용 요약이거나 저자를 잘못 적은 12건을 Crossref의 실제 제목·제1저자·연도로 바꿨다(예: 조피볼락 TS40 논문 저자 Zhang M → Liu H). 출처 id는 바꾸지 않았다(내부 키).
- 링크: 열리지 않던 API 주소 4개(WoRMS·Cellosaurus·Europe PMC ×2)를 설명 페이지로, RDA 가시파래 행 주소에 사이트가 요구하는 `fdNms` 인자를 붙였다.
- 이용조건: CMNPD·Europe PMC에 빠진 `license`·`title`을 넣고, 같은 자료를 가리키는 두 id(uFiSh, IUCN 검색)의 이용조건 문구를 하나로 맞췄다. GBIF IUCN 체크리스트 이용조건 주소를 https로.
- DOI: 갑오징어 Ding 2011의 DOI `10.3724/SP.J.1009.2011.00151`은 논문에 인쇄돼 있지만 doi.org·Crossref에 등록되지 않았다(404). `doi_status`로 밝히고 링크는 ScienceDirect 논문 페이지 그대로 둔다.

## 3. 재현

- `python scripts/build_verified_indices.py --check` (기본 설정 `config/verified-indices-v4.7.json`)
- 4.6 공개본은 `archive/assessments-verified-4.6.json`, `--config config/verified-indices-v4.6.json`으로 바이트 단위 재현(두 설정 키는 4.7에서만 켜진다).
- 테스트: `Verified47Tests`(출처 외 변화 없음, 근거가 이름을 대는 출처는 모두 `source_ids`에 있음, 정정 항목 확인).

## 4. 이번에 고치지 않은 것

- 쓰이지 않는 출처 12개(검색만 하고 결과가 없던 지방 목록 등)는 기록으로 남겼다.
- 운영 DB 스냅샷의 인용 1건(`http://www.mnh.si.edu/…`, 도메인 소멸)은 운영 DB 쪽에서 고쳐야 한다.
- AHTPDB·CancerPPD(`webs.iiitd.edu.in`)는 점검 시점에 DNS 응답이 없었다. 일시 장애로 보고 다시 확인한다.
- 이용조건 문구(약 80종류)를 SPDX로 통일하는 일은 하지 않았다.
