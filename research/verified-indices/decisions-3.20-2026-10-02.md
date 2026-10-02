# verified-pilot-3.20 — 팀장 결정 3건 (2026-10-02)

3.19 결정 기록의 3번(다시마·꼬시래기 ChEMBL 원논문 연결)을 계산해 보고한 뒤, 팀장이 아래 세 가지를 추천안대로 결정했다.

## 1. 다시마: 원논문 연결 반영, MBPI 26.5

- **규칙**: Wikidata P703 진술이 있는 종에도 원논문 연결을 허용한다. 단, 원논문에 그 종(WoRMS 인정명 또는 동의어)의 학명과 시료 출처가 분명히 적혀 있어야 한다. 3.1의 다른 원논문 연결 조건(단일 화합물, 그 종에서 분리·동정, PubChem InChIKey 일치)과 연결 검수는 그대로 적용한다. 설정 키는 `chembl_bioactivity.paper_links_p703`, 자료는 `mbpi-paper-links-p703-2026-10-02.json`이다.
- **연결 3건** (Europe PMC 원문, 2026-10-02 재확인):
  - Lu et al. 2022 *PLoS ONE* 17:e0258980 (PMC8794173, CC BY): *Laminaria japonica*(다시마의 WoRMS 동의어), 중국 산둥 옌타이 양식(품종 GS-02-004-2013), 2018년 7월 수확 → 24-hydroperoxy-24-vinylcholesterol, saringosterol 분리
  - Foods 2023 12:244 (PMC9858231, CC BY): Kombu(*Saccharina japonica*), 일본 2021년 3–4월 채집 8배치 → saringosterol을 표준품 대비 ¹H NMR로 정량
- **값**: 24-hydroperoxy-24-vinylcholesterol, *T. brucei* IC50 3.2 µM(Hoet 2007), 4,525건 중 백분위 47.14 × 연결 0.75 × 활성 0.75 = **26.5**. 단일 논문 참고값이며 BBVI는 보류한다. saringosterol은 연결 논문이 2편이라 19.6이다. 두 값 모두 톳의 같은 화합물과 같은 비교집단·활성값을 쓴다.
- **주의문**: 두 산화 스테롤은 푸코스테롤이 빛·공기에 산화하면 생길 수 있다(Lu 2022 시료는 햇볕·오븐 건조). 톳 검수 때 달았던 주의문을 이번부터 화합물 단위(`compound_caveats`)로 톳과 다시마 상세에 함께 표시한다. 점수에는 영향이 없다.
- Lu 2022 본문의 화합물 2·5 이름은 ¹³C 값과 서로 뒤바뀐 것으로 보인다(C-24 89.1 ppm은 하이드로퍼옥사이드, 77.7 ppm은 saringosterol). 두 구조 모두 분리물에 있으므로 연결은 성립하고, 화합물별 수득량만 불확실하다. 연결 기록의 verification에 남겼다.
- 채워진 칸은 66 → 67이다. 다시마는 MFPI 56.7과 함께 참고 통합값 대상이 된다.

## 2. 꼬시래기: 보류

- 가장 높은 값 두 개(PGA2 인플루엔자 NS1 백분위 97.7, 15-keto-PGE2 ROR-γ 92.4)가 PubChem qHTS에서 ChEMBL이 'Inconclusive'로 표시한 행이다.
- 이 행들을 빼면 남는 것은 스크리닝 'Active' 한 건(DNA 중합효소 β, 백분위 약 87.6)과 약한 Nur77 결합 Kd(백분위 약 30)뿐이다. 종 점수 하나가 스크리닝 결과 한 건에 기대게 되므로 보류했다(`held` 항목).

## 3. ChEMBL 'Inconclusive'·'Not Active' 활성은 종 항목에서 제외

- 2026-09-30 수집기는 `activity_comment`를 저장하지 않았다. 그래서 등록자가 활성으로 판정하지 않은 qHTS 곡선값도 관계·유효성·중복·시험 유형 필터를 통과할 수 있었다.
- 수집 파일의 활성값 2,058건 전부의 판정 칸을 같은 ChEMBL_37 판에서 받았다(`snapshots/chembl-activity-comments-2026-10-02.json`). Inconclusive 88건(대소문자 포함), Not Active 12건, 합계 100건이며 이 행은 어떤 종 항목에도 들어가지 않는다.
- **공개 점수 변화 없음**: 3.19의 종 항목은 모두 이런 행을 쓰지 않았다.
- **민감도 값 변화**: 흔한 대사물 필터를 끈 민감도 보기만 바뀐다. 그 보기의 최댓값이 흔한 지방산의 qHTS 미확정 행이었기 때문이다.
  - 해삼 38.1 → 36.7, 멍게 69.7 → 68.5, 괭생이모자반 52.3 → 51.4, 청각 50.7 → 0.4
- 제외 후 중앙값이 바뀐 화합물 그룹 4개(아라키돈산·올레산, 민감도 보기에서만 쓰임)는 수집 파일에 그 위치 건수가 없었다. 같은 필터·같은 판에서 건수를 받았고, 네 비교집단 모두 총건수가 수집 당시와 같다.
- 한계: 비교집단(동료 값)에는 이런 행이 여전히 들어 있다. 비교집단 건수는 2026-09-30 API 집계 그대로다.

## 검사

- `build_verified_indices.py --check`, `build_matrix_readiness.py --check` 재현 일치
- unittest 214 OK: 3.19 공개본은 `archive/assessments-verified-pilot-3.19.json`으로 보관하고 `VerifiedPilot319Tests`가 재현한다. `VerifiedPilot320Tests`를 새로 추가했다.
- JS 11개 OK
- uicheck 134 PASS / 0 FAIL: 참고 통합값 목록에 다시마가 추가됐다.
