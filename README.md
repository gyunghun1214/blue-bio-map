# Blue-bio Value Map

alt F4의 Ocean 20 Challenge 본선 준비용 연구 프로토타입.

## 현재 구현

- 운영 DB에서 발행된 8종(참굴·홍합(참담치)·톳·우뭇가사리·살오징어·멍게·해삼·미역)의 요약을 읽는다. 분류명과 AphiaID를 확인한 추가 조사 후보 22종을 별도의 카탈로그로 붙여 총 30종을 탐색한다. **신규 22종은 GBIF·OBIS 개별 기록을 검수해(후보 셀 v2, 2026-10-01 규칙 갱신: CC BY-NC 4.0 허용·해안선 1 km 버퍼) 21종 544셀(기간별 행, 격자 347곳)·8,126건을 1° 셀(채취 민감종 전복·피조개는 4°)로 공개한다. CC BY-NC 기록이 든 셀은 비상업 연구용으로 표시한다. 셀은 출현 기록 집계이며 분포·자원량이 아니다. 후보 종도 운영 8종과 같은 규칙으로 축별 판정하되 "조사 후보"로 따로 표시한다.** 기존 8종의 공개 기준을 통과한 GBIF 기록만 1° 셀(해삼은 4°)로 일반화해 지도에 붉은 점 무늬로 표시한다. 셀을 누르면 기간별 집계·출처·이용조건·해역 판단 보류 사유가 나온다.
- 별도 시연 자료(다시마·참굴·돌기해삼, OBIS 1° 격자)는 운영 자료와 합산하지 않고 따로 선택한다.
- 이름·학명·분류·AphiaID 검색, 종 선택, 후보 비교, 정보 부족 종의 우선 조사 대상 목록, 활용 전 제도(ABS·BBNJ) 확인 목록, 출처·이용 조건 확인.
- 검증 전 시범 지표(`verified-pilot-3.6`, 입력 기준일 2026-10-01): MFPI 15종(피조개 아연은 일본 식품성분표 8정판 대체치), MBPI 13종(새 MBPI는 모두 단일 논문 참고값), MCUI 14종(IUCN 전 지구 평가 기반 7종 · 한국 국가 평가 기반 7종, 이 중 OBIS 출현 추세 감소 신호로 +10을 받은 종 4종: 살오징어·맛조개·멸치·참조기), BBVI 1종(참굴 80.9). BBVI × MCUI 매트릭스와 GIS 지도는 그림 5단계의 네 유형으로 표시한다. 국가 평가 기반 MCUI는 네모 점으로 구분하고, 지도 색은 '출현 기록 셀 × 종 유형'이며 해역 점수가 아니다. 우선 조사 대상 17종, 미탐색 후보 1종(시카메굴)은 점수와 섞지 않는 별도 표시다. **그림 단계별 구현 위치·자료원·이용조건·공식·한계와 2.3 → 현재 종별 값 변화는 [워크플로 그림 기준 방법 문서](docs/workflow-method.md)에 있다.**
- 방법 버전 이력: 2.3(2026-09-27) → 3.1 MBPI ChEMBL 층과 연결 검수 → 3.2 매트릭스 유형·GIS 셀 색·정보충분도 층 → 3.3 MFPI 섭취 부위·유사종 대체치 → 3.4 MCUI OBIS 출현 추세와 보전 평가 없음 우선 조사 → 3.5 규칙 변경 없이 검수된 근거 행 추가(펩타이드 5종·미역 Sato 원문, 양식 기록 3종) → 3.6 MFPI 아연 대체치에 일본 식품성분표 2020(8정판) 같은 종 생것 항목 추가. 버전마다 공개본을 `research/verified-indices/archive/`에 보관하고 테스트로 재현한다. 결정 기록은 `research/verified-indices/` (`mbpi-chembl-stratum-2026-09-29.md`, `matrix-gis-2026-09-30.md`, `mfpi-substitutes-2026-09-30.md`, `mcui-trend-2026-10-01.md`, `evidence-additions-2026-10-01.md`, `mext-zinc-2026-10-01.md`). [1번 과제 입력 감사](research/assessment-1/README.md)와 [30종 통합 방법 검토](docs/species-30-method-review.md)는 당시 작업 기록이다.
- 학명·출현 자료 연결과 활용·보전 지표 개발을 구분하는 설명 및 질의응답 연습.
- 외부 접속 없이 표시할 수 있도록 지도 경계와 Leaflet을 포함. 원문 링크는 인터넷 필요.

## 30종 카탈로그와 다음 데이터 작업

- [2026-09-26 신규 22종 OBIS 조회 감사](research/expansion-30/audit-2026-09-26.md): WoRMS 승인명을 다시 확인한 뒤 OBIS의 한반도 시험 범위 건수를 22종 모두 조회했다(21종 결과, 시카메굴 해당 질의 0건). 이 건수는 개별 기록·라이선스·중복·민감도를 검수한 출현 자료가 아니다. **OBIS 조회만으로 신규 공개 셀이나 지표를 추가하지 않았다.** 이후 감태에는 별도 원논문 검수로 시범 MBPI가 추가됐다. 화면의 종 상세는 GBIF와 OBIS 검색 상태를 별개로 보여준다.
- 선정·제외 기준: [research/expansion-30/README.md](research/expansion-30/README.md). 분류만 확인한 22종은 `dist/candidate-catalog.json`으로 읽으며, 국명·근연종과의 연결은 추가 검수 대상이다.
- 이전 OBIS/WoRMS 실험은 수집 가능한 환경에서 `python scripts/collect_expansion_research.py`를 실행하면 WoRMS 승인명과 한반도 시험 범위 OBIS 원자료·데이터셋 메타데이터를 **무시되는 `tmp/expansion-30/`**에만 저장한다. 실행 결과를 자동 발행하지 않는다. 수집·분류·라이선스·좌표 품질·민감도 확인 후에만 운영 DB에 공개 격자로 올릴 수 있다.
- GBIF 실측 감사와 22종별 보류 사유: [감사 보고서](research/expansion-30/audit-2026-09-25.md). 재현 명령은 `python scripts/collect_expansion_gbif.py`, `python scripts/audit_expansion_iucn.py`, `python scripts/build_expansion_evidence.py` 순서다. 원좌표/개별 기록 ID는 `tmp/`에만 남고 `dist/expansion-evidence.json`은 공개 전 연구 상태만 담는다.
- 후보 22종 중 21종에서 검수 기준을 통과한 공개 출현 셀 544개(기간별 행, 기록 8,126건)를 표시한다. 시카메굴은 기록 5건이 모두 해안선에서 1 km보다 안쪽 육지 좌표라 셀이 없다. 빈 지도는 조사 공백이며 부재의 증거가 아니다. 비교 표는 다섯 종씩 표시한다.

## 실행 및 자료 갱신

Python 표준 라이브러리만 필요하다. 프로젝트에서 `python -m http.server 8765 --bind 127.0.0.1 --directory dist` 실행 후 `http://127.0.0.1:8765/`를 연다.

자료 재수집은 `python scripts/collect_data.py`, 공개용 집계와 의존 자산 준비는 `python scripts/prepare_snapshot.py` 순서다. 원자료는 제외된 `tmp/`에만 저장하고, 배포 파일에는 원좌표·연락처를 포함하지 않는다. 재수집 후 출처와 이용 조건, 날짜, 포함 기준을 다시 검토해야 한다. 현재 조회는 종별 최대 1,000건이며 완전한 전수 자료가 아니다.

## 공개 배포 (2026-09-25)

- 공개 주소: https://blue-bio-map.blue-bio-map.workers.dev (Cloudflare Workers, 누구나 열람)
- 설정: 저장소 루트 `wrangler.jsonc`. `dist/`를 빌드 없이 그대로 제공한다.
- 자동 배포: Cloudflare Workers Builds가 이 저장소에 연결되어 있으면 `main`에 병합할 때마다 `npx wrangler deploy`로 자동 배포된다. 코드를 고치고 PR을 병합하는 것으로 충분하다.
- 수동 배포: 저장소 루트에서 `npx wrangler deploy` (Cloudflare 로그인 필요).
- 응답 헤더: `dist/_headers`. `app.js`·`style.css`·`pilot.css`·`live-data.js`·`vendor/*`는 1년 `immutable` 캐시이므로, 내용을 바꾸면 `index.html`의 `?v=` 값을 LF로 맞춘 파일 내용의 sha256 앞 10자로 다시 계산한다(`node verification/test_client_outdated.mjs`가 불일치를 잡는다. `vendor/`는 파일 이름을 바꾼다). 열려 있던 탭이나 캐시된 옛 `app.js`가 더 새 버전의 자료 파일(`assessments.json`의 `verified-pilot-*`, 각 JSON의 스키마 번호)을 받으면 파일·버전별로 한 번만 새로고침하고, 그래도 옛 코드면 "새 버전 있음"으로 표시한다. `index.html`·`*.json`은 기본 캐시.
- 기존 OpenAI Sites(chatgpt.site, 제한 공유)는 별도이며 Codex/ChatGPT의 Sites 도구로만 갱신된다.

## 자료 사용

`dist/data.json`에 종별 인용·라이선스·조회 URL·처리 방법을 기록했다. CC-BY-NC 4.0 자료를 포함하므로 비상업 연구 시연 범위로 사용한다. 상업적 이용·재배포 범위 변경 시 출처별 조건을 재검토한다. OBIS의 서로 다른 데이터셋 간 관측 중복과 원 동정 정확성은 아직 검증하지 않았다.

지도 경계는 Natural Earth 1:110m 데이터(public domain), 지도 라이브러리는 Leaflet 1.9.4(BSD-2-Clause, dist/vendor/LEAFLET-LICENSE)이다.

## 아직 구현·검증하지 않은 항목

모든 지표 계수·임계값·가중치는 팀의 시범 규칙이며 독립 사례로 검증하지 않았다. BBVI가 있는 종은 참굴뿐이다(단일 논문 MBPI가 많음). 출현 셀과 OBIS 추세는 조사 노력에 좌우되고, 셀이 없다는 것은 종 부재가 아니다. 자동 갱신, 사용자별 권한, 정밀 좌표 승인, 법률 적용 판정은 아직 없다.

아래 날짜별 작업 기록은 **당시의 상태**를 적은 것이다. 현재 기능과 산출 건수는 위 ‘현재 구현’과 `dist/assessments.json`을 기준으로 확인한다.

## 2026-09-22 확인

- 실제 자료 집계: 다시마 389건/14격자, 참굴 990건/33격자, 돌기해삼 507건/27격자.
- 브라우저에서 지도 표시·종 선택·없는 이름 검색·비교 화면·가상 예시 클릭 확인.
- 모바일 390px에서 문서 가로 넘침 없음 확인. 데스크톱 레이아웃 확인.
- WebMCP 읽기·종 선택의 정상 입력, 없는 AphiaID 입력 시 상태 보존 확인.
- 과학적 점수 및 예측 성능에 대한 검증은 수행하지 않았음.
# 2026-09-22: 운영 종 요약 연결

기본 화면은 Supabase의 발행된 `species_profiles` 2종을 공개용 키로 읽는다. 참굴 26건·살오징어 2건의 출처·관측 기간과 한계를 보여주고 좌표·점수는 검토 중으로 표시한다. 기존 `data.json` 3종은 별도 시연 모드로 보존했으며 운영 자료와 합산하지 않는다.

이번 변경은 로컬 검증 완료, 온라인 재배포 미완료(Sites 플러그인 실행 파일 부재). 운영 DB의 프로필 발행은 완료됐다. 상세 검증 및 Claude 점검 요청은 상위 `output/database/publication/README.md`를 참고한다.

# 2026-09-23: 공개 프로필 v2 표시 (로컬 완료 · 온라인 미반영)

운영 공개 프로필 3종(참굴·살오징어·해삼)의 `evidence_summary` v2를 읽어 영양·화합물·보전을 항목별로 표시한다. 건수와 상태는 API 값으로 계산한다. 키가 없으면 "정보 없음"으로 표시하고 0으로 바꾸지 않는다. v2 키가 없는 자료는 기존처럼 `production_summary`를 보여준다.

출현자료가 없는 종(`occurrence_status=not_collected`)은 "출현자료 미수집"으로 표시하며, 지도 도형은 만들지 않는다. CMNPD 화합물 요약에는 출처와 CC BY-NC-SA 4.0(비상업·동일조건) 안내를 함께 표시하고, 개별 화합물 자료는 요청하지 않는다.

검증: 서버를 띄운 상태에서 `node verification/uicheck.mjs <출력폴더>`를 실행한다. Chrome headless와 DevTools 프로토콜을 쓰며 추가 의존성은 없다. 2026-09-23 결과는 `verification/2026-09-23/`에 있다(24 PASS, 화면 캡처 포함).

## 운영 지도 셀 (2026-09-24, 운영 DB 반영 · 사이트 온라인 미배포)
- 운영 모드는 `species_profiles`와 함께 `species_map_cells`(공개 1° 셀)를 읽어 지도에 점선 셀로 표시한다. 팝업에는 기간·해역(LME)·국가·출처·이용조건·해상도(실제 가장 짧은 변)가 나온다. 원좌표와 기록 ID는 API에 없다.
- 셀 자료: `output/database/development/phase3_map/`(GBIF 입력 고정·SQL), `output/database/publication/publish_map_cells.sql`(발행). 기준은 `output/database/publication/OCCURRENCE_REVIEW.md`.
- 임시 '지도 시제품' 보기와 `dist/map-prototype.json`은 운영 반영 후 삭제했다.
- 검증: `python -m http.server 8765 --directory dist` 실행 후 `node verification/uicheck.mjs verification/<날짜>`. 운영 반영 전에는 `FIXTURE=<rest_fixture.json>`으로 로컬 DB 결과를 대신 넣어 검증할 수 있다. 2026-09-24: 로컬 DB 기준 33 PASS, 운영 API 기준 33 PASS.

## 배경 지도 선택 (2026-09-24, 로컬 · 온라인 미배포)
- 지도 제목 줄의 [기본 / 위성 / 수심] 버튼으로 바꾼다. 선택은 브라우저에만 기억한다(localStorage).
  - 기본: Natural Earth 1:10m 경계(`scripts/prepare_basemap.py`로 지도 범위만 잘라 `dist/countries.json` 생성, 427 KB). 외부 요청이 없다.
  - 위성: NASA GIBS Blue Marble(WMTS, 키 불필요). 출처 표시 문구는 GIBS 안내를 따른다.
  - 수심: GEBCO_2026 WMS. 출처 표시와 "항해용 아님" 문구를 함께 넣었다.
- 외부 타일을 불러오지 못하면(전환 후 4회 실패, 성공 0회) 기본 지도로 돌아가고 안내 문구를 띄운다.
- 종을 고르면 그 종의 셀 범위로 확대한다. '전체 범위'로 되돌릴 수 있다. 데스크톱 지도는 높이를 고정하고, 스크롤할 때 화면에 붙어 있다.
- 검증: 37 PASS(`verification/2026-09-24-basemap/`). 위성·수심 타일 로드, 셀 유지, 위성 서버를 막았을 때 기본 지도로 전환되는지 포함.

## 근거 현황 표시

발행 화면은 학명, 출현, 영양, 생리활성, 보전의 다섯 항목마다 **원자료 발견 → 종 연결 → 필수 근거 검수 → 시범 산출** 단계를 구분한다. 다섯 칸은 점수나 완성률이 아니다. 검증된 지표는 다른 축의 결측과 독립적으로 표시하며, 결측은 0으로 채우지 않는다. 보고 화합물 건수는 종의 정량 활성으로 세지 않는다. 영양 단위·기준량, 실험 조건, IUCN 평가 범위가 검수되지 않은 축은 산출하지 않는다. 현재 발행 수치와 출처는 `dist/assessments.json` 및 [연결 감사](research/verified-indices/coverage-reconciliation-2026-09-25.md)를 참고한다.

## 시범 지표 산출기

`python scripts/evaluate_candidates.py tmp/curated-evidence.json`은 출처와 검수 여부가 명시된 입력을 읽어 `tmp/assessments.json`에 **검증 전** 결과를 쓴다. 기본 실행은 공개 `dist/`를 수정하지 않는다. 입력 형식과 산출 조건은 [근거 입력 문서](docs/evidence-schema.md)에 있다. `python -m unittest discover -s verification -p 'test_*.py'`로 합성 사례의 불변조건을 확인할 수 있다.

별도 검토를 거쳐 공개한 `dist/assessments.json`의 시범 지표를 화면에 읽는다. `python scripts/build_verified_indices.py --check`(기본 설정 `config/verified-indices-v2.3.json`)로 공개 `dist/assessments.json`의 30종 점수와 보류 사유를 재현한다. v2·v2.1·v2.2 설정은 기록용이며 커밋된 산출물이 없어 `--check` 대상이 아니다. BBVI와 IUCN 전 지구 기반 MCUI를 모두 산출한 종만 실제 매트릭스에 배치한다. 한국 국가 평가 기반 MCUI는 별도 범위로 표시한다. 운영 요약의 영양 건수나 CMNPD 화합물 건수만으로 점수를 만들지 않는다. 감태 MBPI는 단일 원논문 안의 상대값이므로 참고값으로 표시한다.

## 조사 자료 접수 (2026-09-24)

팀원 조사 자료는 `research/`의 분야별 CSV 양식으로 모으고 `python scripts/check_research.py`로 검사한다. 작성 안내는 `research/README.md`. 접수 자료는 검토 전 기록이며 DB 입력·점수 산출·배포에 쓰지 않는다.

## 모든 운영 종의 지도 표시 (2026-09-25)

운영 종을 선택하면 항상 지도에 공간 도형이 나타난다. 기존 7종은 1° 공개 출현 셀을 표시한다. 해삼은 공개 이용조건과 위치 품질 기준을 통과한 GBIF 기록 2건을 채취 압력을 고려해 4° 광역 셀 2개로 표시한다. 이 셀은 2015년과 2025년의 출현 근거일 뿐, 현재 분포나 개체수·자원량을 뜻하지 않는다. 원좌표와 기록 ID는 공개하지 않았고, 민감도 평가는 미검토 상태로 둔다. 운영 DB 발행 과정과 입력 근거는 `../output/database/development/phase3_map/sea_cucumber_2026_09_25/`에 보관한다.

## 출현 셀 도트 표시

공개 API의 `species_map_cells`와 별도 OBIS 시연용 `data.json`은 집계 셀만 제공한다(운영 해삼은 4°, 그 밖의 운영 종과 시연 자료는 1°). 정밀 좌표와 레코드 ID는 공개하지 않는다. 화면의 **붉은 점**은 실제 발견 좌표가 아니라 이미 공개된 셀 안에만 고정한 **도식적 무늬**로, 한 점이 관측·조사 지점 또는 기록 한 건을 나타내지 않는다. 모든 종에 같은 붉은색을 쓰고, 셀 기록 수를 1–4, 5–19, 20–99, 100건 이상으로 구분해 1° 한 변에 각각 4, 6, 8, 10개씩 엇갈린 격자로 그린다. 4° 셀도 면적당 같은 기준(1–4건은 16×16)이며, 속도를 위해 한 변 24개로 제한한다. 점 크기는 확대 수준에 따라 커지되 점 간격의 40%를 넘지 않는다. 셀 경계는 붉은 점과 구별되는 남색(위성·수심 배경에서는 흰색) 점선으로 그린다. 같은 위치에 여러 기간 셀이 있을 때 패턴을 한 번만 그리며 기록 수 구간은 그 셀들의 합계로 정한다. Natural Earth 육지 경계 안의 점은 생략하며 해안선 근처의 근사 오차가 남을 수 있다. 셀 범위는 투명 클릭 영역으로 유지해 기간, 출처·이용조건, 실제 집계 건수, 공개 해상도와 해역별 판단 보류 사유를 확인할 수 있다. 붉은 점은 클릭을 받지 않는 별도 층에 그려 셀 팝업을 가리지 않는다.  개체수, 자원량, 생물학적 가치, 현재의 전체 분포를 추정하지 않는다.

## 사용자 화면 보강 (2026-09-25)

유사 플랫폼(Seafood Watch, Ocean Health Index, GBIF 민감종 지침, Global Fishing Watch, OBIS, Map of Life, IUCN Red List)의 설계를 참고해 다음을 더했다.

- **상태 요약 카드**: 종 상세 맨 위에 출현·MFPI·MBPI·MCUI·BBVI·보전 상태 칩과 발행일. 판정이 아니라 상태다.
- **정보충분도 막대**: 학명·출현·영양·가식부 검증·정량 활성·보전 평가 5칸. 연결 여부이며 품질 점수가 아니다. 비교표의 미확인 칸은 옅은 색으로 구분한다.
- **GBIF 용어의 일반화 표기**: 셀 팝업에 dataGeneralizations(좌표를 셀로 일반화, 이동·무작위화 없음), informationWithheld(원좌표·기록 ID 비공개), 민감도 근거, 재검토 예정일(미정)을 적는다.
- **조사 노력 배경층**: `python scripts/build_effort.py`로 OBIS 통계 API에서 1° 셀별 전체 해양생물 기록 수(2000년 이후)를 받아 `dist/effort.json`에 저장하고, 옅은 음영으로 표시한다. 붉은 점이 없는 바다가 "없음"인지 "조사 부족"인지 구분하기 위한 참고이며, 특정 종의 존재·개체수와 무관하다. 셀 팝업에도 해당 범위의 기록 수를 적는다.
- **기간 필터·공유 링크·CSV**: 공개 집계 기간이 여러 개인 종은 기간별로 걸러 본다. 선택 종·탭·배경·기간·지도 위치가 주소(#)에 담겨 링크로 공유된다. 셀 목록 표에서 공개 집계와 출처를 CSV로 내려받는다(셀 범위보다 세밀한 좌표 없음).
- **지도 읽는 법(ⓘ)**: 붉은 점, 점선 테두리, 회색 음영, 기간, 배경 지도 출처와 주의를 한 곳에 정리했다.

아직 하지 못한 것: 국립해양생물자원관 MBRIS API 연동은 공공데이터포털 인증키가 필요하다. 실제 종의 MCUI 시범 점수 2건은 있으나 매트릭스 배치에는 같은 종의 BBVI와 추가 검증이 필요하다([입력 감사](research/assessment-1/README.md) 참고).

## 운영 DB 연결 실패 시 저장된 사본 (2026-09-25)

운영 공개 API(Supabase)에 연결하지 못하면(네트워크 끊김·시간 초과·오류 응답) `dist/live-snapshot.json`의 공개 자료 사본을 대신 읽고, 상단에 "연결 실패 · 저장된 사본 사용 (날짜 기준) · 운영 발행 N종 · 조사 후보 M종"과 안내문을 띄운다. 빈 응답(200 `[]`)은 실패가 아니므로 사본으로 바꾸지 않고 "공개 기준 자료 연결됨 · 운영 발행 0종 · 조사 후보 22종"과 함께 보이는 종이 모두 조사 후보임을 알린다. 정상 연결도 운영 발행과 조사 후보를 따로 센다(`live-data.js`의 `publishedCount`·`candidateCount` 한 곳에서 계산). 사본은 공개 API가 주는 `species_profiles`·`species_map_cells` 열 그대로이며 원좌표·레코드 ID가 없다. 인터넷 없이 시연하려면 `python -m http.server 8765 --directory dist`로 로컬에서 연다(기본 배경 지도만 표시).

사본 갱신: `python scripts/snapshot_live.py`. URL·키·열 목록은 `dist/live-data.js`에서 읽는다. 운영 자료를 새로 발행한 뒤와 배포 전에 다시 실행한다.
