# 바다 탐험 첫 버전 진행 기록

브랜치 `feat/ocean-expedition` (origin/main 531ea45에서 시작). 세션이 끊기면 `git status` → `git log` → 이 파일의 마지막 체크포인트부터 이어간다.

## C1 준비 (2026-10-08)

- 시작 상태: `fix/octopus-page-recheck` 브랜치, 추적 파일 변경 없음. 추적 안 되는 `verification/artifacts/`(예전 패널 리뷰 캡처)만 있어 손대지 않고 진행했다(브랜치 전환에 영향 없음).
- 열린 PR: #152(verified-4.8, `fix/octopus-page-recheck`)만 있다. 지표 버전과 `app.js`의 `VERIFIED`·`?v=` 해시를 바꾸므로, 이 브랜치는 `app.js`를 건드리지 않고 진입 링크를 `index.html` 헤더와 `theme.css`에만 둔다. 충돌은 `index.html`의 `?v=` 한 줄에서만 날 수 있다.
- 로컬 도구: Node 24.21(CI는 22), Python 3.13.2(CI는 3.12, 이 PC에 3.12 없음), Chrome 설치됨. 버전 차이는 기록만 하고 CI에서 22/3.12로 다시 확인한다.
- 쓸 스킬·도구: frontend-design(시각 방향), 데스크톱 앱 내장 브라우저(레퍼런스 관찰·화면 확인), Playwright 플러그인(필요 시 브라우저 조작), cloudflare web-perf(첫 로딩·프레임 점검 참고). 브라우저 검사는 기존 `verification/uicheck.mjs`의 Chrome DevTools 방식(의존성 없음)을 그대로 넓힌다.
- 기준선(main 531ea45, 이 PC): `node --check` 5개, `verification/test_*.mjs` 17개, `python -m unittest`(verification), `build_verified_indices.py`·`build_matrix_readiness.py`·`build_trait_evidence.py --check`, `uicheck.mjs` 모두 통과. **기존 실패 없음.** (`build_peptide_cohort.py`·`build_xo_cohort.py --check`는 비공개 원자료 `--source`가 필요해 CI에서도 돌리지 않는다.)

## 다음 할 일

- 없음(첫 버전 완료). 다음 확장 순서는 아래 C8.

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

## C5–C6 항해·그래픽과 발견·근거 (2026-10-08)

두 단계는 같은 상태 객체와 같은 카드·패널 코드를 쓰므로 한 커밋으로 묶었다.
- `scripts/build_expedition_stops.py` → `dist/expedition-stops.json`(3지점, 약 30 KB). 지점 셀은 규칙대로 골랐다: 참굴 `deg1:N34E127`(2010–2015년 29건), 미역 `deg1:N34E128`(2000–2015년 86건), 해삼 `deg4:N32E128`(2012–2015년 116건). 세 곳 모두 남해라 항로는 서→동 한 방향이 됐다(design.md의 "서해→남해→동해" 예상과 다름. 셀 선택 규칙을 바꾸지 않고 결과를 따름).
- 항로 경유점은 `countries.json` 해안선과 겹치지 않게 골랐고(검사는 C7 테스트), 출발점은 진도 남쪽 바다(연출).
- 화면: Three.js 바다 셰이더(물결 법선·햇빛 반짝임·해안 얕은 물과 흰 파도선·1° 경위선), 직접 만든 저폴리 조사선(선체·상부 구조·A프레임·구명정), 배 뒤 V자 항적 리본과 뱃머리 물보라, 1°/4° 셀 점선 칸.
- 발견: 도착 → 해역·관측 기록 → 생물(일러스트, 사진 자료 없음) → 핵심 두 축 + 나머지 축(라벨 포함) → '자세히 보기'(관측·식량·생리활성·보전·종합·원자료 22개 링크) → '지도에서 보기'.
- 핵심 두 축 = MFPI·MBPI·MCUI 중 큰 두 값(빠진 값은 순위에 넣지 않음). BBVI는 항상 작은 칸에 '종 전체 값 · 이 해역 값 아님'과 함께.
- 결정: 저성능이면 카드 목록으로 자동 전환하지 않고 한 번 안내만 한다(design.md에 이유). Three.js 폴더는 캐시 무효화를 위해 `vendor/three-r170/`으로 버전을 이름에 넣었다.
- 기존 화면 변경: `index.html` 헤더에 '바다 탐험' 링크, `theme.css`에 그 모양, `_headers`에 새 파일 캐시. `app.js`는 그대로.

## C7 접근성·대체 경로·검증 (2026-10-08)

- 새 테스트: `verification/test_expedition_stops.py`(재빌드 일치, 값·라벨·유형이 원본과 같음, 빠진 값은 0이 아닌 None, 셀이 바다 위 공개 셀, 지도 링크 형식, '서식' 문구 없음), `verification/test_expedition_ui.mjs`(빠른 연속 이동, 이전 지점 복귀 시 발견 단계 유지, 상세 열림 중 자동 이동 없음, 해시 형식, 항로가 해안선을 넘지 않음, `?v=` 해시). `verify.yml` unit 단계에 둘 다, browser 단계에 `expedition_check.mjs`를 더했다.
- 브라우저 확인(`verification/expedition_check.mjs`, 4개 환경 56 PASS)과 기존 `uicheck.mjs` 146 PASS. 결과·스크린샷·성능 수치는 `verification/2026-10-08-expedition/README.md`.
- 접근성: 키보드만으로 시작(Enter)·이동(←/→, 1–3)·상세(Enter)·닫기(Esc) 가능, 상세는 `<dialog>` 모달이라 포커스가 안에 머물고 닫으면 '자세히 보기'로 돌아온다. 도착 안내는 하단 진행 문구(aria-live)로 짧게. 모션 감소는 즉시 이동·물결 정지·단계 즉시 표시. 대비는 어두운 카드의 흰 글자·회청색 보조 글자, 상세는 밝은 종이 바탕에 남색 글자로 맞췄다(자동 대비 도구는 돌리지 않음).
- 기존 실패: 없음(1단계 기준선과 같음).

## C8 PR 정리 (2026-10-08)

- PR #154 본문: Before/After, 실행 방법, 스크린샷 위치, 검사 결과, 남은 한계. README에 탐험 화면 문단을 더했다. 지표·`docs/workflow-method.md`는 건드리지 않았다.
- 첫 CI에서 browser 단계의 모션 감소 환경이 느린 Windows 러너에서 키 입력 응답 시간 초과(30초)로 1건 실패했다. 모션 감소 환경의 연속 이동은 버튼 경로로 바꾸고(키보드 경로는 데스크톱에서 검사), 모션 감소일 때는 바뀐 것이 있을 때만 다시 그리게 해 CPU 부담을 줄였다.
- Cloudflare PR 미리보기: `wrangler.jsonc`가 `preview_urls: false`라 생기지 않는다.
- 다음 확장 순서: ① `STOPS`에 운영 종(톳·살오징어 등) 추가와 `ROUTE_VIA` 경유점 ② 후보 22종은 `expansion-public-cells.json`을 읽는 분기 추가 ③ 지도 해시에 셀 값을 넣어 노란 선 선택까지 연결(`app.js` 변경 필요) ④ 라이선스 확인한 종 사진.

## 항해 속도 (2026-10-08~)

브랜치 `claude/project-thread-p42tor`(origin/main d9397f2에서 시작, 클라우드 세션). 작업 지시: 프로젝트 공유 폴더 `prompts/expedition-sailing-speed-claude-code.md`.

- S1 기준선(main): `verify.yml` unit 단계 전부 통과, `expedition_check.mjs` 56 PASS, `uicheck.mjs` 151 PASS / 3 FAIL(외부 지도 타일 차단에 따른 기존 실패). 이 환경은 Python 3.12·Node 22, Chromium은 `--no-sandbox` 래퍼로 실행.
- S2 원인: `step()`의 `speed=.09`가 전체 항로 비율/초라 약 10.5 단위/초, 출발 가속 없음. 구간 2.6–4.4초 대부분을 최고 속도로 달려 카메라가 배를 놓쳤다.
- S3–S4 결정·구현: `design.md` '항해 속도와 움직임'. 손잡이 `SAIL.avgLegSeconds`(기본 8), `?sail=` 미리보기, 시간 기반 Hermite 항해(속도 이어받기), '바로 도착'(버튼·Space·End), 카메라 물러남·앞당김, 항적·물보라 정규화, 모바일 안내줄 두 줄 허용. 항로·지점·데이터·메인 지도 파일은 그대로.
- S5 검증: `test_expedition_ui.mjs`에 구간 시간·이징·재지정·바로 도착·`?sail=` 검사를 더하고 대기 시간을 `SAIL`에서 계산. `expedition_check.mjs` 65 PASS(새 9개), uicheck 기준선과 같음. 결과: `verification/2026-10-08-sailing/README.md`.
- 남은 일: 실제 GPU에서 60 fps와 기본 8초의 체감 확인(팀장 PC).
- 첫 CI(browser): 데스크톱·모바일에서 새 항해 검사 6건 실패. 원인은 Windows 러너가 시스템 애니메이션을 꺼 두어 Chrome이 `prefers-reduced-motion: reduce`로 보고한 것(배가 즉시 도착, '바로 도착' 숨김). 모션 감소를 강제한 로컬 실행에서 같은 3건이 그대로 재현됐다. `expedition_check.mjs`가 모션 감소가 아닌 환경에 `no-preference`를 명시하도록 고쳤다. 이전 CI는 이 때문에 데스크톱·모바일 항해 애니메이션을 사실상 검사하지 못하고 있었다. 느린 러너를 위해 항해 대기 상한을 `LONGEST×10`초로 넓혔다(통과하는 실행은 기다리지 않음).
