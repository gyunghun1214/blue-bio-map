# 톳 펩타이드 근거 행 (2026-10-01, 다음 버전 대기)

- 파일: `research/verified-indices/evidence-hijiki-2026-10-01.json` (펩타이드 보충 파일, `snapshot_date` 2026-10-01)
- 상태: **공개 설정은 아직 이 파일을 읽지 않는다.** 다음 공개 버전 설정의 `peptide_supplements`에 이 경로를 더하면 반영된다.
- 규칙, 계수, 비교집단은 바뀌지 않는다. 바뀌는 것은 근거 행뿐이다.
- 테스트: `StagedHijikiRowsTests`는 3.9에 이 파일만 더했을 때 톳 MBPI만 바뀌는지 확인한다.

## 1. 점수에 쓰는 행

종: *Sargassum fusiforme* (AphiaID 494972). 논문의 *Hizikia fusiformis*는 이 종의 이명이다.

논문: Suetsuna 1998, 일본수산학회지 64(5):862–866, doi:10.2331/suisan.64.862 (J-STAGE 무료 전문)

원문에서 확인한 것:
- 시료: 톳 단백질의 펩신 분해물
- 서열 결정: Edman 분해, FAB-MS
- 합성: Fmoc 고상법(Applied Biosystems 433A)
- 측정: HHL 기질(펩타이드연구소), 토끼 폐 ACE(Sigma)
- 값: 표 1 "합성 펩타이드의 ACE 저해 활성", µM 단위

| 서열 | IC50 (µM) | pIC50 | 백분위 | × 단일 논문 0.75 |
|---|---|---|---|---|
| GKY | 3.92 | 5.407 | 86.65 | **64.99** |
| SVY | 8.12 | 5.090 | 78.12 | 58.59 |
| SKTY | 11.07 | 4.956 | 73.58 | 55.18 |

- 일본어 결과 문단에는 네 번째 펩타이드가 Ser-Lys-Tyr-Tyr로 인쇄돼 있다.
- 그러나 다음 근거가 모두 Ser-Lys-Thr-Tyr를 가리키므로, 결과 문단의 Tyr-Tyr를 오타로 판단했다.
  - 표 1
  - 아미노산 비율(Thr 1.07)
  - FAB-MS m/z 498
  - 영문 초록

## 2. 결과

- 톳 MBPI: 45.3 → **65.0**
  - 이전 값은 ChEMBL 화합물(CHEMBL275911, 1985년 논문 1편)이었다.
  - 이제 최고 항목은 합성 GKY다.
- "참고값(단일 논문)"으로 표시된다. BBVI는 `mbpi_single_source`로 보류된다.
- 다른 29종은 바뀌지 않는다.

## 3. 재현 가능성

Europe PMC에서 "Gly-Lys-Tyr", "Ser-Val-Tyr", "Ser-Lys-Thr-Tyr"와 ACE를 함께 찾았다. 리뷰 인용만 나왔고 재측정은 없었다.

AHTPDB에 SVY는 "<20 mM"로만 있어 쓸 수 없다.

다른 논문이 이 세 펩타이드 중 하나를 HHL 기질로 다시 재면, 톳 BBVI를 열 수 있다. 계산은 다음과 같다.
- MFPI 63.3
- MBPI(GKY가 재현될 경우) 86.65
- BBVI = (63.3 + 86.65) / 2 ≈ 75.0
