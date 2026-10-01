# 고등어 펩타이드 근거 행과 도서관 원문 9편 판정 (2026-10-01, `verified-pilot-3.11`에 반영)

- 파일: `research/verified-indices/evidence-mackerel-2026-10-01.json` (펩타이드 보충 파일, `snapshot_date` 2026-10-01)
- 상태: `verified-pilot-3.11` 설정(`config/verified-indices-v3.11.json`)의 `peptide_supplements`가 이 파일을 읽는다.
  - 3.10 이하 설정은 이 파일을 읽지 않는다. 3.10 공개본은 `archive/assessments-verified-pilot-3.10.json`에 그대로 보관한다.
- 규칙, 계수, 비교집단은 바뀌지 않는다. 바뀌는 것은 근거 행뿐이다.
- 테스트 `VerifiedPilot311Tests`는 3.10과 비교해 고등어 MBPI만 바뀌는지와 점수 행·BBVI 보류 사유를 확인한다.
- 원문은 동국대 도서관 구독으로 받았다. PDF는 저장소에 넣지 않고, 수치와 위치만 적는다.

## 1. 점수에 쓰는 행

종: *Scomber japonicus* (AphiaID 127022). 두 논문 모두 중국 푸젠성 Hui'an Ruifang Food의 고등어 근육 가수분해물에서 LC-MS/MS로 서열을 찾았다. 그중 고른 펩타이드를 합성(Sangon, 순도 >98%)해 HHL로 측정했다.

| 서열 | IC50 (µM) | 논문 | 위치 | 백분위 | 보정 후 |
|---|---|---|---|---|---|
| PLITT | 48.73 | Wang 2024, Food Chem 447:138873, [10.1016/j.foodchem.2024.138873](https://doi.org/10.1016/j.foodchem.2024.138873) | §2.9 합성, §3.4·그림 3B·초록 | 46.59 | **34.9** |
| APFLAG | 69.45 | Zhang 2025, J Food Sci e70767, [10.1111/1750-3841.70767](https://doi.org/10.1111/1750-3841.70767) | §2.5 합성, §3.2·그림 2B·표 2·초록 | 41.19 | 30.9 |
| FDHKKFF | 212.85 | Zhang 2025 | 그림 2C·표 2·초록 | 27.56 | 20.7 |
| LFPKFA | 259.05 | Zhang 2025 | 그림 2D·표 2·초록 | 25.00 | 18.8 |

- 측정 조건은 두 논문이 같다: HHL 2.5 mM, ACE(Sigma) 0.1 U/mL, 붕산 완충액 pH 8.3(NaCl 0.3 M), 37 °C 60분, 마유산을 HPLC 228 nm로 정량.
- 넣지 않은 값:
  - Wang 2024의 CRLTT 4.06 µM은 QSAR 예측값이고 합성·측정하지 않았다.
  - Wang 2024의 LTPFT·PVVDT는 합성했지만 IC50이 없다.
- 두 논문은 같은 연구진이고 같은 펩타이드 목록(285개)을 썼다. 하지만 측정한 서열이 서로 달라 한쪽이 다른 쪽을 재현하지 않는다.
- 결과: 고등어 MBPI가 미산출에서 **34.9**(PLITT, 백분위 46.59 × 단일 논문 0.75)로 바뀐다. 표시는 "참고값(단일 논문)"이다. 최고 항목 PLITT를 잰 논문이 한 편뿐이라 BBVI는 `mbpi_single_source`로 보류된다. MBPI 산출 종은 14종에서 15종이 된다.

## 2. 같은 묶음에서 점수에 쓰지 않은 7편

판정 기준은 기존 결정과 같다. 기원종에서 서열을 확인하고, 그 서열의 합성품을 HHL로 측정한 IC50 µM 값이 본문에 있어야 한다. 천연 분리물만 잰 값은 9/30 판정(Suetsuna 2004, Himaya 2012 제외)처럼 쓰지 않는다.

| 논문 | 대상 칸 | 판정 | 사유 |
|---|---|---|---|
| Kapel 2006, Process Biochem 41:1961, [10.1016/j.procbio.2006.04.019](https://doi.org/10.1016/j.procbio.2006.04.019) | 큰가리비 VW 효능 재현 | 제외 | 알팔파 RuBisCO 가수분해물의 분리 피크(FIVd)를 ESI-MS/MS로 VW로 정하고, 그 분리물로 IC50 1.1 µM(HHL 5 mM)을 쟀다. 합성품 측정이 아니어서 `potency_replications`의 `synthetic` 조건을 통과하지 못한다(Lin 2018, Yokoyama IY와 같은 경우). 값도 큰가리비 VW 86.9 µM와 pIC50 차이가 1.90으로 허용 폭 1.0을 넘는다. PDF 글자층의 "mM"은 기호 글꼴의 µ다. |
| Kim 2016, Appl Biol Chem 59:25, [10.1007/s13765-015-0129-4](https://doi.org/10.1007/s13765-015-0129-4) | 멸치 MBPI | 보류 | 합성 DGGP 163.51 µM, GCK 178 µM 등(표 1, HHL 5 mM)으로 측정 조건은 맞다. 하지만 원료가 학명 없이 "anchovies"로만 적힌 천일염 발효 액젓(12~24개월)이다. 기원종을 원문에서 확인할 수 없고, 발효물 기원이라 9/30 Chen 2018 보류와 같은 문제가 있다. |
| Wu 2015, Eur Food Res Technol 240:137, [10.1007/s00217-014-2315-8](https://doi.org/10.1007/s00217-014-2315-8) | 전복 MBPI | 제외 | *Haliotis discus hannai* 생식소, Edman으로 AMN을 확인하고 합성(96.9%), HHL 6.5 mM으로 측정했다. 하지만 IC50이 106.24 µg/mL로만 있고 본문에 µM 값이 없다. |
| Ngo 2016, Process Biochem 51:1622, [10.1016/j.procbio.2016.07.006](https://doi.org/10.1016/j.procbio.2016.07.006) | 대구 MBPI | 제외 | *G. macrocephalus* 껍질 젤라틴. GASSGMPG 6.9 µM, LAYA 14.5 µM(HHL)은 FPLC 분획 FI-1에서 Q-TOF로 찾은 정제물 값이고, 합성품 측정이 없다. 두 서열이 같은 분획에서 나와 각각 따로 쟀는지도 원문에 없다. |
| Ngo 2011, Int J Biol Macromol 49:1110, [10.1016/j.ijbiomac.2011.09.009](https://doi.org/10.1016/j.ijbiomac.2011.09.009) | 대구 MBPI | 제외 | TCSP·TGGGNV의 ACE 억제는 500 µg/mL에서 81%·68%로만 있고 IC50이 없다. 천연 정제물 값이다. |
| Alemán 2013, Food Res Int, [10.1016/j.foodres.2013.08.027](https://doi.org/10.1016/j.foodres.2013.08.027) | 살오징어 MBPI | 제외 | 원료가 *Dosidicus gigas*(아메리카대왕오징어) 껍질이라 살오징어(*Todarodes pacificus*)가 아니다. |
| Hwang 2008, J Appl Phycol 20:469, [10.1007/s10811-007-9265-5](https://doi.org/10.1007/s10811-007-9265-5) | 청각 양식 기록 | 변경 없음 | 원문으로 초록 수준 기록을 확인했다: 완도 양식장(34°17′N, 126°42′E), 2004년 7월 종묘, 2004년 10월~2005년 8월 양성, 수심 1 m에서 7.2 kg/m. `feasible` true는 그대로이고 MFPI도 바뀌지 않는다. `mfpi-aquaculture-3.9-2026-10-01.json`의 "abstract-level" 한계 문구는 공개본 재현을 위해 이번에 고치지 않는다. |

## 3. 이번 묶음에 없는 원문

핸드오프의 도서관 원문 4편은 아직 받지 못했다. Chen 2018(바지락), Food Biosci 2026(참조기), Suetsuna 2000(미역), Feng 2022(참굴 LSL)이다. 미역 재현 행(doyoun0824, `C:/bbvm-papers/replication`)도 아직 이 PC에 없다. 이 자료는 다음 버전에서 다룬다.
