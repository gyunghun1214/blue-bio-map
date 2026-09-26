# 실제 종 매트릭스 입력 검수 — 2026-09-26

검수 범위: 최신 `main`의 `verified-pilot-2` 공개 보고서 8종과 후보 공개 자료 22종. `dist/matrix-readiness.json`은 두 공개 산출물을 결합한 재현 가능한 종별 차단 사유 목록이다. 원자료의 재수집·재실험 결과가 아니며, 해당 공개 스냅샷 이후 자료 상태를 단정하지 않는다.

**결론:** MFPI 3종, MCUI 2종은 검증 전 시범값이다. MBPI 0종, BBVI 0종, 두 독립 축을 갖춘 실제 매트릭스 점 0개. 결측은 0점으로 변환하지 않았다. 가상 A–D 점은 실제 종 평가가 아니다.

## 축별 기준과 재검토

- MFPI: RDA 10.4의 생것·가식부 100 g 단백질·철·아연 고정 비교집단(수산동물 25행, 해조류 3행), 가식부 비율·양식 근거가 모두 있는 기존 3종만 시범 산출. 서로 다른 시료 상태와 일반명만 있는 행은 연결하지 않는다. 기존 점수와 산식은 `python scripts/build_verified_indices.py --check` 및 영양 원값·단위·출처 검사로 재현했다. 22종의 식품명 후보는 종별 시료 연결을 검수하지 않았다.
- MBPI: 기원종 → 확정 구조 ID → 같은 표적·assay·시스템·조건의 정량 활성 → 고정 비교집단 최소 3종 화합물 → 원논문이 한 줄로 연결되어야 한다. 현재 승인된 assay 행·코호트는 없다. 해삼 holotoxin A₁ MIC/MFC는 현행 pChEMBL 대상 endpoint가 아니며 PubChem 구조 대응에 미해결 문제가 있다. 살오징어 SAGSLVP는 논문 질량과 서열 계산 질량이 불일치한다. 서로 다른 종·추출물·분획 활성은 합치지 않았다.
- MCUI: 해삼 EN A2bd(2025 평가, 2026 발표) 80 및 살오징어 LC(2010 평가, 2014 발표, 갱신 필요) 10만 현행 확인을 포함한 기존 시범 산출. 나머지 기존 6종의 검색 미발견은 IUCN 공식 NE가 아니다. 신규 22종의 GBIF/IUCN 체크리스트 등급은 원평가의 기준·범위·연도·현행성을 검수하지 않아 입력에서 제외했다. 출현기록 수를 개체군 변화로 환산하지 않았다.
- BBVI: 제안서·설정의 기본 식 `0.5×MFPI + 0.5×MBPI`, 민감도 식량 가중치 0.25/0.5/0.75를 유지한다. 두 입력이 모두 있어야 계산하며 MCUI는 별도 축이다. 유효한 BBVI가 없어 실제 종의 민감도도 산출되지 않는다.

## 30종별 산출과 다음 필수 입력

| 범위·종 | MFPI | MBPI | MCUI | BBVI | 핵심 차단 단계 |
|---|---:|---:|---:|---:|---|
| 기존 미역 (*Undaria pinnatifida*) | 42.2 | 보류 | 보류 | 보류 | MBPI: 기원종·동일 조건 비교집단; IUCN 평가 미확인 |
| 기존 해삼 (*Apostichopus japonicus*) | 보류 | 보류 | 80.0 | 보류 | MFPI: 식품 행 종 일치; MBPI: 구조·동일 조건 비교집단 |
| 기존 멍게 (*Halocynthia roretzi*) | 54.2 | 보류 | 보류 | 보류 | MBPI: 구조·정량 assay·동일 조건 비교집단; IUCN 평가 미확인 |
| 기존 살오징어 (*Todarodes pacificus*) | 보류 | 보류 | 10.0 | 보류 | MFPI: 필수 영양 성분; MBPI: 구조·동일 조건 비교집단 |
| 기존 우뭇가사리 (*Gelidium elegans*) | 보류 | 보류 | 보류 | 보류 | MFPI: 식품 행 종 일치; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 평가 미확인 |
| 기존 톳 (*Sargassum fusiforme*) | 보류 | 보류 | 보류 | 보류 | MFPI: 필수 영양 성분; MBPI: 구조·정량 assay·동일 조건 비교집단; IUCN 평가 미확인 |
| 기존 홍합(참담치) (*Mytilus coruscus*) | 보류 | 보류 | 보류 | 보류 | MFPI: 필수 영양 성분; MBPI: 구조·정량 assay·동일 조건 비교집단; IUCN 평가 미확인 |
| 기존 참굴 (*Magallana gigas*) | 65.5 | 보류 | 보류 | 보류 | MBPI: 구조·정량 assay·동일 조건 비교집단; IUCN 평가 미확인 |
| 신규 다시마 (*Saccharina japonica*) | 보류 | 보류 | 보류 | 보류 | MFPI: 원값 3성분·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 감태 (*Ecklonia cava*) | 보류 | 보류 | 보류 | 보류 | MFPI: 영양 원값·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 가시파래 (*Ulva prolifera*) | 보류 | 보류 | 보류 | 보류 | MFPI: 영양 원값·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 괭생이모자반 (*Sargassum horneri*) | 보류 | 보류 | 보류 | 보류 | MFPI: 영양 원값·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 Gracilaria vermiculophylla (*Gracilaria vermiculophylla*) | 보류 | 보류 | 보류 | 보류 | MFPI: 원값 3성분·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 청각 (*Codium fragile*) | 보류 | 보류 | 보류 | 보류 | MFPI: 원값 3성분·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 바지락 (*Ruditapes philippinarum*) | 보류 | 보류 | 보류 | 보류 | MFPI: 종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 전복(종 수준) (*Haliotis discus*) | 보류 | 보류 | 보류 | 보류 | MFPI: 원값 3성분·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 큰가리비 (*Mizuhopecten yessoensis*) | 보류 | 보류 | 보류 | 보류 | MFPI: 종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 시카메굴 (*Magallana sikamea*) | 보류 | 보류 | 보류 | 보류 | MFPI: 영양 원값·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 피조개 (*Anadara broughtonii*) | 보류 | 보류 | 보류 | 보류 | MFPI: 원값 3성분·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 맛조개 (*Sinonovacula constricta*) | 보류 | 보류 | 보류 | 보류 | MFPI: 원값 3성분·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 고등어 (*Scomber japonicus*) | 보류 | 보류 | 보류 | 보류 | MFPI: 종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 멸치 (*Engraulis japonicus*) | 보류 | 보류 | 보류 | 보류 | MFPI: 원값 3성분·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 참조기 (*Larimichthys polyactis*) | 보류 | 보류 | 보류 | 보류 | MFPI: 종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 넙치 (*Paralichthys olivaceus*) | 보류 | 보류 | 보류 | 보류 | MFPI: 종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 조피볼락 (*Sebastes schlegelii*) | 보류 | 보류 | 보류 | 보류 | MFPI: 종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 방어 (*Seriola quinqueradiata*) | 보류 | 보류 | 보류 | 보류 | MFPI: 원값 3성분·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 대구 (*Gadus macrocephalus*) | 보류 | 보류 | 보류 | 보류 | MFPI: 종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 꽃게 (*Portunus trituberculatus*) | 보류 | 보류 | 보류 | 보류 | MFPI: 종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 참문어(동아시아 종) (*Octopus sinensis*) | 보류 | 보류 | 보류 | 보류 | MFPI: 원값 3성분·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |
| 신규 갑오징어 (*Acanthosepion esculentum*) | 보류 | 보류 | 보류 | 보류 | MFPI: 원값 3성분·종 연결·가식부·양식·비교집단; MBPI: 기원종·구조·정량 assay·동일 조건 비교집단; IUCN 원평가 검수 |

각 종의 단계별 기원종·구조·정량값·비교집단 불충족 여부, 공개 점수, 원문 링크는 [`dist/matrix-readiness.json`](../../dist/matrix-readiness.json)에 있다. 신규 후보 식품 원값은 [`dist/expansion-evidence.json`](../../dist/expansion-evidence.json)에 있으며, 종 수준 승인값으로 전환하지 않았다.

## 추가로 확인한 원논문 단서

- Wang 등(2012)의 [PubMed 원논문 초록](https://pubmed.ncbi.nlm.nih.gov/23285801/)은 *Apostichopus japonicus*에서 holotoxin D1, 25,26-dihydroxy-holotoxin A1, stichlorosides C1, bivittoside D의 분리와 1·3의 항진균 활성을 기록한다. 초록에는 동일 조건의 정량값과 네 구조의 확인 가능한 CID/InChIKey가 모두 제시되지 않는다. 따라서 새 MBPI 입력으로 승인하지 않았다. 전문·보충자료와 구조 대응의 추가 검수가 필요하다.
- 기존 원논문과 정량값의 세부 내역: [`bioactivity-audit.md`](bioactivity-audit.md), [`nutrition-audit.md`](nutrition-audit.md), [`conservation-audit.md`](conservation-audit.md). 원문 저작권에 따라 논문 전문을 재배포하지 않고 링크와 최소한의 검수 메타데이터만 기록한다.

## 검증과 남은 작업

- 산식 재현용 합성 assay 사례와 실제 근거를 분리했다. 합성 점수는 공개 보고서에 저장되지 않는다. 종명·AphiaID·화합물 ID·표적·조건이 잘못 연결되면 산출이 중단되는 회귀 검사를 추가했다.
- 실제 종으로 사후 성능을 검증할 MBPI/BBVI 사례가 없어 성능 검증은 **미실시**다. MCUI 2종의 순서 일치는 일관성 검사일 뿐 예측 성능 증거가 아니다. 가중치를 조정하는 보정 사례는 없고, 검증 사례로 재사용하지 않았다.
- 다음 조사 우선: (1) 해삼과 살오징어의 구조·정량 assay 사슬 복구, 생것·종별 영양 누락 대조; (2) 시범 MFPI 3종의 독립된 IUCN 원평가 재검색; (3) 신규 바지락·큰가리비·고등어·참조기의 식품 행 종 동정과 보전 원평가, 동조건 assay 수집. 검색 미발견이나 제공처 체크리스트만으로 점수를 만들지 않는다.
- 이용 조건은 종별 근거 JSON의 `source_urls`와 원자료 등록부(`evidence.json`)를 따른다. RDA 식품성분 공개 자료는 공공누리 제1유형, IUCN 원문과 논문은 각각 해당 출처 조건을 확인한다. 출현자료는 이 매트릭스의 수치 입력이 아니며 지도 격자에 종 점수를 자동 전가하지 않는다.
