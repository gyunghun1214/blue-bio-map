# 미역 IY 효능 재현 (2026-10-01, `verified-pilot-3.12`에 반영)

- 파일: `research/verified-indices/evidence-xo-potency-3.12.json` (효능 재현 보충 파일, `snapshot_date` 2026-09-27, 근거 파일과 같음)
  - 2.3의 Miyoshi 1991 LQP 행을 그대로 두고 Suetsuna 2000 IY 행을 더했다.
  - 2.3–3.11 설정은 계속 `evidence-xo-potency.json`을 읽는다. 3.11 공개본은 `archive/assessments-verified-pilot-3.11.json`에 그대로 보관한다.
- 설정: `config/verified-indices-v3.12.json`은 3.11에서 `peptide_bioactivity.cross_origin_potency.supplement` 경로만 바꿨다. 규칙, 계수, 비교집단, pIC50 허용 폭 1.0은 바뀌지 않는다.
- 테스트: `VerifiedPilot312Tests`는 두 가지를 확인한다.
  - 3.11과 비교해 미역 MBPI·BBVI만 바뀌는지
  - 재현 행이 IY 항목에만 붙고 다른 종에는 붙지 않는지

## 1. 재현 행

| 서열 | 기원 논문 값 | 재현 값 | pIC50 차이 | 재현 논문 |
|---|---|---|---|---|
| IY | 6.1 µM (Sato 2002, J Agric Food Chem 50:6245, 표 1 합성 디펩타이드) | **2.65 µM** | 0.362 | Suetsuna & Nakano 2000, J Nutr Biochem 11:450, [10.1016/S0955-2863(00)00110-8](https://doi.org/10.1016/S0955-2863(00)00110-8) |

원문에서 확인한 것(2026-10-01, ScienceDirect 전문, 동국대 기관 인증):
- 시료: 1996년 2–3월 미야기현 기타가미 양식장의 미역을 펩신으로 소화했다.
- 서열: AIYK·YKYY·KFYG·YNKL 네 테트라펩타이드를 Edman 분해(477A)와 FAB-MS로 확인했다.
- 합성: 고상법(433A)으로 합성하고, HF로 처리한 뒤 RP-HPLC로 순도를 확인했다.
- 측정값: 표 2의 제목은 "ACE inhibitory activity of synthetic tetrapeptides"이고, 단편 Ile-Tyr의 IC50은 2.65 µM이다.
- 측정 조건: Hip-His-Leu 12.5 mM(펩타이드연구소), NaCl–붕산 완충액 pH 8.3, 토끼 폐 ACE(Sigma), 37 °C 1시간, 마유산은 아세트산에틸로 추출해 228 nm에서 측정했다. Sato 2002와 같은 계열의 측정법이다.

## 2. 독립성 판단 (팀장 결정, 2026-10-01)

- Takahisa Nakano(Riken Vitamin)가 두 논문의 공저자다(Crossref 저자 목록).
- `evidence-v3.5.json`의 Sato IY 행에는 "Suetsuna et al.과 공저자 없음"이라고 적혀 있지만 사실과 다르다. 이 메모는 3.5–3.11 공개본 재현을 위해 고치지 않고 여기에 정정한다.
- 그래도 독립 논문으로 인정한 이유:
  - 두 값이 다르다(2.65와 6.1 µM). 그래서 "같은 저자가 같은 값을 다시 쓴 논문은 재현이 아니다"라는 규칙에 해당하지 않는다.
  - 측정한 연구진이 다르다(Suetsuna 연구실, 도호쿠대 Sato 연구실).
- 재현 행은 효능만 재현한다. 미역에서 IY가 나온다는 기원 근거는 Sato 2002 한 편뿐이다. Suetsuna 2000의 IY는 테트라펩타이드 AIYK의 합성 단편이라 기원 근거가 되지 않는다.

## 3. 결과

- 미역 IY 항목이 독립 DOI 2편 항목이 된다(계수 0.75 → 1.0, 백분위 80.97).
- 미역 MBPI는 IW 단일 논문 값 71.5에서 **81.0**(IY)으로 바뀐다. IW(1.5 µM, 백분위 95.31 × 0.75 = 71.5)는 근거 목록에 그대로 남는다.
- 미역 BBVI는 보류에서 **63.9**(0.5 × MFPI 46.7 + 0.5 × MBPI 81.0)가 된다.
- 미역은 MCUI가 없어(IUCN 검색 0건) BBVI × MCUI 매트릭스에는 들어가지 않는다. 매트릭스 점은 참굴 1개 그대로다.
- 다른 29종의 점수는 바뀌지 않는다.
- 화면 문구: 재현 행 표시를 "다른 기원 …"에서 "재현 시료 …"로, 한계 문장을 "다른 기원의 합성 펩타이드 측정"에서 "별도 논문의 합성 펩타이드 측정"으로 바꿨다. 같은 종의 다른 논문에서 나온 재현 행도 정확히 표시하기 위해서다.

## 4. 남은 것

- 테트라펩타이드 4행(AIYK 213, YKYY 64.2, KFYG 90.5, YNKL 21 µM)은 `evidence-v3.5.json`에 초록 수준의 `partial_only`로 남아 있다. 원문으로 합성품·HHL 조건이 확인됐지만, 넣더라도 미역 MBPI(최고 항목 IY)는 바뀌지 않아 이번에는 올리지 않았다.
- doyoun0824의 미역 재현 행(IW·VW·IY)은 아직 이 PC에 없다. 들어오면 IW가 재현될 경우 미역 MBPI가 약 95.3까지 오를 수 있다.
