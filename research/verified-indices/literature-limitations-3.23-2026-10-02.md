# verified-pilot-3.23 — 문헌 행 한계 문구 표시 (2026-10-02)

점수는 하나도 바뀌지 않는다. 문헌 경로로 MFPI를 낸 종(시카메굴, 괭생이모자반)의 검수 한계 문구가 그동안 보고서와 화면 어디에도 나오지 않던 것을 고친다. 자료가 바뀌므로(`dist/assessments.json`) 버전을 올린다.

- 설정: `config/verified-indices-v3.23.json` (3.22 + `nutrition.substitutes.literature.show_limitations: true`). 3.22 공개본은 `archive/assessments-verified-pilot-3.22.json`에 보관하고 `VerifiedPilot322Tests`가 재현한다.
- 결정: 팀장(2026-10-02, "3.23도 진행해줘").
- 발견 경위: 'PR 병합 검토' 세션이 라이브 3.22에서 화면에 나오지 않는 한계 3건을 찾았다. 그중 가식부 줄 2건은 화면만 고치면 돼서 PR #107(표시 전용, 버전 유지)로 고쳤다. 나머지 1건이 이 수정이다. 원인은 '지도 사이트 데이터 수집' 세션이 빌더에서 찾았다.

## 1. 무엇이 빠져 있었나

`scripts/build_verified_indices.py`의 `literature_species_row()`는 문헌 행 파일(`mfpi-literature-rows-3.22-2026-10-02.json`)에서 값·수분·가식부를 읽었다. 그런데 항목마다 적어 둔 `limitations`는 돌려주는 행에 넣지 않았다. 그래서 3.15부터 3.22까지 이 문구는 `food_trace`에 들어가지 않았다. 보고서 JSON에도 화면에도 없었다. 가식부 자체의 한계(`edible_fraction.limitations`)는 따로 실려 있었고, #107부터 화면에 나온다.

| 종 | 빠져 있던 문구의 요지 (원문은 영어) |
|---|---|
| 시카메굴 (Liu 2021) | 한 만·한 계절(2월)·한 연령군 시료다. 건물 기준 값을 같은 굴의 평균 수분으로 환산했으므로 생시료 값에 수분 편차(± 3.3%)가 따라온다. RDA 비교집단 식품과 실험실·방법·지역이 다르다. 비교집단과 자기 자신 안에서만 순위를 매기며 구성원이 되지 않는다. |
| 괭생이모자반 (Murakami 2011) | 일본 한 해역(후쿠오카 치쿠젠해)·한 계절(2005년 1~5월)·날짜마다 통합시료 1개라 한국 시료가 없다. **단백질은 Kjeldahl 질소 × 6.25라 비단백 질소 때문에 해조류 단백질이 과대평가된다.** 철은 측정되지 않아 평균이 4개 중 3개 성분에 기댄다. 논문 자체 수치와 교차 확인한 결과(1월 단백질 9.42 vs 9.4 mg/g, 6개 날짜 평균 1.04 g 단백질·88.0% 수분 vs 초록의 1.0%·87.7%)도 함께 적혀 있다. |

## 2. 고친 것

- 빌더: `literature_species_row()`가 돌려주는 행에 `limitations`를 싣는다. 점수 계산과 관측 행 표시는 이 키를 쓰지 않으므로 출력이 바뀌지 않는다.
- 설정 플래그 `show_limitations`가 켜진 설정에서만, 문헌 행으로 점수를 낸 종의 `food_trace.uncertainty`에 `Literature row limitations: <문구>` 한 줄을 더한다. 문구가 비어 있으면 빌드가 멈춘다.
- 3.15~3.22 설정에는 이 플래그가 없다. 그래서 보관본이 그대로 재현된다(검사로 고정).
- 문헌 행 파일과 양식 기록 파일은 3.22의 것을 그대로 읽는다. 입력 파일을 고치지 않았으므로 로더의 출처 일치 조건(`set(파일 sources) == set(설정 source_ids)`)도 그대로다.
- 화면: `dist/app.js`의 표시 코드는 바꾸지 않았다. MFPI 상세 맨 끝의 기존 '불확실성:' 줄로 나온다. 같은 자리에 나오는 비교집단 순위 안내와 구분되도록 문장 앞에 'Literature row limitations:'를 붙였다. 바꾼 것은 버전 목록(`VERIFIED`)과 `index.html`의 `app.js?v=`뿐이다.

## 3. 결과 (3.22 → 3.23)

| 항목 | 3.22 | 3.23 |
|---|---|---|
| 30종 × 4축 점수·보류 사유 | – | 모두 같음 (68/120) |
| 시카메굴 `food_trace.uncertainty` | 6줄 | 7줄 (한계 문구 1줄 추가) |
| 괭생이모자반 `food_trace.uncertainty` | 4줄 | 5줄 (한계 문구 1줄 추가) |
| 그 밖의 차이 | – | 버전 표기(`method_version`, `changes_from`, 각 종 `food_trace.method_version`, 홍합 보충 기록의 '3.22 substitute' 문구)와 설정 플래그뿐 |

`VerifiedPilot323Tests.test_nothing_else_changes`가 이 표를 고정한다. 버전 표기, 플래그, 추가된 두 줄을 빼면 3.23 보고서와 3.22 보고서가 같아야 한다.

## 4. 넣지 않은 것

- 감태·가시파래 MFPI: 같은 시료 수분이 있는 성분 원문을 아직 확보하지 못했다. 감태는 김진아 2004 이화여대 박사논문(RISS, 원문 로그인 필요)이 남은 후보이고, 가시파래는 후보가 없다. 두 종 모두 양식 기록도 따로 있어야 한다. 이 버전에는 근거 행을 넣지 않았다.
- 화면 위치 이동: 한계 문구를 가식부 줄 근처로 옮기는 안은 `app.js` 표시 코드를 바꿔야 해서 이번 범위에서 뺐다.

## 5. 검사

- `build_verified_indices.py --check`, `build_matrix_readiness.py --check` 재현 일치
- unittest: `VerifiedPilot323Tests` 5개 신규(점수 불변, 두 종의 한계 문구, 그 밖의 차이 없음, 옛 설정에 플래그 없음, 재현). `VerifiedPilot322Tests`는 3.22 보관본을 재현한다.
- JS: `test_mfpi_substitutes_ui.mjs`가 두 종의 MFPI 상세에 'Literature row limitations'가 나오는지, 괭생이모자반에 'Kjeldahl'이 나오는지 확인한다. `test_client_outdated.mjs`는 버전 탐침을 하나씩 올렸다.
