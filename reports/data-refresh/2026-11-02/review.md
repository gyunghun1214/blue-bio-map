# 분기 자료 확인 · 검토 대기 (2026-11-02)

- 실행: 2026-11-02 19:37 UTC · 수동 실행 · [실행 기록](https://github.com/gyunghun1214/blue-bio-map/actions/runs/41511642584)
- 비교 기준: 사이트 자료 스냅샷 2026-10-15 · 방법 verified-4.19 · 30종
- 결과: 확인 79건 중 **바뀜 3** · 확인 불가 5 · 같음 71
- 이 목록은 사이트 숫자를 바꾸지 않습니다. 사람이 원문을 확인하고 반영을 정한 뒤, 기존 수집 스크립트로 갱신 PR을 따로 엽니다.

- IUCN 적색목록 GBIF 사본 갱신일: 2026-07-28 (우리 마지막 확인 2026-10-04) → **같음**

## AI 정리

- 2026-11-02 수동 실행 결과, 기준(2026-10-15, verified-4.19, 30종) 대비 **바뀜 3건, 확인 불가 5건, 같음 71건**입니다.
- 바뀐 3건은 멍게·조피볼락의 OBIS 출현 기록 수 감소, 갑오징어의 적색목록 범주 변경(DD → NE, GBIF 사본 기준)입니다.
- 확인 불가 5건 중 4건은 GBIF 응답 오류(HTTP 503)이고, 1건은 학명이 GBIF 분류 목록에 없는 경우입니다. 적색목록 판(2026-07-28 갱신)은 지난 확인 때와 같습니다.

### 먼저 볼 것

**바뀐 항목**
- **갑오징어** (*Acanthosepion esculentum*), 적색목록 범주 DD → NE
  - 확인할 곳: IUCN 적색목록 원문에서 같은 학명과 평가 연도로 범주를 확인합니다. 지금 값은 GBIF 사본 기준이며, 원문 확인 뒤에만 반영합니다.
  - 닿는 화면 값: 보전 시급성(MCUI), 활용·보전 사분면
- **멍게** (*Halocynthia roretzi*), OBIS 출현 기록 수 306 → 207 (-32.4%)
  - 확인할 곳: OBIS에서 이 학명의 출현 기록 수가 이번 조회 조건에서 실제로 줄었는지 확인합니다.
  - 닿는 화면 값: 자체 예비평가(Rapid LC) 입력값
- **조피볼락** (*Sebastes schlegelii*), OBIS 출현 기록 수 497 → 399 (-19.7%)
  - 확인할 곳: OBIS에서 이 학명의 출현 기록 수가 이번 조회 조건에서 실제로 줄었는지 확인합니다.
  - 닿는 화면 값: 자체 예비평가(Rapid LC) 입력값

**다시 돌려 볼 항목 (확인 불가)**
- GBIF 출현 기록 수, HTTP 503 응답 (4건). 일시적인 서버 오류일 수 있으니 재실행으로 다시 받아 봅니다.
  - 미역 (*Undaria pinnatifida*), 이전 값 1523
  - 멍게 (*Halocynthia roretzi*), 이전 값 242
  - 톳 (*Sargassum fusiforme*), 이전 값 1553
  - 다시마 (*Saccharina japonica*), 이전 값 2012
- **감태** (*Ecklonia cava*), 적색목록 범주 (이전 값 NE)
  - 이 학명이 GBIF 분류 목록에 없어 조회하지 못했습니다. 재실행만으로는 해결되지 않을 수 있으니 학명 표기나 조회 경로를 확인해 봅니다.

멍게는 OBIS 값이 바뀐 동시에 GBIF 값은 확인되지 않았습니다. 두 출처를 함께 보고 판단하는 것이 좋습니다.

<sub>정리: claude-opus-5-5. 표가 기준이며, AI는 표를 바꾸지 않습니다.</sub>

## 사람이 확인할 것

| 종 | 자료 | 항목 | 사이트 값 | 지금 값 | 메모 | 닿는 화면 값 |
|---|---|---|---|---|---|---|
| 멍게 *Halocynthia roretzi* | OBIS | 출현 기록 수(예비평가 조건) | 306 | 207 | -32.4% | 자체 예비평가(Rapid LC) 입력값 |
| 조피볼락 *Sebastes schlegelii* | OBIS | 출현 기록 수(예비평가 조건) | 497 | 399 | -19.7% | 자체 예비평가(Rapid LC) 입력값 |
| 갑오징어 *Acanthosepion esculentum* | IUCN(GBIF 사본) | 적색목록 범주 | DD | NE | GBIF 사본 기준. IUCN 적색목록 원문에서 같은 학명·평가 연도를 확인한 뒤에만 반영 | 보전 시급성(MCUI) · 활용·보전 사분면 |

### 확인 불가(다시 돌려 볼 것)

| 종 | 자료 | 항목 | 사이트 값 | 지금 값 | 메모 | 닿는 화면 값 |
|---|---|---|---|---|---|---|
| 미역 *Undaria pinnatifida* | GBIF | 출현 기록 수(예비평가 조건) | 1523 |  | HTTP 503 · https://api.gbif.org/v1/occurrence/search?decimalLatitude=0%2C60&decimalLongitude=105%2C165&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&taxonKey=5422556&year=1990%2 |  |
| 멍게 *Halocynthia roretzi* | GBIF | 출현 기록 수(예비평가 조건) | 242 |  | HTTP 503 · https://api.gbif.org/v1/occurrence/search?decimalLatitude=0%2C60&decimalLongitude=105%2C165&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&taxonKey=2331879&year=1990%2 |  |
| 톳 *Sargassum fusiforme* | GBIF | 출현 기록 수(예비평가 조건) | 1553 |  | HTTP 503 · https://api.gbif.org/v1/occurrence/search?decimalLatitude=0%2C60&decimalLongitude=105%2C165&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&taxonKey=3196917&year=1990%2 |  |
| 다시마 *Saccharina japonica* | GBIF | 출현 기록 수(예비평가 조건) | 2012 |  | HTTP 503 · https://api.gbif.org/v1/occurrence/search?decimalLatitude=38.5%2C60&decimalLongitude=128%2C165&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&taxonKey=5422368&year=199 |  |
| 감태 *Ecklonia cava* | IUCN(GBIF 사본) | 적색목록 범주 | NE |  | GBIF 분류 목록에 이 학명이 없음 |  |

### 검토 순서

- [ ] 바뀐 항목마다 원문(IUCN 적색목록·WoRMS·OBIS·GBIF)을 직접 열어 확인
- [ ] 반영할 항목은 해당 수집 스크립트를 다시 돌려 별도 PR로 갱신(점수·화면 확인 포함)
- [ ] 반영하지 않을 항목은 이 PR에 이유를 한 줄 남김
- [ ] 이 PR은 기록만 남기므로 병합하거나 닫아도 사이트는 바뀌지 않음

<details><summary>같음 71건 펼치기</summary>

| 종 | 자료 | 항목 | 사이트 값 | 지금 값 | 메모 | 닿는 화면 값 |
|---|---|---|---|---|---|---|
| 미역 *Undaria pinnatifida* | WoRMS | 승인 학명 | Undaria pinnatifida | Undaria pinnatifida |  |  |
| 미역 *Undaria pinnatifida* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 미역 *Undaria pinnatifida* | OBIS | 출현 기록 수(예비평가 조건) | 1607 | 1506 | -6.3% (작은 차이) |  |
| 해삼 *Apostichopus japonicus* | WoRMS | 승인 학명 | Apostichopus japonicus | Apostichopus japonicus |  |  |
| 해삼 *Apostichopus japonicus* | IUCN(GBIF 사본) | 적색목록 범주 | EN | EN |  |  |
| 멍게 *Halocynthia roretzi* | WoRMS | 승인 학명 | Halocynthia roretzi | Halocynthia roretzi |  |  |
| 멍게 *Halocynthia roretzi* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 살오징어 *Todarodes pacificus* | WoRMS | 승인 학명 | Todarodes pacificus | Todarodes pacificus |  |  |
| 살오징어 *Todarodes pacificus* | IUCN(GBIF 사본) | 적색목록 범주 | LC | LC |  |  |
| 우뭇가사리 *Gelidium elegans* | WoRMS | 승인 학명 | Gelidium elegans | Gelidium elegans |  |  |
| 우뭇가사리 *Gelidium elegans* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 톳 *Sargassum fusiforme* | WoRMS | 승인 학명 | Sargassum fusiforme | Sargassum fusiforme |  |  |
| 톳 *Sargassum fusiforme* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 톳 *Sargassum fusiforme* | OBIS | 출현 기록 수(예비평가 조건) | 1985 | 1972 | -0.7% (작은 차이) |  |
| 홍합(참담치) *Mytilus coruscus* | WoRMS | 승인 학명 | Mytilus coruscus | Mytilus coruscus |  |  |
| 홍합(참담치) *Mytilus coruscus* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 참굴 *Magallana gigas* | WoRMS | 승인 학명 | Magallana gigas | Magallana gigas |  |  |
| 참굴 *Magallana gigas* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 다시마 *Saccharina japonica* | WoRMS | 승인 학명 | Saccharina japonica | Saccharina japonica |  |  |
| 다시마 *Saccharina japonica* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 다시마 *Saccharina japonica* | OBIS | 출현 기록 수(예비평가 조건) | 1788 | 1788 |  |  |
| 감태 *Ecklonia cava* | WoRMS | 승인 학명 | Ecklonia cava | Ecklonia cava |  |  |
| 감태 *Ecklonia cava* | OBIS | 출현 기록 수(예비평가 조건) | 1943 | 1915 | -1.4% (작은 차이) |  |
| 가시파래 *Ulva prolifera* | WoRMS | 승인 학명 | Ulva prolifera | Ulva prolifera |  |  |
| 가시파래 *Ulva prolifera* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 괭생이모자반 *Sargassum horneri* | WoRMS | 승인 학명 | Sargassum horneri | Sargassum horneri |  |  |
| 괭생이모자반 *Sargassum horneri* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 괭생이모자반 *Sargassum horneri* | OBIS | 출현 기록 수(예비평가 조건) | 2123 | 2038 | -4.0% (작은 차이) |  |
| 괭생이모자반 *Sargassum horneri* | GBIF | 출현 기록 수(예비평가 조건) | 1231 | 1220 | -0.9% (작은 차이) |  |
| 꼬시래기 *Gracilaria vermiculophylla* | WoRMS | 승인 학명 | Gracilaria vermiculophylla | Gracilaria vermiculophylla |  |  |
| 꼬시래기 *Gracilaria vermiculophylla* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 꼬시래기 *Gracilaria vermiculophylla* | OBIS | 출현 기록 수(예비평가 조건) | 1100 | 1029 | -6.5% (작은 차이) |  |
| 꼬시래기 *Gracilaria vermiculophylla* | GBIF | 출현 기록 수(예비평가 조건) | 1061 | 1045 | -1.5% (작은 차이) |  |
| 청각 *Codium fragile* | WoRMS | 승인 학명 | Codium fragile | Codium fragile |  |  |
| 청각 *Codium fragile* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 청각 *Codium fragile* | OBIS | 출현 기록 수(예비평가 조건) | 1403 | 1381 | -1.6% (작은 차이) |  |
| 청각 *Codium fragile* | GBIF | 출현 기록 수(예비평가 조건) | 1370 | 1338 | -2.3% (작은 차이) |  |
| 바지락 *Ruditapes philippinarum* | WoRMS | 승인 학명 | Ruditapes philippinarum | Ruditapes philippinarum |  |  |
| 바지락 *Ruditapes philippinarum* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 전복(종 수준) *Haliotis discus* | WoRMS | 승인 학명 | Haliotis discus | Haliotis discus |  |  |
| 전복(종 수준) *Haliotis discus* | IUCN(GBIF 사본) | 적색목록 범주 | EN | EN |  |  |
| 큰가리비 *Mizuhopecten yessoensis* | WoRMS | 승인 학명 | Mizuhopecten yessoensis | Mizuhopecten yessoensis |  |  |
| 큰가리비 *Mizuhopecten yessoensis* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 시카메굴 *Magallana sikamea* | WoRMS | 승인 학명 | Magallana sikamea | Magallana sikamea |  |  |
| 시카메굴 *Magallana sikamea* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 피조개 *Anadara broughtonii* | WoRMS | 승인 학명 | Anadara broughtonii | Anadara broughtonii |  |  |
| 피조개 *Anadara broughtonii* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 가리맛조개 *Sinonovacula constricta* | WoRMS | 승인 학명 | Sinonovacula constricta | Sinonovacula constricta |  |  |
| 가리맛조개 *Sinonovacula constricta* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 고등어 *Scomber japonicus* | WoRMS | 승인 학명 | Scomber japonicus | Scomber japonicus |  |  |
| 고등어 *Scomber japonicus* | IUCN(GBIF 사본) | 적색목록 범주 | LC | LC |  |  |
| 멸치 *Engraulis japonicus* | WoRMS | 승인 학명 | Engraulis japonicus | Engraulis japonicus |  |  |
| 멸치 *Engraulis japonicus* | IUCN(GBIF 사본) | 적색목록 범주 | LC | LC |  |  |
| 참조기 *Larimichthys polyactis* | WoRMS | 승인 학명 | Larimichthys polyactis | Larimichthys polyactis |  |  |
| 참조기 *Larimichthys polyactis* | IUCN(GBIF 사본) | 적색목록 범주 | LC | LC |  |  |
| 넙치 *Paralichthys olivaceus* | WoRMS | 승인 학명 | Paralichthys olivaceus | Paralichthys olivaceus |  |  |
| 넙치 *Paralichthys olivaceus* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 조피볼락 *Sebastes schlegelii* | WoRMS | 승인 학명 | Sebastes schlegelii | Sebastes schlegelii |  |  |
| 조피볼락 *Sebastes schlegelii* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 조피볼락 *Sebastes schlegelii* | GBIF | 출현 기록 수(예비평가 조건) | 420 | 406 | -3.3% (작은 차이) |  |
| 방어 *Seriola quinqueradiata* | WoRMS | 승인 학명 | Seriola quinqueradiata | Seriola quinqueradiata |  |  |
| 방어 *Seriola quinqueradiata* | IUCN(GBIF 사본) | 적색목록 범주 | LC | LC |  |  |
| 대구 *Gadus macrocephalus* | WoRMS | 승인 학명 | Gadus macrocephalus | Gadus macrocephalus |  |  |
| 대구 *Gadus macrocephalus* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 꽃게 *Portunus trituberculatus* | WoRMS | 승인 학명 | Portunus trituberculatus | Portunus trituberculatus |  |  |
| 꽃게 *Portunus trituberculatus* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 꽃게 *Portunus trituberculatus* | OBIS | 출현 기록 수(예비평가 조건) | 598 | 598 |  |  |
| 꽃게 *Portunus trituberculatus* | GBIF | 출현 기록 수(예비평가 조건) | 644 | 581 | -9.8% (작은 차이) |  |
| 참문어(동아시아 종) *Octopus sinensis* | WoRMS | 승인 학명 | Octopus sinensis | Octopus sinensis |  |  |
| 참문어(동아시아 종) *Octopus sinensis* | IUCN(GBIF 사본) | 적색목록 범주 | NE | NE |  |  |
| 갑오징어 *Acanthosepion esculentum* | WoRMS | 승인 학명 | Acanthosepion esculentum | Acanthosepion esculentum |  |  |

</details>
