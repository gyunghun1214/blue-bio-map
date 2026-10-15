# 라이선스 충돌 정리: 출처별 상업 이용 구분 (2026-10-15)

개선 프롬프트 4/15. 출처마다 **표시된 라이선스**를 읽은 분류이며 법률 판단이 아니다. 불확실한 항목은 '확인 필요'로 둔다. 점수·사분면 유형·지도 색은 바꾸지 않았다.

- 표: `dist/license-matrix.json` (스키마 `license-matrix-1`), 생성 `python scripts/build_license_matrix.py` (`--check`로 재현 확인, `verification/test_license_matrix.py`).
- 기준: 지표 verified-4.18 · 운영 종 스냅샷 2026-10-01 · 후보 셀 2026-10-01.
- 열: 출처(title·provider·url) / 라이선스(license·license_url) / 상업 이용 구분(group·tier·share_alike·basis) / 쓰이는 곳(uses: MFPI·MBPI·MCUI·출현 지도 셀·종 상세 요약·학명·조사량 음영·배경 지도 등)과 종 수.
- 지표 보고서가 바뀌는 배포(assessments.json·live-snapshot.json·expansion-public-cells.json 변경)에서는 이 스크립트를 다시 실행해 표를 함께 갱신한다. 새 라이선스 문구는 규칙이 없으면 '확인 필요'로 들어간다.

## 분리 표

| 구분 | 출처 수 | 기준 |
|---|---:|---|
| 상업 이용 가능 | 108 | 표시된 라이선스가 출처 표시 조건으로 상업 이용을 허락합니다(CC0·CC BY 계열, 퍼블릭 도메인, 공공누리 제1유형 등). CC BY-SA는 같은 조건(동일조건 변경허락)을 붙여야 합니다. |
| 상업 이용 불가 | 36 | 표시된 라이선스가 비상업 이용만 허락합니다(CC BY-NC 계열). 상업 서비스에 쓰려면 권리자의 별도 허락이 필요합니다. |
| 허가 필요 | 19 | 이용약관이 상업 이용에 기관의 별도 허가를 요구합니다(IUCN 적색목록, FAO 자료). |
| 확인 필요 | 90 | 라이선스가 표시되지 않았거나 조건이 섞여 있어 상업 이용 범위를 확인해야 합니다(논문 수치·사실 인용, 정부·지자체 간행물 등). |

같은 GBIF 데이터셋에 CC BY와 CC BY-NC 기록이 섞이면 라이선스마다 한 행으로 센다.

## 상업 레이어 재구성 가능성 (계산만, 공개 점수 불변)

지표는 그 종의 지표 기록에 연결된 출처가 모두 조건에 맞을 때만 센다(확인 단계에만 쓴 출처도 포함하는 보수적 계산). BBVI는 MFPI·MBPI가, 유형은 BBVI·MCUI가 함께 남을 때 센다. 지도 셀은 그 셀의 검수 통과 기록 중 하나라도 CC0·CC BY이면 남는다.

| 항목 | 현재 공개 | CC0·CC BY만 | + CC BY-SA | + 확인 필요(상한) |
|---|---:|---:|---:|---:|
| MFPI(종) | 30 | 3 | 3 | 18 |
| MBPI(종) | 30 | 0 | 0 | 16 |
| MCUI(종) | 29 | 0 | 0 | 0 |
| BBVI(종) | 30 | 0 | 0 | 9 |
| 활용 × 보전 유형(종) | 29 | 0 | 0 | 0 |
| 출현 지도 격자(칸) | 40 | 30 | 30 | 30 |
| 출현 지도 셀(종×격자) | 480 | 91 | 91 | 91 |
| 출현 셀이 있는 종 | 30 | 25 | 25 | 25 |
| ㄴ 1° 격자(칸) | 36 | 26 | 26 | 26 |
| ㄴ 4° 격자(칸) | 4 | 4 | 4 | 4 |
| 활용 × 보전 셀 색(칸) | 40 | 0 | 0 | 0 |

시나리오: CC0·CC BY만 = CC0·CC BY 계열 출처만 · + CC BY-SA = CC0·CC BY + CC BY-SA(동일조건) · + 확인 필요(상한) = 위 + 확인 필요 출처 전부(확인 결과가 모두 '가능'일 때의 상한)

CC0·CC BY만 남길 때 주로 빠지는 출처(종 수):

- MFPI: Food and Agriculture Organization of the United Nations 5 · FAO/INFOODS 3 · Statistics Korea (국가데이터처), 어류양식동향조사 2 · ALGAE 33(1):101-108 (The Korean Society of Phycology), open access 1 · Aquaculture Research 49(2):1020-1028 (Wiley) 1
- MBPI: EMBL-EBI ChEMBL 19 · NCBI PubChem 19 · AHTPDB, IIIT-Delhi (Raghava group) 14 · Comprehensive Marine Natural Products Database (CMNPD) 14 · EMBL-EBI Europe PMC 14
- MCUI: IUCN Red List 29 · Ocean Biodiversity Information System (OBIS), IOC-UNESCO 29 · 국가데이터처 · KOSIS 국가통계포털 29 · IUCN Red List of Threatened Species 11 · GBIF.org occurrence search API and OBIS API v3 (counts and areas derived for the Rapid LC check) 9

확인 필요가 모두 '가능'으로 확인돼도 기관 승인이 필요한 출처:

- MFPI: Food and Agriculture Organization of the United Nations 5 · FAO/INFOODS 3 · ALGAE 33(1):101-108 (The Korean Society of Phycology), open access 1 · Development & Reproduction 29(1):13-18 (Hwang & Kang 2025), full text via Europe PMC PMC12004011 1 · Lee HI, Kim CB, Lee MK; Korean Society of Food Preservation 1
- MBPI: Comprehensive Marine Natural Products Database (CMNPD) 14 · Molecular Medicine Reports (Spandidos), open access, full text read from the Europe PMC REST fullTextXML of PMC5865786 1
- MCUI: IUCN Red List 29 · Ocean Biodiversity Information System (OBIS), IOC-UNESCO 29 · IUCN Red List of Threatened Species 11 · GBIF.org occurrence search API and OBIS API v3 (counts and areas derived for the Rapid LC check) 9

읽는 법: 지금 상태로 CC0·CC BY만 쓰는 상업 레이어는 출현 지도(격자 30/40칸)와 학명 정도이며, 지표 점수는 ChEMBL(CC BY-SA)·PubChem·CMNPD·IUCN·KOSIS·OBIS 추세 등 연결 출처 때문에 거의 다시 만들 수 없다. 점수를 상업 레이어에 넣으려면 CMNPD·IUCN·FAO 승인과 '확인 필요' 출처의 조건 확인이 먼저다.

## 사이트 표기

- 모든 탭 하단: '콘텐츠 라이선스: 출처별 혼합 · 출처 목록 참조'(누르면 근거와 방법 탭의 분리 표로 이동).
- 근거와 방법 탭 출처 목록 위: '출처별 상업 이용 구분' 표, 접힌 '상업 레이어 재구성 계산', 접힌 '확인 필요 항목'.
- CC BY-NC-SA(CMNPD) 파생 요약 점검: 종 상세의 CMNPD 화합물 요약(해삼)에는 이미 '비상업 이용·출처 표시·동일조건 변경허락이 이 요약에도 적용됩니다'가 붙어 있다. MBPI 상세의 원논문 검색 줄(CMNPD·PubChem·Europe PMC 검색 건수, 14종)에는 표기가 없어 'CMNPD 검색 부분은 CC BY-NC-SA 4.0 조건'을 덧붙였다. CSV 내려받기는 셀 단위 라이선스 열을 이미 담는다. 탐사 화면(expedition.html)에는 CMNPD 파생 내용이 없다.

## 확인 필요 항목

1. **IUCN 적색목록 범주를 공개 사이트에 다시 게시할 수 있는 범위** — 확인 필요. 원문: https://www.iucnredlist.org/terms/terms-of-use . 클라우드에서 원문이 열리지 않았다(robots 차단, 2026-10-15). MCUI·종 상세가 IUCN 범주·평가 연도를 적는 범위, 상업 서비스에 필요한 허가를 원문으로 확인해야 한다. 관련 출처 11건.
2. **논문·간행물: 공개 라이선스 표시 없음, 수치·짧은 사실만 기록** — 69건: A defensin-like antimicrobial peptide from the manila clam Ruditapes philippinarum (Yang D et al. 2018) · ACE inhibitory peptides derived from wakame (Undaria pinnatifida) · An active peptide purified from gastrointestinal enzyme hydrolysate of Pacific cod skin gelatin attenuates ACE activity (Himaya SWA et al. 2012) · Angiotensin I-converting enzyme inhibitors in autolysates of squid liver and mantle muscle · Angiotensin I-converting enzyme inhibitory peptides from an enzymatic hydrolysate of flounder fish (Paralichthys olivaceus) muscle as a potent anti-hypertensive agent · Angiotensin-I-converting enzyme (ACE) inhibitory peptides from Pacific cod skin gelatin using ultrafiltration membranes · Angiotensin-converting enzyme inhibitory activity of enzymatic hydrolysates of Crassostrea gigas (oyster) · Anticancer activity of an oligopeptide isolated from hydrolysates of Sepia ink (Ding G-F et al. 2011) · Antihypertensive effects of Undaria pinnatifida (wakame) peptide on blood pressure in spontaneously hypertensive rats · Biotechnological production of the angiotensin-converting enzyme inhibitory dipeptide isoleucine-tryptophan · Changes in the Proximate and Fatty Acid Compositions of Chub Mackerel, Scomber japonicus Muscle during Cultivation (Moon SK, Kim IS, Hong SN, Lim DH, Jeong BY), doi:10.5657/kfas.2010.43.6.589 · Characterization of Fish Skin Hydrolysates Exhibiting Dipeptidyl Peptidase IV Inhibitory Activity (Miyamoto H, Safitri E, Nagai T, Saito M 2024) 외 57건
3. **정부·지자체 자료: 재이용 조건 표시 없음 또는 확인 전** — 12건: KOSIS 어업생산동향조사 · 어업별 품종별 통계(DT_1EW0004) · Standard Tables of Food Composition in Japan, Eighth Revised Edition, 2023 supplement — dried tengusa · Постановление Губернатора Приморского края от 14.05.2002 № 272 «Об утверждении перечня объектов растительного мира и перечня объектов животного мира, занесенных в Красную книгу Приморского края» · Постановление Правительства Приморского края от 24.10.2022 № 723-пп «О видах растительного мира Красной книги Приморского края» 공식 스캔(21쪽) · Список растений и грибов, занесённых в Красную книгу Российской Федерации (Order No. 320 of 23.05.2023; Minjust registration 21.07.2023 No. 74362), Section 5 ВОДОРОСЛИ, row 594 · いしかわレッドデータブック2020〈動物編〉 6. 浅海域の生物 · レッドデータおきなわ 第3版 菌類編・植物編〈藻類〉 · 福岡県レッドリスト2024（動物） · 茨城における絶滅のおそれのある野生生物 蘚苔類・藻類・地衣類・菌類編 2020年版 · 국가생물적색자료집 통합본(2019-2024), 찾아보기 표 (분류군·종명·초판·개정판·변동·페이지)와 그 페이지 칸이 가리키는 종 목록 쪽 · 성분코드 조회: 식품원료 성분명(한글), 성분학명 · 시도·시군구별 양식방법별 어종별 양식현황(입식, 생산, 사육, 먹이를 준 양) DT_1EZ0008
4. **데이터베이스 자체 이용 정책 또는 담당자 회신(공개 라이선스 아님)** — 6건: AHTPDB antihypertensive peptide database, IC50 download (pepic50.txt) · CancerPPD 2.0 cell-line records (407 cell-line tables) used as the fixed IC50 comparison cohorts · DBAASP peptide records (full REST dump, 25,542 records) used as the fixed MIC comparison cohorts · Europe PMC REST search (IDs, titles and quoted abstract sentences) · PUG REST InChIKey -> CID and taxonomy 'Natural Products' section · PubChem PUG REST compound/substance records
5. **OBIS 전체 기록 집계 수(데이터셋별 라이선스 혼합)** — 1건: 조사량 음영(OBIS 1° 칸별 전체 기록 수)
6. **논문은 출판사 저작권, 추출값은 ChEMBL CC BY-SA 3.0** — 1건: Dieckol, a SARS-CoV 3CL(pro) inhibitor, isolated from the edible brown algae Ecklonia cava
7. **공공누리 제3유형: 출처 표시·변경 금지(셀 집계가 변경에 해당하는지 확인)** — 1건: 국립생물자원관 생물지리정보(표본 채집 지점·일자)

그 밖에 '허가 필요'로 둔 FAO 자료(웹페이지 6건, FAO/INFOODS uFish 2건)는 상업 이용 시 FAO 허가 요청 대상이다. 출처별 전체 목록은 license-matrix.json의 rows와 review_items에 있다.

## 발표 한 줄

"상업 서비스는 CC0·CC BY 데이터만으로 만든 레이어로 하고, 비상업 데이터와 IUCN 데이터는 해당 기관의 승인을 받은 뒤에만 씁니다. 우리 수익원은 데이터 판매가 아니라 연결과 표준화 작업입니다."
