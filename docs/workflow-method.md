# 워크플로 그림 기준 방법 문서 — `verified-pilot-3.9`

이 문서는 팀 워크플로 그림(`Blue-bio Value Map 기반 해양생물 활용·보전 통합 분석 구조`)의 단계마다 다음을 적는다: 저장소 어디에서 구현했는지(파일·함수), 쓰는 자료원과 이용조건, 공식, 한계.

- 표의 숫자는 `dist/assessments.json`(현재 `verified-pilot-3.9`)과 `research/verified-indices/archive/assessments-verified-pilot-2.3.json`(2.3 공개본)에서 만든 값이다. 문서를 고쳐 쓰지 않고, 같은 자료로 다시 만들 수 있다.
- 모든 지표는 **검증 전 시범 지표**다. 종 단위 지표이며, 해역의 가치·자원량·분포가 아니다.

## 0. 한눈에 보기

| 그림 단계 | 사이트에서 보이는 것 | 구현 위치 | 결정 기록 |
|---|---|---|---|
| 1 문제 인식 (OBIS·IUCN·FAO/AFCD·CMNPD·ChEMBL·PubChem) | 종별 근거 화면의 출처·이용조건 목록, 출현 지도 | `dist/data.json`, `dist/assessments.json`의 `sources` | 각 자료원 행 |
| 2 표준화·연계 (WoRMS AphiaID, InChIKey·PubChem CID) | 종 상세의 AphiaID·WoRMS 링크, MBPI 근거의 화합물 링크 | `scripts/collect_taxonomy.py`, `scripts/collect_mbpi_links.py`, `research/verified-indices/mbpi-link-review-2026-09-30.json` | `mbpi-chembl-stratum-2026-09-29.md` |
| 3 MBPI | 종 상세 MBPI 근거(층·표적·화합물·출처) | `build_verified_indices.py`의 `chembl_items`, `chembl_stratum`, `bio_scores`, `peptide_items` | `mbpi-chembl-stratum-2026-09-29.md` |
| 3 MFPI | 종 상세 MFPI 근거(원값·백분위·대체치 라벨·가식부·양식) | `food_axis`, `substitute`, `mfpi`, `build_cohorts` | `mfpi-substitutes-2026-09-30.md` |
| 3 MCUI | 종 상세 MCUI 근거(IUCN/국가 평가, OBIS 출현 추세) | `conservation_axis`, `national_axis`, `occurrence_trend` | `mcui-trend-2026-10-01.md` |
| 4 통합·정보충분도 | BBVI 가중치 슬라이더, 정보충분도·우선 조사 대상·미탐색 후보 표시 | `build`→`assess`(BBVI, `information_sufficiency`, `priority_survey`), `unexplored_flag` | `matrix-gis-2026-09-30.md` |
| 5 매트릭스 | 활용 × 보전 매트릭스(네 유형, 국가 평가 MCUI는 네모 점) | `build_matrix_readiness.py`의 `matrix_type`; `dist/app.js`의 `matrixType`, `toggleSimulation` | `matrix-gis-2026-09-30.md` |
| 5 GIS 지도 | '활용 × 보전 보기': 출현 셀 × 종 유형 색, 정보충분도 층, 셀 카드 | `dist/app.js`의 `renderValueMap`, `cellMatrixType`, `valueCellOrder`, `drawSufficiency`, `valueSpeciesCard` | `matrix-gis-2026-09-30.md` |
| 추가 정보 연계 (관할 해역·국제 이익공유) | 종 상세의 활용 전 제도 확인 목록(ABS·나고야의정서·BBNJ) | `dist/app.js`의 `institutionChecks` | – |

## 1. 문제 인식 — 자료원과 이용조건

| 자료원 | 쓰는 곳 | 이용조건 (원문 확인) |
|---|---|---|
| OBIS | 출현 셀(별도 수집), 조사 노력 배경(`dist/effort.json`), MCUI 출현 추세 | 데이터셋별 CC0·CC BY·CC BY-NC. OBIS와 원 데이터셋을 인용한다(OBIS data policy). 셀별 건수만 저장한다. |
| GBIF | 운영 출현 셀 | 공개 기준 CC0·CC BY 4.0 기록만 쓴다. |
| IUCN Red List | MCUI 기반 | 평가 ID·등급·날짜만 저장한다. IUCN 이용조건상 상업적 API 사용은 금지다. |
| 한국 국가생물적색자료집 2024(NIBR) | IUCN 수치가 없을 때의 MCUI | 쪽 번호와 범주만 저장한다. |
| RDA 국가표준식품성분 DB 10.4 | MFPI 원값·고정 비교집단 | 공공누리 제1유형(출처표시) |
| FAO/INFOODS uFiSh1.0 | MFPI 빠진 성분의 대체치 | © FAO 2016. 비상업 연구·교육 목적의 복사·내려받기를 허용하며, 출처를 표기하고 FAO 보증을 암시하지 않아야 한다(사용자 안내서 4쪽). |
| AFCD Release 3 (FSANZ) | 참굴 교차 점검(3.6까지. 3.7은 AFCD 행에 검수된 칼슘 값이 없어 멈춤) | CC BY-SA 3.0 AU + FSANZ 약관. 학명이 없어 대체치로 쓰지 않는다. |
| ChEMBL 37 | MBPI 화합물 활성(pChEMBL) | CC BY-SA 3.0. 필요한 ID·값만 저장한다. |
| Wikidata(LOTUS P703) | 종-화합물 연결 | CC0 |
| CMNPD, PubChem, Europe PMC | 연결이 없는 종의 원논문 검색 | CMNPD CC BY-NC-SA 4.0. 검색 기록만 저장한다. |
| AHTPDB | 펩타이드 층 고정 비교집단 | CC BY-NC 4.0 출처 표시 |
| WoRMS | 학명·AphiaID·속/과/강 분류 | CC BY 4.0. 데이터베이스 전체 재배포는 하지 않는다. |

출처마다 조회일·버전·라이선스는 `dist/assessments.json`의 `sources`에 있고, 종 상세의 '출처와 이용조건'에 그대로 나온다.

## 2. 표준화 및 데이터 연계

- **생물종:** 모든 종을 WoRMS 승인명과 AphiaID로 묶는다(`research/verified-indices/candidates.json`, `dist/candidate-catalog.json`). 속·과·강은 `scripts/collect_taxonomy.py` → `research/verified-indices/taxonomy.json`(WoRMS `AphiaClassificationByAphiaID`)에서 읽는다.
- **화합물:** Wikidata P703(LOTUS)의 화합물 항목을 InChIKey로 ChEMBL molecule에, 다시 PubChem CID에 맞춘다(`scripts/collect_mbpi_links.py`).
  - 종별로 SPARQL을 나눠 보내고 User-Agent를 붙인다.
  - P703 연결이 없는 종은 CMNPD·PubChem 분류군·Europe PMC 원논문을 검색했다.
- **연결 검수:** 점수를 만드는 연결은 모두 원문으로 검수했다. 오염물·약물 대사물·비조직·보편 대사물은 제외한다(`mbpi-link-review-2026-09-30.json`).

## 3. 세 가지 지표

### MBPI — 신약개발 잠재성

- 층은 세 가지다. 효소·수용체(단일 단백질 등), 암 세포주(CELL-LINE), 병원체(ORGANISM: 세균·바이러스·원충·기생충). 'Unchecked', 'NON-PROTEIN TARGET', ADMET은 제외한다.
- 층 안에서 표적 × 지표(IC50·Ki·EC50 등)별 비교집단을 ChEMBL 스냅숏에서 만들고 pChEMBL 백분위를 매긴다(`chembl_items`). 비교집단이 최소 크기에 못 미치면 쓰지 않는다.
- **종 특이성:** 연결 분류군 수(P703)의 Tukey 상한(Q3 + 1.5·IQR)을 넘는 흔한 대사물과 승인 약물(ChEMBL max_phase 4)을 제외한다. 민감도는 결정 기록에 있다.
- **근거 수준:** 원논문 DOI 1편이면 0.75, 2편 이상이면 1.0이다. ChEMBL 항목은 종-화합물 연결 문헌과 활성 문서 중 적은 쪽을 센다(`independent_sources`).
- 기존 층(펩타이드 AHTPDB ACE/HHL, 원논문 화합물)은 유지한다. 종 점수는 층 전체의 최댓값이다(민감도: 중앙값·평균).
- 화면 표시는 "이 종에서 보고된 화합물의 공개 생리활성(잠재력) · 종 추출물의 효능 아님"이다.
- 한계: 흔한 대사물 울타리는 문헌량에 좌우된다. 단일 논문 MBPI는 참고값이며 BBVI에 넣지 않는다.

### MFPI — 식량자원 잠재력

- MFPI = 0.8 × 평균(단백질·철·아연·칼슘 백분위 × 등급 계수) + 0.1 × 100 × 가식부 + 0.1 × 100 × 양식 가능(0/1) (`mfpi`). 칼슘은 3.7부터다(3.6까지 세 성분).
- 고정 비교집단은 RDA 10.4에서 네 성분을 모두 보고하는 수산동물 25개·해조류 3개 식품이다(3.6과 같은 구성원).
- **4개 중 3개(3.7):** 대체치로도 채우지 못한 성분이 있으면, 보고된 성분이 3개 이상일 때 그 성분들의 평균으로 계산한다. 빠진 성분은 0점이 아니라 평균에서 빼고 화면에 표시한다(톳·청각의 아연). 결정 기록: `mfpi-calcium-2026-10-01.md`.
- **섭취 부위·유사종 대체치(3.3):** 종 자신의 RDA 행에서 빠진 성분만 채운다. 그 행에는 자기 성분이 하나 이상 있어야 한다.
  - 순서는 같은 표의 같은 종 부표본 행 > uFiSh 같은 종 > 같은 속 > 같은 과다. uFiSh는 섭취 부위가 fillet·flesh·muscle인 원물 항목만 쓴다.
  - 등급 계수: 실측 1.0, 계산 0.85, 대용 0.5.
  - 대체치가 있는 종은 비교집단에 넣지 않고 '비교집단 + 자기 자신' 안에서 순위를 매긴다.
  - 정보충분도는 자기 값만 센다.
- 양식 가능성은 원문으로 확인한 근거만 쓴다(대구는 '불가'로 0점).
- 한계: 대체치는 다른 지역·시기·분석법의 값이다. 비교집단이 작아 순위 한 칸이 약 4점이다.

### MCUI — 보전 시급성

- 기반은 IUCN 현행 평가 범주를 수치로 바꾼 값이다(LC 10, NT 35, VU 60, EN 80, CR 100). IUCN 수치가 없으면 한국 국가 평가를 쓰고, "한국 국가 평가 기반"으로 따로 표시한다.
- **OBIS 출현 추세(3.4):**
  - 보고율 = 종 기록 ÷ 같은 셀·기간의 같은 WoRMS 강 기록. 2006–2015와 2016–2025를 비교한다.
  - 셀 경계 위 기록은 경계를 공유하는 모든 셀에 센다. 분자와 분모가 같은 규칙이다.
  - 결과는 감소 신호 / 감소 경향(30% 미만) / 조사 부족 / 보고율 감소 없음 / 판단 불가 중 하나다.
  - 감소 신호(보고율 비 ≤ 0.7, 95% 구간 상한 < 1)는 과거 기록이 가장 많은 데이터셋 안에서도 같은 기준을 넘어야 인정한다. 조사 사업 하나가 끝난 것을 감소로 읽지 않기 위해서다.
  - 감소 신호이면 MCUI에 +10을 더한다(상한 100). 추세로 MCUI를 만들거나 낮추지 않는다.
  - 근거: IUCN 기준 A(10년, A2 VU 30%). 표적군 배경과 보고율은 Phillips et al. 2009, Telfer et al. 2002, Isaac et al. 2014를 따랐다.
- **IUCN 평가가 없거나(검색 0건) DD이고 국가 평가도 없는 종**은 MCUI를 만들지 않고 우선 조사 대상으로 표시한다. 사유는 '보전 평가 없음' 또는 'IUCN 자료 부족(DD)'이다. IUCN 조회 실패는 자료 문제라 이 사유를 붙이지 않는다.
- 한계: 보고율은 개체수가 아니다. 최대 데이터셋 외의 구성 변화, 중복, 세대 길이, 과분산은 통제하지 않았다. IUCN 개체군 추세가 알려진 3종(해삼·전복·고등어)은 모두 방향이 어긋난다(결정 기록 §4).

## 4. 지표 통합 및 정보충분도

- BBVI = w × MFPI + (1 − w) × MBPI. 기본 w는 0.5이고 화면 슬라이더로 바꿀 수 있다.
  - MBPI가 독립 원논문 2편 미만이면 BBVI를 보류한다. 대신 '참고 조합'을 점수가 아닌 값으로 보여 준다.
  - MCUI는 합치지 않는 별도 축이다.
- 정보충분도 = 축별 필수 입력 충족 비율의 평균이다. 점수에 곱하거나 더하지 않는다.
- 우선 조사 대상: 평균 < 0.5이거나, 보전 평가가 없거나 IUCN DD인 종(사유를 나눠 표시).
- 미탐색 후보: 우선 조사 대상 가운데, 같은 속(없으면 과)의 근연종 BBVI가 50 이상인 종. 근연종 점수는 옮겨 적지 않는다.

## 5. 최종 결과: 매트릭스와 GIS 지도

- 매트릭스는 BBVI와 MCUI가 각각 50 이상이면 '높음'으로 보는 네 유형이다(그림 5 범례 이름 그대로). 한국 국가 평가 기반 MCUI는 네모 점으로 구분한다.
- 지도는 출현 기록이 있는 공개 셀을 그 셀에 기록된 종의 유형 색으로 칠한다. 여러 유형이 있는 셀은 보전 우선 > 대체생산 > 지속가능 활용 > 기초조사 순서로 칠한다(사전예방 원칙).
- 색은 "출현 기록 셀 × 종 유형"이다. 해역의 자원량·분포·해역 점수가 아니다.
- 셀을 누르면 종별 BBVI·MCUI·영양 원값(대체치 표시)·이 셀 출현 기록·정보충분도를 보여 준다.
- 정보충분도 층(우선 조사 대상, 미탐색 후보)은 따로 켤 수 있다. 층 이름에 '지도 표시 종 수'를 적고, 공개 셀이 없는 종은 이름을 나열한다.

**현재 배치:** 참굴(BBVI 83.9 × MCUI 10.0, 한국 국가 평가 기반) → 지속가능 활용 후보. 우선 조사 대상 17종, 미탐색 후보 1종.

## 6. 2.3 → 현재 버전

| 버전 | 바뀐 점 (설정 `changes_from` 원문) |
|---|---|
| `verified-pilot-3.1` | verified-pilot-2.3 (2026-09-27). Diagram stage 2-3 MBPI: adds the automated ChEMBL stratum (see chembl_bioactivity and research/verified-indices/mbpi-chembl-stratum-2026-09-29.md). Every other rule, factor, cohort and threshold equals 2.3. |
| `verified-pilot-3.2` | verified-pilot-3.1 (2026-09-30). Diagram stages 4-5: all 30 species get information sufficiency as its own label (priority_survey) and an unexplored-candidate flag from a same-genus/family relative with BBVI >= 50; the BBVI x MCUI matrix types (IUCN and marked national MCUI) are published and the GIS map colours each public cell by the types of species recorded there. No axis score changes. Information sufficiency changes in one place: a species whose MCUI comes from a reviewed national assessment counts that assessment for the three MCUI steps (3.1 counted only an IUCN record). See research/verified-indices/matrix-gis-2026-09-30.md. |
| `verified-pilot-3.3` | verified-pilot-3.2 (2026-09-30). Diagram stage 3 MFPI, '섭취위치 / 유사종 대체치 구분': a component missing from a species' own RDA row is filled from FAO/INFOODS uFiSh1.0, species (measured > calculated) > same genus > same family (proxy), same consumed part, and is labelled; five species-level aquaculture records read in the original source are added. The fixed RDA cohorts are re-confirmed unchanged. See research/verified-indices/mfpi-substitutes-2026-09-30.md. |
| `verified-pilot-3.4` | verified-pilot-3.3 (2026-09-30). Diagram stage 3 MCUI, 'OBIS 출현기록 등 분포 최신성 검증, 개체수 감소 vs 조사 부족 구분': an OBIS reporting-rate check (species records / records of the same WoRMS class in the same 1-degree cells, 2006-2015 vs 2016-2025, edge records in every cell that holds them) classifies each species as decline signal, decline below threshold, survey gap, no clear decline or undetermined. A decline signal must also hold inside the dataset with most past records; it raises a computed IUCN or national MCUI by conservation.effort_adjustment and never creates or lowers one. A species without a national category whose IUCN search found no assessment, or whose assessment is DD, is labelled priority_survey with that reason (figure: 우선 조사 대상). See research/verified-indices/mcui-trend-2026-10-01.md. |
| `verified-pilot-3.5` | verified-pilot-3.4 (2026-10-01). Rules, thresholds, cohorts and weights unchanged; only reviewed evidence rows are added, in files read by 3.5 alone so 3.4 and earlier stay reproducible. Peptide rows (research/verified-indices/evidence-v3.5.json): synthetic ACE/HHL single peptides for 가시파래 KAF, 가리맛조개 VQY, 큰가리비 VW and 해삼 HDWWKER (branch sunny/bbvm-0928-pr2-evidence, 2 of 3 or more independent verifiers), 넙치 MEVFVP and VSQLTR (Ko 2016) and the seven Sato 2002 미역 dipeptides moved from partial to approved after the full text confirmed synthetic peptides and HHL (PR #65). Aquaculture records (research/verified-indices/mfpi-aquaculture-2026-10-01.json): 참조기, 넙치, 꽃게. See research/verified-indices/evidence-additions-2026-10-01.md. |
| `verified-pilot-3.6` | verified-pilot-3.5 (2026-10-01). Diagram stage 3 MFPI substitutes: after same-species RDA sub-samples and uFiSh species-level values, a component still missing from a species' own RDA row may be taken from the same species' raw item of the Standard Tables of Food Composition in Japan 2020 (8th revised edition), linked by the standard Japanese name that WoRMS lists for the AphiaID; graded foreign_table_cited (0.85), as RDA rows that cite the Japanese table are. Only zinc is filled (research/verified-indices/snapshots/mext-zinc-2026-10-01.json: あかがい, かたくちいわし, するめいか). Team-lead decision of 2026-10-01. See research/verified-indices/mext-zinc-2026-10-01.md. |
| `verified-pilot-3.7` | verified-pilot-3.6 (2026-10-01). Diagram stage 3 MFPI, nutrient components: calcium is added to protein, iron and zinc (RDA DB 10.4 reports calcium for 407 of 410 raw marine-animal rows and all 15 raw seaweed rows; zinc for 36 and 3). A species whose own RDA row still misses a component after the 3.3/3.6 substitutes (RDA sub-sample, uFiSh, MEXT) is scored when it reports at least nutrition.minimum_components (3) of the 4; the missing component is left out of the mean, never scored 0, and the species is ranked against the fixed cohort plus itself. The fixed cohorts are the same 28 foods (all report calcium). The AFCD oyster cross-check is paused because its rows carry no reviewed calcium value. Three aquaculture records are added (톳 Wando 1993-94, 청각 Wando 2004-05, 멸치 research rearing from egg to maturity). See research/verified-indices/mfpi-calcium-2026-10-01.md. |
| `verified-pilot-3.8` | verified-pilot-3.7 (2026-10-01). Evidence rows only: the reviewed 바지락 (Ruditapes philippinarum) peptide rows IAE 34.7 and IVE 95.6 uM (Suetsuna 2002, Fish Sci 68:233) and LLP 158 uM (Lee et al. 2005, J Fish Sci Technol 8:109) join peptide_supplements; AEL, LVE and IELPLG stay partial_only because the paper swaps the clam and pearl-oyster peak lists. Rules, coefficients and cohorts are unchanged. 바지락 MBPI 39.5 is a single-paper reference value and BBVI stays withheld; a same-author repeat of the same value (Suetsuna & Chen 2001, Spirulina) is not counted as replication. See research/verified-indices/evidence-clam-2026-10-01.md. |
| `verified-pilot-3.9` | verified-pilot-3.8 (2026-10-01). MFPI: the MEXT 2020 (8th) same-species raw item now covers protein, iron, zinc and calcium (research/verified-indices/snapshots/mext-2026-10-01.json). When RDA DB 10.4 has no row linked to a species, a reviewed MEXT item marked species_row is that species' own nutrition row and edible fraction (graded foreign_table_cited 0.85, ranked against the fixed cohort plus itself, never a cohort member): あげまき 10280 (맛조개), まさば 10154 (고등어), まだこ 10361 (참문어). Name link: the MEXT standard Japanese name equals the WoRMS Japanese vernacular, or equals it without a final ガイ (貝) when the MEXT description matches the taxon. Three aquaculture records (research/verified-indices/mfpi-aquaculture-3.9-2026-10-01.json): 고등어 Tongyeong sea cages 2007-08, 맛조개 Zhoushan polyculture pond 2020-21, 참문어 rearing stopped at settlement (feasible false). Team-lead decisions of 2026-10-01. See research/verified-indices/mext-rows-2026-10-01.md. |

| 축 | 2.3 | 현재 |
|---|---|---|
| MFPI 산출 종 수 | 7 | 21 |
| MBPI 산출 종 수 | 3 | 14 |
| MCUI 산출 종 수 | 14 | 14 |
| BBVI 산출 종 수 | 1 | 1 |

## 7. 30종 값 변화 (2.3 → `verified-pilot-3.9`)

굵은 글씨는 2.3에서 바뀐 값이다. '–'는 산출 보류이며, 0점이나 낮은 가치가 아니다.

| 종 (AphiaID) | 범위 | MFPI | MBPI | MCUI | BBVI | 정보충분도 2.3 → 현재 | 우선 조사 대상 (사유) | 미탐색 후보 | 매트릭스 유형 | OBIS 추세 |
|---|---|---|---|---|---|---|---|---|---|---|
| 멍게 (250680) | 운영 8종 | 54.2 → **52.8** | – → **13.5** | – | – | 42% → 67% | 예 (보전 평가 없음) | – | – | 판단 불가 |
| 미역 (145721) | 운영 8종 | 42.2 → **46.7** | 19.6 → **71.5** | – | – | 67% → 67% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 살오징어 (342067) | 운영 8종 | – | – | 10.0 → **20.0** (IUCN) | – | 78% → 81% | – | – | – | 감소 신호 |
| 우뭇가사리 (372119) | 운영 8종 | – | – | – | – | 0% → 0% | 예 (정보충분도, 보전 평가 없음) | – | – | 조사 부족 |
| 참굴 (836033) | 운영 8종 | 65.5 → **71.6** | 96.3 | 10.0 (국가 평가) | 80.9 → **83.9** | 67% → 100% | – | – | 지속가능 활용 후보 | 조사 부족 |
| 톳 (494972) | 운영 8종 | – → **63.3** | – → **45.3** | – | – | 28% → 61% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 해삼 (241776) | 운영 8종 | – | – → **8.7** | 80.0 (IUCN) | – | 50% → 67% | – | – | – | 보고율 감소 없음 |
| 홍합(참담치) (506159) | 운영 8종 | – → **60.9** | – → **10.1** | 10.0 (국가 평가) | – | 28% → 94% | – | – | – | 조사 부족 |
| Gracilaria vermiculophylla (236157) | 조사 후보 | – | – | – | – | 0% → 8% | 예 (정보충분도, 보전 평가 없음) | – | – | 조사 부족 |
| 가시파래 (234476) | 조사 후보 | – | – → **73.3** | – | – | 0% → 33% | 예 (정보충분도, 보전 평가 없음) | – | – | 조사 부족 |
| 감태 (371986) | 조사 후보 | – | 67.5 | – | – | 33% → 33% | 예 (정보충분도, 보전 평가 없음) | – | – | 조사 부족 |
| 갑오징어 (1666974) | 조사 후보 | – → **42.5** | – | 10.0 (국가 평가) | – | 42% → 61% | – | – | – | 조사 부족 |
| 고등어 (127022) | 조사 후보 | – → **48.0** | – | 10.0 (IUCN) | – | 33% → 75% | – | – | – | 감소 경향(30% 미만) |
| 괭생이모자반 (494853) | 조사 후보 | – | – → **21.6** | – | – | 0% → 33% | 예 (정보충분도, 보전 평가 없음) | – | – | 조사 부족 |
| 꽃게 (1061762) | 조사 후보 | – → **62.0** | – | – | – | 27% → 33% | 예 (정보충분도, 보전 평가 없음) | – | – | 조사 부족 |
| 넙치 (275816) | 조사 후보 | – → **59.4** | – → **29.2** | – | – | 27% → 67% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 다시마 (377084) | 조사 후보 | – | – | – | – | 0% → 17% | 예 (정보충분도, 보전 평가 없음) | – | – | 조사 부족 |
| 대구 (254538) | 조사 후보 | – → **38.3** | – | – | – | 20% → 36% | 예 (정보충분도, 보전 평가 없음) | – | – | 조사 부족 |
| 맛조개 (413600) | 조사 후보 | – → **57.7** | – → **56.9** | 10.0 → **20.0** (국가 평가) | – | 0% → 100% | – | – | – | 감소 신호 |
| 멸치 (219984) | 조사 후보 | – → **74.1** | – | 10.0 → **20.0** (IUCN) | – | 53% → 61% | – | – | – | 감소 신호 |
| 바지락 (231750) | 조사 후보 | 52.1 → **60.4** | – → **39.5** | 10.0 (국가 평가) | – | 33% → 100% | – | – | – | 조사 부족 |
| 방어 (276651) | 조사 후보 | 56.3 → **51.0** | – | 10.0 (IUCN) | – | 67% → 67% | – | – | – | 조사 부족 |
| 시카메굴 (836041) | 조사 후보 | – | – | – | – | 0% → 8% | 예 (정보충분도, 보전 평가 없음) | 같은 속 Magallana | – | 판단 불가 |
| 전복(종 수준) (397082) | 조사 후보 | – → **54.7** | – | 80.0 (IUCN) | – | 53% → 61% | – | – | – | 조사 부족 |
| 조피볼락 (274849) | 조사 후보 | 42.9 → **48.5** | – | – | – | 33% → 33% | 예 (정보충분도, 보전 평가 없음) | – | – | 조사 부족 |
| 참문어(동아시아 종) (534443) | 조사 후보 | – → **36.9** | – | – | – | 0% → 33% | 예 (정보충분도, 보전 평가 없음) | – | – | 조사 부족 |
| 참조기 (281273) | 조사 후보 | – → **39.4** | – | 10.0 → **20.0** (IUCN) | – | 60% → 67% | – | – | – | 감소 신호 |
| 청각 (145086) | 조사 후보 | – → **36.7** | – → **0.4** | – | – | 20% → 61% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 큰가리비 (393716) | 조사 후보 | 56.3 → **55.8** | – → **27.3** | 10.0 (국가 평가) | – | 33% → 100% | – | – | – | 조사 부족 |
| 피조개 (504357) | 조사 후보 | – → **61.9** | – | 10.0 (국가 평가) | – | 20% → 69% | – | – | – | 조사 부족 |

## 8. 남은 한계

- 모든 지표는 팀의 시범 규칙이다(계수·임계값·가중치). 독립 사례로 검증하지 않았다.
- BBVI가 있는 종은 참굴 하나다. 단일 논문 MBPI가 많아 매트릭스 점이 적다.
- 출현 셀과 OBIS 추세는 조사 노력에 좌우된다. 셀이 없다는 것은 종이 없다는 뜻이 아니다. OBIS 추세와 IUCN 개체군 추세의 방향이 3종에서 모두 어긋나, 추세 방법은 아직 검증되지 않았다.
- 대체치, 국가 평가, 추세 보정은 화면에서 구분 표시하지만, 서로 다른 근거를 섞은 값이라는 점은 그대로 남는다.
