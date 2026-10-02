# 항균 펩타이드(AMP) 층 — `verified-pilot-3.18` 결정 기록 (2026-10-02)

제안서는 MBPI를 "CMNPD·ChEMBL·PubChem BioAssay의 **항균·항암** 생리활성 자료"로 정의하고, "표적·assay 유형별로 층화한 뒤 각 층 안의 백분위 순위로 점수화한다"고 적었다. 3.17까지 구현된 층은 ACE(혈압)와 ChEMBL뿐이라 사이트의 '항균' 칩이 0종이었다. 이 버전은 제안서가 적은 **항균 층을 같은 구조로** 추가한다.

규칙을 느슨하게 해서 값을 만든 곳은 없다. 새 층은 자기 비교집단과 자기 기준을 갖고, 나머지 규칙·계수는 3.17과 같다.

## 1. 왜 ACE 층을 그대로 본떴나

| | ACE 층 (3.1~) | AMP 층 (3.18) |
|---|---|---|
| 고정 비교집단 | AHTPDB, ACE·IC50·HHL 352개 | DBAASP, 표적 세균 종별 MIC·액체배지 |
| 점수값 | pIC50 = 6 − log10(IC50 µM) | pMIC = 6 − log10(MIC µM) |
| 순위 | 비교집단 안 백분위 | 같음 |
| 최소 크기 | 30 | 30 |
| 근거 계수 | 단일 논문 0.75 / 2편 이상 1.0 | 같음 |
| 집계 | 층 전체 최댓값 | 같음 |
| 기원 판정 | 원논문 | 같음 |

**MIC 백분위와 ACE IC50 백분위는 서로 순위를 매기지 않는다.** 각 층이 자기 비교집단 안에서만 순위를 내고, 종 MBPI는 예전처럼 층 전체의 최댓값이며 화면에는 최고 항목의 층을 적는다. 검사 `test_a_mic_is_never_ranked_against_an_ace_ic50`이 이를 고정한다.

## 2. 비교집단 — DBAASP

- 자료: DBAASP v3 REST 전체 덤프 25,542건(2026-10-02, sha256 `d8877834…`). 수집기는 `scripts/build_amp_cohorts.py`, 결과는 `research/verified-indices/amp-cohorts-dbaasp-2026-10-02.json`.
- 이용조건: DBAASP Terms and Conditions의 Data Access Policy를 직접 읽었다 — "제한 없이 접근·내려받기·복사·이용·수정·재배포할 수 있으며, 출처를 밝혀야 한다". 그래서 서열과 MIC 값을 저장소에 담을 수 있다. 인용: Pirtskhalava et al. 2021 *Nucleic Acids Res* 49:D288 (doi:10.1093/nar/gkaa991).
- **DBAASP의 숫자 `activity` 필드는 한 번도 읽지 않았다**(원값이 아니라 불투명한 변환값이다). `concentration` + `unit`만 쓴다.
- 코호트 규칙
  - `activityMeasureValue`가 정확히 `MIC`. MIC50·MIC90·MBC·MFC·**MEC**·IC50은 뺀다.
  - 액체배지 화이트리스트만. 한천 배지와 정체를 확정하지 못한 약어는 전부 뺀다(코호트별 `dropped_media`에 이름과 건수를 남겼다).
  - 농도가 단일 숫자여야 한다. `>`·`<`·범위·`±`는 버린다.
  - µg/mL → µM은 3.15의 환산 규칙 그대로(ExPASy 평균 잔기질량 + 물 1분자).
  - 구성원 키 = 서열 + 말단 수식 + 비표준 잔기 + 결합 + 단량체/다량체. 구성원 값은 그 구성원 µM 행들의 중앙값.
- 저장소에는 **채택된 행이 실제로 쓰는 7개 세균 코호트**만 담는다.

| 코호트 | 크기 | 중앙 pMIC | 자연기원만 | CLSI 배지만 |
|---|---|---|---|---|
| *Staphylococcus aureus* | 6,158 | 5.056 | 1,281 | 4,242 |
| *Escherichia coli* | 7,123 | 5.028 | 1,263 | 4,760 |
| *Pseudomonas aeruginosa* | 4,403 | 4.903 | 671 | 3,011 |
| *Bacillus subtilis* | 2,131 | 5.252 | 449 | 1,205 |
| *Vibrio parahaemolyticus* | 128 | 5.281 | 45 | 77 |
| *Streptococcus agalactiae* | 97 | 5.072 | 34 | 68 |
| *Vibrio anguillarum* (Listonella 포함) | 69 | 5.201 | 38 | 39 |

같은 수집에서 만든 *Vibrio alginolyticus*(55)와 ***Candida albicans*(1,948)**는 담지 않았다. **칸디다는 세균이 아니라 진균이다.** 진균 행이 생기면 자기 이름을 단 별도 코호트가 필요하고, 세균 코호트와 절대 섞지 않는다(빌더가 `target_kind == "bacterium"`을 강제한다).

## 3. 기원 행 — 원논문에서만 판정

DBAASP는 **시험한 물질이 합성인지 재조합인지 기록하지 않는다.** 그래서 다섯 요소를 모두 원논문에서 확인한 행만 넣는다.

1. 종이 우리 후보종으로 동정될 것(WoRMS 정명 또는 이명, 동아시아 종은 채집지까지).
2. 서열이 그 종 자신의 유전자·조직에서 나온 것일 것.
3. 시험 물질이 **화학 합성품 또는 서열 확인 정제 단일 펩타이드**일 것. 재조합 융합단백질은 제외.
4. 값이 **액체배지 미량희석 MIC**일 것. MEC(방사확산)·억제대 지름·검열값은 제외.
5. 논문 DOI와 각 요소가 적힌 위치.

### 채택 — 2종

| 종 | 펩타이드 | 표적 | MIC (µM) | 백분위 | 조정값 |
|---|---|---|---|---|---|
| **피조개** *Anadara broughtonii* | AI-hemocidin 2 `DLRDSWKVIGSDKK` | *S. aureus* ATCC 25923 | 22.77 | 29.41 | **22.1** |
| | | *E. coli* ATCC 25922 | 45.54 | 17.28 | 13.0 |
| | | *P. aeruginosa* ATCC 27853 | 91.08 | 7.54 | 5.7 |
| | | *B. subtilis* ATCC 6633 | 182.16 | 1.99 | 1.5 |
| | AI-hemocidin 1 `PSVQGAAAQLTADVKK` | *E. coli* ATCC 25922 | 47.35 | 17.08 | 12.8 |
| | | *P. aeruginosa* ATCC 27853 | 47.35 | 18.60 | 14.0 |
| **조피볼락** *Sebastes schlegelii* | TS40 (40 aa, SsTFPI-2 187–226) | *S. aureus* | 12.5 | 42.20 | **31.6** |
| | | *V. anguillarum* | 25.0 | 16.67 | 12.5 |
| | | *V. parahaemolyticus* | 400.0 | 0.00 | 0.0 |
| | | *S. agalactiae* | 800.0 | 0.00 | 0.0 |

→ **피조개 MBPI 22.1, 조피볼락 MBPI 31.6.** 둘 다 단일 논문이라 계수 0.75의 참고값이고 BBVI는 `mbpi_single_source`로 보류한다. MBPI 산출 18 → 20종, 채워진 칸 64 → 66.

**솔직히 적어 둘 것**: 열 개 측정값 중 일곱 개가 백분위 30 미만이고 두 개는 0이다. DBAASP 모집단은 설계·합성 AMP가 대부분이라 자연 유래 펩타이드는 대체로 중앙값 아래에 놓인다. 최고 항목 두 개도 코호트 중앙값보다 약하다(검사로 고정했다). 약한 표적(*V. parahaemolyticus* 400 µM, *S. agalactiae* 800 µM)도 지우지 않고 남겨 가장 강한 값 옆에 보이게 한다.

### 종 동정 — 피조개

논문은 종명을 *Arca inflata*로 적는다. WoRMS에서 *Arca inflata* Reeve, 1844는 unaccepted이고 정명이 ***Anadara broughtonii***다(537824 → 504357). *Scapharca broughtonii*도 같은 정명으로 수렴한다(591364 → 504357). 저장소가 쓰는 504357과 같다. 시료는 중국 칭다오 수산시장이다.

유전자 수준까지 맞췄다: 논문이 대조한 GenBank `AB713934.1`의 ORGANISM이 *Anadara broughtonii*(taxon 148819)이고, 그 번역단백질 `BAM63323.1`(147 aa)에서 AI-hemocidin 1은 잔기 2–17, AI-hemocidin 2는 18–31에 연속 구간으로 존재한다. 다만 논문 2.2절에 인쇄된 Edman 서열(`PSVQGAAQQLTADVK`)은 8번 잔기가 유전자와 다르다. **합성한 서열(표 2)이 유전자와 일치하므로 그 서열만 점수에 쓰고, 불일치는 근거 파일에 적어 둔다.**

### 탈락 기록

| 종 | 대상 | 사유 |
|---|---|---|
| 꽃게 | MCCC1-MTS (IJMS 2025 26:8546) | MIC 32 µg/mL(14.1 µM), 합성, 액체배지 미량희석까지 맞지만 **서열이 본문·보충자료 어디에도 인쇄되지 않았다**(helix-wheel 그림과 유전자명뿐). 서열이 없으면 구성원 키도 질량 검증도 불가 |
| 꽃게 | PtALF1·3~7, PtCrustin1~5 | 논문이 재조합 단백질을 시험했다 |
| 꽃게 | crab-ALF2A/6A, ALF6A8 (FSI 2019) | 합성이지만 값이 한천 방사확산 **MEC**이고 천연 서열을 변형했다 |
| 꽃게 | PtCrustin5-GRR (Aquaculture 2023) | MIC 행이 전부 검열값·범위이고 원문이 구독 자료다 |
| 꽃게 | PT-peptide (Mar Drugs 2019) | 합성·서열 공개지만 그 논문에 MIC가 없다 |
| 전복 | hdMolluscidin 등 11행 | 전부 MEC다 |
| 시카메굴 | – | 서열 확인 펩타이드의 MIC 논문이 없다 |

## 4. 한계

- 비교집단이 설계·합성 펩타이드 쪽으로 기울어 있다. **자연기원만 코호트**를 민감도로 함께 공개한다.
- DBAASP는 말단 수식·비표준 잔기의 질량을 0으로 기록해 변형 펩타이드의 µg/mL 행은 질량을 계산할 수 없어 버렸다. 아마이드·아세틸 두 보정만 허용하면 큰 코호트마다 약 1,300명이 늘지만 **어느 코호트도 중앙 pMIC가 0.10 이상 움직이지 않는다**. 엄격 규칙은 크기를 잃을 뿐 중심을 바꾸지 않아 그대로 두었다.
- 채택된 두 논문은 모두 LB 배지로 쟀다. 그래서 CLSI MHB/CAMHB 코호트는 **민감도**이고 기본이 아니다.
- 해조류 8종은 '펩타이드 + 수치' 논문이 0건이다. 이 층은 사실상 동물 쪽만 덮는다.
- MIC는 세균 배양 억제 농도다. 임상 효과나 제품 가치가 아니다.


### 3.19 후보 — 참굴 Cg-BigDef1 (점수는 바뀌지 않음)

같은 조사에서 **참굴** *Magallana gigas*의 Cg-BigDef1 (DBAASPR_17382)이 다섯 요소를 거의 다 채우는 것을 확인했다.

- 기원: Rosa et al. 2011 *PLoS One* 6:e25594 (PMC3182236, OA) — 참굴 자체 전사체·유전체에서 동정하고, 감염 개체에서 성숙 펩타이드를 HPLC·질량분석으로 검출했다.
- 시험 물질: Loth et al. 2019 *mBio* (10.1128/mBio.01821-19, PMC6805989, OA) — native chemical ligation으로 **전합성**한 뒤 산화적 폴딩, LC-MS로 확인했다. 재조합도 조추출물도 아니다.
- 값: *S. aureus* SG511 **1.25 µM**. 이 저장소의 *S. aureus* 코호트(6,158)에서 백분위 **93.42**, 조정값 70.1이다. *Micrococcus luteus* CIP 5345 0.3 µM도 있다.
- **참굴 MBPI는 바뀌지 않는다**: 현재 최고 항목인 LQP(96.3)가 더 높다. 바뀌는 것은 '항균' 칩이 2종 → 3종이 되는 것뿐이다.
- **남은 확인**: 시험법이 "liquid growth inhibition assay (Hétru & Bulet)"이고 배지가 Poor Broth·Zobell이다. 액체배지 연속희석이지만 논문이 'broth microdilution'이라고 적지는 않는다. 이 표현을 우리 규칙의 `broth_microdilution`으로 읽을지, 그리고 *M. luteus* 코호트(62)를 담을지는 정하고 넣어야 한다. 그래서 이번 버전에는 넣지 않았다.

### 보류 — 참굴 Cg-Def / Cg-Defh1 / Cg-Defh2

수치는 가장 좋다(Cg-Defh2의 *S. aureus* SG511 0.12 µM은 그 코호트 상위 끝). 그러나 시험 물질이 *E. coli*에서 발현한 His6 융합단백질을 CNBr로 잘라 정제한 것이라 **화학 합성품이 아니다**. 3.14가 받아들인 '서열 확인 정제 단일 펩타이드'에 해당하는지는 판단이 필요하다(그 조항은 천연 시료에서 정제한 펩타이드를 염두에 둔 것이고, 이쪽은 이종 발현 산물이다). 규칙을 넓히지 않고 보류했다.

### DBAASP 자료 오류 3건 (기록)

- **cgMolluscidin** 6행이 MIC로 저장돼 있으나 원논문(Seo et al. 2013)은 같은 수치를 **MEC**로 보고한다. 배지도 TSA(한천)라 이중으로 제외 대상이다. 라벨만 믿으면 안 된다는 사례다.
- **Octopromycin**의 `sourceGenes`에 *Octopus vulgaris*와 *Octopus minor*가 함께 적혀 있으나 논문과 저자의 GenBank 등록(QTW43735.1)은 *O. minor* 단독이다. 우리 후보종 참문어(*O. sinensis*)와는 무관하다.
- **Cg-Def**의 *M. luteus* 0.01 µM 행이 중복되고 사본 쪽은 NaCl 600 mM 고염 조건이다.

### 바지락·전복·홍합 — 정직한 빈 결과

- 바지락: MCdef 7행·VpDef 9행이 전부 범위값이거나 `>`값이고, 두 논문 모두 **재조합체**(rMCdef, rVpDef)로 쟀다.
- 전복: hdMolluscidin 11행이 전부 **MEC**이고 배지가 한천(TSA/SDA)이다.
- 홍합: Myticusin-alpha 9행이 전부 범위값이다.

### 재현 논문

25,542건 전수에서 우리 13개 서열을 공유하는 다른 레코드는 **0건**이다. 어느 종도 AMP 층으로 BBVI를 열 수 없다.

## 5. 아직 못 한 것

- **항암 층**: CancerPPD 2.0으로 주요 세포주 코호트(MCF-7 120, HeLa 95, A-549 77 등)를 만들 수 있음을 확인했다. 다만 사이트에 라이선스 문구가 없어 재배포 조건을 확인하지 못했다. 피조개 항암 펩타이드 P6(`WYIRKIRRFFKWLKKKLKKK`, DLD-1 IC50 2.14 µg/mL)가 후보다.
- 참문어 Zhou 2025(*Fish Shellfish Immunol*)는 자체 유전체 유래 합성 펩타이드 7종의 µM 활성을 보고하지만 구독 원문이라 서열·균주별 MIC를 확인하지 못했다. 도서관 목록에 있다.
