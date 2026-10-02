# verified-pilot-3.25 — 미역 합성 펩타이드 재현 3행과 양식 기록 2건 정정 (2026-10-02)

근거 행 3개를 더하고 양식 기록 2건의 문구를 고쳤다. 규칙, 비교집단, pIC50 차이 기준(1.0), 계수, feasible 판정은 바꾸지 않았다. **30종 점수 변화는 없다**(69/120 그대로).

- 설정: `config/verified-indices-v3.25.json`. 3.24에서 두 입력만 바꿨다.
  - `peptide_bioactivity.cross_origin_potency.supplement` → `evidence-xo-potency-3.25.json`
  - `nutrition.substitutes.aquaculture_supplement` → `mfpi-aquaculture-names-3.25-2026-10-02.json`
  - 3.24 공개본은 `archive/assessments-verified-pilot-3.24.json` 에 보관했다. 그 재현은 `VerifiedPilot324Tests` 가 검사한다.
- 새 입력은 둘 다 앞 파일을 복사해서(fork) 만들었다. 3.14~3.24 설정은 각자 읽던 파일을 그대로 읽는다(검사로 고정).
  - `evidence-xo-potency-3.25.json`: 3.24 파일의 여섯 행을 그대로 두고 세 행을 더했다.
  - `mfpi-aquaculture-names-3.25-2026-10-02.json`: 3.22 파일에서 food_support 2건과 출처 1건만 바꿨다.
- 결정 경위: 팀장 지시(2026-10-02)다. doyoun0824가 보낸 공유 파일(`replication-share.zip`, `paywalled-share.zip`, 10-01 작성, 3.6 기준)을 반영하라는 것과, 청각의 "초록 수준 근거" 제약을 떼라는 것이다. 근거 행 추가와 기록 정정이므로 규칙 변경이 아니다.

## 1. 공유 파일 중 이미 반영돼 있던 것

공유 파일은 3.6 기준으로 만들어졌다. 그 뒤 이 저장소에서 같은 논문들을 원문으로 처리했다.

| 도윤 판정 (10-01) | 저장소 처리 |
|---|---|
| 고등어 Zhang 2025 APFLAG, Wang 2024 PLITT: 원문 필요 | 3.11 반영, 고등어 MBPI 34.9 (도윤 손 계산 34.9와 같음) |
| 멸치 Kim 2016 DGGP: 원문 필요 | 3.13 반영, 멸치 MBPI 22.6 (도윤 손 계산과 같음) |
| 살오징어 Alemán 2013: 학명 확인 필요 | 원문 확인 결과 *Dosidicus gigas*여서 제외 |
| 전복 Wu 2015 AMN: µg/mL만 있음 | 3.15 환산 규칙으로 반영 |
| 대구 Ngo 2011·2016: 원문 필요 | 3.14 정제물 규칙으로 Ngo 2016 반영 |
| Kapel 2006 VW: 원문 필요 | 원문 확인 결과 정제물 1.1 µM. 3.14에 미역 VW 재현으로 반영. 큰가리비 VW와는 차이 1.898로 쓰이지 않음 |
| 톳 노 2000(완도) 양식: feasible | 저장소 기록과 같은 논문, 같은 판정 |
| 멸치 Yoneda 2025: "경계 사례, 팀 결정 필요" | 3.7 규칙 메모(연구용 사육 인정, 팀장 결정 2026-10-01)로 이미 결정됨 |

## 2. 채택: 미역 IW·VW·IY 합성 펩타이드 효능 재현 3행

| 서열 | 논문 | 값 | 위치와 합성 근거 |
|---|---|---|---|
| IW | Michelke et al. 2018, *Eng Life Sci* 18:218, 10.1002/elsc.201700172 (TU Dresden) | 1.91 µM, Hip-HL, 토끼 폐 ACE | Table 1의 cIW. 2.1절에서 cIW는 Bachem에서 산 화학 합성품이다. 같은 행의 재조합 rIW 1.72 µM과 서론의 인용값 0.7 µM은 쓰지 않는다 |
| VW | Nomura et al. 2002, *Fish Sci* 68:954, 10.1046/j.1444-2906.2002.00518.x (高知県工業技術センター 등) | 1.68 µM, HHL, 토끼 폐 ACE | p955 Table 2 "synthetic peptides". 본문에 화학 합성 VW의 IC50이라고 적혀 있다. VW는 Sigma 구매품이다 |
| IY | Saito et al. 1994, *Biosci Biotechnol Biochem* 58:1767, 10.1271/bbb.58.1767 (月桂冠) | 2.4 µM, HHL | p1768 결과 2절과 Table III. IYPRY 단편을 합성해 측정했다. IY는 분리물 표(Table I)에 없다. 논문에 ACE 출처는 적혀 있지 않다 |

- 판독: 도윤 쪽 판독자 2명이 각각 원문을 읽었고 두 명 모두 통과로 봤다(10-01, `recheck-A.md`·`recheck-B.md`). 2026-10-02에 이 PC에서 세 원문을 한 번 더 읽었다.
  - Michelke: PMC HTML. Nomura: J-STAGE PDF.
  - Saito: J-STAGE 스캔본이라 쪽 이미지로 확인했다.
- 독립성: 세 논문 모두 Sato 2002(東北大·理研ビタミン)와 겹치는 저자가 없다.
- pIC50 차이(Sato 2002 대비): IW 0.105, VW 0.293, IY 0.405.
- 점수 영향: 없다. 미역은 세 항목 모두 이미 계수 1.0이었다. 미역 MBPI 95.3과 BBVI 71.0은 그대로다.
- 넣는 이유: 그동안 미역 BBVI의 재현 근거에는 각각 단서가 붙어 있었다.
  - IW: Lin 2018 정제물 하나였다. Lin 2018은 IC50을 mg/mL로 회귀한 뒤 저자가 µM로 바꿔 적었다(Table 5 "equivalent to … mg/mL"). 도윤은 이 때문에 Lin 2018을 "환산값"으로 탈락시켰다.
  - IY: Suetsuna 2000 하나였다. 공저자가 겹치지만 팀장 결정으로 독립 논문으로 인정한 행이다.
  - 이제 세 항목 모두 공저자가 겹치지 않는 합성품 측정이 하나씩 있다. 그래서 미역 BBVI는 3.14 정제물 규칙이나 공저자 예외를 빼고 봐도 성립한다.
- 큰가리비: Nomura VW(1.68 µM)는 서열 단위로 큰가리비 VW(86.9 µM)에도 붙는다. 차이가 1.714라 used=false이고 큰가리비 값은 바뀌지 않는다(MBPI 36.4, BBVI 46.1).
- 보류(도윤 기록): Yokoyama 1992 IW 2.0 µM. 같은 쪽이 IW를 효소 분해 단편으로 설명해, 합성품 값인지 원문만으로 정할 수 없다.

## 3. 양식 기록 정정 2건 (feasible 판정은 그대로)

### 3-1. 멸치 (219984) — 사육 장소

- 3.7~3.24 기록의 적용 범위는 "Hatsukaichi Field Station, Fisheries Research and Education Agency, Japan"이었다. 이것은 저자 소속이다.
- Yoneda et al. 2025(*Sci Rep* 15:15057, PMC12041393) Methods "Fish rearing"을 다시 확인했다. 오무라만에서 잡은 멸치 약 700마리를 2014년 2월 Hakatajima Field Station(National Research Institute of Fisheries and Environment of Inland Sea)으로 옮겨 사육했다.
- 도윤의 독립 판정(10-01)이 이 차이를 처음 잡았다.
- 바뀐 것은 region과 method 두 필드다. method에는 채집·이송 경로를 더했다.

### 3-2. 청각 (145086) — 초록 수준 근거를 전문 확인으로 교체

- 3.7~3.24 기록은 Hwang, Baek, Park 2008(*J Appl Phycol* 20:469-475) 초록만 읽은 것이었다. 제약에 "Abstract-level evidence"라고 적혀 있었다.
- 2026-10-02에 동국대 도서관 경로로 Springer 전문을 읽었다. PDF는 받지 않았다.
  - 2004년 7월: 분리 소낭·수질 사상체를 종사에 인공 부착했다. 이어 60일 동안 수조에서 배양했다.
  - 해상 양성: 1단계 2004.10~12, 2단계 2004.12~2005.5, 3단계 2005.5~8.
  - 시설: 길이 100 m 수평 로프를 0.5~3 m 수심에 설치했다. 장소는 완도(34°17'N, 126°42'E)다.
  - 수확: 2005년 8월(Fig. 1h). 1 m 수심에서 로프 1 m당 약 7 kg(생중량)이었다. Table 2는 수심별 생물량·생산량·수입을 비교한다.
- 규칙 문장("종자부터 수확까지, 또는 한 양식 철 전체를, 정해진 시스템·지역·기간에서")을 원문으로 충족한다. feasible=true를 유지한다.
- 바꾼 필드: record_id, method, region, year, limitations, quote.
  - 새 제약 문구: 연구용 1주기·1개 장소의 수심 시험이고, 36,110 kg 건중량/ha는 저자의 잠재 생산량 추정치다.
  - 출처 기록 `hwang_2008_codium_wando` 는 전문 열람, accessed 2026-10-02로 바꿨다.

## 4. 반영하지 않은 것

- 톳 황 1999, Zhang 2025: 톳은 이미 feasible=true다. 종마다 주 기록은 하나만 쓴다.
- 넙치 MEVFVP·VSQLTR: 도윤과 3.24 탐색 모두 재현 후보를 찾지 못했다.

## 5. 확인

- `build_verified_indices.py --check` 통과. 3.24 대비 점수와 보류 사유가 바뀐 종은 0종이다.
- 바뀐 출력:
  - 미역·큰가리비의 `potency_replications`
  - 미역 `independent_dois`·`source_ids`
  - 멸치·청각 `food_trace.aquaculture`
  - 모든 종 `food_trace.method_version` 표기
  - `VerifiedPilot325Tests.test_nothing_else_changes` 가 이 범위를 고정한다.
