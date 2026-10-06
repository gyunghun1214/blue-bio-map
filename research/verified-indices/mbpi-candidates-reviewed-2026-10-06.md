# MBPI 후보 재검토 (2026-10-06)

현재 규칙(verified-4.5)·임계값·비교집단은 바꾸지 않았다. 이 기록으로 바뀌는 데이터 값은 없다.

- 원문 읽기 경로
  - Europe PMC REST `fullTextXML`으로 읽었다(2026-10-06).
  - 食品科学 논문은 출판사 PDF가 403이었다. 그래서 학술지의 공개 HTML 전문을 로그인 없이 읽었다.
- 판정 방식
  - 작업 A의 두 행은 반박 검증 에이전트 3개가 각자 원문을 읽고 문장 위치를 적었다.
  - 모순이 제시되면 다수결로 넘기지 않고 원문을 직접 다시 읽었다.

## 1. 작업 A: 미역 KNFL·참굴 AEYLCEAC — 이미 반영됨, 값 변화 없음

두 행은 새 근거가 아니다.

- 2.2부터 `approved_for_score`로 점수 입력이다. 2.2 당시 파일은 `evidence-v3.json`이었고, 3.5부터 `research/verified-indices/evidence-v3.5.json`(`peptide_supplements` 첫 파일)에 있다.
- 4.5 공개값에 이미 반영돼 있다.

| 종 | 행 | 4.5 상태 | 이번 결과 |
|---|---|---|---|
| 미역 (145721) | KNFL 225.87 µM, Feng 2021, 10.3390/md19030177 | AHTPDB 352개 중 백분위 26.14, 단일 DOI 0.75 → 조정값 19.6 | MBPI 95.3은 IW(1.5 µM, 재현 있음)에서 나온다. KNFL은 최댓값이 아니어서 MBPI 영향이 없다. **값 변화 없음** |
| 참굴 (836033) | AEYLCEAC 4287 µM(원문 4.287 mM), Chen 2022, 10.3389/fnut.2022.981163 | 백분위 1.42 × 0.75 → 조정값 1.07 | MBPI 96.3은 LQP(1.18 µM, 다른 기원 효능 재현)에서 나온다. **값 변화 없음**. `config/verified-indices-v3-oyster-lqp.json` 계열 근거(LQP)와의 관계는 "영향 없음"이다. |

mM → µM 환산은 2.2(`peptide_bioactivity` 행, 2026-09-27)부터 쓰던 SI 접두어 환산이다(×1000).

- 원문 값과 단위는 행의 `verification` 문장에 남아 있다: "IC50 4.287 mM in text".
- 질량 단위 환산 규칙(`unit_conversion`, µg/mL → µM)과는 별개다. 분자량을 쓰지 않는다.

### 검증 에이전트 3개가 확인한 문장 위치

| 항목 | KNFL (PMC8004985) | AEYLCEAC (PMC9445672) |
|---|---|---|
| 종·시료 | 3.1 Materials and Chemicals ¶1: 광시 베이부만 채집 시료를 Dalian Ocean University 연구자가 *Undaria pinnatifida*로 동정 (3/3 확인) | 초록 "oyster (*Crassostrea gigas*) hydrolysates", Introduction ¶2 (3/3 확인). 방법 절에는 종명이 없다(아래 해소 참고) |
| 합성·순도 | 3.1 ¶2 GL Biochem 공급, 2.4 ¶1 "chemically synthesized peptide (98% purity)". 두 문장에 나뉘어 있다 (3/3) | "Chemical synthesis of peptides" ¶1 Chinapeptides 고상 합성, ">95% pure according to HPLC" (3/3) |
| 기질 | 3.1 ¶2 HHL(Sigma-Aldrich), 3.5 ¶1 HHL 5 mM (3/3) | "Materials and chemicals" ¶1 HHL(Sigma-Aldrich), 측정 절 ¶1 HHL 5 mM (3/3) |
| 값·단위 | 2.4 ¶1 "225.87 ± 2.7 μM"(합성품). 초록·2.4 ¶2·표 1·표 2도 같은 값. 분획 A24의 228.96 ± 1.5 µM와 섞이지 않는다 (3/3) | 초록 "4.287 mM", 결과 "ACE-inhibitory activity determinations" ¶1 "4.29 mM". 표에는 없다 (3/3) |
| 반복 측정 | 표기 없음. 통계 절(3.7)에 t-검정·ANOVA만 있어 ±의 뜻이 정의되지 않았다 (3/3) | 통계 절 ¶1 "carried out in triplicate … mean ± SD" (3/3). IC50 자체에는 ±가 없다 |
| DOI·이용조건 | 10.3390/md19030177, CC BY 4.0 (3/3) | 10.3389/fnut.2022.981163, CC BY 4.0 (3/3) |
| 서열 표기 | KNFL 32회, 변형 표기 0회 (3/3) | AEYLCEAC 91회, 변형 표기 0회 (3/3) |

### 제시된 모순과 해소

**검증 2번: "참굴 방법 절에 종명이 없다"**

- 맞는 지적이다. 방법 절은 시료를 "reported previously (13)"로만 적었다.
- 원문을 직접 다시 읽어 확인한 것:
  - 이 논문 초록이 시료를 "oyster (*Crassostrea gigas*) hydrolysates"라고 적는다.
  - 인용된 선행 연구(Chen et al. 2019, *Food Funct* 10:5426, PMID 31402368)의 초록도 "oyster (*Crassostrea gigas*) proteins"를 모의 소화했다고 적는다. Europe PMC 초록으로 확인했다.
- 따라서 종 귀속은 원문 초록과 인용 원자료가 함께 뒷받침한다. 행의 서술("screened from a *Crassostrea gigas* simulated GI digest")과 모순되지 않는다.
- **행 유지.** 저장소 규칙(`origin_material_rule`)은 종명을 방법 절에 적도록 요구하지 않는다.

**4.287 mM과 4.29 mM**

- 같은 값을 반올림한 것이다. 저장된 4287 µM은 초록 값을 따른다.
- 4290 µM으로 바꿔도 pIC50이 2.3678에서 2.3675로 바뀔 뿐이다. 352개 비교집단에 그 사이 값이 0개라 백분위(1.42)는 같다.
- 작은 변경 원칙에 따라 그대로 둔다.

### 값을 바꾸지 않는 기록 사항

- KNFL: 초록은 "non-competitive", 본문(2.5·2.6)은 "mixed-type" 억제라고 적었다. MBPI 입력이 아니다.
- 두 논문 모두 IC50이 반응액 최종 농도인지 첨가 원액 농도인지 밝히지 않았다(검증 2번 지적).
  - AHTPDB 비교집단 회원 전체에 공통인 한계다. 이 두 행만 고치지 않는다.

## 2. 작업 B: 검토함·불통과

각 사유는 원문 문장으로 다시 확인했다. "확인"은 원문 문장과 위치를 대조했다는 뜻이다.

| 종 | 원문 | 후보 | 불통과 사유 | 원문 확인 |
|---|---|---|---|---|
| 넙치 | Foods 2020;9:647, 10.3390/foods9050647, PMC7278688 | IVDR 46.90 · WYK 32.97 · VASVI 32.66 µM (합성, Anygen) | **기질 규칙**: 2.2 ACE Inhibitory Activity Assay ¶1 "measured using the Dojindo ACE kit-WST". 전문에 HHL·hippuryl이 0회 나온다. | 확인 (2.1 ¶1 합성, 3.1 ¶1 값, 표 1 ±SD) |
| 전복 내장 | Mar Drugs 2024;22:461, 10.3390/md22100461, PMC11509546 | VAR·NYER·VTPGLQY·QFPVGR·LGEW·QLQFPVGR·NLGEW (합성, Anygen) | ① 3.7 ¶1 "ACE kit-WST (Dojindo …)", HHL 아님 ② 표 3 IC50 단위가 mg/mL ③ 3.1 ¶1 "Abalones were purchased from a fishing village market on Jeju Island"라고만 적어 학명이 없다. *Haliotis discus hannai*는 본문에 없고 참고문헌 제목에만 나온다. | 확인. ③은 "방법 절뿐 아니라 본문 전체에 시험 재료의 학명이 없다"로 더 정확히 적는다 |
| 전복 외투막 | 食品科学 2023;44(6):158-164, 10.7506/spkx1002-6630-20220406-061 | GPPGPAGAR 177.1 µmol/L | **서열 표기 불일치**: 결과 2.7 ¶1의 IC50 문장과 그 뒤 고찰이 "GPPGRAGAR"이다(2.7에 5회). 초록·결론의 177.1 µmol/L 문장과 1.3.9 합성·1.3.10·2.5 질량분석·그림 7은 GPPGPAGAR이다(41회). 해삼 DDQYHIF(2026-09-28)와 멸치 NHP(2026-10-01) 선례를 따라 행에 넣지 않는다. | 확인. **"원문 대기"가 아니다**: 출판사 PDF는 403이지만 공개 HTML 전문(spkx.net.cn/article/2023/1002-6630/2023-44-6-020.html)을 로그인 없이 읽었다. 나머지 요건은 원문으로 확인했다: 皱纹盘鲍 (*H. discus hannai*) 裙边, 고상 합성 >95%(1.3.9), HHL(Sigma, 1.1), µmol/L 값. 이용조건은 DOAJ 학술지 기록상 CC BY-NC-ND 4.0이다(DOAJ API, ISSN 1002-6630, 2026-10-06 조회; 저장한 HTML에는 라이선스 문구가 없다. 서지·수치만 인용). |
| 해삼 | Mar Drugs 2024;22:90, 10.3390/md22020090, PMC10890666 | DDQIHIF / DDQYHIF 333.5 µmol/L | **서열 표기 불일치**: 초록·결론·2.7·그림 3D 캡션은 DDQIHIF(5회)다. 초록의 IC50 문장은 DDQIHIF이고, 결과 2.3 ¶1의 IC50 문장("DDQYHIF … 333.5 ± 25.3 μmol·L−1")·표 1~4·동역학·도킹은 DDQYHIF(23회)다. 2.6 ¶1에는 DQYHIF도 1회 있다. HDWWKER(583.6 µmol/L, 현재 해삼 MBPI 근거)는 바꾸지 않는다. | 확인. 같은 논문의 THDWWKER는 단위 불일치(결과 절 mmol·L−1, 초록·결론 µmol·L−1)로 이미 제외돼 있다(2026-09-28 기록) |
| 살오징어 | IJMS 2019;20:4159, 10.3390/ijms20174159, PMC6747323 | IIY pIC50 4.58 · NPPK pIC50 4.41 (고상 합성, HHL) | **기원 요건**: 초록 ¶1 "its myosin heavy chain was hydrolyzed in silico". 3.2 ¶1의 서열은 GenBank ADU19853.1이다. 오징어 재료에서 이 펩타이드를 검출한 실험이 없다. 막는 조건은 기원 하나이고, 완화 규칙도 기원은 "Never relaxed"다. 값은 원문에 pIC50으로만 인쇄됐고 전문에 µM 표기가 0회다. 저장소 행(`evidence-v3.5.json`, `partial_only`)은 이미 26.3·38.9 µM(= 10^(6−pIC50))과 `reported_pIC50`을 함께 저장하고 있다. 다만 `value_in_text: true`는 원문과 맞지 않는다(점수 미사용 행이라 값 영향 없음, 이번에 고치지 않음). | 확인 (2.4 ¶1 합성, 3.1 ¶1·3.5 ¶1 HHL 5.8 mM). 인정 여부는 방법 변경이라 [docs/species-30-method-review.md](../../docs/species-30-method-review.md) 13-1에 제안으로 넘긴다 |
| (해당 없음) | 小野 외 2002, 日本水産学会誌 68(2):192-196, 10.2331/suisan.68.192 | — | 가수분해물 수준이다. 영문 초록이 "Hydrolysates prepared from defatted chum salmon muscle and squid liver"의 억제율(% at µg/mL)만 적고 펩타이드 서열·IC50은 없다. 오징어 부위도 근육이 아니라 간췌장이다. | 초록 기준 확인(J-STAGE 무료 공개 페이지, 본문 PDF는 읽지 않음) |

### 서열 표기 불일치 두 건을 질량으로 판별할 수 있는가 (계산만, 적용 안 함)

두 논문은 서열과 함께 분자량을 인쇄했다. 평균 잔기 질량 + 물 1분자로 계산한 값과 대조했다.

| 논문 | 인쇄된 분자량 | 후보 서열 계산값 | 맞는 쪽 |
|---|---|---|---|
| 전복 외투막 2.5 | GPPGPAGAR 778.85 Da | GPPGPAGAR 778.87 · GPPGRAGAR 837.94 | GPPGPAGAR |
| 해삼 표 1 No.20 | DDQYHIF 936.98 | DDQYHIF 936.98 · DDQIHIF 886.96 | DDQYHIF |

판별된 서열을 인정하면 어떻게 되는지 계산했다.

- 계산 방법: 같은 AHTPDB 비교집단(352개)에 같은 백분위 함수(`build_verified_indices.percentile`)와 단일 DOI 0.75를 적용했다. 전체 재빌드가 아니어서 BBVI 등은 확정하지 않았다.
- 전복(397082) MBPI 15.6(AMN)이 22.1(GPPGPAGAR, 백분위 29.40)이 된다.
- 해삼(241776) MBPI 8.7(HDWWKER)이 14.9(DDQYHIF, 백분위 19.89)가 된다.
- 멸치 NHP/NPH는 같은 잔기의 순서만 다르다. 질량이 같아 이 방법으로 판별되지 않는다.
- 주의: 두 논문의 분자량은 측정값이 아니라 계산값으로 보인다(전복 SGEVGQ 575.57 = 계산 평균 질량, 해삼 표 1은 가상 선별·물성 표). 그래서 이 대조는 "그 표가 어느 서열로 계산됐는가"만 보여 준다.
- 이 판별을 규칙으로 들일지는 방법 변경이다. [docs/species-30-method-review.md](../../docs/species-30-method-review.md) 13-2에 제안으로 넘긴다.
