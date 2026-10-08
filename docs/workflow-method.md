# 워크플로 그림 기준 방법 문서 — `verified-pilot-3.28`

> **현재 공개본은 `verified-4.7`(2026-10-08)이다.** 0–8절의 표와 숫자는 3.28 시점 기록이며, 4.0–4.7의 변화(120/120칸, 매트릭스 점 30개, 우선 조사 대상 0종 등)는 9절과 `dist/assessments.json`이 기준이다.

이 문서는 팀 워크플로 그림(`Blue-bio Value Map 기반 해양생물 활용·보전 통합 분석 구조`)의 단계마다 다음을 적는다: 저장소 어디에서 구현했는지(파일·함수), 쓰는 자료원과 이용조건, 공식, 한계.

- 표의 숫자는 `dist/assessments.json`(현재 `verified-pilot-3.28`)과 `research/verified-indices/archive/assessments-verified-pilot-2.3.json`(2.3 공개본)에서 만든 값이다. 문서를 고쳐 쓰지 않고, 같은 자료로 다시 만들 수 있다.
- 모든 지표는 **시범 지표**다. 사후 검증은 MFPI만 통과했다(일본 식품성분표 2020으로 다시 계산한 영양 점수의 순위 일치: 11종, Spearman ρ 0.873, 단측 순열 p 0.0004). MBPI는 3.27에 약물 기원종 사례를 계산해 미통과였고(H. okadai 73.8·E. turbinata 56.1 < 참굴 96.3), 그래서 MBPI와 BBVI 라벨은 '사후 검증 미통과'다. MCUI 예비 평가 두 가지(Rapid LC, 어획 기반 기준 A)는 역검증을 통과하지 못해 MCUI 점수로 쓰지 않는다(팀장 결정 2026-10-02·2026-10-03). OBIS 추세 +10 보정은 3.27 외부 검증을 통과하지 못했지만 규칙은 바꾸지 않아 그대로 적용된다(4종, 종 상세에 미통과를 표시). 종 단위 지표이며, 해역의 가치·자원량·분포가 아니다.

## 0. 한눈에 보기

| 그림 단계 | 사이트에서 보이는 것 | 구현 위치 | 결정 기록 |
|---|---|---|---|
| 1 문제 인식 (OBIS·IUCN·FAO/AFCD·CMNPD·ChEMBL·PubChem) | 종별 근거 화면의 출처·이용조건 목록, 출현 지도 | `dist/assessments.json`의 `sources` | 각 자료원 행 |
| 2 표준화·연계 (WoRMS AphiaID, InChIKey·PubChem CID) | 종 상세의 AphiaID·WoRMS 링크, MBPI 근거의 화합물 링크 | `scripts/collect_taxonomy.py`, `scripts/collect_mbpi_links.py`, `research/verified-indices/mbpi-link-review-2026-09-30.json`(3.27: `mbpi-link-review-3.27-2026-10-03.json`) | `mbpi-chembl-stratum-2026-09-29.md` |
| 3 MBPI | 종 상세 MBPI 근거(층·표적·화합물·출처), '쓰임새로 찾기' 신약 칩 | `build_verified_indices.py`의 `chembl_items`, `chembl_stratum`, `bio_scores`, `load_inputs`(3.27 보충 스냅숏 병합), `peptide_items`, `converted_peptide`, `amp_items`, `anticancer_items`; 비교집단 `scripts/build_amp_cohorts.py`, `scripts/build_anticancer_cohorts.py`; `dist/app.js`의 `USE_TRAITS` | `mbpi-chembl-stratum-2026-09-29.md`, `gap-closing-2026-10-02.md`, `amp-stratum-2026-10-02.md`, `decisions-3.19-2026-10-02.md`, `decisions-3.20-2026-10-02.md`, `anticancer-stratum-2026-10-02.md`, `bbvi-replication-3.24-2026-10-02.md`, `doyoun-replication-3.25-2026-10-02.md`, `gap-filling-3.27-2026-10-03.md`, `tot-replication-3.28-2026-10-03.md`, `trait-display-2026-10-03.md`(표시 전용 칩 근거, `scripts/build_trait_evidence.py`) |
| 3 MFPI | 종 상세 MFPI 근거(원값·백분위·대체치 라벨·가식부·양식), EPA·DHA 표시(점수 아님), '쓰임새로 찾기' 식량 칩 | `food_axis`, `substitute`, `literature_species_row`, `mfpi`, `build_cohorts`; 종 연결 `rda-name-links-2026-10-01.json`; EPA·DHA `scripts/collect_rda_fatty_acids.py` | `mfpi-substitutes-2026-09-30.md`, `gap-closing-2026-10-02.md`, `omega3-display-2026-10-02.md`, `mfpi-sargassum-2026-10-02.md`, `literature-limitations-3.23-2026-10-02.md`, `doyoun-replication-3.25-2026-10-02.md`, `codium-table2-3.26-2026-10-02.md` |
| 3 MCUI | 종 상세 MCUI 근거(IUCN/국가 평가/서식국 국가 평가, OBIS 출현 추세), 예비 평가(참고 정보) | `conservation_axis`, `national_axis`, `occurrence_trend`, `mcui_substitute`; `scripts/collect_mcui_rapid_lc.py` | `mcui-trend-2026-10-01.md`, `gap-closing-2026-10-02.md`, `gap-closing-3.16-2026-10-02.md`, `decisions-3.19-2026-10-02.md`, `gap-filling-3.27-2026-10-03.md` |
| 4 통합·정보충분도 | BBVI 가중치 슬라이더, 정보충분도·우선 조사 대상·미탐색 후보 표시 | `build`→`assess`(BBVI, `information_sufficiency`, `priority_survey`), `unexplored_flag` | `matrix-gis-2026-09-30.md` |
| 5 매트릭스 | 활용 × 보전 매트릭스(네 유형, 국가 평가·서식국 국가 평가 MCUI는 네모 점, 3.27부터 단일 논문 BBVI는 속 빈 점. 예비 평가는 참고 정보라 MCUI가 아님) | `build_matrix_readiness.py`의 `matrix_type`, `_eligible`; `dist/app.js`의 `matrixType`, `toggleSimulation`, `declutterPointLabels` | `matrix-gis-2026-09-30.md`, `gap-filling-3.27-2026-10-03.md` |
| 5 GIS 지도 | '활용 × 보전 보기': 출현 셀 × 종 유형 색, 정보충분도 층, 셀 카드 | `dist/app.js`의 `renderValueMap`, `cellMatrixType`, `valueCellOrder`, `drawSufficiency`, `valueSpeciesCard` | `matrix-gis-2026-09-30.md` |
| 추가 정보 연계 (관할 해역·국제 이익공유) | 종 상세의 활용 전 제도 확인 목록(ABS·나고야의정서·BBNJ) | `dist/app.js`의 `institutionChecks` | – |
| 사후 검증 | 축별 라벨('시범 지표 · 방법 검증 통과(11종 비교)', '시범 지표 · 사후 검증 미통과'), 자료 연결 현황의 '방법 검증 통과' 단계, MBPI 상세 첫 줄의 검증 결과 | `scripts/posthoc_validation.py`(`mfpi_check`, `mcui_check`, `mbpi_check`) → `method.posthoc.validation_sets`; `dist/app.js`의 `validationResult`, `pilotLabel` | `gap-closing-2026-10-02.md`, `gap-filling-3.27-2026-10-03.md`, `posthoc-3.27/` |

## 1. 문제 인식 — 자료원과 이용조건

| 자료원 | 쓰는 곳 | 이용조건 (원문 확인) |
|---|---|---|
| OBIS | 출현 셀(별도 수집), 조사 노력 배경(`dist/effort.json`), MCUI 출현 추세 | 데이터셋별 CC0·CC BY·CC BY-NC. OBIS와 원 데이터셋을 인용한다(OBIS data policy). 셀별 건수만 저장한다. |
| GBIF | 운영 출현 셀 | 공개 기준 CC0·CC BY 4.0 기록만 쓴다. |
| IUCN Red List | MCUI 기반 | 평가 ID·등급·날짜만 저장한다. IUCN 이용조건상 상업적 API 사용은 금지다. |
| 한국 국가생물적색자료집 2024(NIBR) | IUCN 수치가 없을 때의 MCUI | 쪽 번호와 범주만 저장한다. |
| 일본 환경성 레드리스트 2020(패류) | IUCN·한국 평가가 없을 때의 서식국 국가 평가 MCUI(시카메굴) | 정부 표준 이용약관. 범주·이름 한 행만 인용하고 목록은 재배포하지 않는다. |
| 러시아연방 적색자료집 식물·균류 목록(천연자원생태부 명령 제320호, 2023) | 서식국 국가 평가 MCUI(우뭇가사리, 3.16) | 연방 법령 공식 게재본. 범주·이름 사실만 인용한다. |
| GBIF·OBIS 출현 API | 예비 평가(Rapid LC) 참고 정보의 EOO·AOO·기록 수 | 데이터셋별 CC0·CC BY·CC BY-NC 4.0. 개수·면적만 저장하고 GBIF.org·OBIS와 조회식을 인용한다. 방법은 Bachman et al. 2020(CC BY 4.0). |
| RDA 국가표준식품성분 DB 10.4 | MFPI 원값·고정 비교집단, EPA·DHA 표시(3.17, 점수 아님) | 공공누리 제1유형(출처표시) |
| 국립해양생물자원관 국가 해양수산생물종 목록 | RDA 식품명의 종 연결(국명 = 정명) | 공공데이터포털 이용허락범위 제한 없음. 검색한 종의 국명·학명만 저장한다. |
| 식약처 식품원료 성분코드(수입식품정보마루) | 국명이 아닐 때 RDA 식품명의 종 연결(성분학명) | 이용허락 표시 없는 정부 웹 페이지. 검색한 원료의 코드·국명·학명만 저장한다. |
| FAO/INFOODS uFiSh1.0 | MFPI 빠진 성분의 대체치 | © FAO 2016. 비상업 연구·교육 목적의 복사·내려받기를 허용하며, 출처를 표기하고 FAO 보증을 암시하지 않아야 한다(사용자 안내서 4쪽). |
| AFCD Release 3 (FSANZ) | 참굴 교차 점검(3.6까지. 3.7은 AFCD 행에 검수된 칼슘 값이 없어 멈춤) | CC BY-SA 3.0 AU + FSANZ 약관. 학명이 없어 대체치로 쓰지 않는다. |
| ChEMBL 37 | MBPI 화합물 활성(pChEMBL) | CC BY-SA 3.0. 필요한 ID·값만 저장한다. |
| Wikidata(LOTUS P703) | 종-화합물 연결 | CC0 |
| CMNPD, PubChem, Europe PMC | 원논문 검색과 원논문 연결(3.20부터 P703 진술이 있는 종도 학명·시료 출처가 적힌 원논문이면 연결) | CMNPD CC BY-NC-SA 4.0. 검색 기록만 저장한다. |
| AHTPDB | 펩타이드 층 고정 비교집단 | CC BY-NC 4.0 출처 표시 |
| DBAASP v3 | 항균 펩타이드 층 고정 비교집단(3.18) | Data Access Policy: 출처를 밝히면 제한 없이 내려받기·이용·재배포할 수 있다. Pirtskhalava et al. 2021을 인용한다. |
| CancerPPD 2.0 | 항암 펩타이드 층 고정 비교집단(3.21) | 사이트·논문에 이용조건이 없어 관리자에게 문의했고, 2026-10-02 서면 회신('공개 이용에 제한 없음')을 받았다. Chauhan et al. 2025를 인용한다. |
| WoRMS | 학명·AphiaID·속/과/강 분류 | CC BY 4.0. 데이터베이스 전체 재배포는 하지 않는다. |

출처마다 조회일·버전·라이선스는 `dist/assessments.json`의 `sources`에 있고, 종 상세의 '출처와 이용조건'에 그대로 나온다.

## 2. 표준화 및 데이터 연계

- **생물종:** 모든 종을 WoRMS 승인명과 AphiaID로 묶는다(`research/verified-indices/candidates.json`, `dist/candidate-catalog.json`). 속·과·강은 `scripts/collect_taxonomy.py` → `research/verified-indices/taxonomy.json`(WoRMS `AphiaClassificationByAphiaID`)에서 읽는다.
- **화합물:** Wikidata P703(LOTUS)의 화합물 항목을 InChIKey로 ChEMBL molecule에, 다시 PubChem CID에 맞춘다(`scripts/collect_mbpi_links.py`).
  - 종별로 SPARQL을 나눠 보내고 User-Agent를 붙인다.
  - P703 연결이 없는 종은 CMNPD·PubChem 분류군·Europe PMC 원논문을 검색했다.
- **연결 검수:** 점수를 만드는 연결은 모두 원문으로 검수했다. 오염물·약물 대사물·비조직·보편 대사물은 제외한다(`mbpi-link-review-2026-09-30.json`, 3.27: `mbpi-link-review-3.27-2026-10-03.json`).

## 3. 세 가지 지표

### MBPI — 신약개발 잠재성

- 층은 다섯 가지이고, 층마다 자기 고정 비교집단 안에서만 백분위를 매긴다(층끼리 섞어 비교하지 않는다). 종 MBPI는 모든 층 항목 가운데 가장 높은 값이고, 화면에는 그 항목의 층을 적는다.
  1. ChEMBL 화합물 층(3.1): 같은 표적 × 같은 종말점(IC50·Ki 등) 활성 기록.
  2. ACE 저해 펩타이드 층(2.2): AHTPDB ACE IC50(HHL 기질) 352개, pIC50.
  3. 항균 펩타이드 층(3.18): DBAASP 표적 세균 종별 액체배지 MIC, pMIC = 6 − log10(MIC µM).
  4. 항암 펩타이드 층(3.21): CancerPPD 2.0 암세포주별 IC50, pIC50 = 6 − log10(IC50 µM).
  5. 감태 원논문 화합물 층: 같은 논문·같은 시험 조건 안의 상대 백분위라 종 간 순위에 쓰지 않는다.
- ChEMBL 층은 세 갈래다. 효소·수용체(단일 단백질 등), 암 세포주(CELL-LINE), 병원체(ORGANISM: 세균·바이러스·원충·기생충). 'Unchecked', 'NON-PROTEIN TARGET', ADMET은 제외한다. 등록자가 'Inconclusive'·'Not Active'로 표시한 활성(3.20, 스냅숏 2,058건 중 100건)은 어떤 종 항목에도 넣지 않는다.
- 층 안에서 표적 × 지표(IC50·Ki·EC50 등)별 비교집단을 ChEMBL 스냅숏에서 만들고 pChEMBL 백분위를 매긴다(`chembl_items`). 비교집단이 최소 크기에 못 미치면 쓰지 않는다.
- **종 특이성:** 연결 분류군 수(P703)의 Tukey 상한(Q3 + 1.5·IQR)을 넘는 흔한 대사물과 승인 약물(ChEMBL max_phase 4)을 제외한다. 민감도는 결정 기록에 있다.
- **근거 수준:** 원논문 DOI 1편이면 0.75, 2편 이상이면 1.0이다. ChEMBL 항목은 종-화합물 연결 문헌과 활성 문서 중 적은 쪽을 센다(`independent_sources`).
- **효능 재현(2.3·3.12·3.14):** 같은 서열을 다른 논문이 합성품이나 서열을 확인한 정제 단일 펩타이드로 HHL에서 다시 잰 값은, pIC50 차이가 1.0 이내이면 독립 DOI로만 센다. 점수 값과 기원 주장은 바꾸지 않는다(`potency_replications`, ACE 층에만 있음). 3.24에 큰가리비 VW(86.9 µM)가 Suetsuna 2004 미역 정제 VW(10.8 µM, 차이 0.906)로 2편이 됐다. 3.25에 미역 IW·VW·IY에 합성 펩타이드 재현(Michelke 2018 1.91 · Nomura 2002 1.68 · Saito 1994 2.4 µM)이 더해져, 미역 BBVI는 정제물 규칙(3.14)이나 공저자 예외(Suetsuna 2000) 없이도 성립한다. 3.28에 톳 GKY·SKTY에 합성 표준품 재현(Chen 2016: 7.94·20.63 µM, 차이 0.307·0.270, 학교 도서관 원문)이 더해져 톳 최고 항목이 2편이 됐다(MBPI 65.0 → 86.6, `evidence-xo-potency-3.28-2026-10-03.json`). 같은 논문의 FY(4.83 µM)는 미역 FY 항목을 재현하지만(차이 0.942) 최고 항목이 아니다.
- 기존 층(펩타이드 AHTPDB ACE/HHL, 원논문 화합물)은 유지한다. 종 점수는 층 전체의 최댓값이다(민감도: 중앙값·평균).
- **µg/mL → µM 환산(3.15):** 서열을 확인한 합성 펩타이드가 µg/mL로만 보고되면 평균 잔기 질량 + 물 1분자로 계산한 분자량으로 µM로 바꾼다(`converted_peptide`). 원문 값·단위·분자량을 옆에 남기고, 가수분해물·분획물은 바꾸지 않는다. 전복 AMN(Wu et al. 2015): 106.24 µg/mL ÷ 334.39 g/mol = 317.71 µM.
- **원논문 연결(3.20):** Wikidata P703 진술이 있는 종도 원논문에 그 종(WoRMS 인정명 또는 동의어)의 학명과 시료 출처가 적혀 있으면 연결한다(`mbpi-paper-links-p703-2026-10-02.json`, 3.27: `mbpi-paper-links-p703-3.27-2026-10-03.json`). 다시마가 26.5(단일 논문)를 얻었고 톳과 같은 자동산화 주의문을 함께 보인다. 꼬시래기는 미확정 행을 빼면 최고값이 대량 스크리닝 'Active' 1건이라 3.20에 보류했고, 3.27에 팀장 결정으로 보류를 풀었다(PGA2, Nylund 2011 연결, DNA 중합효소 β qHTS 백분위 87.62 → 49.3, MBPI 상세의 주의문: "대량 스크리닝(PubChem qHTS 농도-반응 시험) 'Active' 1건 기반입니다. 별도 후속 시험이 없고, …비특이 반응일 수 있습니다.").
- **보충 스냅숏(3.27):** 2026-09-30 스냅숏 뒤에 인정한 연결의 화합물(flazin, PGA2)은 같은 ChEMBL_37 판에서 같은 필터로 따로 모아 병합한다(`scripts/collect_mbpi_supplement.py`, `snapshots/mbpi-links-supplement-2026-10-03.json`). 스냅숏에 이미 있는 비교집단은 총수가 같아야 하고 새 중앙값의 수만 더한다. 등록자 판정(Inconclusive·Not Active)도 함께 저장해 3.20 규칙을 그대로 적용한다. 시카메굴은 flazin(Kong 2021, 원논문 연결, `mbpi-paper-links-3.27-2026-10-03.json`)으로 13.8을 얻었다. 점수 행은 리뷰가 원측정(EC50 2.36 µM, Tang 2008)을 IC50으로 옮겨 적은 값이며, 원 종말점 행이면 12.3이다(주의문에 표시, 규칙은 그대로). 빌드는 원논문 연결 파일과 병합 스냅숏의 연결이 같은지 확인한다.
- **살오징어(3.27):** Wako 1996의 정제 펩타이드 YALPHA 9.8 µM(HHL, Edman 서열 확인, 3.14 정제물 규칙)로 56.9. 시험법이 모든 시료를 ACE와 3시간 미리 반응시키는 점, 간과 외투근이 섞인 자가분해물이라는 점, 보존된 액틴 조각이라는 점을 기록에 함께 적었다.
- **항균 층(3.18, 3.19):** 기원 행은 데이터베이스가 아니라 원논문에서 판정한다. 서열이 그 종 자신의 유전자·조직에서 나와야 하고, 시험 물질은 화학 합성품이나 서열을 확인한 정제 단일 펩타이드, 값은 액체배지 미량희석 MIC여야 한다. 3.19부터 액체 생장 억제 시험을 같은 방법으로 읽고 비교집단 배지에 Poor Broth를 넣었다. MEC·억제대 지름·검열값과 다른 생물에서 발현한 재조합 펩타이드는 뺀다(3.19 팀장 결정). 진균 값은 세균 비교집단에 섞지 않는다. 현재 항목은 피조개 AI-hemocidin 1·2(Li 2017), 조피볼락 TS40(Zhang 2022), 참굴 Cg-BigDef1(Loth 2019, 전합성, 황색포도상구균 7개 균주 중앙값 2.5 µM; 참굴 MBPI는 LQP가 더 높아 그대로)이다.
- **항암 층(3.21):** 세포주 하나 × IC50이 비교집단 하나이고 최소 30개다. ± 표기는 가운데 값을 쓰고, 단위가 'M'인 행은 입력 오류로 버린다. 점수를 매기는 펩타이드가 데이터베이스에 이미 있으면 순위를 매기기 전에 자기 비교집단에서 뺀다(`cohort_self_member_key`). 피조개 P6(Li 2022, HT-29 IC50 1.585 µM, 50개 중 백분위 100)가 75.0으로 피조개의 최고 항목이 됐고, 가시파래 HTDT-6-2-3-2와 맛조개 SCH-P9·P10은 기존 최고 항목보다 낮아 점수가 바뀌지 않는다.
- 화면 표시는 "이 종에서 보고된 화합물의 공개 생리활성(잠재력) · 종 추출물의 효능 아님"이다.
- 한계: 흔한 대사물 울타리는 문헌량에 좌우된다. 단일 논문 MBPI는 0.75를 곱한 값이고, 3.27부터 그 위의 BBVI는 '단일 논문' 표시를 단 점수다(3.15–3.26은 참고값). DBAASP·CancerPPD 비교집단은 설계·합성 펩타이드가 많아 천연 펩타이드는 대개 중앙값 아래에 놓인다(자연기원만 모은 비교집단을 민감도로 함께 싣는다). 백분위 100은 그 비교집단 안에서 가장 강하다는 뜻이지 더 강한 펩타이드가 없다는 뜻이 아니다. 항암 비교집단은 노출 시간과 시험법을 섞는다.

### MFPI — 식량자원 잠재력

- MFPI = 0.8 × 평균(단백질·철·아연·칼슘 백분위 × 등급 계수) + 0.1 × 100 × 가식부 + 0.1 × 100 × 양식 가능(0/1) (`mfpi`). 칼슘은 3.7부터다(3.6까지 세 성분).
- 고정 비교집단은 RDA 10.4에서 네 성분을 모두 보고하는 수산동물 25개·해조류 3개 식품이다(3.6과 같은 구성원).
- **4개 중 3개(3.7):** 대체치로도 채우지 못한 성분이 있으면, 보고된 성분이 3개 이상일 때 그 성분들의 평균으로 계산한다. 빠진 성분은 0점이 아니라 평균에서 빼고 화면에 표시한다(톳·청각의 아연). 결정 기록: `mfpi-calcium-2026-10-01.md`.
- **섭취 부위·유사종 대체치(3.3):** 종 자신의 RDA 행에서 빠진 성분만 채운다. 그 행에는 자기 성분이 하나 이상 있어야 한다.
  - 순서는 같은 표의 같은 종 부표본 행 > uFiSh 같은 종 > 같은 속 > 같은 과다. uFiSh는 섭취 부위가 fillet·flesh·muscle인 원물 항목만 쓴다.
  - 등급 계수: 실측 1.0, 계산 0.85, 대용 0.5.
  - 대체치가 있는 종은 비교집단에 넣지 않고 '비교집단 + 자기 자신' 안에서 순위를 매긴다.
  - 정보충분도는 자기 값만 센다.
- **종 연결(3.15):** RDA 식품명의 종 이름이 국립해양생물자원관 목록에서 정확히 한 종의 국명이면 그 종에 연결하고, 아니면 식약처 식품원료 성분학명이 WoRMS에서 한 종으로 풀릴 때 연결한다(`rda_name_links`). 목록 학명이 북서태평양 분포 기록이 없는 종이면 동아시아 개체군 종에 연결한다(참문어 → *Octopus sinensis*). 다시마·우뭇가사리·꼬시래기·해삼이 연결됐고, 고등어·참문어는 일본 표 대신 RDA 행을 쓴다.
- **문헌 분석값 행(3.15):** RDA·일본 표 어디에도 행이 없는 종은 원논문의 날것 가식부 분석값을 같은 시료 수분으로 날것 환산해 종 행으로 쓴다(등급 0.85, `literature_species_row`). 시카메굴: Liu et al. 2021(CC BY). 아연은 원문 안에서 값이 어긋나 평균에서 뺐다. 3.22에 괭생이모자반이 같은 경로로 들어왔다(Murakami 2011, 표 3·4의 같은 시료 수분 88.0%로 환산, 철은 측정되지 않아 평균에서 뺐다). 3.23부터 문헌 행 파일에 적은 검수 한계(시료 산지·시기·방법, 해조류 단백질의 Kjeldahl 과대평가 등)를 MFPI 상세의 문헌 환산 설명 바로 아래에 '원논문 자료의 한계: …' 줄로 보인다(`food_trace.literature_limitations`). 3.15~3.22는 빌더가 값만 읽고 이 문구를 버렸다.
- 양식 가능성은 원문으로 확인한 근거만 쓴다(대구·살오징어는 '불가'로 0점). 양식 기록이 없으면 영양 행이 있어도 MFPI를 내지 않는다. 3.7부터 명시된 시설·기간에서 생활사를 거친 연구용 사육도 feasible = true로 센다(예: 멸치, 우뭇가사리, 3.22의 괭생이모자반 Pang 2008 수조 양성). 이런 기록에는 식량 생산이 아니라고 적는다.
- **EPA·DHA 표시(3.17):** 종 자신의 RDA 행이 EPA·DHA를 함께 보고하면(30종 중 10종) mg/100 g과 1일 기준치 330 mg(식품 등의 표시·광고에 관한 법률 시행규칙 별표 5) 대비 비율을 보인다. 한국에는 오메가-3 함량 강조표시 기준이 없어 '풍부' 같은 법정 용어를 쓰지 않고, '오메가-3' 칩의 30%는 팀 표시 기준이다. MFPI의 성분·가중치·비교집단에는 들어가지 않는다.
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
- **IUCN 평가가 없거나(검색 0건) DD이고 국가 평가도 없는 종**은 MCUI를 만들지 않고 우선 조사 대상으로 표시한다(3.4부터). 3.15에서도 아래 1·2번 근거가 없는 종은 그대로다. 사유는 '보전 평가 없음' 또는 'IUCN 자료 부족(DD)'이다. IUCN 조회 실패는 자료 문제라 이 사유를 붙이지 않는다.
- **대체 근거(3.15):** IUCN 검색 0건이고 한국 목록에도 없으면 이 순서로 찾는다(`mcui_substitute`). 기반마다 따로 표시하고 IUCN 기반과 순위를 매기거나 합치지 않는다. DD는 대체하지 않는다.
  1. 한국 목록 학명 대응: 목록 학명이 북서태평양 분포가 없는 종이면 국명이 가리키는 한국 개체군 종에 배정한다(참문어 NT → *O. sinensis*).
  2. 서식국 공식 국가 적색목록: 시카메굴은 일본 환경성 레드리스트 2020 NT(2015–2020판 모두 NT). 3.16부터 우뭇가사리는 러시아연방 적색자료집(2023) 절멸 위협 상태 'У' = VU(60)이고, 러시아가 분포의 북쪽 끝이라 주변 개체군 평가로 표시한다. 3.27부터 가시파래는 스웨덴 적색목록 2025 LC(10)이다. 여러 서식국 목록이 있으면 범주를 명시한 가장 최근 정부 목록(DD 제외)을 쓰고, 나머지(노르웨이 2021 LC, 핀란드 2019 DD)와 '먼 서식국(북동대서양) 평가'를 한계로 보인다(팀장 결정 2026-10-03). 3.19부터 이 단계에는 정부 부처·기관이 발행한 목록만 쓴다(학술 편찬물인 『中国物种红色名录』(2004)는 쓰지 않는다). 매트릭스에는 네모 점으로 놓는다.
  3. 예비 평가 Rapid LC(Bachman et al. 2020): 1990년 이후 GBIF·OBIS 좌표로 EOO > 30,000 km², 10 km 격자 AOO > 3,000 km², 기록 75건 이상, OBIS 감소 신호 없음이면 '아마 LC'로 본다(`scripts/collect_mcui_rapid_lc.py`). 3.15에 14종이 해당했고, 3.16에 우뭇가사리, 3.27에 가시파래가 서식국 평가로 넘어가 12종이 남았다. MCUI는 만들지 않는다(아래).
  - 예비 평가는 역검증(이미 평가된 14종에 적용)에서 EN인 해삼·전복을 LC로 판정해 통과하지 못했다. 그래서 MCUI 점수로 쓰지 않고, 비교표에는 '예비 평가 참고 · LC 가능성 · 역검증 미통과 · 점수 아님', 종 상세에는 '예비 평가(Rapid LC) 참고 정보 · MCUI 점수 아님'으로 EOO·AOO·기록 수와 역검증 결과만 보여 준다(팀장 결정 2026-10-02). BBVI 참고값처럼 점수·매트릭스·지도 색·순위·산출 종 수에 쓰지 않는다. MCUI를 주는 대체 근거는 1·2번뿐이다.
  - 3.27에 어획 통계로 IUCN 기준 A(감소율)를 보는 예비 평가를 미리 규칙을 정해 같은 14종에 역검증했지만 통과하지 못했다(판정 가능 4/14, 위협종 검출 0/2; `posthoc-3.27/mcui-criterion-a/`). 팀장 결정(2026-10-03: 통과할 때만 점수)에 따라 이 경로로 채운 MCUI는 없다.
  - 그 12종은 '보전 평가 없음' 사유로 우선 조사 대상에 남는다. 정보충분도의 MCUI 칸도 평가가 없는 종으로 센다(0/3).
- 한계: 보고율은 개체수가 아니다. 최대 데이터셋 외의 구성 변화, 중복, 세대 길이, 과분산은 통제하지 않았다. IUCN 개체군 추세가 알려진 3종(해삼·전복·고등어)은 모두 방향이 어긋난다(결정 기록 §4). 3.27의 외부 검증(지도 상자 안 다른 229종)도 통과하지 못했다. 위협종 9종(사전 기준 10종 미달) 중 1종, LC 172종 중 36종에서 신호가 나왔다. 추세 +10을 받은 4종(멸치·참조기·살오징어·맛조개)의 신호는 모두 국립해양생물자원관 표본 수집 자료의 기록 감소에서 나왔다(규칙은 바꾸지 않았다; `posthoc-3.27/mcui-obis-trend/`).

## 4. 지표 통합 및 정보충분도

- BBVI = w × MFPI + (1 − w) × MBPI. 기본 w는 0.5이고 화면 슬라이더로 바꿀 수 있다.
  - MBPI 최고 항목이 독립 원논문 2편 미만이면 3.26까지는 BBVI를 보류하고 '참고 조합'만 보였다. 3.27부터는 같은 공식의 BBVI를 점수로 내고 'BBVI · 단일 논문' 표시를 단다(팀장 결정 2026-10-03, `bbvi.single_source_policy`). MBPI 항목에는 이미 단일 논문 계수 0.75가 곱해져 있다. 매트릭스에서는 속이 빈 점이고, 재현 논문이 확인되면 표시를 뗀다. 22종 중 18종이 단일 논문이고, 미역·참굴·톳(3.28)·큰가리비는 재현 논문이 있다.
  - MCUI는 합치지 않는 별도 축이다.
- 정보충분도 = 축별 필수 입력 충족 비율의 평균이다. 점수에 곱하거나 더하지 않는다.
- 우선 조사 대상: 평균 < 0.5이거나, 보전 평가가 없거나 IUCN DD인 종(사유를 나눠 표시). 예비 평가(Rapid LC) 참고 정보만 있는 종은 평가가 없는 종이므로 '보전 평가 없음' 사유로 남는다(12종, 이 중 2종은 정보충분도 사유도 있다).
- 미탐색 후보: 우선 조사 대상 가운데, 같은 속(없으면 과)의 근연종 BBVI가 50 이상인 종. 근연종 점수는 옮겨 적지 않는다.

## 5. 최종 결과: 매트릭스와 GIS 지도

- 매트릭스는 BBVI와 MCUI가 각각 50 이상이면 '높음'으로 보는 네 유형이다(그림 5 범례 이름 그대로). 한국 국가 평가·서식국 국가 평가 기반 MCUI는 네모 점으로 구분한다. 예비 평가(Rapid LC)는 참고 정보라 MCUI가 없으므로 매트릭스·지도 색에 들어가지 않는다.
- 지도는 출현 기록이 있는 공개 셀을 그 셀에 기록된 종의 유형 색으로 칠한다. 여러 유형이 있는 셀은 보전 우선 > 대체생산 > 지속가능 활용 > 기초조사 순서로 칠한다(사전예방 원칙).
- 색은 "출현 기록 셀 × 종 유형"이다. 해역의 자원량·분포·해역 점수가 아니다.
- 셀을 누르면 종별 BBVI·MCUI·영양 원값(대체치 표시)·이 셀 출현 기록·정보충분도를 보여 준다.
- 정보충분도 층(우선 조사 대상, 미탐색 후보)은 따로 켤 수 있다. 층 이름에 '지도 표시 종 수'를 적고, 공개 셀이 없는 종은 이름을 나열한다.

**현재 배치(3.28, 12점, 3.27과 같음):** 지속가능 활용 후보 5(참굴 83.9×10, 피조개 68.5×10, 바지락 59.5×10, 맛조개 57.3×20, 살오징어 51.5×20), 기초조사·관찰 대상 5(멸치 48.3×20, 고등어 47.4×10, 큰가리비 46.1×10, 홍합 35.5×10, 시카메굴 35.0×35), 보전 우선·모니터링 2(해삼 36.1×80, 전복 35.2×80). 참굴·큰가리비를 뺀 10점은 단일 논문 BBVI다. 미역(71.0)·톳(74.9)·꼬시래기(59.7) 등 10종은 BBVI가 있지만 MCUI가 없어 놓지 않는다. 우선 조사 대상 12종(모두 '보전 평가 없음', 이 중 2종은 정보충분도도 낮음), 미탐색 후보 0종. 지도에서 유형 색이 칠해진 공개 격자는 39곳이다.

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
| `verified-pilot-3.10` | verified-pilot-3.9 (2026-10-01). Evidence rows only: the reviewed 톳 (Sargassum fusiforme, syn. Hizikia fusiformis) peptide rows GKY 3.92, SVY 8.12 and SKTY 11.07 uM (Suetsuna 1998, Nippon Suisan Gakkaishi 64:862; synthetic peptides, HHL) join peptide_supplements. Rules, coefficients and cohorts are unchanged. 톳 MBPI moves from its ChEMBL value 45.3 to the GKY peptide value 65.0 (single-paper reference) and BBVI stays withheld (no second paper for GKY). See research/verified-indices/evidence-hijiki-2026-10-01.md. |
| `verified-pilot-3.11` | verified-pilot-3.10 (2026-10-01). Evidence rows only: the reviewed 고등어 (Scomber japonicus) peptide rows PLITT 48.73 uM (Wang 2024, Food Chem 447:138873) and APFLAG 69.45, FDHKKFF 212.85 and LFPKFA 259.05 uM (Zhang 2025, J Food Sci e70767), all synthetic peptides identified by LC-MS/MS in mackerel muscle hydrolysates and assayed with HHL, join peptide_supplements. Rules, coefficients and cohorts are unchanged. 고등어 gains an MBPI from the PLITT item (single-paper reference); BBVI stays withheld (no second paper for PLITT). See research/verified-indices/evidence-mackerel-2026-10-01.md. |
| `verified-pilot-3.12` | verified-pilot-3.11 (2026-10-01). Evidence rows only: the cross-origin potency supplement becomes research/verified-indices/evidence-xo-potency-3.12.json, which keeps the 2.3 row (Miyoshi 1991 zein LQP 2.0 uM) and adds the synthetic IY 2.65 uM of Suetsuna 2000 (J Nutr Biochem 11:450; HHL). It replicates the potency of the 미역 IY item (Sato 2002, 6.1 uM; pIC50 gap 0.36). Takahisa Nakano co-authored both papers; the team lead counted them as independent (2026-10-01). Rules, coefficients and cohorts are unchanged. 미역 IY becomes a two-DOI item, so 미역 MBPI moves from the single-paper IW value to IY and BBVI is computed. See research/verified-indices/evidence-wakame-iy-2026-10-01.md. |
| `verified-pilot-3.13` | verified-pilot-3.12 (2026-10-01). Evidence rows only: the reviewed 멸치 (Engraulis japonicus) peptide rows DGGP 163.51, GCK 177.75 and PK 4092.26 uM (Kim 2016, Appl Biol Chem 59:25; synthetic peptides, HHL) join peptide_supplements. The paper names no species for its Korean fermented anchovy sauce; the team lead read it as E. japonicus (2026-10-01). NHP is left out because the text and Table 1 spell it differently (NHP/NPH). Rules, coefficients and cohorts are unchanged. 멸치 gains an MBPI from the DGGP item (single-paper reference); BBVI stays withheld. See research/verified-indices/evidence-anchovy-2026-10-01.md. |
| `verified-pilot-3.14` | verified-pilot-3.13 (2026-10-01). Peptide material rule (team-lead decision 2026-10-01): a sequence-confirmed purified single peptide counts like a synthetic one, for origin rows and for potency replications (peptide_bioactivity.cross_origin_potency.accepted_materials). New origin rows: 대구 GASSGMPG 6.9 and LAYA 14.5 uM (Ngo 2016, Process Biochem 51:1622) and 바지락 VISDEDGVTH 8.16 uM and three more (Chen 2018, Food Funct 9:5230). New replications: Lin 2018 (Nutrients 10:1397) purified IW 0.50 and VW 0.58 uM and Kapel 2006 (Process Biochem 41:1961) purified VW 1.1 uM. Coefficients, cohorts and the pIC50 gap are unchanged. See research/verified-indices/evidence-isolates-2026-10-01.md. |
| `verified-pilot-3.15` | verified-pilot-3.14 (2026-10-01). Gap closing (team-lead decisions 2026-10-01; research/verified-indices/gap-closing-2026-10-02.md). MFPI: an RDA DB 10.4 row is linked to a species by its MABIK national species list Korean name, else by its MFDS food-material scientific name, with a misapplied-name crosswalk (다시마, 우뭇가사리, 꼬시래기 and 해삼 join; 고등어 and 참문어 move from their MEXT item to their RDA row); a reviewed paper's own analysis, converted to fresh weight with the moisture of the same sample, is a species row graded literature_converted 0.85 (시카메굴, Liu 2021); six aquaculture records are added (살오징어 false). MBPI: a synthetic, sequence-confirmed peptide reported only in ug/mL is converted to uM with its average-residue molecular weight (전복 AMN, Wu 2015: 317.71 uM, MBPI 15.6). MCUI: when IUCN and the Korean list have no assessment, another range state's official national list (시카메굴, Japan NT) gives a separately labelled MCUI, and the Korean 참문어 row is assigned to Octopus sinensis by the crosswalk. Post-hoc validation with criteria fixed before the run: MFPI passed (MEXT cross-table, 11 species, rho 0.873); the preliminary Rapid LC check (Bachman et al. 2020; 14 species likely LC) failed its back-test (EN 해삼 and 전복 called LC), so it is shown as reference information only and gives no MCUI (team-lead decision 2026-10-02). BBVI rules, coefficients, cohorts and weights are unchanged; the site shows a single-paper BBVI reference value beside a withheld BBVI. |
| `verified-pilot-3.16` | verified-pilot-3.15 (2026-10-02). MCUI: the range-state step gains the Russian Red Data Book (Order No. 320 of 23.05.2023) row for Gelidium elegans (우뭇가사리), threat status 'У' = VU -> 60, labelled as a peripheral (northern-limit) population; the ladder order (range state before the preliminary check) is 3.15's. Every other rule, coefficient, cohort and threshold equals 3.15. See research/verified-indices/gap-closing-3.16-2026-10-02.md. |
| `verified-pilot-3.17` | verified-pilot-3.16 (2026-10-02). Display only, no score changes: the species' own RDA DB 10.4 row also carries EPA and DHA per 100 g (research/verified-indices/snapshots/rda-epa-dha-2026-10-02.json, collected by scripts/collect_rda_fatty_acids.py from the same 425 rows), shown beside the species with its share of the 330 mg daily reference value for EPA + DHA (식품 등의 표시·광고에 관한 법률 시행규칙 [별표 5]). Korea has no omega-3 content claim, so no claim word is used. MFPI keeps its four components, its weights and its cohorts; nothing enters any score. See research/verified-indices/omega3-display-2026-10-02.md. |
| `verified-pilot-3.18` | verified-pilot-3.17 (2026-10-02). New MBPI stratum for antibacterial activity, the input the proposal names beside the ACE one: a fixed DBAASP cohort per target bacterium (MIC, broth media, single clean numeric value; research/verified-indices/amp-cohorts-dbaasp-2026-10-02.json, built by scripts/build_amp_cohorts.py), pMIC = 6 - log10(MIC uM), percentile inside that cohort, minimum cohort 30 and the same single/multiple-DOI factors and max aggregation as the peptide stratum. A MIC is never ranked against an ACE IC50: each stratum keeps its own cohort. Origin rows come from the original paper, never from the database (DBAASP records neither the tested material nor its synthesis): a chemically synthetic or sequence-confirmed purified single peptide whose sequence comes from the species' own gene or tissue, with a numeric MIC by broth microdilution. MEC, inhibition zones, recombinant proteins and censored values are excluded. 피조개 (AI-hemocidin 1 and 2, Li 2017) and 조피볼락 (TS40, Zhang 2022) gain an MBPI; both rest on one paper each, so both are reference values and BBVI stays withheld. Every other rule, coefficient and cohort equals 3.17. See research/verified-indices/amp-stratum-2026-10-02.md. |
| `verified-pilot-3.19` | verified-pilot-3.18 (2026-10-02). Team-lead decisions of 2026-10-02 (research/verified-indices/decisions-3.19-2026-10-02.md). (1) The liquid growth inhibition assay (liquid medium, two-fold dilutions, MIC = 100% inhibition) counts as broth microdilution, and Poor Broth (DBAASP code PBM) joins the cohort's broth list (research/verified-indices/amp-cohorts-dbaasp-3.19-2026-10-02.json, same builder and dump; S. aureus 6158 -> 6208 members). 참굴 Cg-BigDef1 (total chemical synthesis, Loth 2019) enters with all seven S. aureus strains of its table, median 2.5 uM; 참굴 MBPI stays 96.3 (LQP is higher) and only the antibacterial evidence grows. (2) Recombinant peptides expressed in another organism stay excluded (참굴 Cg-Def family). (3) Non-ministry red lists such as the China Species Red List (2004) are not official national lists for the MCUI range-state step. Every other rule and coefficient equals 3.18. |
| `verified-pilot-3.20` | verified-pilot-3.19 (2026-10-02). Team-lead decisions of 2026-10-02 (research/verified-indices/decisions-3.20-2026-10-02.md). (1) An original-paper link is also admitted for a species that already has Wikidata P703 statements, when the paper names the species (WoRMS accepted name or synonym) and states where its sample came from (research/verified-indices/mbpi-paper-links-p703-2026-10-02.json). 다시마 gains a single-paper ChEMBL MBPI 26.5 (24-hydroperoxy-24-vinylcholesterol, Lu 2022) with the autoxidation caveat already used for 톳. 꼬시래기 is held: its highest values are screening rows marked Inconclusive. (2) A ChEMBL activity the depositor marked Inconclusive or Not Active never enters a species item (snapshots/chembl-activity-comments-2026-10-02.json, 100 of 2,058 snapshot rows); no current score rests on one. Every other rule and coefficient equals 3.19. |
| `verified-pilot-3.21` | verified-pilot-3.20 (2026-10-02). New MBPI stratum for anticancer activity, the second input the proposal names beside the antibacterial one. Built like the 3.18 AMP stratum with a cancer cell line in place of a target bacterium: one fixed CancerPPD 2.0 cohort per cell line (IC50, single clean numeric value; research/verified-indices/anticancer-cohorts-cancerppd-2026-10-02.json, built by scripts/build_anticancer_cohorts.py from 407 cell-line tables), pIC50 = 6 - log10(IC50 uM), percentile inside that cohort, minimum cohort 30 and the same single/multiple-DOI factors and max aggregation as the other strata. A cell IC50 is never ranked against a MIC or an ACE IC50. Origin rows come from the original paper, never from the database. A peptide the database already holds is removed from its own cohort before ranking. 피조개 (P6, Li 2022) gains an anticancer item that becomes its best MBPI item; 가시파래 (HTDT-6-2-3-2, Zhang 2022) and 맛조개 (SCH-P9 and SCH-P10, Zhu 2017) gain items that rank below their existing best, so their scores do not move. The use of CancerPPD 2.0 was confirmed in writing by its maintainer on 2026-10-02. Every other rule and coefficient equals 3.20. See research/verified-indices/anticancer-stratum-2026-10-02.md. |
| `verified-pilot-3.22` | verified-pilot-3.21 (2026-10-02). 괭생이모자반 gains an MFPI through the literature route the method has had since 3.12: Murakami et al. 2011 (J Food Compos Anal 24:231) analyses the raw edible portion of this species and reports the moisture of the same pooled sample, which is exactly what the earlier searches could not find. Protein, calcium and zinc convert to a fresh-weight basis; iron is not measured and stays out of the mean under the 3.7 minimum-components rule. Read on 2026-10-02 through the Dongguk University library. The species also gains the aquaculture record the MFPI formula needs (Pang et al. 2008, tank culture through a full generation to the long-line stage), counted feasible = true under the 3.7 research-rearing clause. No rule, cohort or coefficient changes. See research/verified-indices/mfpi-sargassum-2026-10-02.md. |
| `verified-pilot-3.23` | verified-pilot-3.22 (2026-10-02). Display data only, no score change: the reviewed limitations of a literature species row (sample site, season, laboratory and method, e.g. that Kjeldahl nitrogen x 6.25 overstates seaweed protein) now reach the MFPI trace as food_trace.literature_limitations (nutrition.substitutes.literature.show_limitations), shown under the literature-row paragraph of the MFPI detail as '원논문 자료의 한계: ...'. From 3.15 to 3.22 the builder read the row's values but dropped this text, so it was in neither the report nor the screen for 시카메굴 and 괭생이모자반. Every rule, input file, cohort, coefficient, weight and score equals 3.22. See research/verified-indices/literature-limitations-3.23-2026-10-02.md. |
| `verified-pilot-3.24` | verified-pilot-3.23 (2026-10-02). Evidence row only: Suetsuna et al. 2004 (J Nutr Biochem 15:267) joins the potency replications. Its Table 1 gives 10.8 uM for Val-Trp isolated from a wakame hot-water extract as a single HPLC peak and sequenced by Edman degradation, measured with HHL; a sequence-confirmed purified peptide has counted since the 3.14 team-lead decision, and the 2026-09-30 review had excluded the paper only under the older synthetic-only rule. Its pIC50 lies 0.906 from the scallop VW (86.9 uM, Li 2018), inside the 1.0 gap, so 큰가리비's top item rests on two independent papers and its BBVI is computed. 3/3 independent verifiers passed the row. No rule, cohort, gap or coefficient changes. See research/verified-indices/bbvi-replication-3.24-2026-10-02.md. |
| `verified-pilot-3.25` | verified-pilot-3.24 (2026-10-02). Evidence rows and record text only; no score moves. (1) Three synthetic potency replications for the wakame IW, VW and IY items (Sato 2002), found by doyoun0824 with two independent readers each and read a third time: Michelke et al. 2018 (Eng Life Sci 18:218, chemically produced Ile-Trp from Bachem, Table 1, 1.91 uM), Nomura et al. 2002 (Fish Sci 68:954, synthetic Val-Trp from Sigma, Table 2, 1.68 uM) and Saito et al. 1994 (Biosci Biotechnol Biochem 58:1767, solid-phase synthetic Ile-Tyr fragment, Table III, 2.4 uM), all with HHL and from groups that share no author with Sato 2002. 미역 already scored 1.0 on those items, so its values stay, but its BBVI no longer rests only on the 3.14 purified-isolate rule (Lin 2018, whose uM values the authors converted from mg/mL) or on the Suetsuna 2000 shared-co-author exception. Nomura's VW also attaches to the scallop VW item and stays unused (pIC50 gap 1.714). (2) Two aquaculture records corrected without changing any feasible flag: 멸치's rearing site is the Hakatajima Field Station named in Yoneda 2025's Methods, not the authors' Hatsukaichi affiliation (found by doyoun0824's independent check); 청각's Hwang 2008 was read in full (seeding July 2004 to harvest August 2005 on horizontal ropes at Wando), so its abstract-level limitation is replaced. See research/verified-indices/doyoun-replication-3.25-2026-10-02.md. |
| `verified-pilot-3.26` | verified-pilot-3.25 (2026-10-02). Record text only; no score moves. The 청각 aquaculture limitation quoted the maximum potential production in Hwang et al. 2008 (J Appl Phycol 20:469), 36,110 kg dry weight per hectare at 1 m depth, as the authors' estimate. That figure is a misprint in the paper: Table 2's own footnotes (5% dry yield; 100 ropes of 100 m per hectare) turn the 1 m row's 36.1 kg dry per 100 m into 3,610, the rule its 0.5, 2 and 3 m rows follow (790, 1,720, 515), and the text and the income column (433,320 = 36,110 x 12 US$) repeat the misprint. The limitation now says so. No feasible flag, rule, cohort or coefficient changes. See research/verified-indices/codium-table2-3.26-2026-10-02.md. |
| `verified-pilot-3.27` | verified-pilot-3.26 (2026-10-03). Gap-filling version (team-lead decisions 2026-10-03). (1) A BBVI whose top MBPI item rests on one paper is now a score, labelled 'BBVI · 단일 논문' and placed in the matrix as a hollow point and counted in each map cell's tooltip; 16 of the 19 were reference values since 3.15 (살오징어, 시카메굴 and 꼬시래기 have an MBPI only since 3.27) (bbvi.single_source_policy). (2) New evidence under the existing rules: 살오징어 MBPI from Wako et al. 1996 (YALPHA 9.8 uM, purified peptide, HHL); 시카메굴 MBPI from flazin (Kong et al. 2021, original-paper link, ChEMBL pathogen stratum); 가시파래 MCUI from the Swedish red list 2025 (LC, range-state list; the most recent government list with a category other than DD is used when several range states list a species). (3) 꼬시래기 MBPI: the 3.20 hold is released (PGA2 linked by Nylund et al. 2011; the score rests on one PubChem qHTS 'Active' row and says so). (4) Post-hoc validation: the MBPI drug-origin check is now computed (failed under its pre-registered wording); two MCUI checks were run and failed (the OBIS trend element, whose +10 rule is kept unchanged; a catch-based criterion-A screen), so no MCUI is filled from them. (5) The approved new MBPI strata were not added: none holds a row for a blank species; the team lead's confirmation is pending. The new ChEMBL compounds come from a supplement of the same ChEMBL_37 release; the 2026-09-30 snapshot is unchanged. See research/verified-indices/gap-filling-3.27-2026-10-03.md. |
| `verified-pilot-3.28` | verified-pilot-3.27 (2026-10-03). Potency replication under the existing rule, no rule, cohort or coefficient change: Chen et al. 2016 (J Food Process Preserv 40:492, synthetic standards, HHL) re-measured GKY 7.94 uM and SKTY 20.63 uM, two of the three 톳 peptides of Suetsuna 1998 (pIC50 gaps 0.307 and 0.270; GKY is 톳's top item, SVY 8.12 uM was not re-measured), and FY 4.83 uM (the 미역 FY item, gap 0.942, not its top item). 톳's top item now rests on two independent papers, so its MBPI loses the single-paper factor and its BBVI the '단일 논문' label. The paper was read through the user's university library login on 2026-10-03; in the same session Li et al. 2018 (Chemosphere) gave only dried-sample moisture, so 가시파래 MFPI stays withheld. See research/verified-indices/tot-replication-3.28-2026-10-03.md. |

| 축 | 2.3 | 현재 |
|---|---|---|
| MFPI 산출 종 수 | 7 | 28 |
| MBPI 산출 종 수 | 3 | 24 |
| MCUI 산출 종 수 | 14 | 18 |
| BBVI 산출 종 수 | 1 | 22 |

MCUI 18종 = IUCN 7 · 한국 국가 평가 8 · 서식국 국가 평가 3. 예비 평가(Rapid LC) 참고 정보 12종은 산출 종 수에 넣지 않는다. BBVI 22종 중 18종은 '단일 논문' 표시 점수다(3.28에 톳은 재현 논문으로 표시를 뗐다).

## 7. 30종 값 변화 (2.3 → `verified-pilot-3.28`)

굵은 글씨는 2.3에서 바뀐 값이다. '–'는 산출 보류이며, 0점이나 낮은 가치가 아니다. 예비 평가(Rapid LC) 참고 정보는 MCUI 칸에 넣지 않는다. BBVI의 '(단일 논문)'은 3.27부터 점수로 쓰는 단일 논문 BBVI다.

| 종 (AphiaID) | 범위 | MFPI | MBPI | MCUI | BBVI | 정보충분도 2.3 → 현재 | 우선 조사 대상 (사유) | 미탐색 후보 | 매트릭스 유형 | OBIS 추세 |
|---|---|---|---|---|---|---|---|---|---|---|
| 멍게 (250680) | 운영 8종 | 54.2 → **52.8** | – → **13.5** | – | – → **33.2** (단일 논문) | 42% → 67% | 예 (보전 평가 없음) | – | – | 판단 불가 |
| 미역 (145721) | 운영 8종 | 42.2 → **46.7** | 19.6 → **95.3** | – | – → **71.0** | 67% → 67% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 살오징어 (342067) | 운영 8종 | – → **46.1** | – → **56.9** | 10.0 → **20.0** (IUCN) | – → **51.5** (단일 논문) | 78% → 94% | – | – | 지속가능 활용 후보 | 감소 신호 |
| 우뭇가사리 (372119) | 운영 8종 | – → **76.7** | – | – → **60.0** (러시아 국가 평가) | – | 0% → 61% | – | – | – | 조사 부족 |
| 참굴 (836033) | 운영 8종 | 65.5 → **71.6** | 96.3 | 10.0 (국가 평가) | 80.9 → **83.9** | 67% → 100% | – | – | 지속가능 활용 후보 | 조사 부족 |
| 톳 (494972) | 운영 8종 | – → **63.3** | – → **86.6** | – | – → **74.9** | 28% → 61% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 해삼 (241776) | 운영 8종 | – → **63.5** | – → **8.7** | 80.0 (IUCN) | – → **36.1** (단일 논문) | 50% → 94% | – | – | 보전 우선·모니터링 | 보고율 감소 없음 |
| 홍합(참담치) (506159) | 운영 8종 | – → **60.9** | – → **10.1** | 10.0 (국가 평가) | – → **35.5** (단일 논문) | 28% → 94% | – | – | 기초조사·관찰 대상 | 조사 부족 |
| 가시파래 (234476) | 조사 후보 | – | – → **73.3** | – → **10.0** (스웨덴 국가 평가) | – | 0% → 67% | – | – | – | 조사 부족 |
| 감태 (371986) | 조사 후보 | – | 67.5 | – | – | 33% → 33% | 예 (정보충분도, 보전 평가 없음) | – | – | 조사 부족 |
| 갑오징어 (1666974) | 조사 후보 | – → **42.5** | – | 10.0 (국가 평가) | – | 42% → 61% | – | – | – | 조사 부족 |
| 고등어 (127022) | 조사 후보 | – → **59.9** | – → **34.9** | 10.0 (IUCN) | – → **47.4** (단일 논문) | 33% → 94% | – | – | 기초조사·관찰 대상 | 감소 경향(30% 미만) |
| 괭생이모자반 (494853) | 조사 후보 | – → **53.5** | – → **21.6** | – | – → **37.6** (단일 논문) | 0% → 61% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 꼬시래기 (236157) | 조사 후보 | – → **70.0** | – → **49.3** | – | – → **59.7** (단일 논문) | 0% → 61% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 꽃게 (1061762) | 조사 후보 | – → **62.0** | – | – | – | 27% → 33% | 예 (정보충분도, 보전 평가 없음) | – | – | 조사 부족 |
| 넙치 (275816) | 조사 후보 | – → **59.4** | – → **29.2** | – | – → **44.3** (단일 논문) | 27% → 67% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 다시마 (377084) | 조사 후보 | – → **56.7** | – → **26.5** | – | – → **41.6** (단일 논문) | 0% → 61% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 대구 (254538) | 조사 후보 | – → **38.3** | – → **59.9** | – | – → **49.1** (단일 논문) | 20% → 61% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 맛조개 (413600) | 조사 후보 | – → **57.7** | – → **56.9** | 10.0 → **20.0** (국가 평가) | – → **57.3** (단일 논문) | 0% → 100% | – | – | 지속가능 활용 후보 | 감소 신호 |
| 멸치 (219984) | 조사 후보 | – → **74.1** | – → **22.6** | 10.0 → **20.0** (IUCN) | – → **48.3** (단일 논문) | 53% → 94% | – | – | 기초조사·관찰 대상 | 감소 신호 |
| 바지락 (231750) | 조사 후보 | 52.1 → **60.4** | – → **58.6** | 10.0 (국가 평가) | – → **59.5** (단일 논문) | 33% → 100% | – | – | 지속가능 활용 후보 | 조사 부족 |
| 방어 (276651) | 조사 후보 | 56.3 → **51.0** | – | 10.0 (IUCN) | – | 67% → 67% | – | – | – | 조사 부족 |
| 시카메굴 (836041) | 조사 후보 | – → **56.1** | – → **13.8** | – → **35.0** (일본 국가 평가) | – → **35.0** (단일 논문) | 0% → 94% | – | – | 기초조사·관찰 대상 | 판단 불가 |
| 전복(종 수준) (397082) | 조사 후보 | – → **54.7** | – → **15.6** | 80.0 (IUCN) | – → **35.2** (단일 논문) | 53% → 94% | – | – | 보전 우선·모니터링 | 조사 부족 |
| 조피볼락 (274849) | 조사 후보 | 42.9 → **48.5** | – → **31.7** | – | – → **40.1** (단일 논문) | 33% → 67% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 참문어(동아시아 종) (534443) | 조사 후보 | – → **37.8** | – | – → **35.0** (국가 평가) | – | 0% → 50% | – | – | – | 조사 부족 |
| 참조기 (281273) | 조사 후보 | – → **39.4** | – | 10.0 → **20.0** (IUCN) | – | 60% → 67% | – | – | – | 감소 신호 |
| 청각 (145086) | 조사 후보 | – → **36.7** | – → **0.4** | – | – → **18.6** (단일 논문) | 20% → 61% | 예 (보전 평가 없음) | – | – | 조사 부족 |
| 큰가리비 (393716) | 조사 후보 | 56.3 → **55.8** | – → **36.4** | 10.0 (국가 평가) | – → **46.1** | 33% → 100% | – | – | 기초조사·관찰 대상 | 조사 부족 |
| 피조개 (504357) | 조사 후보 | – → **61.9** | – → **75.0** | 10.0 (국가 평가) | – → **68.5** (단일 논문) | 20% → 94% | – | – | 지속가능 활용 후보 | 조사 부족 |

## 8. 남은 한계

- 모든 지표는 팀의 시범 규칙이다(계수·임계값·가중치). 사후 검증은 MFPI의 표 의존성(일본 식품성분표로 다시 계산해도 순위 유지)만 통과했다. MBPI 약물 기원종 검증(3.27)은 미통과였고, 가중치·공식 자체는 독립 사례로 검증하지 않았다.
- BBVI 22종 중 18종은 MBPI 최고 항목이 논문 한 편인 '단일 논문' BBVI다(3.27 팀장 결정으로 점수화). 재현 논문이 있는 종은 참굴·미역·톳·큰가리비 넷이고, 큰가리비의 재현은 pIC50 차이 0.906으로 기준 1.0에 가깝다(`bbvi-replication-3.24-2026-10-02.md` 2절의 한계). 톳은 3.28에 Chen 2016 원문(학교 도서관 접속)으로 GKY·SKTY 재현을 확인했다(`tot-replication-3.28-2026-10-03.md`). 나머지 단일 논문 종의 재현 논문은 아직 원문으로 확인하지 못했다(`gap-filling-3.27-2026-10-03.md` 4-5절).
- 예비 평가(Rapid LC)는 분포 범위만 본다. 역검증에서 남획으로 EN이 된 해삼·전복을 LC로 판정했으므로 MCUI 점수로 쓰지 않고 참고 정보로만 표시한다(팀장 결정 2026-10-02). 어획 기반 기준 A 예비 평가(3.27)도 역검증을 통과하지 못했다.
- 남은 공백(30종 × 4축 120칸 중 28칸): MFPI 2종(가시파래·감태: 양식 기록은 찾았지만 같은 시료 수분을 보고한 날것 성분 원문이 없다), MBPI 6종(우뭇가사리·참조기·방어·꽃게·참문어(동아시아 종)·갑오징어: 어느 층 규칙도 통과하는 측정값이 없다), MCUI 12종(서식국 국가 적색목록에 없다. 연해주·오키나와 지방 목록은 국가 목록 규칙상 제외했고 북한·베트남 목록은 확인하지 못했다. 예비 평가 두 가지는 역검증을 통과하지 못했다), BBVI 8종(입력 축 부족). 막힌 이유와 남은 단서(로그인·구독 원문)는 `research/verified-indices/gap-filling-3.27-2026-10-03.md` 4절에 있다. 그중 Li et al. 2018 *Chemosphere*(4-1절)는 3.28에 원문으로 읽었고, 건조 시료의 수분만 있어 단서에서 빠졌다(`tot-replication-3.28-2026-10-03.md` 2절).
- 출현 셀과 OBIS 추세는 조사 노력에 좌우된다. 셀이 없다는 것은 종이 없다는 뜻이 아니다. OBIS 추세와 IUCN 개체군 추세의 방향이 3종에서 모두 어긋나, 추세 방법은 아직 검증되지 않았다.
- 대체치, 국가 평가, 추세 보정은 화면에서 구분 표시하지만, 서로 다른 근거를 섞은 값이라는 점은 그대로 남는다.

## 9. 정식 산출 `verified-4.0`–`4.7` (2026-10-04–08)

`verified-4.3`(2026-10-05)은 남은 빈칸 15칸을 사전 등록한 대체 규칙으로 채워 120칸을 모두 값으로 만들었다([사전 등록](../research/verified-indices/prereg-fill-all-4.3-2026-10-05.md), [기록](../research/verified-indices/formal-release-4.3-2026-10-05.md)). 보전 축은 순서 `IUCN > 한국 국가 > 서식국 국가 > 지방 > 자체 예비평가(Rapid LC)`를 따르며, 자체 예비평가는 공식 목록이 하나도 없는 6종에만 LC 상당 10점으로 쓰고 역검증 미통과 라벨과 별도 표식을 단다. 생리활성 축에는 잔틴 산화효소(XO) 펩타이드 층을 더했다. 공개 데이터베이스가 없어 PubMed 270건을 두 번 판독해 회원 46개를 모았고, 회원마다 독립 검증 2회를 거쳤다(`scripts/build_xo_cohort.py`). 어느 층에도 항목이 없는 종은 MBPI 0(효능 근거 미확인 · 하한값)이고, 이는 '효능 없음'이 아니라 '규칙을 채우는 근거가 아직 없음'이다. 이 확장들은 채워질 칸을 안 뒤의 결정이어서 사전 등록 0절에 그 사실과 미리 본 결과를 적었다.

`verified-4.4`(2026-10-05)는 4.3이 대체 규칙으로 채운 10칸을 재조사해, 4.3에 등록된 완화 (d)(펩타이드를 같은 표적·종말점의 ChEMBL 비교집단에서 순위)를 처음 적용했다([사전 등록](../research/verified-indices/prereg-4.4-2026-10-05.md), [기록](../research/verified-indices/formal-release-4.4-2026-10-05.md)). 참문어 세팔로토신이 MBPI 70.5(BBVI 54.2)가 됐고, 기원은 참문어 표준 유전체의 염기서열 기록이 성숙 서열과 가공 신호를 암호화함(4.1 선례)으로 확인했다. 방어·갑오징어 하한값과 MCUI 7칸은 재조사 뒤에도 그대로다. 참조기 XO 비교집단은 기준 2(잔틴 기질·요산 측정) 확인 회원을 원문 재확인으로 16 → 33으로 늘려, 4.3이 남긴 엄격 해석으로도 층이 성립한다.

`verified-4.5`(2026-10-05)는 팀장 결정 카드에 따라 완화 (d)를 방어(sbGnRH, 사람 GnRH 수용체 결합 IC50 684 nM → MBPI 7.5)와 갑오징어(FMRFamide, ChEMBL 사람 NPFF2 Ki 6.6 nM 자기 행 제외 → MBPI 65.8)에 적용했다([사전 등록](../research/verified-indices/prereg-4.5-2026-10-05.md), [기록](../research/verified-indices/formal-release-4.5-2026-10-05.md)). 두 펩타이드 모두 그 종 자체의 공개 서열 기록이 가공 신호와 함께 암호화하지만 분류군 공통 펩타이드라는 한계(농어목 공통 호르몬 / 무척추동물 문 공통 신경펩타이드)를 항목 주의 문구에 그대로 적는다. 이 판에서 MBPI 하한값 0을 받는 종은 없고, 하한값 규칙은 등록된 채 남는다.

`verified-4.7`(2026-10-08)은 점수를 바꾸지 않고 출처 점검 결과(근거 출처 목록 보강, 제목·저자·링크 정정)를 반영했다([기록](../research/verified-indices/formal-release-4.7-2026-10-08.md)).

`verified-4.6`(2026-10-08)은 점수를 바꾸지 않고, 지방 적색목록 MCUI의 정보충분도를 그 목록 행에서 읽게 했다(4.5까지는 IUCN 단계로 떨어져 0%). 미역·톳·청각·꽃게 MCUI 정보충분도 0% → 100%([기록](../research/verified-indices/formal-release-4.6-2026-10-08.md)).

`verified-4.2`는 보전 축에 지방(현·주) 적색목록을 받아들였다. 공식 평가가 하나도 없는 종에만 쓰고, DD와 지역 절멸은 점수가 되지 않으며, 여러 지역은 중앙값(짝수면 덜 위협적인 쪽)을 쓴다. 톳 60·청각 35·꽃게 35가 채워져 빈칸 102 → 105칸, 매트릭스 점 16 → 19가 됐다. 이 확장은 채워질 칸을 안 뒤의 결정이어서 규칙과 역검증 기준을 값 계산 전에 커밋했고, 사전 등록한 과대평가 역검증은 미통과(6종 비교)로 나와 값마다 라벨에 적는다. [사전 등록](../research/verified-indices/prereg-subnational-mcui-2026-10-04.md) · [기록](../research/verified-indices/formal-release-4.2-2026-10-04.md)

### 9.1 정식 산출 `verified-4.1` (2026-10-04)

`verified-4.1`은 4.0 규칙을 그대로 두고 꽃게 MBPI 30.3(BBVI 46.2, 단일 논문)을 채웠다. 4.0이 보류했던 항균 펩타이드 MCCC1-MTS의 기원종을 공개 서열 기록으로 확정했다(꽃게 자신의 유전자 모형 N말단과 일치, 대게 기록에는 없음). 초안 유전체 모형과 특허의 다른 종명은 종 상세의 '주의' 줄에 함께 보인다. 채워진 칸 100 → 102, 매트릭스 점 16 유지. [기록](../research/verified-indices/formal-release-4.1-2026-10-04.md)

### 9.2 정식 산출 `verified-4.0` (2026-10-04)

- 팀장 결정으로 3.28까지의 규칙을 고정하고 지표를 정식 산출로 낸다(status `released`). 화면의 '시범' 문구는 모두 '정식 산출'로 바뀌었고, 검증 결과는 축마다 그대로 보인다: MFPI 방법 검증 통과(11종 비교), MBPI·BBVI 사후 검증 미통과('검증 미통과'), MCUI 공식 평가 범주(OBIS 추세 보정 요소는 검증 미통과로 따로 표시).
- 라벨을 붙인 확장 3가지로 빈칸 28 → 20칸: 가시파래·감태 MFPI(같은 종 다른 시료의 생시료 수분 중앙값으로 건물 기준 값을 환산, '수분 환산값(다른 시료)'), 넙치·대구 MCUI(일본 수산청 2017 희소성 평가 'ランク外'를 LC 상당으로), 우뭇가사리 MBPI(한국 제주산 'Gelidium amansii' 시료 논문을 G. elegans로 대응, pheophorbide A). 3.15 Rapid LC는 여전히 점수가 아니다.
- '미확인' 점검: IUCN 2026-1과 국가·서식국 목록을 다시 확인한 12종은 '평가 없음 확인'으로, 근거가 있지만 점수를 낼 수 없는 생리활성 4종은 '일부 근거'로 보인다. 해역명이 없던 셀은 셀 안 바다 지점으로 해역명을 정했다.
- 활용 특성 칩: 항진균(해삼·참굴, 가시파래 추출물), 진통(감태 추출물)을 표시 전용으로 채웠다.
- 미탐색 후보: BBVI 50 이상 종과 같은 속인 30종 밖 종을 점수 없이 출현 셀로 보인다.
- 남은 20칸과 막힌 이유는 `research/verified-indices/formal-release-4.0-2026-10-04.md` 7절에 있다.
