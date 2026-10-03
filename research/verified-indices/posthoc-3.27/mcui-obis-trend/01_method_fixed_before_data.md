# MCUI OBIS 출현 추세 요소 — 패널 밖 외부 검증 방법 (결과 자료 보기 전에 고정)

작성: 2026-10-03. 패널 밖 종의 IUCN 범주, 같은 강 기록(조사 노력), 보고율을 하나도 보기 전에 작성했다. 이 파일의 sha256을 `locked.sha256`에 적는다. 이후 수정 금지(수정하면 아래 '변경 기록'에 날짜·이유·두 결과를 모두 적는다).

## 0. 검증 대상

`config/verified-indices-v3.25.json`의 `conservation.trend` 규칙(3.4부터 같음)과 `scripts/build_verified_indices.py`의 `occurrence_trend`·`_rate_ratio`가 내는 **감소 신호(decline_signal)** 판정. 이 판정이 MCUI에 +10을 주는 유일한 조건이다.

질문: 이 판정이 IUCN 전 지구 위협 종(VU·EN·CR)에서 LC 종보다 더 자주 나오는가?

규칙 수치는 하나도 바꾸지 않는다.
- 기간: 2006-01-01–2015-12-31 대 2016-01-01–2025-12-31
- min_past_records 20, continuity 0.5, z 1.96, decline_ratio 0.7
- 1° 셀, 셀 경계 규칙(`cells_of`), 같은 WoRMS 강 기록을 조사 노력으로 사용
- 데이터셋 검사(과거 기록 최다 데이터셋 안에서도 같은 기준)

## 1. 이 문서를 쓰기 전에 본 것 (형식 확인만)

- OBIS checklist 응답 형식과 날짜 필터·skip 동작: Bivalvia(105), 지도 상자.
  - 기간별 첫 줄: 2006–2015 Arcuatula senhousia 1,427건, 2016–2025 Ruditapes philippinarum(패널 종) 308건, 전체 Saccostrea kegaki 2,223건.
  - 종 단위 건수 몇 줄만 보았고, 같은 강 기록·보고율·IUCN 범주는 보지 않았다.
- GBIF species/match와 /species/{key}/iucnRedListCategory 형식.
  - Apostichopus japonicus(패널 종) → EN
  - 예시 키 5181446 → NE
  - GBIF의 IUCN Red List 데이터셋(19491596-35ae-4a91-9a98-85cf505f1bd3) pubDate 2026-07-28
- WoRMS AphiaIDByName('Elasmobranchii') = 10193
- 일본 환경성 CSV 머리줄과 범주별 행 수(아래 5절 S3의 벤치마크 파일)

## 2. 종 선정 규칙 (전수, 종별 판단 없음)

**공간:** 지도 범위 상자 `POLYGON((122 30,136 30,136 43,122 43,122 30))`. 수집기와 같은 상자다.

**1차 집합 P(판정에 쓰는 집합):** 패널 30종이 쓰는 WoRMS 강 10개. 괄호 안은 OBIS taxonid(= AphiaID)다.
- Ascidiacea 1839, Bivalvia 105, Cephalopoda 11707, Florideophyceae 368670, Gastropoda 101
- Holothuroidea 123083, Malacostraca 1071, Phaeophyceae 830, Teleostei 293496, Ulvophyceae 146216

**2차 확장 집합 S2(서술용, 판정에 안 씀):** Elasmobranchii 10193.

**후보 뽑기:**
- OBIS `checklist`를 강마다 조회한다(taxonid = 강, geometry = 상자, 2006-01-01–2015-12-31, 끝까지 페이지).
- 남기는 조건(셋 다):
  - `taxonRank == "Species"`
  - `class`가 조회한 강과 같다
  - `records ≥ 20`(방법의 min_past_records와 같은 값)
- 제외:
  - 패널 30종의 AphiaID
  - 패널 종과 이명(속명 + 종소명)이 같은 종

**IUCN 범주:**
- GBIF `species/match`를 쓴다(name = OBIS scientificName, kingdom = OBIS kingdom 힌트, strict = true).
- `matchType == "EXACT"`이고 `rank == "SPECIES"`인 것만 받는다.
- 키는 acceptedUsageKey가 있으면 그것, 없으면 usageKey다.
- `GET /v1/species/{key}/iucnRedListCategory`의 `code`를 쓴다.
- 짝이 없거나 NE이거나 응답이 없으면 '미평가'로 보고 검정에서 뺀다(수만 보고).
- 집단 구분:
  - T(위협) = VU·EN·CR
  - L = LC
  - NT·DD는 추세를 계산해 서술만 하고 검정에는 넣지 않는다.
  - EX·EW는 뺀다.

**OBIS 추세 계산 대상:** IUCN 코드가 CR·EN·VU·NT·LC·DD인 후보만. 미평가 종은 계산하지 않는다.

## 3. 계산 (패널과 같은 코드, 같은 안전 검사)

- 코드는 `scripts/collect_mcui_trend.py`의 `get`·`cells_of`·`species_rows`·`tally`와 `scripts/build_verified_indices.py`의 `occurrence_trend`·`_rate_ratio`를 복사한 것이다. 상수는 config v3.25 값이다. 저장소에는 아무것도 쓰지 않는다.
- **같은 강 조사 노력:** 종의 기록이 어느 한 기간에라도 있는 모든 셀에 대해 `statistics(taxonid = 강, geometry = 셀 폴리곤, 기간)`으로 센다. 수집기와 같다.
- **데이터셋 검사:** 전체 조건(R ≤ 0.7이고 상한 < 1)이 성립한 종만 계산한다. 그 경우에만 판정을 바꾸기 때문이다. 다른 종은 계산하지 않아도 판정이 같다. 계산 방법은 수집기와 같다.
  - 과거 기록 최다 데이터셋을 고른다(동률이면 정렬 순서 첫째).
  - 그 데이터셋의 statistics 건수와 페이지 기록의 데이터셋별 건수가 같아야 한다.
  - 셀별로 같은 강 기록을 datasetid로 센다.
- **안전 검사:**
  - (a) 종 × 기간마다 페이지로 받은 기록 수 = statistics 건수.
  - (b) 최다 데이터셋의 datasetid statistics 건수 = 페이지 기록의 그 데이터셋 건수.
  - (a)·(b)가 어긋나면 캐시 없이 한 번 다시 받는다. 그래도 어긋나면 그 종을 '자료 검사 실패'로 빼고 명단에 적는다.
  - (c) 실행 시작 때 한 번, 존재하지 않는 datasetid로 조회해 0건인지 확인한다. 0이 아니면 전체를 멈춘다.
- **구현 검사(검증 실행 전):**
  - 패널 종 멸치(219984)와 해삼(241776)을 이 코드로 다시 계산한다.
  - 공개본과 같은 판정이어야 한다(멸치 decline_signal, 해삼 no_clear_decline). 보고율 비는 ±0.05 안이어야 한다(OBIS가 2일 사이 바뀔 수 있음).
  - 어긋나면 코드 오류만 고친다(규칙은 고치지 않는다).
- OBIS 호출은 순차 호출, 호출 사이 0.2초, 실패 시 10·60·300초 대기다(수집기와 같다). User-Agent의 연락처는 research@example.org다.

**정의:**
- **계산 가능:** 비교 셀이 1개 이상이고 비교 셀 과거 기록이 20건 이상이다. 즉 `undetermined`의 사유가 `no_comparable_cells`나 `past_records_below_minimum`이 아니다.
  - `decline_uncertain`, `decline_not_confirmed_within_dominant_dataset`로 판단 불가가 된 종은 계산 가능하고 '신호 없음'으로 센다.
- **양성:** class == `decline_signal`

## 4. 1차 검정 (P만, 합격·불합격을 정한다)

- 2×2 표: (T, L) × (감소 신호, 신호 없음). 계산 가능한 종만 넣는다.
- 단측 Fisher 정확 검정을 쓴다(대립가설: T에서 감소 신호의 오즈가 더 크다). `scipy.stats.fisher_exact(alternative="greater")`.
- **합격 조건:** 아래 둘 다.
  - (i) 계산 가능한 T 종 ≥ 10
  - (ii) p < 0.05
- (i)이 안 되면 '검정 불가 = 불합격'이다.
- 보고할 값:
  - 민감도 = T 중 감소 신호 비율
  - 거짓 경보율 = L 중 감소 신호 비율
  - 둘 다 Clopper–Pearson 95% 구간
  - 오즈비
  - 종별 전체 표(종, AphiaID, 강, IUCN, 비교 셀, 과거→최근 기록, 보고율 비와 구간, 데이터셋 검사, 판정)

## 5. 보조 분석 (서술용, 1차 판정을 바꾸지 않는다)

- **S1:** P에서 보고율 비 R을 T 대 L로 비교한다. 단측 Mann–Whitney U, T < L.
- **S2:** P ∪ Elasmobranchii에서 같은 Fisher 검정, 민감도와 거짓 경보율.
- **S3 일본 환경성 벤치마크:** 계산 가능한 P ∪ S2 종에 적용한다.
  - 파일과 sha256(앞 8자리):
    - 해양생물 레드리스트 2017: 어류 `redlist2017kaiyo_gyorui.csv` 0f779f9f, 갑각류 `_koukakurui.csv` a058c22b, 연체류 `_nantai.csv` 550bc1d2, 산호류 `_sangorui.csv` ee4f5b5e, 기타 무척추 `_sonotamusekitsui.csv` ffae3d80
    - 제4차 레드리스트 2020 무척추동물 `redlist2020_invertebrate.csv` cc7e19f2
    - 조류(藻類)는 최신판 `redlist2025_sorui.csv` a6a7f15d만 쓴다(2020판 226509d2는 대체되어 쓰지 않는다)
  - 학명은 앞 두 단어(속명 + 종소명)를 쓴다. 'sp.' 등은 버린다.
  - WoRMS `AphiaRecordsByName`(marine_only=false, like=false)의 첫 레코드 `valid_AphiaID`로 바꿔 종의 AphiaID와 맞춘다.
  - 일본 위협 = 絶滅危惧IA(CR)·IB(EN)·I(CR+EN)·II(VU)
  - 일본 미등재 = 위 파일 어디에도 없는 종(어떤 범주로도). 준절멸위협(NT)·정보부족(DD)·지역개체군(LP)으로만 오른 종은 뺀다.
  - 미등재는 LC가 아니다. 평가되지 않은 종이 섞인다(한계로 적는다). 단측 Fisher 검정과 비율을 보고한다.
- **S4:** NT·DD 종의 감소 신호 비율.

## 6. 고정 사항

- 결과를 본 뒤 기간·문턱·데이터셋 검사·선정 조건·집단 구분·합격 조건을 바꾸지 않는다.
- 판정 규칙의 오류가 아니라 코드 오류(구현 검사 불일치, 예외)만 고친다. 고친 내용은 변경 기록에 적는다.
- 사이트 표시('MCUI 검증 전 시범')를 바꿀지는 팀장이 정한다. 이 기록은 결과만 낸다.

## 7. 미리 적는 한계

- IUCN 범주는 전 지구 평가다. OBIS 신호는 지도 범위(한반도 주변) 보고율이다. 위협 사유가 다른 해역의 감소이거나 기준 B(좁은 분포)·D이면 이 지역 보고율에 나타나지 않을 수 있다. GBIF API는 기준 코드를 주지 않아 기준 A 종만 따로 고를 수 없다.
- 보고율은 개체수가 아니다. 같은 강 기록은 조사 노력의 대용치일 뿐이다.
- 과거 20건 이상인 종만 계산 가능하다. 희귀한 위협 종은 빠지기 쉽다.
- OBIS 2026-10-03 조회분과 GBIF IUCN 2026-07-28판이다.
- 다중 검정: 1차 검정 하나만 합격을 정한다. 보조 분석은 서술용이다.

## 변경 기록
- (없음)
