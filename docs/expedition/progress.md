# 바다 탐험 첫 버전 진행 기록

브랜치 `feat/ocean-expedition` (origin/main 531ea45에서 시작). 세션이 끊기면 `git status` → `git log` → 이 파일의 마지막 체크포인트부터 이어간다.

## C1 준비 (2026-10-08)

- 시작 상태: `fix/octopus-page-recheck` 브랜치, 추적 파일 변경 없음. 추적 안 되는 `verification/artifacts/`(예전 패널 리뷰 캡처)만 있어 손대지 않고 진행했다(브랜치 전환에 영향 없음).
- 열린 PR: #152(verified-4.8, `fix/octopus-page-recheck`)만 있다. 지표 버전과 `app.js`의 `VERIFIED`·`?v=` 해시를 바꾸므로, 이 브랜치는 `app.js`를 건드리지 않고 진입 링크를 `index.html` 헤더와 `theme.css`에만 둔다. 충돌은 `index.html`의 `?v=` 한 줄에서만 날 수 있다.
- 로컬 도구: Node 24.21(CI는 22), Python 3.13.2(CI는 3.12, 이 PC에 3.12 없음), Chrome 설치됨. 버전 차이는 기록만 하고 CI에서 22/3.12로 다시 확인한다.
- 쓸 스킬·도구: frontend-design(시각 방향), 데스크톱 앱 내장 브라우저(레퍼런스 관찰·화면 확인), Playwright 플러그인(필요 시 브라우저 조작), cloudflare web-perf(첫 로딩·프레임 점검 참고). 브라우저 검사는 기존 `verification/uicheck.mjs`의 Chrome DevTools 방식(의존성 없음)을 그대로 넓힌다.
- 기준선(main 531ea45, 이 PC): `node --check` 5개, `verification/test_*.mjs` 17개, `python -m unittest`(verification), `build_verified_indices.py`·`build_matrix_readiness.py`·`build_trait_evidence.py --check`, `uicheck.mjs` 모두 통과. **기존 실패 없음.** (`build_peptide_cohort.py`·`build_xo_cohort.py --check`는 비공개 원자료 `--source`가 필요해 CI에서도 돌리지 않는다.)

## 다음 할 일

- C5 항해·그래픽 구현(`expedition.html/js/css`, `build_expedition_stops.py`)

## C2 레퍼런스 관찰 (2026-10-08)

- `docs/expedition/reference.md`에 표와 요약. 데스크톱·모바일(390px) 모두 직접 조작했다. draft PR #154를 열었다.
- 결정: 오디오는 첫 버전에서 뺀다(레퍼런스도 MVP 뒤에 넣었고, 이 플랫폼의 기준인 '근거 확인'과 무관).

## C3 현재 프로젝트 확인 (2026-10-08)

프롬프트의 사실 목록을 코드로 다시 확인했다. 맞음: 빌드 도구 없는 `dist/` 정적 사이트 + `/api/*` Worker, `app.js` 308 KB, Leaflet `dist/vendor/leaflet.js`, 해시 `readHash/writeHash/applyHash`(`app.js` 2068행), 운영 8종 + 후보 22종, `verified-4.7` released, 검사 `verify.yml`.
다른 점·보탤 점:
- 운영 8종 셀은 `live-snapshot.json`의 `cells`가 `species_id`로 `profiles`와 이어진다(`aphia_id`는 `profiles`에만 있음). 셀 코드는 `deg1:N37E126:2000` 꼴이고 `N·E` 값이 셀의 남서 모서리, 마지막 숫자는 기간 시작 연도다(`live-data.js` 42행 해석과 같음).
- 해삼은 민감종이라 4° 셀만 공개된다. 탐험 화면도 4° 칸 그대로 그린다.
- 미역 MCUI 80은 IUCN이 아니라 연해주 지방 적색목록 참고값이고 라벨 "과대평가 역검증 미통과(6종 비교)"가 붙는다. 화면에 이 라벨을 같이 둔다.
- `index.html`의 `?v=` 해시는 `test_client_outdated.mjs`가 검사한다. 탐험 화면의 `?v=`도 같은 방식으로 검사한다.

### 연결할 데이터 필드 표

| 화면 요소 | JSON 경로 | 없을 때 표시 |
|---|---|---|
| 국명·학명·AphiaID | `assessments.json` `species[].korean_name / scientific_name / aphia_id` | (필수: 없으면 빌드 실패) |
| 네 지표 값 | `species[].scores.{MFPI,MBPI,MCUI,BBVI}` (표시 소수 1자리, 기존 화면과 같음) | `withheld_reasons[축]` 사유, 사유도 없으면 "자료 없음". 0으로 바꾸지 않음 |
| BBVI 라벨 | `species[].bbvi_label` (예: 단일 논문) | 라벨 없음 |
| 축 검증 상태 | `posthoc.validation_sets.{MFPI,MBPI}.result`, BBVI는 둘 다 통과일 때만 통과(`app.js` `validationResult`) | "검증 전" |
| MCUI 근거 | `mcui_basis` + `conservation_trace`(IUCN 범주·평가 연도·기준) / `national_assessment` / `mcui_substitute.label` | "미확인" |
| 식량 근거 | `food_trace.reported_food_name`, `nutrients.{protein_g,iron_mg,zinc_mg,calcium_mg}.value·unit·percentile`, `edible_fraction.value`, `aquaculture.feasible·method` | 성분별 "자료 없음"(`omitted_components`) |
| 생리활성 근거 | `bioactivity_trace` 중 `adjusted` 최대 항목(`app.js` `bestBio`): 표적·종말점·값·단위·서열/화합물·백분위·`original_paper_dois` | "자료 없음" |
| 매트릭스 유형 | `matrix-readiness.json` `species[].matrix_type` + `assessments.method.matrix.types` 라벨 | "유형 미배정" |
| 정보충분도 | `species[].information_sufficiency.mean_ratio` | "미확인" |
| 근거 링크 | `assessments.sources[source_id].title·url·license` | 링크 없이 "원자료 링크 없음" |
| 관측 셀 | `live-snapshot.json` `cells[]`(`cell_code`, `period_start/end`, `year_start/end`, `record_count`, `site_count`, `sea_areas`, `citations[].title·url·licenses`) | 해역명은 `cell-sea-areas.json`, 그래도 없으면 "해역명 미확인" |
| 공개 사본 기준일 | `live-snapshot.json` `fetched_at` | "기준일 미확인" |

## C4 설계 결정 (2026-10-08)

- `docs/expedition/design.md`. Three.js r170을 `dist/vendor/three/`에 고정(MIT, 출처·sha256은 `SOURCE.txt`). 카드 목록을 먼저 그리고 Three.js는 뒤에 불러와, 실패해도 데이터가 보이게 했다.
- 지점: 참굴(지속가능 활용) → 미역(대체생산·배양) → 해삼(보전 우선). 이유는 design.md 표.
- `app.js`는 바꾸지 않기로 했다(진입 링크는 `index.html` 헤더).
