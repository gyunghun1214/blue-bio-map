# verified-pilot-3: 펩타이드 층과 국가 적색목록 층 (2026-09-26)

v2(`config/verified-indices-v2.json`, `dist/assessments.json`)는 그대로 둔다. v3는 별도 설정과 별도 출력이다.

```
python scripts/build_verified_indices.py --config config/verified-indices-v3.json --out research/verified-indices/assessments-v3.json [--check]
python scripts/build_peptide_cohort.py --source <AHTPDB pepic50.txt> [--check]
```

- 바꾸지 않은 것:
  - 영양(MFPI) 규칙
  - 가중치와 IUCN 숫자 매핑
  - BBVI 식(0.5 × MFPI + 0.5 × MBPI)
  - ChEMBL 저분자 층
- 추가한 것:
  - MBPI 펩타이드 층
  - MCUI 국가 평가 층
- 추가 근거는 `research/verified-indices/evidence-v3.json` 한 파일에만 둔다. v2 입력 파일은 건드리지 않았다.

## MBPI 펩타이드 층

- **비교집단**: AHTPDB IC50 내려받기(`pepic50.txt`, 2026-09-26, 3,364행, sha256은 `peptide-cohort-ahtpdb-ace-hhl.json`에 기록).
  - 넣는 행:
    - 시험법 열이 정확히 "Cushman and Cheung (1971)"인 행(HHL 기질 ACE 시험)
    - IC50이 µM·nM·mM 단일 숫자인 행
    - 표준 아미노산 서열인 행
  - 뺀 행: 범위, 부등호, "µM/L", 질량 단위, % 단위.
  - 같은 서열은 한 구성원으로 묶고 µM 중앙값을 쓴다.
  - 결과: **352개 펩타이드**.
- **최소 크기 30**: 30개면 한 순위 차이가 약 3 백분위점이다. 그보다 작으면 구성원 하나가 단일 DOI 감점(0.75)보다 점수를 더 크게 움직인다. 팀 시범 기준이다.
- **라이선스**: AHTPDB 내려받기 페이지에 라이선스 표기가 없다. 원파일과 서열은 저장소에 넣지 않았다. 비교집단 파일에는 AHTPDB 행 ID, 사용한 값, 원파일 해시만 있다.
- **종 점수 조건**(하나라도 빠지면 `partial_only`):
  - 원논문이 기원종의 실제 재료에서 서열을 확인했다.
  - 합성 펩타이드로 IC50을 쟀고, 그 값이 본문에 숫자로 있다(그림에만 있으면 제외).
  - ACE·HHL 기질을 원문에서 확인했다.
- **제외 대상**: 추출물·가수분해물·분획물은 `material_kind`에서 막는다. 기원종이 없으면 빌드가 멈춘다.
- **점수 계산**:
  - 점수값 pIC50 = 6 − log10(µM).
  - 백분위와 단일/복수 DOI 계수(0.75/1.0), 종별 최댓값 집계는 v2 저분자 층과 같다.
  - 펩타이드 항목은 `stratum_kind: "peptide"`로 표시한다.
  - 종 행에는 `mbpi_stratum`과 `bbvi_mbpi_from_peptide_stratum`을 붙인다.

| 종 | 펩타이드 | IC50 | 근거 | 판정 |
|---|---|---|---|---|
| 미역 *Undaria pinnatifida* | KNFL | 225.87 µM | Feng et al. 2021 *Mar Drugs* 19:177, 전문 확인(HHL, 합성 98%) | 산출: 백분위 26.1 × 0.75 = **19.6** |
| 참굴 *Magallana gigas* | AEYLCEAC | 4.287 mM | Chen et al. 2022 *Front Nutr* 9:981163, 전문 확인(HHL, 합성 >95%) | 산출: 백분위 1.4 × 0.75 = **1.1** |
| 미역 | VY·IY·AW·FY·VW·IW·LW | 1.5~42.3 µM | Sato et al. 2002 *JAFC* 초록 | 보류: 시험 기질을 원문에서 확인하지 못함(AHTPDB는 Cushman-Cheung으로 적음) |
| 미역 | AIYK·YKYY·KFYG·YNKL | 21~213 µM | Suetsuna & Nakano 2000 초록 | 보류: 같은 이유 |
| 참굴 | LSL | 107.17 nM | Feng et al. 2022 *Food Chem* 초록 | 보류: 같은 이유 |
| 살오징어 *Todarodes pacificus* | IIY·NPPK | pIC50 4.58·4.41 | Yu et al. 2019 *IJMS* 전문(HHL) | 보류: 미오신 서열의 in silico 절단 예측이며, 오징어 재료에서 방출을 관찰하지 않음 |

- 한계:
  - 비교집단의 시험법·값은 AHTPDB 큐레이션을 따르며, 원논문을 재확인하지 않았다.
  - 같은 서열의 중복 행 값이 서로 다른 경우가 있어(예: FY 3.7과 42.3 µM) 중앙값으로 묶었다.
  - 디펩타이드(IY, VW 등)는 여러 단백질에 흔한 서열이라 종 특이성이 낮다. 이번에 보류한 행 대부분이 여기에 해당한다.
- 참굴 MBPI 1.1은 비교집단 안에서 실제로 약하다는 뜻이며 빈칸이 아니다.
- 보류 행의 원문에서 HHL을 확인하면 미역 점수는 크게 오를 수 있다. 예: IW 1.5 µM.

## MCUI 국가 평가 층

- **출처**: 국립생물자원관 『국가생물적색자료집 통합본(2019-2024)』 찾아보기 표. 연체동물은 2022년 개정판이다. IUCN 지역 적용 지침으로 평가한 범주다.
- **적용 조건**: IUCN 전 지구 축이 `not_in_red_list` 또는 `category_not_numeric`(DD)일 때만 쓴다.
  - IUCN 숫자가 있으면 IUCN을 쓴다. 예: 살오징어는 IUCN LC.
  - 매핑은 IUCN과 같다(LC 10 등). 출력에는 `mcui_basis: "national"`과 `national_assessment.label: "국가 평가"`를 붙인다.
- **법정 보호 지정**(해양보호생물 등): 범주가 없으면 `legal_protection_facts`에 사실로만 둔다. 점수는 만들지 않는다. 이번 조사 범위에는 해당 종이 없다.
- **이름 연결**: WoRMS에서 같은 승인 종으로 풀리는 행만 연결했다.
  - *Mytilus unguiculatus* → *M. coruscus*
  - *Scapharca broughtonii* → *Anadara broughtonii*
  - *Sepia esculenta* → *Acanthosepion esculentum*

| 종 | 자료집 표기 | 범주 | 평가 페이지 |
|---|---|---|---|
| 참굴 *Magallana gigas* | 굴 *Magallana gigas* | LC | 1371 |
| 홍합 *Mytilus coruscus* | 홍합 *Mytilus unguiculatus* | LC | 1380 |
| 바지락 *Ruditapes philippinarum* | 바지락 | LC | 1375 |
| 피조개 *Anadara broughtonii* | 피조개 *Scapharca broughtonii* | LC | 1380 |
| 큰가리비 *Mizuhopecten yessoensis* | 큰가리비 | LC | 1379 |
| 가리맛조개 *Sinonovacula constricta* | 가리맛조개 | LC | 1370 |
| 갑오징어 *Acanthosepion esculentum* | 참갑오징어 *Sepia esculenta* | LC (IUCN은 DD) | 1379 |
| 살오징어 *Todarodes pacificus* | 살오징어 | LC | 1376 (IUCN 우선) |

- 연결하지 않은 행:
  - 참문어: 자료집은 *Octopus vulgaris* NT로 표기한다. WoRMS에서 *O. sinensis*와 다른 승인 종이다.
  - 전복: 북방전복 *Haliotis discus hannai* LC는 아종이라 종으로 옮기지 않았다.
- 검색 범위 안에서 미발견:
  - 해양 어류 7종: 자료집 어류는 담수 중심이다.
  - 해삼, 우렁쉥이, 해조류: 찾아보기에 극피동물·피낭동물·해조류 분류군이 없다.
  - 이 결과는 NE(미평가) 판정이 아니다.

## v2 → v3 (MFPI / MBPI / MCUI / BBVI)

| 종 | v2 | v3 | 바뀐 이유 |
|---|---|---|---|
| 미역 | 42.2 / — / — / — | 42.2 / 19.6 / — / **30.9** | MBPI 펩타이드 층 |
| 참굴 | 65.5 / — / — / — | 65.5 / 1.1 / 10.0 / **33.3** | MBPI 펩타이드 층, MCUI 국가 평가 |
| 홍합 | — / — / — / — | — / — / 10.0 / — | 국가 평가 |
| 바지락 (조사 후보) | 52.1 / — / — / — | 52.1 / — / 10.0 / — | 국가 평가 |
| 큰가리비 (조사 후보) | 56.3 / — / — / — | 56.3 / — / 10.0 / — | 국가 평가 |
| 피조개 (조사 후보) | — / — / — / — | — / — / 10.0 / — | 국가 평가 |
| 가리맛조개 (조사 후보) | — / — / — / — | — / — / 10.0 / — | 국가 평가 |
| 갑오징어 (조사 후보) | — / — / — / — | — / — / 10.0 / — | 국가 평가 |

- 30종 기준 채워진 칸 수(v2 → v3):
  - MFPI 7 → 7
  - MBPI 0 → 2
  - MCUI 7 → 14
  - BBVI 0 → 2
- 나머지 모든 종의 네 축 값은 v2와 같다.
