# 바지락 펩타이드 근거 행 (2026-10-01, 다음 버전 대기)

- 파일: `research/verified-indices/evidence-clam-2026-10-01.json` (펩타이드 보충 파일, `snapshot_date` 2026-10-01)
- 상태: **공개 설정은 아직 이 파일을 읽지 않는다.**
  - 다음 공개 버전에서 설정의 `peptide_supplements`에 이 경로를 더하면 반영된다.
  - 같은 날 다음 버전 번호를 쓰려는 작업이 두 개 있어(칼슘 MFPI, 미역 재현 통합) 근거만 먼저 넣었다.
- 규칙, 계수, 비교집단은 바뀌지 않는다. 바뀌는 것은 근거 행뿐이다.
- 테스트 `StagedClamRowsTests`는 3.6에 이 파일만 더했을 때 바지락 MBPI만 바뀌는지 확인한다.
- 결정: 팀장 승인(2026-10-01). 같은 저자가 같은 값을 다시 보고한 논문은 재현으로 쓰지 않는다.

## 1. 점수에 쓰는 행

종: *Ruditapes philippinarum* (AphiaID 231750). Suetsuna의 *Tapes philippinarum*은 같은 종의 이명이다.

| 서열 | IC50 (µM) | 논문 | 원문에서 확인한 것 |
|---|---|---|---|
| IAE | 34.7 | Suetsuna 2002, Fisheries Science 68:233, doi:10.1046/j.1444-2906.2002.00415.x (J-STAGE 무료 전문) | 고상 합성 펩타이드(Applied Biosystems 430A), HHL(Peptide Institute), 토끼 폐 ACE(Sigma), 표 1·본문 µM |
| IVE | 95.6 | 위와 같음 | 위와 같음 |
| LLP | 158 | Lee et al. 2005, J Fish Sci Technol 8:109, doi:10.5657/fas.2005.8.2.109 (KoreaScience 무료 전문) | 국내 남서해안 바지락 thermolysin 가수분해물, Edman 서열, 주문 합성(KBSI), HHL·ACE(Sigma), 본문·표 1 µM |

결과는 바지락 MBPI **39.5**(IAE, 백분위 52.70 × 단일 논문 0.75)이며, "참고값(단일 논문)"으로 표시된다. BBVI는 `mbpi_single_source`로 보류된다.

## 2. 보이기만 하고 점수에 쓰지 않는 행 (`partial_only`)

Suetsuna 2002 본문은 피크별 IC50을 나열하면서 바지락과 진주조개(*Pinctada fucata martensii*)의 값을 바꿔 적었다. 바로 뒤의 서열 문장과 표 1은 서로 일치한다.
- 서열 문장 기준 바지락 펩타이드: IAE, AEL, LVE, IVE, IELPLG
- 피크 나열 기준 바지락 펩타이드: IAE, IVE, FE, ALAFE, VEV

두 읽기 모두에서 바지락에 속하는 IAE와 IVE만 점수에 쓴다. AEL(57.1), LVE(14.2), IELPLG(72.1)는 기원이 모호해 표시만 한다. LVE를 넣었다면 최고 항목이 51.7로 바뀌었을 것이다.

## 3. 재현으로 쓰지 않은 것

Suetsuna & Chen 2001 (Mar Biotechnol 3:305, doi:10.1007/s10126-001-0012-7, Spirulina)은 IAE 34.7 µM와 AEL 57.1 µM를 보고한다. 2002년 바지락 표 1과 소수점까지 같고 저자도 같다. 같은 측정을 두 논문에 쓴 것으로 보고 재현으로 인정하지 않는다(팀장 결정). 이 논문은 `potency_replications`에 넣지 않았다.

LLP는 α-zein LLP 57 µM(Miyoshi 1991)와 pIC50 차이가 0.44라 재현 후보가 될 수 있다. 그러나 IAE가 최고 항목이라 결과가 바뀌지 않으므로 넣지 않았다.

## 4. 이미 판정된 것과 남은 것

- Chen 2018 (Food Funct, doi:10.1039/c8fo01146j, VISDEDGVTH 8.16 µM): 2026-09-30 판정 그대로 **보류**다. 합성품 IC50 여부가 적혀 있지 않고, 발효물 기원도 불확실하다. 원문으로 통과하면 백분위 78.1이 되어 최고 항목이 바뀐다. 이때도 단일 논문이라 BBVI는 계속 보류된다.
- Himaya 2012 (대구): 2026-09-30 판정 그대로 **제외**다(천연 정제물, 합성품 측정 없음, 서열과 질량 불일치).
- 바지락 가수분해물 논문(Yu 2018, Sun 2023, JFF 2021, KFAS 2002)은 서열 IC50이 없어 제외한다.

조사 범위와 다른 7종(대구, 참조기, 조피볼락, 방어, 피조개, 꽃게, 갑오징어)의 결과는 저장소 밖 조사 메모에 있다. 7종 모두 점수에 넣을 행이 없었다.
