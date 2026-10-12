# `verified-4.10` — 의약 후보 MBPI(MBPI-Rx) 보조 지표 (2026-10-12)

계기: MBPI 근거 층 표시와 MBPI-Rx 작업 요청(2026-10-12). 기준은 `main`(= `verified-4.9`, PR #172 병합 뒤)이고 기본 지표의 규칙은 바꾸지 않았다.

사전 등록: [prereg-mbpi-rx-4.10-2026-10-12](prereg-mbpi-rx-4.10-2026-10-12.md), 커밋 `f52ae057d53172b4ff660e890023cca4316832a2`(2026-10-12 17:42 UTC). 이 파일 하나만 담은 커밋이고, MBPI-Rx를 계산하는 코드·설정보다 앞선다.

## 바뀐 것과 바뀌지 않은 것

- **바뀌지 않은 것:** 30종의 MBPI·BBVI·MCUI·MFPI 값, 라벨, 매트릭스 유형, 근거 계수, 기준값 50, 하한값 규칙, 미탐색 후보 목록, 기존 사후 검증 기록 6건(MBPI 기준 미충족, MFPI 통과, MCUI 계열 4건). 종 객체에서 바뀐 것은 새 키 `mbpi_rx`와 버전 문자열뿐이다(`Verified410Tests.test_only_mbpi_rx_and_version_strings_move`).
- **더한 것:** 종마다 `mbpi_rx`(값, 1위 층, 1위 항목, 뺀 항목 수, 사유), 설정 `mbpi_rx`(분류표·제외 층·사유 문구), 사후 검증 `posthoc.validation_sets.MBPI_RX`(`exploratory: true`).
- 화면에는 세 곳에만 보인다: 종 상세 MBPI 칸 아래 한 줄(누르면 뺀 항목 수, 층 분류 기준, 사후 검증 사유, 사전 등록 경로), '비교와 지표' 데이터 표의 'MBPI-Rx' 열(정렬 가능, 값이 없으면 '–'로 정렬 맨 뒤), '근거와 방법' 03 카드 한 줄. 브라우저는 MBPI처럼 trace에서 값을 다시 확인하고, 맞지 않거나 MBPI가 숨겨지면 보이지 않는다.
- MBPI-Rx는 BBVI, 매트릭스, 활용 특성 칩, 지도, 바다 탐험, 미탐색 후보, 종 카드, 비교 탭 프로필·대화상자에 들어가지 않는다.

## 정의

MBPI-Rx는 기존 MBPI 규칙 그대로(항목마다 층 내부 백분위 × 근거 계수, 종의 최댓값, `round1`)에서 **제외 층의 항목만 뺀 값**이다. 항목 값은 다시 계산하지 않는다. **하한값 규칙(4.3)은 적용하지 않는다.** 남는 항목이 없으면 값은 `null`이고 사유는 "제외 층(ACE·잔틴 산화효소 펩타이드) 밖의 항목이 없습니다"다.

## 층 분류표

기준(사전 등록 3.1): **그 층의 비교집단이 식품 단백질(가수분해·발효 포함) 유래 기능성 펩타이드를 모은 DB 또는 문헌 집합인가.** 그렇다면 제외한다. 출처 근거와 한 줄씩의 표는 사전 등록 3.2–3.4절에 있고, 설정의 `mbpi_rx.classified_strata` 52줄과 같다.

| kind | 분류 | stratum_id | 이유 |
|---|---|---|---|
| peptide | **제외** | `ahtpdb-ace-ic50-hhl-cushman-cheung` | AHTPDB 초록: "derived from 35 major sources that include milk, egg, fish, pork, chicken, soybean, etc." 회원별 출처는 파일에 없다 |
| xo | **제외** | `xo-peptide-literature-2026-10-05` | 검색식에 `hydrolysate*`. 회원 46개 중 32개가 식품 단백질 출처·가수분해물 기록, 3개 식품 밖, 11개 출처 기록 없음(식품·영양 학술지) |
| (없음) | 포함 | `wijesinghe-2011-cell-free-ACE-IC50` | 감태 논문 1편의 분리 화합물 5개. 펩타이드 모음이 아니다 |
| chembl | 포함 | `ChEMBL_37:` + `CHEMBL247\|IC50`, `CHEMBL247\|EC50`, `CHEMBL378\|IC50`, `CHEMBL378\|EC50`, `CHEMBL612851\|IC50`, `CHEMBL2808\|EC50`, `CHEMBL613966\|EC50`, `CHEMBL5980\|EC50`, `CHEMBL5118\|IC50`, `CHEMBL5118\|Ki`, `CHEMBL1914\|IC50`, `CHEMBL4822\|IC50`, `CHEMBL5763\|IC50`, `CHEMBL2392\|Potency`, `CHEMBL4303835\|IC50` (15개) | 같은 표적·종말점의 ChEMBL 활성 기록 |
| chembl (사후 검증 사례) | 포함 | `ChEMBL_37:` + `CHEMBL335\|IC50`, `CHEMBL395\|IC50`, `CHEMBL398\|IC50` (3개) | 같음 |
| relaxed | 포함 | `ChEMBL_37:` + `CHEMBL1855\|IC50`, `CHEMBL1921\|EC50`, `CHEMBL5952\|Ki` (항목 있음), `CHEMBL1790\|EC50`, `CHEMBL5952\|EC50`, `CHEMBL3309\|IC50` (항목 없음) | 펩타이드를 ChEMBL 표적 비교집단에서 순위 |
| amp | 포함 | `amp-dbaasp-mic-broth-` + `staphylococcus-aureus`, `escherichia-coli`, `bacillus-subtilis`, `pseudomonas-aeruginosa`, `streptococcus-agalactiae`, `vibrio-anguillarum`, `vibrio-parahaemolyticus` (7개) | DBAASP 균종별 MIC 모음(항균 펩타이드 DB) |
| anticancer | 포함 | `anticancer-cancerppd-ic50-` + `a-549`, `hepg-2`, `hct-116`, `ht-29`, `pc-3` (항목 있음), `ccrf-cem`, `h-157`, `h-838`, `hela`, `hmler`, `hmler-shecad`, `jurkat`, `k-562`, `mcf-7`, `mda-mb-231`, `sw`, `u-251-mg`, `u-2-os` (항목 없음) | CancerPPD 2.0 세포주별 IC50 모음(항암 펩타이드 DB) |

분류표에 없는 stratum_id가 공개본 trace나 사후 검증 사례 항목에 나오면 build와 `posthoc_validation.py`가 멈춘다(`test_an_unclassified_stratum_stops_the_build`). 새 층은 새 사전 등록으로 분류한다.

## 30종 MBPI → MBPI-Rx

| 종 | 구분 | MBPI | MBPI 1위 층 | MBPI-Rx | Rx 1위 층 · 항목 | 뺀 항목 | null 사유 |
|---|---|---|---|---|---|---|---|
| 미역 | 운영 | 95.3 | ACE 펩타이드 | **없음** | — | 8 | 제외 층 밖 항목 없음 |
| 해삼 | 운영 | 8.7 | ACE 펩타이드 | **없음** | — | 1 | 제외 층 밖 항목 없음 |
| 멍게 | 운영 | 13.5 | ChEMBL 화합물 | 13.5 | ChEMBL 화합물 · halocynthiaxanthin | 0 | |
| 살오징어 | 운영 | 56.9 | ACE 펩타이드 | **없음** | — | 2 | 제외 층 밖 항목 없음 |
| 우뭇가사리 | 운영 | 13.5 | ChEMBL 화합물 | 13.5 | ChEMBL 화합물 · pheophorbide a | 0 | |
| 톳 | 운영 | 86.6 | ACE 펩타이드 | 45.3 | ChEMBL 화합물 · CHEMBL275911 (LXR-α EC50) | 3 | |
| 홍합(참담치) | 운영 | 10.1 | ChEMBL 화합물 | 10.1 | ChEMBL 화합물 · halocynthiaxanthin | 0 | |
| 참굴 | 운영 | 96.3 | ACE 펩타이드 | 62.6 | 항균 펩타이드 · Cg-BigDef1 (*S. aureus* MIC) | 2 | |
| 다시마 | 후보 | 26.5 | ChEMBL 화합물 | 26.5 | ChEMBL 화합물 · CHEMBL252561 | 0 | |
| 감태 | 후보 | 67.5 | ACE 화합물 | 67.5 | ACE 화합물 · dieckol | 0 | |
| 가시파래 | 후보 | 73.3 | ACE 펩타이드 | 2.3 | 항암 펩타이드 · HTDT-6-2-3-2 (A-549) | 1 | |
| 괭생이모자반 | 후보 | 21.6 | ChEMBL 화합물 | 21.6 | ChEMBL 화합물 · CHEMBL4085945 | 0 | |
| 꼬시래기 | 후보 | 49.3 | ChEMBL 화합물 | 49.3 | ChEMBL 화합물 · prostaglandin A2 | 0 | |
| 청각 | 후보 | 0.4 | ChEMBL 화합물 | 0.4 | ChEMBL 화합물 · CHEMBL5287816 | 0 | |
| 바지락 | 후보 | 58.6 | ACE 펩타이드 | **없음** | — | 7 | 제외 층 밖 항목 없음 |
| 전복(종 수준) | 후보 | 15.6 | ACE 펩타이드 | **없음** | — | 1 | 제외 층 밖 항목 없음 |
| 큰가리비 | 후보 | 36.4 | ACE 펩타이드 | **없음** | — | 1 | 제외 층 밖 항목 없음 |
| 시카메굴 | 후보 | 13.8 | ChEMBL 화합물 | 13.8 | ChEMBL 화합물 · flazine | 0 | |
| 피조개 | 후보 | 75.0 | 항암 펩타이드 | 75.0 | 항암 펩타이드 · P6 (HT-29) | 0 | |
| 가리맛조개 | 후보 | 56.9 | ACE 펩타이드 | 3.3 | 항암 펩타이드 · SCH-P10 (PC-3) | 1 | |
| 고등어 | 후보 | 34.9 | ACE 펩타이드 | **없음** | — | 4 | 제외 층 밖 항목 없음 |
| 멸치 | 후보 | 22.6 | ACE 펩타이드 | **없음** | — | 3 | 제외 층 밖 항목 없음 |
| 참조기 | 후보 | 53.8 | 잔틴 산화효소 펩타이드 | **없음** | — | 2 | 제외 층 밖 항목 없음 |
| 넙치 | 후보 | 29.2 | ACE 펩타이드 | **없음** | — | 2 | 제외 층 밖 항목 없음 |
| 조피볼락 | 후보 | 31.7 | 항균 펩타이드 | 31.7 | 항균 펩타이드 · TS40 | 0 | |
| 방어 | 후보 | 7.5 | ChEMBL 표적(펩타이드) | 7.5 | ChEMBL 표적(펩타이드) · sbGnRH | 0 | |
| 대구 | 후보 | 59.9 | ACE 펩타이드 | **없음** | — | 2 | 제외 층 밖 항목 없음 |
| 꽃게 | 후보 | 30.3 | 항균 펩타이드 | 30.3 | 항균 펩타이드 · MCCC1-MTS | 0 | |
| 참문어(동아시아 종) | 후보 | 70.5 | ChEMBL 표적(펩타이드) | 70.5 | ChEMBL 표적(펩타이드) · cephalotocin | 0 | |
| 갑오징어 | 후보 | 87.7 | ChEMBL 표적(펩타이드) | 87.7 | ChEMBL 표적(펩타이드) · FMRFamide | 0 | |

- 값이 있는 종 19종, 없는 종 11종. 1위 층이 바뀐 종은 톳·참굴·가시파래·가리맛조개 4종이다(ACE 펩타이드 → ChEMBL·항균·항암). 나머지 15종은 MBPI와 같은 값이다.
- 감태는 ACE 항목(dieckol) 그대로 67.5다. 비교집단이 펩타이드 모음이 아니라 논문 1편의 분리 화합물 5개라서다(사전 등록 3.3).

## 사후 검증 다시 보기 (탐색적)

| | 값 |
|---|---|
| 기준 문장 | "Origin species of a marine-derived drug at or beyond clinical stage should rank above operating candidates." (기존 그대로) |
| 운영 종 | 시범 8종. MBPI-Rx가 없는 미역·살오징어·해삼은 비교에서 빠짐 |
| 운영 종 MBPI-Rx 최댓값 | **62.6 (참굴, 항균 펩타이드 Cg-BigDef1)** |
| *Halichondria okadai* | 73.8 (okadaic acid, PTP1B IC50) → 62.6보다 높음 |
| *Ecteinascidia turbinata* | 56.1 (ET-770, KB 세포주 IC50) → 62.6보다 낮음 |
| *Conus magus* | 계산되지 않음(기존과 같음) |
| **결과** | **기준 미충족(failed)** |
| 사전 등록 예상(5.2절) | 기준 미충족(failed). 값까지 모두 같다 |

- 기록: `posthoc-validation-mbpi-rx-4.10-2026-10-12.json`(`python scripts/posthoc_validation.py --only mbpi-rx`). 설정 `posthoc.validation_sets.MBPI_RX`가 이 기록을 옮긴 것이고, 테스트가 다시 계산해 같은지 본다.
- 사례 항목은 모두 ChEMBL 층이라 사례 값은 기본 MBPI와 같다.
- 기본 MBPI에서 두 사례가 넘지 못한 미역 95.3·참굴 96.3(둘 다 ACE 펩타이드 층)은 빠졌다. 하지만 참굴의 다음 항목(항균 펩타이드 62.6)이 *E. turbinata*보다 높다.

**이 결과는 탐색적이다.** 규칙은 기존 MBPI 사후 검증 실패를 본 뒤 제안했고, 결과는 등록 전에 공개 데이터로 계산할 수 있었으며 실제로 계산해 사전 등록 5절에 적었다. 결과와 상관없이 MBPI-Rx는 보조 지표로만 싣고, 기본 MBPI·BBVI·MCUI·MFPI, 매트릭스 유형, 축 라벨은 바꾸지 않는다. 기본값을 바꿀지는 팀장 결정 사항으로 남긴다.

## 재현

- `python scripts/build_verified_indices.py --check` (기본 설정 `config/verified-indices-v4.10.json`)
- 4.9 공개본은 `archive/assessments-verified-4.9.json`, `--config config/verified-indices-v4.9.json`으로 바이트 단위까지 같게 재현되고 `mbpi_rx` 키가 없다(`Verified49Tests`).
- `python scripts/posthoc_validation.py --only mbpi-rx --out research/verified-indices/posthoc-validation-mbpi-rx-4.10-2026-10-12.json`
- 테스트: `Verified410Tests`(기본 지표 불변, 제외 층 항목 미사용, 값 = 남은 항목 최댓값, null 사유, 미분류 층에서 빌드 멈춤, 사후 검증 기록 = 재계산, 사전 등록 예상값과 일치).
- `dist/matrix-readiness.json`·`dist/expedition-stops.json`은 `--check`가 통과하고 바뀐 것은 버전 문자열뿐이다. `dist/unexplored-candidates.json`은 생성 스크립트가 WoRMS·GBIF·OBIS에 접속해야 하는데 작업한 클라우드에서는 막혀 있어, 그 스크립트가 공개본에서 읽는 값(BBVI와 기준 50)이 4.9와 같음을 확인하고 `reportVersion`만 고쳤다.
