# 사전 등록: 의약 후보 MBPI(MBPI-Rx) 보조 지표 (verified-4.10 후보, 2026-10-12)

**이 문서는 MBPI-Rx를 계산하는 코드보다 먼저, 이 파일 하나만 커밋한다.** 기본 지표(MBPI·BBVI·MCUI·MFPI)의 값, 가중치, 기준값 50, 매트릭스 유형, 근거 계수는 바꾸지 않는다. 결과를 보고 이 문서를 고치지 않는다. 고칠 이유가 생기면 날짜와 함께 덧붙이고 다시 계산한다.

## 0. 왜 하는가, 그리고 이미 본 것 (숨기지 않는다)

MBPI는 층(stratum)마다 따로 매긴 백분위에 근거 계수를 곱한 값의 최댓값이다. 층마다 비교집단이 다르니 층끼리의 백분위는 같은 척도가 아니다. 그런데 종의 MBPI 하나로 모이면 한 0–100 척도로 읽힌다.

- 30종 중 15종(감태 포함)의 MBPI 1위 항목이 ACE 저해 시험이다. 그중 14종은 AHTPDB 항고혈압 펩타이드 352개 안의 순위다(`ahtpdb-ace-ic50-hhl-cushman-cheung`).
- MBPI 사후검증(3.27, `posthoc-validation-3.27-2026-10-03.json`)은 **기준 미충족(failed)**이다. 약물 기원종 3종 중 2종이 계산됐고, *Halichondria okadai* 73.8과 *Ecteinascidia turbinata* 56.1이 운영 종 참굴 96.3·미역 95.3보다 낮았다. 두 운영 종의 1위 항목은 모두 ACE 펩타이드 층이다.
- 공개 기록이 적은 주원인은 **근거 계수**다(연결 논문·활성 문서가 1편이면 0.75; 계수 전 백분위 99.75·98.34는 참굴 96.31보다 높다). 이번에 보는 것은 다른 원인 후보인 **층 구조**다. 식품 기능성 펩타이드 모음 안의 상위 백분위가 의약 후보 척도와 같은 자리에서 비교된다는 가설이다.

이 문서를 쓰기 전에 다음을 이미 알고 있었다.

1. **이 규칙은 기존 사후검증 실패를 본 뒤에 제안했다.** 그래서 새 사후검증 결과는 "확증"이 아니라 **"탐색적 재검토"**다.
2. **등록 시점에 공개 데이터로 결과를 미리 계산할 수 있었고, 실제로 계산했다.** 공개본 `verified-4.9`의 `dist/assessments.json`과 사례 스냅숏(`posthoc-3.27/mbpi-drug-origin/`)에서 계산한 값을 5절에 그대로 싣는다. 계산해서 예상과 다르면 다른 대로 공개한다.
3. 예상 결과는 **기준 미충족(failed)**이다(5.2절). 예상값이 마음에 들지 않아도 기준, 근거 계수, 운영 종 정의, 제외 층 목록을 바꾸지 않는다.

## 1. 바뀌지 않는 것

- 기본 MBPI·BBVI·MCUI·MFPI 값, BBVI 식량 가중치, 기준값 50, 매트릭스 유형, 근거 계수(1편 0.75 · 2편 이상 1.0), 층 내부 백분위 방식, 하한값 규칙(4.3)은 그대로다.
- MBPI 사후검증의 사례 3종, 사례 스냅숏, 운영 종 정의, 판정 기준 문장과 그 해석은 그대로다(4절).
- MBPI-Rx는 BBVI, 매트릭스, 활용 특성 칩, 지도, 바다 탐험, 미탐색 후보, 프로필·비교 대화상자 어디에도 들어가지 않는다. 종 상세의 보조 줄과 '비교와 지표'의 데이터 표 한 열, '근거와 방법' 한 줄에만 보인다.

## 2. 정의

- **MBPI-Rx = 기존 MBPI 규칙 그대로에서 제외 층(3절)의 항목만 뺀 값.** 항목은 공개본 `bioactivity_trace`의 항목 그대로이고, 항목의 `adjusted`(층 내부 백분위 × 근거 계수)를 다시 계산하지 않는다. 종의 값은 남은 항목의 `adjusted` 최댓값을 기존 반올림(`round1`)으로 적은 것이다. 새 항목, 새 비교집단, 새 계수는 없다.
- **하한값 규칙(`mbpi_floor`, 0점)은 MBPI-Rx에 적용하지 않는다.** 이 점이 기본 MBPI와 다르다. 남는 항목이 없으면 값은 `null`이고 사유를 적는다.
  - 제외 층 항목만 있던 종: "제외 층(ACE·잔틴 산화효소 펩타이드) 밖의 항목이 없습니다"
  - 항목이 하나도 없는 종: "MBPI 항목이 없습니다" (2026-10-12 현재 30종 모두 항목이 있어 해당 종 없음)
  - 결측을 0으로 채우거나 다른 종의 값을 옮기지 않는다.
- 종마다 `mbpi_rx` = `{value, stratum_kind, stratum_id, top_item, excluded_item_count, reason}`. `top_item`은 쓴 항목의 식별자(`record_ids` 또는 `compound_id`), `adjusted`, `percentile`, `evidence_factor`와 그 항목의 `bioactivity_trace` 위치다. 설정에 `mbpi_rx` 키가 없는 옛 설정으로 빌드하면 이 키는 출력에 없다.

## 3. 층 분류

### 3.1 기준 (층의 성격으로만 판단한다)

> **그 층의 비교집단이 식품 단백질(가수분해·발효 포함) 유래 기능성 펩타이드를 모은 DB 또는 문헌 집합인가.**
> 그렇다 → 제외. 아니다 → 포함.

- 판단 근거는 비교집단 파일·출처 기록과 출처 논문 초록이다. 종의 점수, 표적의 성격(예: ACE 저해라는 사실)은 보지 않는다.

### 3.2 제외하는 층 2개

1. **`ahtpdb-ace-ic50-hhl-cushman-cheung`** (kind `peptide`, 비교집단 352개)
   - 비교집단 출처는 AHTPDB다(Kumar R 외 2015 *Nucleic Acids Res* 43:D956–D962, [doi:10.1093/nar/gku1141](https://doi.org/10.1093/nar/gku1141)). PubMed(PMID 25392419)에 실린 초록은 "These peptides were derived from 35 major sources that include milk, egg, fish, pork, chicken, soybean, etc."라고 쓴다.
   - 비교집단 파일(`peptide-cohort-ahtpdb-ace-hhl.json`)에는 **회원별 출처가 기록돼 있지 않다.** 그래서 "352개 모두 식품 가수분해물 유래"라고 쓰지 않고 "식품 단백질 유래가 주를 이루는 항고혈압 펩타이드 DB"로 분류한다.
2. **`xo-peptide-literature-2026-10-05`** (kind `xo`, 비교집단 46개)
   - PubMed 검색식 네 개로 모은 문헌 집합이고, 그중 하나가 `(peptide*|hydrolysate*)`를 쓴다(`xo-cohort-4.3-2026-10-05.json`의 `search`).
   - 회원 46개의 기록(`rows[].material`)을 읽은 결과:
     - 32개는 그 회원 기록이나 같은 논문의 다른 회원 기록에 식품 단백질 출처 또는 가수분해물이 적혀 있다(회원 기록 자체에 적힌 것은 25개). 출처는 참치·호두박·흰다리새우·꽃게·참깨 11S 글로불린·유청 단백질·남극 크릴·쌀 단백질 잔사·달걀흰자·해바라기·고등어·미역·*S. japonicus* 단백질 등이다.
     - 3개는 식품 밖이다: 고초균 단백체에서 기계학습으로 고른 ECFK·FECK, 깃털 케라틴 발효액에서 정제한 GNQQVHLQSQDM.
     - 11개는 기록에 출처가 없다. 모두 식품·영양 학술지(*Foods*, *Food Chem*, *Nutrients*, *Food Sci Nutr*, *Food Res Int*) 논문의 합성 펩타이드다.
   - 식품 단백질에서 찾은 서열이 다수인 문헌 집합이므로 제외한다.

### 3.3 포함하는 층

- **`wijesinghe-2011-cell-free-ACE-IC50`**(stratum_kind 없음, 종의 `mbpi_stratum` `small_molecule`): 비교집단이 펩타이드 모음이 아니라 감태 논문 1편(Wijesinghe 2011)의 분리 화합물(플로로탄닌) 5개다. 기준대로면 **포함**이다. 그 결과 **감태 MBPI-Rx는 ACE 항목(dieckol) 그대로 67.5**로 남는다. 표적이 ACE라는 이유로 빼지 않는다.
- **`chembl`**: 비교집단이 같은 표적·같은 종말점의 ChEMBL 활성 기록 전체다. 식품 기능성 펩타이드 모음이 아니다.
- **`relaxed`**(완화 산출 d): 펩타이드를 같은 표적·같은 종말점의 ChEMBL 비교집단에서 순위 매긴다. 비교집단은 ChEMBL 활성 기록이다.
- **`amp`**: DBAASP의 균종별 MIC 모음(항균 펩타이드 DB)이다. 식품 단백질 유래 모음이 아니다.
- **`anticancer`**: CancerPPD 2.0의 세포주별 IC50 모음(항암 펩타이드 DB)이다. 식품 단백질 유래 모음이 아니다.

### 3.4 분류표

공개본 `verified-4.9`의 `bioactivity_trace`에 나오는 stratum_id **33개 전부**, 설정이 읽는 비교집단 파일에 정의돼 있지만 항목이 없는 층 **16개**, MBPI 사후검증 사례 항목의 층 **3개**를 한 줄씩 적는다. 이 52개가 설정의 `mbpi_rx.classified_strata`가 된다.

**(가) 공개본 trace의 층 33개**

| # | stratum_id | kind | 비교집단 출처 | 분류 | 이유 | 항목이 있는 종 |
|---|---|---|---|---|---|---|
| 1 | `ahtpdb-ace-ic50-hhl-cushman-cheung` | peptide | AHTPDB ACE IC50(HHL, Cushman–Cheung) 352개 | **제외** | 3.2-1 | 가리맛조개·가시파래·고등어·넙치·대구·멸치·미역·바지락·살오징어·전복·참굴·큰가리비·톳·해삼 |
| 2 | `xo-peptide-literature-2026-10-05` | xo | PubMed 문헌 비교집단 46개 | **제외** | 3.2-2 | 참조기 |
| 3 | `wijesinghe-2011-cell-free-ACE-IC50` | (없음) | 감태 논문 1편의 분리 화합물 5개 | 포함 | 3.3, 펩타이드 모음 아님 | 감태 |
| 4 | `ChEMBL_37:CHEMBL247\|IC50` | chembl | ChEMBL HIV-1 역전사효소 IC50 7,735건 | 포함 | ChEMBL 활성 기록 | 멍게·참굴·홍합 |
| 5 | `ChEMBL_37:CHEMBL247\|EC50` | chembl | ChEMBL HIV-1 역전사효소 EC50 1,274건 | 포함 | 같음 | 감태 |
| 6 | `ChEMBL_37:CHEMBL378\|IC50` | chembl | ChEMBL HIV-1(생물체) IC50 10,781건 | 포함 | 같음 | 시카메굴·우뭇가사리 |
| 7 | `ChEMBL_37:CHEMBL378\|EC50` | chembl | ChEMBL HIV-1(생물체) EC50 31,563건 | 포함 | 같음 | 감태 |
| 8 | `ChEMBL_37:CHEMBL612851\|IC50` | chembl | ChEMBL *Trypanosoma brucei brucei* IC50 4,525건 | 포함 | 같음 | 다시마·톳 |
| 9 | `ChEMBL_37:CHEMBL2808\|EC50` | chembl | ChEMBL LXR-α EC50 776건 | 포함 | 같음 | 톳 |
| 10 | `ChEMBL_37:CHEMBL613966\|EC50` | chembl | ChEMBL 뎅기 바이러스 2형 EC50 1,294건 | 포함 | 같음 | 참굴 |
| 11 | `ChEMBL_37:CHEMBL5980\|EC50` | chembl | ChEMBL 뎅기 2형 유전체 다단백질 EC50 136건 | 포함 | 같음 | 참굴 |
| 12 | `ChEMBL_37:CHEMBL5118\|IC50` | chembl | ChEMBL SARS-CoV 복제효소 1ab IC50 200건 | 포함 | 같음 | 감태 |
| 13 | `ChEMBL_37:CHEMBL5118\|Ki` | chembl | ChEMBL SARS-CoV 복제효소 1ab Ki 35건 | 포함 | 같음 | 감태 |
| 14 | `ChEMBL_37:CHEMBL1914\|IC50` | chembl | ChEMBL 사람 콜린에스테라아제 IC50 3,866건 | 포함 | 같음 | 감태 |
| 15 | `ChEMBL_37:CHEMBL4822\|IC50` | chembl | ChEMBL BACE1 IC50 10,649건 | 포함 | 같음 | 감태 |
| 16 | `ChEMBL_37:CHEMBL5763\|IC50` | chembl | ChEMBL 말 콜린에스테라아제 IC50 4,944건 | 포함 | 같음 | 괭생이모자반 |
| 17 | `ChEMBL_37:CHEMBL2392\|Potency` | chembl | ChEMBL DNA 중합효소 β Potency 23,070건 | 포함 | 같음 | 꼬시래기 |
| 18 | `ChEMBL_37:CHEMBL4303835\|IC50` | chembl | ChEMBL SARS-CoV-2 IC50 926건 | 포함 | 같음 | 청각 |
| 19 | `amp-dbaasp-mic-broth-staphylococcus-aureus` | amp | DBAASP *S. aureus* 액체배지 MIC 6,208개 | 포함 | 항균 펩타이드 DB | 꽃게·조피볼락·참굴·피조개 |
| 20 | `amp-dbaasp-mic-broth-escherichia-coli` | amp | DBAASP *E. coli* MIC 7,198개 | 포함 | 같음 | 꽃게·피조개 |
| 21 | `amp-dbaasp-mic-broth-bacillus-subtilis` | amp | DBAASP *B. subtilis* MIC 2,156개 | 포함 | 같음 | 피조개 |
| 22 | `amp-dbaasp-mic-broth-pseudomonas-aeruginosa` | amp | DBAASP *P. aeruginosa* MIC 4,433개 | 포함 | 같음 | 피조개 |
| 23 | `amp-dbaasp-mic-broth-streptococcus-agalactiae` | amp | DBAASP *S. agalactiae* MIC 97개 | 포함 | 같음 | 조피볼락 |
| 24 | `amp-dbaasp-mic-broth-vibrio-anguillarum` | amp | DBAASP *V. anguillarum* MIC 73개 | 포함 | 같음 | 조피볼락 |
| 25 | `amp-dbaasp-mic-broth-vibrio-parahaemolyticus` | amp | DBAASP *V. parahaemolyticus* MIC 132개 | 포함 | 같음 | 조피볼락 |
| 26 | `anticancer-cancerppd-ic50-a-549` | anticancer | CancerPPD 2.0 A-549 IC50 134개 | 포함 | 항암 펩타이드 DB | 가시파래 |
| 27 | `anticancer-cancerppd-ic50-hepg-2` | anticancer | CancerPPD 2.0 HepG-2 IC50 109개 | 포함 | 같음 | 가시파래 |
| 28 | `anticancer-cancerppd-ic50-hct-116` | anticancer | CancerPPD 2.0 HCT-116 IC50 58개 | 포함 | 같음 | 피조개 |
| 29 | `anticancer-cancerppd-ic50-ht-29` | anticancer | CancerPPD 2.0 HT-29 IC50 51개 | 포함 | 같음 | 피조개 |
| 30 | `anticancer-cancerppd-ic50-pc-3` | anticancer | CancerPPD 2.0 PC-3 IC50 92개 | 포함 | 같음 | 가리맛조개 |
| 31 | `ChEMBL_37:CHEMBL1855\|IC50` | relaxed | ChEMBL 사람 GnRH 수용체 IC50 1,844건 | 포함 | ChEMBL 활성 기록 | 방어 |
| 32 | `ChEMBL_37:CHEMBL1921\|EC50` | relaxed | ChEMBL 사람 바소프레신 V1b 수용체 EC50 251건 | 포함 | 같음 | 참문어 |
| 33 | `ChEMBL_37:CHEMBL5952\|Ki` | relaxed | ChEMBL 사람 NPFF2 수용체 Ki 138건 | 포함 | 같음 | 갑오징어 |

AMP·항암 비교집단 크기는 비교집단 파일의 회원 수다(항목마다 자기 자신을 뺀 수가 `peer_peptides`로 실린다).

**(나) 비교집단 파일에 정의돼 있지만 항목이 없는 층 16개** (모두 포함, 이유는 같은 kind의 위 줄과 같다)

| # | stratum_id | kind | 비교집단 |
|---|---|---|---|
| 34 | `anticancer-cancerppd-ic50-ccrf-cem` | anticancer | CancerPPD 2.0 CCRF-CEM IC50 34개 |
| 35 | `anticancer-cancerppd-ic50-h-157` | anticancer | CancerPPD 2.0 H-157 IC50 36개 |
| 36 | `anticancer-cancerppd-ic50-h-838` | anticancer | CancerPPD 2.0 H-838 IC50 35개 |
| 37 | `anticancer-cancerppd-ic50-hela` | anticancer | CancerPPD 2.0 HeLa IC50 128개 |
| 38 | `anticancer-cancerppd-ic50-hmler` | anticancer | CancerPPD 2.0 HMLER IC50 39개 |
| 39 | `anticancer-cancerppd-ic50-hmler-shecad` | anticancer | CancerPPD 2.0 HMLER-shEcad IC50 39개 |
| 40 | `anticancer-cancerppd-ic50-jurkat` | anticancer | CancerPPD 2.0 Jurkat IC50 61개 |
| 41 | `anticancer-cancerppd-ic50-k-562` | anticancer | CancerPPD 2.0 K-562 IC50 52개 |
| 42 | `anticancer-cancerppd-ic50-mcf-7` | anticancer | CancerPPD 2.0 MCF-7 IC50 182개 |
| 43 | `anticancer-cancerppd-ic50-mda-mb-231` | anticancer | CancerPPD 2.0 MDA-MB-231 IC50 74개 |
| 44 | `anticancer-cancerppd-ic50-sw` | anticancer | CancerPPD 2.0 SW IC50 30개 |
| 45 | `anticancer-cancerppd-ic50-u-251-mg` | anticancer | CancerPPD 2.0 U-251-MG IC50 46개 |
| 46 | `anticancer-cancerppd-ic50-u-2-os` | anticancer | CancerPPD 2.0 U-2 OS IC50 41개 |
| 47 | `ChEMBL_37:CHEMBL1790\|EC50` | relaxed | ChEMBL 사람 바소프레신 V2 수용체 EC50 297건 |
| 48 | `ChEMBL_37:CHEMBL5952\|EC50` | relaxed | ChEMBL 사람 NPFF2 수용체 EC50 120건 |
| 49 | `ChEMBL_37:CHEMBL3309\|IC50` | relaxed | ChEMBL 쥐 NPY Y2 수용체 IC50 52건 |

항암 13개는 `anticancer-cohorts-cancerppd-2026-10-02.json`, 완화 3개는 `snapshots/relaxed-chembl-cohorts-4.5-2026-10-05.json`에 있다.

AMP 비교집단 파일(`amp-cohorts-dbaasp-3.19-2026-10-02.json`)의 7개는 모두 (가)에 있다. ACE 펩타이드·잔틴 산화효소 층은 비교집단이 하나씩이다.

**(다) MBPI 사후검증 사례 항목의 층 3개** (모두 포함, ChEMBL 활성 기록)

| # | stratum_id | 비교집단 | 사례 종 |
|---|---|---|---|
| 50 | `ChEMBL_37:CHEMBL335\|IC50` | ChEMBL 사람 PTP1B IC50 3,497건 | *Halichondria okadai* |
| 51 | `ChEMBL_37:CHEMBL395\|IC50` | ChEMBL HepG2 세포주 IC50 17,904건 | *Halichondria okadai* |
| 52 | `ChEMBL_37:CHEMBL398\|IC50` | ChEMBL KB 세포주 IC50 5,343건 | *Ecteinascidia turbinata* |

### 3.5 이후 새 층

- 분류표에 없는 stratum_id가 공개본 trace나 사후검증 사례 항목에 나오면 **build와 사후검증 스크립트가 멈춘다.** 새 층은 새 사전 등록으로 분류한다.
- ChEMBL 스냅숏의 다른 표적×종말점 비교집단(항목 없음)은 한 줄씩 적지 않는다. 3.1 기준으로는 포함이겠지만 자동으로 포함하지 않는다. 항목이 생기면 위 규칙대로 멈추고 새 사전 등록에서 분류한다.
- 제외 층 목록(3.2)은 이 커밋 뒤에 고정한다.

## 4. 판정 기준과 결정 규칙

- **기준 문장은 기존 그대로다:** "Origin species of a marine-derived drug at or beyond clinical stage should rank above operating candidates."
- **해석도 기존과 같다:** 계산된 사례 종이 모두, **MBPI-Rx 값이 있는 운영 종(시범 8종) 모두보다 높아야** 통과(`passed`)다. 하나라도 그렇지 않으면 기준 미충족(`failed`)이다. 계산된 사례가 없으면 `not_computable`이다.
  - MBPI-Rx가 `null`인 운영 종은 비교에서 빠진다.
  - 운영 종은 `scripts/posthoc_validation.py`의 `mbpi_check`가 쓰는 `report["species"]`(시범 8종: 미역·해삼·멍게·살오징어·우뭇가사리·톳·홍합·참굴)다. 후보 22종은 들어가지 않는다.
- **사례 값:** 같은 사례 스냅숏, 같은 ChEMBL 규칙(`mbpi_check`와 같은 계산)에 같은 제외를 적용한다. 사례 항목은 모두 ChEMBL 층(3.4 다)이라 사례 값은 기본 MBPI와 같다.
- 근거 계수, 백분위 방식, 사례 3종, 운영 종 정의, 기준, 제외 층 목록은 결과를 본 뒤 바꾸지 않는다.
- **결과와 상관없이 MBPI-Rx는 보조 지표('의약 후보 MBPI(보조, 탐색적)')로만 공개한다.**
  - 통과하더라도 기본 MBPI·BBVI 라벨('사후 검증 기준 미충족')은 바뀌지 않는다. 화면의 '방법 검증 통과' 판정에도 이 결과를 쓰지 않는다(`exploratory: true`).
  - 기본 MBPI·BBVI·MCUI·MFPI·매트릭스 유형·기준값 50은 이번 버전에서 바꾸지 않는다.
  - 기본값을 MBPI-Rx로 바꿀지는 팀장 결정 사항으로 남긴다.

## 5. 이미 예상되는 결과 (공개 데이터로 미리 계산했다)

### 5.1 운영 8종

| 종 | MBPI | MBPI-Rx | Rx 1위 항목 | 뺀 항목 |
|---|---|---|---|---|
| 미역 | 95.3 | **null** | 제외 층 밖 항목 없음 | 8 |
| 해삼 | 8.7 | **null** | 제외 층 밖 항목 없음 | 1 |
| 멍게 | 13.5 | 13.5 | ChEMBL · halocynthiaxanthin · HIV-1 역전사효소 IC50 | 0 |
| 살오징어 | 56.9 | **null** | 제외 층 밖 항목 없음 | 2 |
| 우뭇가사리 | 13.5 | 13.5 | ChEMBL · pheophorbide a · HIV-1 IC50 | 0 |
| 톳 | 86.6 | 45.3 | ChEMBL · CHEMBL275911 · LXR-α EC50 | 3 |
| 홍합(참담치) | 10.1 | 10.1 | ChEMBL · halocynthiaxanthin · HIV-1 역전사효소 IC50 | 0 |
| 참굴 | 96.3 | 62.6 | 항균 펩타이드 · Cg-BigDef1 · *S. aureus* MIC | 2 |

### 5.2 사후검증

- 운영 종 MBPI-Rx 최댓값은 **62.6(참굴)**이다.
- *Halichondria okadai* 73.8은 62.6보다 높다. *Ecteinascidia turbinata* 56.1은 62.6보다 낮다(톳 45.3·멍게·우뭇가사리 13.5·홍합 10.1보다는 높다). *Conus magus*는 지금처럼 계산되지 않는다.
- 그래서 결과는 **기준 미충족(failed)으로 예상한다.** 기본 MBPI에서 두 사례가 넘지 못한 미역 95.3·참굴 96.3(둘 다 ACE 펩타이드 층)은 빠지지만, 참굴의 다음 항목(항균 펩타이드 62.6)이 *E. turbinata*보다 높다.

### 5.3 30종 전체 (후보 22종은 사후검증 운영 종에 들어가지 않는다)

| 종 | 구분 | MBPI | MBPI 1위 층 | MBPI-Rx | Rx 1위 항목 | 뺀 항목 |
|---|---|---|---|---|---|---|
| 미역 | 운영 | 95.3 | ACE 펩타이드 | **null** | 제외 층 밖 항목 없음 | 8 |
| 해삼 | 운영 | 8.7 | ACE 펩타이드 | **null** | 제외 층 밖 항목 없음 | 1 |
| 멍게 | 운영 | 13.5 | ChEMBL 화합물 | 13.5 | ChEMBL · halocynthiaxanthin · HIV-1 역전사효소 IC50 | 0 |
| 살오징어 | 운영 | 56.9 | ACE 펩타이드 | **null** | 제외 층 밖 항목 없음 | 2 |
| 우뭇가사리 | 운영 | 13.5 | ChEMBL 화합물 | 13.5 | ChEMBL · pheophorbide a · HIV-1 IC50 | 0 |
| 톳 | 운영 | 86.6 | ACE 펩타이드 | 45.3 | ChEMBL · CHEMBL275911 · LXR-α EC50 | 3 |
| 홍합(참담치) | 운영 | 10.1 | ChEMBL 화합물 | 10.1 | ChEMBL · halocynthiaxanthin · HIV-1 역전사효소 IC50 | 0 |
| 참굴 | 운영 | 96.3 | ACE 펩타이드 | 62.6 | 항균 펩타이드 · Cg-BigDef1 · *S. aureus* MIC | 2 |
| 다시마 | 후보 | 26.5 | ChEMBL 화합물 | 26.5 | ChEMBL · CHEMBL252561 · *T. brucei brucei* IC50 | 0 |
| 감태 | 후보 | 67.5 | ACE 화합물 | 67.5 | ACE 화합물 · dieckol (3.3) | 0 |
| 가시파래 | 후보 | 73.3 | ACE 펩타이드 | **2.3** | 항암 펩타이드 · HTDT-6-2-3-2 · A-549 IC50 | 1 |
| 괭생이모자반 | 후보 | 21.6 | ChEMBL 화합물 | 21.6 | ChEMBL · CHEMBL4085945 · 콜린에스테라아제 IC50 | 0 |
| 꼬시래기 | 후보 | 49.3 | ChEMBL 화합물 | 49.3 | ChEMBL · prostaglandin A2 · DNA 중합효소 β Potency | 0 |
| 청각 | 후보 | 0.4 | ChEMBL 화합물 | 0.4 | ChEMBL · CHEMBL5287816 · SARS-CoV-2 IC50 | 0 |
| 바지락 | 후보 | 58.6 | ACE 펩타이드 | **null** | 제외 층 밖 항목 없음 | 7 |
| 전복(종 수준) | 후보 | 15.6 | ACE 펩타이드 | **null** | 제외 층 밖 항목 없음 | 1 |
| 큰가리비 | 후보 | 36.4 | ACE 펩타이드 | **null** | 제외 층 밖 항목 없음 | 1 |
| 시카메굴 | 후보 | 13.8 | ChEMBL 화합물 | 13.8 | ChEMBL · flazine · HIV-1 IC50 | 0 |
| 피조개 | 후보 | 75.0 | 항암 펩타이드 | 75.0 | 항암 펩타이드 · P6 · HT-29 IC50 | 0 |
| 가리맛조개 | 후보 | 56.9 | ACE 펩타이드 | **3.3** | 항암 펩타이드 · SCH-P10 · PC-3 IC50 | 1 |
| 고등어 | 후보 | 34.9 | ACE 펩타이드 | **null** | 제외 층 밖 항목 없음 | 4 |
| 멸치 | 후보 | 22.6 | ACE 펩타이드 | **null** | 제외 층 밖 항목 없음 | 3 |
| 참조기 | 후보 | 53.8 | 잔틴 산화효소 펩타이드 | **null** | 제외 층 밖 항목 없음 | 2 |
| 넙치 | 후보 | 29.2 | ACE 펩타이드 | **null** | 제외 층 밖 항목 없음 | 2 |
| 조피볼락 | 후보 | 31.7 | 항균 펩타이드 | 31.7 | 항균 펩타이드 · TS40 · *S. aureus* MIC | 0 |
| 방어 | 후보 | 7.5 | ChEMBL 표적(펩타이드) | 7.5 | 완화 d · sbGnRH · 사람 GnRH 수용체 IC50 | 0 |
| 대구 | 후보 | 59.9 | ACE 펩타이드 | **null** | 제외 층 밖 항목 없음 | 2 |
| 꽃게 | 후보 | 30.3 | 항균 펩타이드 | 30.3 | 항균 펩타이드 · MCCC1-MTS · *E. coli* MIC | 0 |
| 참문어(동아시아 종) | 후보 | 70.5 | ChEMBL 표적(펩타이드) | 70.5 | 완화 d · cephalotocin · 사람 바소프레신 V1b 수용체 EC50 | 0 |
| 갑오징어 | 후보 | 87.7 | ChEMBL 표적(펩타이드) | 87.7 | 완화 d · FMRFamide · 사람 NPFF2 수용체 Ki | 0 |

- `null` **11종**: 미역·해삼·살오징어·바지락·전복·큰가리비·고등어·멸치·참조기·넙치·대구.
- 크게 내려가는 종: 가시파래 73.3 → 2.3, 가리맛조개 56.9 → 3.3, 톳 86.6 → 45.3, 참굴 96.3 → 62.6.
- 감태는 67.5 그대로다(3.3).
- 30종 최댓값은 갑오징어 87.7(완화 층)이다. 후보 종이라 사후검증의 운영 종에는 들어가지 않는다.

## 6. 순서

1. 이 문서를 커밋한다(이 파일 하나만).
2. `config/verified-indices-v4.10.json`에 `mbpi_rx`(제외 층 2개, 분류표 52개, 이 문서 경로, `status: exploratory_secondary`, 라벨 '의약 후보 MBPI(보조, 탐색적)')를 넣어 고정한다.
3. build가 종마다 `mbpi_rx`를 쓰고, `scripts/posthoc_validation.py --only mbpi-rx`로 사후검증을 돌려 기록 JSON을 쓴 뒤 그 결과를 설정의 `posthoc.validation_sets.MBPI_RX`에 옮긴다(`exploratory: true`, 이 문서 경로).
4. 결과를 라벨과 함께 공개한다. 릴리스 기록(`formal-release-4.10-2026-10-12.md`)에 이 커밋의 해시를 적고, 5절과 다른 값이 있으면 밝힌다.
