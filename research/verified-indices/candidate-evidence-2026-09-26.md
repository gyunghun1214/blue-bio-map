# 조사 후보 22종 근거 보강 (verified-pilot-2 규칙 그대로, 2026-09-26)

규칙·가중치·비교집단은 바꾸지 않았다. 운영 8종의 `dist/assessments.json` 값은 보강 전 사본과 바이트 단위로 같다(`species` 8개 항목 전부 동일). 후보 22종은 `candidate_species`에 따로 출력하고 `candidate_label: "조사 후보"`를 붙인다. 점수가 생겨도 운영 목록으로 옮기지 않는다. 고정 비교집단의 `operating_candidates`는 운영 8종만 담고, 같은 집단에 행이 있는 후보는 `research_candidates`에 따로 적는다.

빈칸 유형: **A** 미조사 → 이번 PR에서 조사 완료. **B** 조사했으나 규칙상 보류(아래 사유 코드). **C** 규칙이 해양 근거를 담지 못함 → PR-B(`verified-pilot-3`)에서 다룬다.

## 종 × 축

| 종 | AphiaID | MFPI | MCUI | MBPI | 막힌 이유 (규칙 코드) |
|---|---|---|---|---|---|
| 다시마 *Saccharina japonica* | 377084 | 보류 | 보류 | 보류 | MFPI `food_row_not_species_specific`(RDA "다시마" 일반명 행 미연결) · MCUI `not_in_red_list` |
| 감태 *Ecklonia cava* | 371986 | 보류 | 보류 | 일부 근거 | RDA 행 없음 · IUCN 검색 0건 · 3CLpro 사슬은 비교집단 없음(C) |
| 가시파래 *Ulva prolifera* | 234476 | 보류 | 보류 | 보류 | RDA "파래" 일반명 행만 있음 · IUCN 0건 |
| 괭생이모자반 *Sargassum horneri* | 494853 | 보류 | 보류 | 보류 | RDA 행 없음 · IUCN 0건 |
| 꼬시래기 *Gracilaria vermiculophylla* | 236157 | 보류 | 보류 | 보류 | RDA "꼬시래기" 행은 과거 *G. verrucosa* 표기 대상, 종 미특정 · IUCN 0건 |
| 청각 *Codium fragile* | 145086 | 보류 | 보류 | 보류 | RDA 아연 결측 `component_missing_in_source` · IUCN 0건 |
| 바지락 *Ruditapes philippinarum* | 231750 | **52.1** | 보류 | 보류 | IUCN 0건 |
| 전복(종 수준) *Haliotis discus* | 397082 | 보류 | **80.0** (EN A2d) | 보류 | RDA 둥근전복 행 아연 결측 |
| 큰가리비 *Mizuhopecten yessoensis* | 393716 | **56.3** | 보류 | 보류 | IUCN 0건 |
| 시카메굴 *Magallana sikamea* | 836041 | 보류 | 보류 | 보류 | RDA 행 없음 · IUCN 0건 |
| 피조개 *Anadara broughtonii* | 504357 | 보류 | 보류 | 보류 | RDA 아연 결측 · IUCN 0건 |
| 가리맛조개 *Sinonovacula constricta* | 413600 | 보류 | 보류 | 보류 | RDA "맛조개"는 *Solen strictus*로 다른 종 · IUCN 0건 |
| 고등어 *Scomber japonicus* | 127022 | 보류 | **10.0** (LC) | 보류 | RDA "고등어" 일반명 행(망치고등어 *S. australasicus* 포함 가능) |
| 멸치 *Engraulis japonicus* | 219984 | 보류 | **10.0** (LC) | 보류 | RDA 아연 결측 |
| 참조기 *Larimichthys polyactis* | 281273 | 보류 | **10.0** (LC) | 보류 | KOSIS 어류양식동향 입식량 "-" → `aquaculture_method_unverified` |
| 넙치 *Paralichthys olivaceus* | 275816 | 보류 | 보류 | 보류 | KOSIS는 "넙치류" 묶음값뿐 → `aquaculture_method_unverified` · IUCN 0건 |
| 조피볼락 *Sebastes schlegelii* | 274849 | **42.9** | 보류 | 보류 | IUCN 0건 |
| 방어 *Seriola quinqueradiata* | 276651 | **60.3** | **10.0** (LC) | 보류 | — (한계: 아래) |
| 대구 *Gadus macrocephalus* | 254538 | 보류 | 보류 | 보류 | RDA 아연 결측 · IUCN 0건 |
| 꽃게 *Portunus trituberculatus* | 1061762 | 보류 | 보류 | 보류 | 공식 양식 근거 미확인 · IUCN 0건 |
| 참문어 *Octopus sinensis* | 534443 | 보류 | 보류 | 보류 | RDA "참문어" 영문 *O. vulgaris* 표기, 종 미특정 · IUCN 0건 |
| 갑오징어 *Acanthosepion esculentum* | 1666974 | 보류 | 보류 (DD) | 보류 | RDA 참갑오징어 행 아연 결측 · IUCN DD `category_not_numeric` |

BBVI는 22종 모두 보류(MBPI 없음).

## MCUI 근거

- IUCN 종 페이지(브라우저 열람, 2026-09-26)와 GBIF 게시 IUCN 적색목록 체크리스트(Red List 2026-1)로 현행 여부를 확인했다.
  - *Haliotis discus* EN A2d · 평가 2022-05-31 · 발표 2022 · 감소.
  - *Scomber japonicus* LC · 2022-06-01 / 2023.
  - *Engraulis japonicus* LC · 2018-05-16 / 2018.
  - *Larimichthys polyactis* LC · 2016-06-30 / 2020.
  - *Seriola quinqueradiata* LC · 2015-03-09 / 2016 · 주석 "Needs updating". 살오징어와 같은 처리로 현행 평가로 쓰고 10년 넘은 평가 표시.
  - *Sepia esculenta*(= *Acanthosepion esculentum*) DD · 2009-03-14 / 2012 · 숫자 매핑 없음.
- 나머지 16종은 승인명과 주요 동의어(*Laminaria japonica*, *Enteromorpha prolifera*, *Patinopecten yessoensis*, *Crassostrea sikamea*, *Scapharca broughtonii*, *Sebastes schlegeli*)로 IUCN 사이트를 검색해 **검색 범위 안에서 미발견**. 대조 검색 *Haliotis discus* 1건. 공식 NE 판정이 아니며 낮은 점수로 바꾸지 않는다.
- 국가 적색목록(NIBR·해수부)은 이번 PR에서 반영하지 않았다(PR-B). 결과는 `verified-pilot-3-method.md`에 있다.

## MFPI 근거

- 연결한 RDA 10.4 행(`rda_taxon_links`, 모두 기존 고정 수산동물 25개 집단 안):
  - 넙치 K0270000000a
  - 조피볼락 K0960070000a
  - 참조기 K1620000000a
  - 큰가리비 K4000040000a
  - 바지락 K4130000000a(+양식 K4130010000a)
  - 꽃게 K6020010000a
  - 방어 양식 어린것 K0830011130a
- 양식 근거(`food_support`):
  - 조피볼락·방어: KOSIS 어류양식동향조사 DT_1EZ0008 입식량 2026년 1/4분기 잠정. 방어는 FAO 양식 개요(CASP)도 있음.
  - 바지락·큰가리비: FAO CASP 종 수준 양식 기술 개요.
- 방어 한계: RDA 행이 "양식, 어린것, JAPAN('20)"이고 폐기율 0이라 가식부 1.0으로 계산된다. 원자료 폐기율의 근거를 온라인에서 확인하지 못했다. 점수는 규칙대로 산출하되 이 한계를 함께 적는다.
- 연결하지 않은 행: 고등어·다시마·꼬시래기·참문어·갑오징어 일반명 행. 김 L0110과 파래 L0270도 일반명 행이다. 과(科)·속(屬) 수준 값은 종으로 옮기지 않았다.

## MBPI 탐색 범위

- 탐색한 곳:
  - Wikidata/LOTUS P703(22종 전부)
  - ChEMBL 37 pChEMBL(기원종 명시 논문 한정)
- 완결 직전 사슬: 감태 Park et al. 2013(PMID 23647823, DOI 10.1016/j.bmc.2013.04.026).
  - *E. cava*에서 분리한 phlorotannin 9종.
  - SARS-CoV 3CLpro IC50: dieckol 2.7 µM · eckol 8.8 µM · phlorofucofuroeckol A 16.7 µM(ChEMBL assay CHEMBL2395056).
  - 기원종·구조·정량값은 확인했으나 같은 표적·조건의 고정 비교집단이 없어 `partial_only`.
- 그 밖의 결과는 흔한 1차 대사물이거나 데이터 오류(예: zidovudine)였다.
- PubChem·CMNPD·문헌 전수는 이번에 탐색하지 않았다. 따라서 "검색 범위 안에서 미발견"이며 부재 증거가 아니다.
