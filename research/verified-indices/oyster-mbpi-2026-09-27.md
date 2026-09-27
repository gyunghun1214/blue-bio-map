# 참굴 *Magallana gigas* (AphiaID 836033) MBPI 재산출 (2026-09-27)

- 기준: origin/main 86a122e. 작업 브랜치 `research/oyster-mbpi-20260927`.
- 결론: 공개 화면은 바꾸지 않았다. 공개 v2.1의 참굴 MBPI는 그대로 보류다.
  - 기존 규칙에 따른 연구용 산출값은 **72.2**(참고값, 단일 논문)이다. v3의 1.1보다 크게 오른다.
  - BBVI는 여전히 보류(`mbpi_single_source`)이고 매트릭스에도 들어가지 않는다.
  - 결정(2026-09-27, 사용자 승인): A ① 연구용 유지, B 보류, C 보류. 공개 화면은 연결하지 않는다(6절).
- 산출물(연구용, 화면 미연결):
  - `config/verified-indices-v3-oyster-lqp.json`
  - `research/verified-indices/assessments-v3-oyster-lqp.json`
  - `verification/test_verified_indices.py`의 `OysterLqpResearchScenarioTests`와 참굴 탈락 규칙 테스트

## 1. 코드 요약

### a) v2.1 보류 경로

- `config/verified-indices-v2.1.json`에는 `peptide_bioactivity`가 없다. 그래서 `peptide_items()`가 빈 목록을 돌려준다(`scripts/build_verified_indices.py:341`).
- ChEMBL 저분자 층에도 참굴 사슬이 없다. 따라서 `mbpi`가 None이다.
- `:555`에서 사유 `compound_origin_assay_chain_or_fixed_cohort_missing`을 적는다.
- `:547` `partial_bio`(LSL, 2013 항암 펩타이드 행)가 있어 상태는 "일부 근거 확인"이다.
- 이 사유 코드는 모든 종에 쓰는 공통 코드다. 참굴의 실제 사유는 비교집단(AHTPDB)의 이용조건이 확인되지 않은 것이다(5절 A).
- v2.1은 `peptide_raw_values`로 AEYLCEAC와 LQP의 원값·출처만 보여준다(`used_for_score: False`, `:626`).
  - AHTPDB 출처는 `excluded_sources`로 막는다(`load_inputs`, `:700`).

### b) v3 자격 조건

- 펩타이드(`peptide_items`, `:341`–`:375`):
  - 비교집단 크기가 파일 기록과 같고 30 이상이어야 한다(`:348`).
  - 모든 행에 기원종이 있어야 한다. `material_kind`가 extract, hydrolysate, fraction이면 빌드가 멈춘다(`:350`–`:352`).
  - 점수 행(`approved_for_score`)에 필요한 것(`:356`–`:362`):
    - `reviewed`, `material_kind == single_peptide`, 표준 아미노산 서열
    - `sequence_confirmed`, `value_in_text`
    - 표적 ACE, 종말점 IC50, 기질 HHL, 관계 "=", 단위 µM
    - 등록된 출처, 원논문 DOI
  - 같은 (기원종, 서열)은 한 항목으로 묶고 pIC50 중앙값을 쓴다. DOI가 하나면 0.75, 둘 이상이면 1.0이다.
- 저분자(`_approved_assays` `:289`, `bio_scores` `:378`):
  - ChEMBL 사슬과 CID 또는 InChIKey 구조 식별자가 필요하다.
  - 한 층에 화합물이 3개 이상이어야 한다(`:392`).
  - 참굴에는 해당 행이 없다.

### c) 단일 논문 참고값과 독립값의 분리

- `:541`–`:546`에서 최고 항목의 DOI 수를 센다. `minimum_independent_mbpi_dois`(2)보다 적으면 `single_source`다.
- `single_source`면:
  - MBPI는 `scores.MBPI`에 남는다.
  - `mbpi_label` "참고값(단일 논문)"을 붙인다(`:607`).
  - BBVI는 None이다.
- `reference_combination`(v2.1 전용, `:614`–`:622`)은 `used_for_score: False`인 곁값이다. `scores.BBVI`에는 들어가지 않는다.

### d) BBVI·매트릭스 관문

- BBVI는 MFPI와 MBPI가 모두 있고 `single_source`가 아닐 때만 나온다(`:546`).
- 매트릭스는 BBVI와 MCUI가 모두 있어야 한다(`scripts/build_matrix_readiness.py:28`). 국가 평가 MCUI도 제외한다.
- 참굴은 두 관문 모두 통과하지 못한다:
  - MBPI가 단일 논문이라 BBVI가 보류된다.
  - MCUI가 국가 평가(LC)다.

### 사실과 코드의 차이

1. **합성 펩타이드 조건이 코드에 없다.**
   - `verified-pilot-3-method.md`는 "합성 펩타이드로 IC50을 쟀다"를 종 점수 조건으로 적었다.
   - 코드에는 이 조건을 담는 필드가 없다. 검토자가 `verification` 문장과 `status`로 지킨다.
   - 기존 승인 행(KNFL, AEYLCEAC, LQP)은 모두 합성 펩타이드라 결과는 같다.
   - 구현 제약으로 분류한다. 필드를 새로 넣으면 스키마가 바뀌므로 이번에는 넣지 않았다.
2. **LQP가 v3에 없다.**
   - LQP는 v3 조건을 모두 충족한다(3절).
   - 하지만 v2.1 전용 보충 파일(`peptide-raw-values-2.1.json`)에만 넣었다. 그래서 v3 연구 출력은 AEYLCEAC 하나로 1.1이다.
   - 데이터가 부족한 것이 아니라 파일이 분리된 구현 제약이다.
   - `evidence-v3.json`에 넣으면 v2.1 원값 표에 LQP가 두 번 들어가고 출처 중복으로 빌드가 멈춘다. 그래서 별도 연구 설정의 `peptide_supplements`로 넣었다(4절).
3. 나머지 사실(v2.1 보류 코드, v3 1.1, 352개 비교집단과 해시, 최소 30, BBVI 규칙)은 코드와 일치한다.
   - 비교집단은 `build_peptide_cohort.py --check`로 해시 일치를 확인했다.

## 2. 출처 조사

- 검색어: *Magallana gigas*, *Crassostrea gigas*, 참굴, oyster.
- 검색처: Europe PMC(검색·전문 XML·인용), Crossref, KoreaScience, Springer 초록 쪽.
- 로그인, 결제, 무단 공유 사이트는 쓰지 않았다.
- 종명은 WoRMS REST(AphiaRecordsByName)로 확인했다.
  - *C. talienwhanensis*(539093)는 *M. gigas*의 junior subjective synonym이다.
  - *C. rivularis*는 *M. rivularis*(836040), *Pinctada fucata martensii*는 *P. fucata*(397170)다.
- 확인일은 모두 2026-09-27이다. PubChem은 이번에 쓰지 않았다. 서열만 필요했고 구조 식별자가 필요한 저분자 행이 없었다.

### 판정표

| # | 출처 | 펩타이드 · 값 | 판정 | 근거 |
|---|---|---|---|---|
| 1 | Chen et al. 2022 *Front Nutr* 9:981163, DOI 10.3389/fnut.2022.981163 (PMC9445672, CC BY 4.0) | AEYLCEAC 4.287 mM | **승인** (v3 기존) | 전문 확인. 5절 표 참조 |
| 2 | Do et al. 2012 *J Life Sci* 22(2):220, DOI 10.5352/JLS.2012.22.2.220 (KoreaScience JAKO201209640672935, 출판사 저작권) | LQP 1.18 µM | **승인** (v3 조건 충족, v2.1은 원값만) | 전문 확인. 5절 표 참조 |
| 3 | Feng et al. 2022 *Food Chem* 379:132160, DOI 10.1016/j.foodchem.2022.132160 | LSL 107.17 nM | **접근 실패** (유료) | Crossref·Europe PMC 비공개. 초록은 도킹과 in vitro 시험만 적고 기질을 적지 않았다 |
| 4 | Shiozaki et al. 2010 *Fish Sci* 76:865, DOI 10.1007/s12562-010-0264-0 | DLTDY (AHTPDB 143 µM) | **접근 실패** (유료) | 초록: *C. gigas* 가로무늬근 트립신 분해물에서 동정했다. IC50, 기질, 합성 여부는 초록에 없다 |
| 5 | Wang et al. 2008 *Food Chem* 111:302, DOI 10.1016/j.foodchem.2008.03.059 | VVYPWTQRF 66 µM | **접근 실패** (유료) | 초록: *C. talienwhanensis*(WoRMS상 *M. gigas*)의 펩신 분해물에서 **정제한 천연 펩타이드**로 측정했다. 합성 여부와 기질은 원문이 필요하다. 초록대로라면 합성 조건을 충족하지 못한다 |
| 6 | Je et al. 2005 *Food Chem* 90:809, DOI 10.1016/j.foodchem.2004.05.028 | 굴 소스(발효) 억제물질 | **접근 실패** (유료) | 초록 비공개. AHTPDB에 해당 행이 없다 |
| 7 | Xie et al. 2014 *BioMed Res Int* 2014:379234, DOI 10.1155/2014/379234 (PMC4130196, CC BY 3.0) | TAY 16.7, VK 29.0, KY 51.5, FYN 68.2, YA 93.9 µM | **탈락**: 종 미기재 | 전문 확인. 합성(GL Biochem, >95%), HHL, Table 1 숫자는 있다. 그러나 재료가 "통영 시장에서 산 굴"뿐이고 학명이 없다(본문의 *C. gigas*는 참고문헌 제목뿐). 통영 양식 굴이 대부분 참굴이라는 추정으로 채우지 않았다. MTGase 가교 단백질이라는 점도 적는다 |
| 8 | Chen et al. 2019 *Food Funct* 10:5426, DOI 10.1039/c9fo01433k | (1의 서열 목록 출처) | **탈락**: 항혈전 연구 | *C. gigas* 소화물의 UPLC-Q-TOF 서열 목록이다. ACE 값이 없다. 1의 서열 확인 근거로만 쓴다 |
| 9 | Zhuang et al. 2025 *Molecules* 30:4818, DOI 10.3390/molecules30244818 (PMC12735907, CC BY 4.0) | SeMFRTSSK, QASeMNEATGGK | **탈락**: 종 미기재, 비표준 잔기 | 재료가 "Maowei Sea 굴"이고 학명이 없다. 셀레노메티오닌이 들어 있어 표준 서열이 아니다. 펩타이드 IC50은 본문에서 찾지 못했다 |
| 10 | 2020 *Food Sci Biotechnol*, DOI 10.1007/s10068-020-00736-4 | 소화액 IC50 6.77·3.34 µg/mL | **탈락**: 혼합물 | 단일 펩타이드 값이 없다 |
| 11 | 2023 *Molecules* 28:651, DOI 10.3390/molecules28020651 | in silico | **탈락**: in silico | 굴 재료에서 방출을 관찰하지 않았다 |
| 12 | *Pinctada fucata martensii*(HLHT, GWA), *C. rivularis* 등 | – | **탈락**: 다른 종 | 참굴이 아니다 |
| 13 | AHTPDB `pepic50.txt` 굴 행 | VVYPWTQRF(1047·2923·2739·2826·3713), DLTDY(6100) | 비교집단 구성원 확인만 | 원논문은 4·5번이다. 2826·3713은 단위가 "µM/ml"라 비교집단에서 빠졌다 |
| 14 | BIOPEP-UWM | – | **검색 미완** | 조회가 화면 양식 방식이라 스크립트 조회가 되지 않았다. 이용조건도 확인하지 않았다 |
| 15 | 1의 인용 논문 13편 (Europe PMC) | – | 굴 관련은 9번뿐 | 나머지는 총설이거나 다른 재료 |
| 16 | Antioxidants 2026, DOI 10.3390/antiox15080992 (*M. gigas* KSVSPKFLTG) | ACE2 활성화 | 후보 목록만 | ACE 억제(HHL)가 아니다 |

### 유료 논문에서 필요한 부분

- 3 Feng 2022: 방법의 ACE 시험 절(효소 출처, 기질과 농도, 검출법), IC50 표(6개 펩타이드, 합성 여부, 순도, 오차).
- 4 Shiozaki 2010: DLTDY 합성 여부, ACE 시험 절, IC50 값이 있는 표나 본문 쪽.
- 5 Wang 2008: 펩타이드 합성 여부, ACE 시험 절(HHL 여부), IC50 66 µM이 있는 본문이나 표, 종 동정 근거.
- 6 Je 2005: 억제물질 서열, 시험 절, IC50 표.

## 3. 승인 원문 세부 (전문 확인)

| 항목 | AEYLCEAC (Chen 2022) | LQP (Do 2012) |
|---|---|---|
| 종 | *Crassostrea gigas* | 참굴(*Crassostrea gigas*), 통영 양식, IQF 냉동 1~2년 |
| 조직·가수분해 | 전체 육, 모의 위장관 소화(위 2 h, 장 3 h) | 전체 육, Protamex 가수분해(PEH), 10 kDa 한외여과 |
| 정제 | 소화물의 UPLC-Q-TOF 서열(선행 연구 Chen 2019)과 도킹으로 후보 선정 | RP-HPLC 33분획 중 B분획(억제율 85.85%, Table 3) |
| 서열 동정 | UPLC-Q-TOF-MS/MS | Edman(ABI492, SIS 서울) |
| 합성 | Chinapeptides, HPLC 순도 >95% | ㈜코스모진텍, 순도 미기재 |
| ACE 출처 | 토끼 폐(Sigma), 0.1 U/mL | Sigma A6778, 60 mU/mL |
| 기질 | HHL 5 mM | HHL 5 mM |
| 검출 | 마뇨산 HPLC | 마뇨산 HPLC 228 nm |
| 조건 | 37 °C 60 min, borate pH 7.3 | 37 °C 30 min, borate pH 8.3, NaCl 300 mM |
| IC50 | 4.287 mM(초록), 4.29 mM(결과). 오차 없음 | 1.18 µM(결과 p.224, 초록). 오차·n 없음 |
| 양성대조 | 시험관 IC50 없음(캡토프릴은 동물실험만) | Val-Tyr를 양성대조로 썼으나 IC50은 없음 |
| 라이선스 | CC BY 4.0 | 출판사 저작권, 서지와 숫자만 인용 |

- AEYLCEAC 단위 점검: Figure 2A 회귀식을 풀면 약 3.82 mg/mL다. 분자량 약 901 Da로 환산하면 약 4.24 mM이다. 본문 4.29 mM과 같은 크기라 mM 단위가 맞다.
- LQP의 순도와 오차는 현재 규칙의 조건이 아니다. 한계로만 적는다.

## 4. 계산 (연구용)

- 비교집단: `ahtpdb-ace-ic50-hhl-cushman-cheung`, 352개, sha256 `c10deee6…5178e0`.
  - 원파일 해시 일치와 `build_peptide_cohort.py --check` 통과를 확인했다.
  - 논문 안 비교집단이나 굴 전용 비교집단은 쓰지 않았다.
- 식:
  - pIC50 = 6 − log10(µM)
  - 백분위 = 100 × (낮은 수 + 0.5 × 같은 수) / 352
  - 조정값 = 백분위 × DOI 계수
  - 종 값 = 최댓값

| 펩타이드 | 원값 | µM | pIC50 | 백분위 | DOI 계수 | 조정값 |
|---|---|---|---|---|---|---|
| AEYLCEAC | 4.287 mM | 4287 | 2.368 | 1.42 | 0.75 (1편) | 1.07 |
| LQP | 1.18 µM | 1.18 | 5.928 | 96.31 | 0.75 (1편) | **72.23** |

- 최댓값 **72.2**. 민감도: 중앙값 36.6, 평균 36.6, 집계 방식에 따른 범위 1.1~72.2.
- 이전 값과 새 값:
  - 공개 v2.1: 보류 → 보류(변경 없음).
  - v3 연구 출력: 1.1 → 연구 시나리오 72.2.
  - 바뀐 이유: 기존 규칙을 충족하는 LQP 행을 v3 층에 넣었다. 기준은 하나도 바꾸지 않았다.
- **자기 비교**:
  - 비교집단에 LQP 구성원이 있다(AHTPDB 1277 외 6행, 중앙값 2.0 µM). 출처는 곡물, 제인, 치즈이고 굴이 아니다.
  - 참굴 LQP 측정값 자체는 비교집단에 없다.
  - 고정 비교집단은 그대로 두었다. 참굴을 위해 구성원을 빼면 참굴 전용 예외가 된다.
  - 민감도로 그 구성원을 빼면 351개 중 96.30이고 조정값은 72.2로 같다.
  - AHTPDB의 굴 유래 구성원(VVYPWTQRF 66 µM, DLTDY 143 µM)은 승인 행이 아니다. 따라서 자기 비교가 일어나지 않는다.
- **독립 재현**: AEYLCEAC와 LQP는 서로 다른 펩타이드이고 서로 다른 논문이다. 재현이 아니므로 BBVI는 보류다.
  - 한 논문 안의 반복 측정이나 같은 연구진의 다른 논문도 독립으로 세지 않는다.
- 29종 영향: 연구 출력과 v3를 method_version만 빼고 비교하면 참굴 한 종만 다르다(테스트로 고정).
  - 공개 `dist/assessments.json`과 `dist/matrix-readiness.json`은 바이트 단위로 그대로다(`--check`).

## 5. 부족한 것: 데이터 부족과 구현 제약

- 데이터 부족(원문이 없거나 조건 미충족):
  - LSL, DLTDY, VVYPWTQRF, Je 2005는 유료라 원문 조건을 확인하지 못했다(2절 목록).
  - 독립 재현이 없다. 같은 펩타이드를 다른 연구진이 다시 잰 논문을 찾지 못했다. 이것 때문에 BBVI가 보류된다.
  - Xie 2014는 원문에 종 학명이 없다.
- 구현 제약(데이터는 있으나 연결 방식 때문에 빠짐):
  - LQP가 v2.1 전용 파일에만 있었다. 연구 설정 `peptide_supplements`로 해소했고 공개 정의는 바꾸지 않았다.
  - 합성 여부 필드가 없다(1절 차이 1).
  - v2.1의 보류 사유 코드가 이용조건 보류와 사슬 결측을 구분하지 않는다.
- 이번에 바꾸지 않은 것:
  - 최소 비교집단 크기 30, DOI 계수 0.75/1.0, HHL 기질 조건.
  - 참굴 전용 예외는 넣지 않았다. 코드 변경은 연구 설정이 읽는 `peptide_supplements` 키 하나뿐이다. 이 키가 없는 v2.1·v3 설정의 출력은 그대로다.

## 6. 결정 지점

- **결정 (2026-09-27, 사용자가 권고안 승인)**:
  - A: **① 연구용 유지.** AHTPDB 백분위와 72.2는 공개하지 않는다. 공개 화면은 지금처럼 원값·출처만 보인다.
  - B: **보류.** 공개 MBPI 정의는 v2.1 그대로다.
  - C: **보류.** A가 바뀌기 전에는 72.2를 공개하지 않으므로 확인할 대상이 없다.
- 다시 열 조건:
  - AHTPDB가 재배포와 인용 조건을 답하면 A를 다시 판단한다. 문의 초안 `ahtpdb-permission-draft.md`는 사용자가 보낸다.
  - 또는 ③(재배포 가능한 원논문 30편 이상의 대체 비교집단)을 따로 승인받는다.
  - 그때 C를 다시 확인한다. LQP의 한계(순도·오차·n 없음)는 아래에 있다.
- 유료 논문 4편(2절)을 도서관 경로로 구하면 판정을 다시 한다. 결과가 바뀌어도 공개는 A를 따른다.

### A. AHTPDB 백분위를 공개 화면에 쓰는가

| 선택 | 장점 | 단점 |
|---|---|---|
| ① 연구용 유지, 원값만 공개 (현재) | 이용조건 위험이 없다. 지금 화면과 같다 | 참굴 MBPI는 계속 보류다 |
| ② CC BY-NC 4.0으로 보고 출처 표시 후 공개 | 바로 72.2를 쓸 수 있다 | README(CC BY-NC)와 LICENSE(MIT)가 어긋난다. 비영리 조건이 대회·배포 목적과 맞는지 확인되지 않았다 |
| ③ 재배포 가능한 원논문으로 30개 이상 대체 비교집단 구축 | 이용조건에서 독립적이다 | 같은 조건(HHL, 합성, 본문 숫자)의 공개 원문 30편 이상을 새로 검토해야 한다. 비교집단이 바뀌면 참굴·미역 값이 모두 다시 계산된다 |

- 권고: **①**. AHTPDB 답을 받을 때까지 유지한다. 문의 초안(`ahtpdb-permission-draft.md`)은 아직 보내지 않았다.

### B. 공개 MBPI 정의를 v2.1에서 v3 펩타이드 층으로 바꾸는가

- A가 ②나 ③일 때만 의미가 있다. 권고: A가 정해질 때까지 보류.

### C. 참굴 MBPI 큰 변화(1.1 → 72.2) 확인

- 변화 원인은 LQP 한 행이다. LQP의 한계:
  - 합성 순도, 오차, n이 없다.
  - 논문 한 편의 값이다.
  - 비교집단에 같은 서열 구성원이 있다(민감도 영향 없음).
- 공개하면 화면에는 "72.2 · 참고값(단일 논문)"으로 나가고 BBVI는 보류다.
