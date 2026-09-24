# 실제 근거 지표 설계 및 입력 경계

기준: 제안서 「Blue-bio Value Map」 3–4쪽, GitHub `main` `c35c99c` (2026-09-25),
`docs/evidence-schema.md`, `scripts/evaluate_candidates.py`, 공개 `species_profiles` 읽기 전용 조회.
이 문서는 원자료 조사와 구현에 **앞서** 제안 원칙과 현재 시범 규칙을 분리한다.
지표와 가중치는 과학적으로 검증된 예측 모델이 아니다.

## 제안서의 원칙과 현재 코드의 선택

| 주제 | 제안서 3–4쪽 | 현재 `main`의 자체 선택 | 확인·수정할 가정 |
| --- | --- | --- | --- |
| 분류 연결 | WoRMS 승인 학명/AphiaID로 종을, InChIKey/CID로 화합물을 연결 | 입력의 `aphia_id`, `scientific_name` 및 `compound_id` 문자열 검사 | 운영 프로필의 8종과 원자료의 원명을 각각 대조한다. 문자열이나 시험 생물만으로 기원종을 연결하지 않는다. |
| MBPI | 비교 가능한 표적·assay 층에서 pChEMBL 백분위와 독립 검증 근거를 반영 | `(target_id, assay_type)` 층, 최소 3개 화합물, 최고 화합물 백분위 × 문헌 1건 0.75 / 2건 이상 1.0 | endpoint, 단위, relation, 시험 생물·조건, 동일 DOI 중복을 추가 확인한다. 최고값 선택에 따른 연구량 편향을 민감도로 보고한다. MIC/MFC와 분획은 소분자 pChEMBL 층에 넣지 않는다. |
| MFPI | 영양 원값, 실측/대용 구분, 가식부·양식 가능성을 반영 | 단백질·철·아연의 종별 백분위 평균 80%, 가식부 비율 10%, 양식 여부 10%; 실측 1.0/계산 0.85/대용 0.5; 성분별 최소 3종 | 이 계수는 팀 시범 규칙이다. 식품 상태·가식부 100 g·분석 연도·영양값의 개별 유래를 검수하고 기준집단을 동결한다. 참고 메타데이터의 결측은 원값 자체를 숨기는 이유가 아니다. |
| MCUI | IUCN 평가를 기본으로, 출현 추세의 원인을 검수해 별도 보전 축으로 표시 | LC/NT/VU/EN/CR → 10/35/60/80/100; 검수된 노력 보정 추세 ±10 | 숫자 매핑과 ±10은 자체 규칙이다. 원평가의 범위·연도·근거와 **현재 평가 확인**을 별도 검증한다. 노력 통제 없는 OBIS 원시 건수로 보정하지 않는다. DD/NE/검색 실패/접근 실패는 서로 다르다. |
| BBVI | MFPI와 MBPI를 목적별 가중 합산; MCUI는 독립 | 기본 `0.5×MFPI + 0.5×MBPI`; 한 축 누락 시 보류 | 식량/생리활성 단독 시나리오는 기본 BBVI와 구분한다. 화면 필터가 비교집단이나 기존 점수를 재계산하지 않는다. |
| 정보충분도/지도 | 결측과 불확실성을 따로 표시; 공개 좌표 일반화 | 영양 trace가 없는 MFPI는 브라우저가 숨김; 종별 시범 점수 파일은 현재 없음 | 축별 상태를 독립 표시한다. 점수는 종 수준이며 공개 셀의 해역 가치로 복사하지 않는다. 실제 매트릭스에는 BBVI와 MCUI가 모두 있는 종만 둔다. |

현재 코드의 `min_peers=3`, 최고 화합물, 실측/계산/대용 계수, IUCN 숫자,
MFPI 80/10/10은 **기존 구현의 임의 시범 기준**이며 국제 표준이나 통계적
타당성의 증거가 아니다. 3개로 만든 백분위는 매우 불안정하다.

## 공개 운영 후보와 병합 상태

2026-09-25 공개 `species_profiles` GET에서 8행을 확인했다. 학명과 AphiaID는
공개 프로필 값이며, 원자료별 동의어 연결과 WoRMS의 당일 승인 상태는 별도 검수한다.

| 공개 이름 | 공개 학명 | AphiaID |
| --- | --- | ---: |
| 참굴 | *Magallana gigas* | 836033 |
| 홍합(참담치) | *Mytilus coruscus* | 506159 |
| 톳 | *Sargassum fusiforme* | 494972 |
| 우뭇가사리 | *Gelidium elegans* | 372119 |
| 살오징어 | *Todarodes pacificus* | 342067 |
| 멍게 | *Halocynthia roretzi* | 250680 |
| 해삼 | *Apostichopus japonicus* | 241776 |
| 미역 | *Undaria pinnatifida* | 145721 |

GitHub API 확인일 2026-09-25: PR #5, #6, #7, #10은 열려 있고 미병합이다.
조사 결과는 탐색 단서일 뿐 승인된 입력이 아니다. PR #11만 병합되어 `main`에
있다. 특히 PR #7의 `Gelidium amansii`/212186 후보는 현재 공개 프로필의
`Gelidium elegans`/372119와 다르므로 자동 합치지 않는다.

## 원자료 후보와 수집 원칙

- AFCD는 **Food Standards Australia New Zealand**의 *Australian Food
  Composition Database*이다. 2025-12 공개 Release 3의 식품 상세와 성분
  프로필을 행 ID로 연결한다. 식품 상세의 `Derivation`, `Sampling Details`,
  `Analysed Portion`을 함께 읽는다. `Pacific oyster` 등 식품 이름이 운영
  종의 학명으로 직접 확정되는지 검토한다. [공식 DB](https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd),
  [자료 이용조건](https://www.foodstandards.gov.au/science-data/monitoringnutrients/afcd/datauserlicenceagreement).
- FAO/INFOODS **uFiSh1.0 (2016)**은 식품 ID·ASFIS 종명·생물/가공 상태,
  100 g 가식부 성분, `EDIBLE` 계수와 원 참조 ID를 분리해서 읽는다.
  [공식 파일 안내](https://www.fao.org/food-composition/tables-and-databases/detail/f-food-composition-tables/en).
  FAO의 원자료 발행연도를 시료 채집 연도로 대신 쓰지 않는다.
- MBPI는 [CMNPD](https://docs.cmnpd.org/tutorial),
  [ChEMBL](https://www.ebi.ac.uk/chembl/),
  [PubChem BioAssay](https://pubchem.ncbi.nlm.nih.gov/) 및 원논문의
  **기원종 → 분리·동정 물질 → 외부 구조 ID → assay/endpoint → DOI**를 한
  사슬로 검증한다. PR #5의 해삼 MIC/MFC와 다시마 Lj5 분획은 단일 소분자
  MBPI의 승인 입력이 아니지만 별도 원값 근거로 보존할 수 있다.
- IUCN은 레코드의 범주·평가일·발행연도·전 지구/지역 범위·근거와 현재
  평가 확인일을 분리한다. PR #7의 돌기해삼 2013년 EN은 역사적 원평가의
  단서이며, 최신 평가 확인 전에는 MCUI 숫자로 발행하지 않는다.

각 수집 행은 원레코드 ID/URL/DOI, 제공처와 버전, 조회일과 이용조건, 원명과
승인명 연결, 측정값·단위·시료 상태·평가 범위, 실제 제공된 시료 연도와
발행연도, 검증 상태·확인 근거·누락·제외 이유를 갖는다. 알 수 없는 값은
`null`로 남긴다. `reviewed: true`는 원자료 행과 검토 기록이 실제로 확인된
경우에만 사용한다. 원문 전문은 재배포하지 않고 허용되는 사실 요약·링크와
재수집 절차만 보존한다.

## 계산·공개 구조

1. 공개 8종 프로필을 기준일과 함께 동결한다. 출현 좌표나 비공개 DB 행은
   가져오지 않는다.
2. 영양/양식, 생리활성, 보전 원레코드의 **원값**을 각각 별도 입력으로
   보존한다. 참고 메타데이터와 점수 필수 항목을 구분한다.
3. 원명→승인 종, 원물질→구조 ID, 분석 시료→가식부·상태를 검증하고
   제외 이유를 남긴다. 건조·가공·생물 자료는 별도 층으로 유지한다.
4. 화면 후보와 분리된 비교집단을 스냅샷·방법론 버전으로 동결한다.
   종/화합물 수와 출처를 공개한다. 같은 DOI가 두 DB에 있어도 한 논문이다.
5. 축별 점수와 계산 흔적을 생성한다. 기본 BBVI는 두 축이 있을 때만
   계산한다. MCUI는 두 활용 축 없이도 자체 근거가 갖춰지면 표시한다.
6. 공개 결과에는 `산출됨 / 일부 근거 확인 / 산출 보류`를 지표별로
   기록하고, 원값·비교집단·가중치·누락·불확실성을 열람할 수 있게 한다.
   실제 매트릭스에는 BBVI와 MCUI가 모두 있는 종만 표시한다.

검증은 단위/시료 상태 혼합, 기원종과 시험 생물 혼동, 결측의 0점화,
중복 논문, 비교집단 고정, 화면과 계산값 일치, 가중치·집계 방식
민감도를 포함한다. 알려진 의약품/보전 사례 중 가중치 선택에 사용한
사례는 독립 사후 점검에서 제외한다. 민감도 범위는 신뢰구간이 아니다.
