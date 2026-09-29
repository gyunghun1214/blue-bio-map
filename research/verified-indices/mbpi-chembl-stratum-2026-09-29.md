# verified-pilot-3.1: 자동 ChEMBL 생리활성 층 추가 (그림 2·3단계 MBPI, 2026-09-29)

- 공개 방법: `verified-pilot-3.1` (`config/verified-indices-v3.1.json`, `scripts/build_verified_indices.py`의 기본 설정).
- 이전 방법: `verified-pilot-2.3` (`config/verified-indices-v2.3.json`). 2.3 공개본은 `research/verified-indices/archive/assessments-verified-pilot-2.3.json`에 그대로 보관하고, 테스트로 계속 재현한다.
- 근거 그림: 팀 워크플로 그림 2단계(종→화합물 연결, 구조 표준화)와 3단계 MBPI(활성값, 비교 코호트, 백분위, 근거 계수).
- 상태: 검증 전 시범 지표(`provisional_unvalidated`).

## 1. 바꾼 이유

2.3의 MBPI는 사람이 원논문을 읽고 검수한 두 층만 썼다. 감태 ACE 저분자 층과 AHTPDB 펩타이드 층이다. 그래서 30종 중 3종(미역·참굴·감태)만 MBPI가 있었다. 그림은 "종 → 보고 화합물 → 공개 생리활성 DB"를 자동으로 잇는 연결을 요구한다. 3.1은 이 연결을 공개 표준(ChEMBL pChEMBL)으로 한 층 더 만든다. 기존 두 층은 그대로 두고 더 높은 근거 수준(1)으로 유지한다. 새 층은 근거 수준 2다.

화면 표기: **"이 종에서 보고된 화합물의 공개 생리활성(잠재력) · 종 추출물의 효능 아님"**. 층·표적·화합물·출처를 함께 보여 준다.

## 2. 규칙 (설정 `chembl_bioactivity`)

| 단계 | 규칙 | 근거 |
|---|---|---|
| 이름 | WoRMS AphiaID의 승인명과 모든 동의어. 종마다 AphiaID ↔ 동의어 표를 스냅숏에 저장 | WoRMS REST |
| 종→화합물 | 위키데이터 P703(found in taxon) 진술 중 P248 참고문헌에 DOI가 있는 것. 종마다 SPARQL 한 번, User-Agent 명시 | LOTUS 가져오기(DOI 10.5281/zenodo.5794106) |
| P703이 없는 종 | CMNPD·PubChem 분류군 'Natural Products'·Europe PMC 원논문을 찾아 검수한 연결만 인정(`mbpi-paper-links-2026-09-29.json`) | 원논문 |
| 흔한 대사물 제외 | 화합물별 P703 분류군 수가 전체 분포의 Tukey 상한(Q3 + 1.5·IQR, `statistics.quantiles(n=4, inclusive)`)을 넘으면 제외. 지방산·아미노산·스테롤·카로티노이드처럼 한 종을 말해 주지 않는 물질 | 재현 가능한 통계 규칙, 종별 예외 없음 |
| 승인 약물 제외 | ChEMBL 부모 분자 max_phase 4 제외. LOTUS 문헌 추출이 시험 대조약을 생물에 붙인 사례(지도부딘 → 감태, DOI 10.1016/j.bmc.2008.07.078) | ChEMBL |
| 구조 표준화 | InChIKey → ChEMBL 분자 → 부모 분자(염·용매화물 통합) → PubChem CID | ChEMBL, PubChem |
| 활성값 | pChEMBL 있음, 관계 '=', data_validity_comment 없음 또는 'Manually validated', potential_duplicate 아님, 시험 유형 B·F | ChEMBL pChEMBL 정의 |
| 층 | 단백질 표적(효소·수용체 등), 암세포주(Cellosaurus 'Cancer cell line'), 병원체(ChEMBL 분류 Bacteria·Viruses·원충·기생충). ADMET, UNCHECKED, NON-MOLECULAR 등은 쓰지 않음 | ChEMBL target_type, Cellosaurus |
| 코호트 | 같은 표적 × 같은 종말점(standard_type)의 모든 인정 활성 기록. 최소 30건(펩타이드 층과 같은 이유: 한 순위 차이가 약 3백분위) | 민감도 10·100건 |
| 종의 값 | 부모 분자의 인정 활성 중앙 pChEMBL. 백분위 = 100 × (아래 수 + 0.5 × 같은 수) / 전체 | 2.3과 같은 식 |
| 근거 계수 | 종 연결 계수(연결 DOI 1편 0.75, 2편 이상 1.0) × 활성 계수(ChEMBL 문서 1건 0.75, 2건 이상 1.0) | 2.3 DOI 계수와 같은 값 |
| 층 안 항목 | 종·부모 화합물·층마다 하나. 그 화합물의 표적 × 종말점 코호트 중 백분위가 가장 높은 것(같으면 기록이 많은 쪽) | – |
| 종 MBPI | 모든 층의 조정값 중 최댓값. 중앙값·평균은 민감도 | 2.3과 같음 |
| BBVI 독립 조건 | `bbvi.minimum_independent_mbpi_dois` 2를 min(종 연결 DOI, ChEMBL 문서) ≥ 2로 적용. 미달이면 "참고값(단일 논문)"과 BBVI 보류 | 2.3 단일 출처 규칙 |

규칙 민감도(`sensitivity.rule_sensitivity`): 최소 코호트 10건·100건, 흔한 대사물 필터 없음, 로그 척도 Tukey 상한, 승인 약물 필터 없음. 각 값은 그 규칙만 바꿨을 때의 종 MBPI다.

## 3. 바뀐 값

2.3 → 3.1에서 MBPI가 생긴 종은 10종, 값이 바뀐 기존 종은 없다(미역·참굴·감태는 검수 논문 층이 그대로 최댓값). MFPI·MCUI는 바뀌지 않았다. BBVI는 모든 새 ChEMBL 점수가 독립 조건(min(연결 DOI, ChEMBL 문서) ≥ 2)에 미달이라 새로 생기지 않았다.

| 종 | 2.3 MBPI | 3.1 MBPI | 점수 항목 (층 · 화합물 · 표적 · 종말점) | 백분위 (코호트 n) | 연결 DOI / ChEMBL 문서 | BBVI | 필터 없음 | 로그 상한 | 최소 10 | 최소 100 | 약물 필터 없음 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 미역 (145721) | 19.6 | 19.6 | 검수 논문 층 `ahtpdb-ace-ic50-hhl-cushman-cheung` | 26.1 | – | – | 54.8 | 54.8 | 19.6 | 19.6 | 19.6 |
| 멍게 (250680) | – | 43.4 | protein · OXYPURINOL · Beta-lactamase · Potency | 57.9 (61,719) | 2 / 1 | – | 69.7 | 69.7 | 43.4 | 43.4 | 43.4 |
| 톳 (494972) | – | 45.3 | protein · CHEMBL275911 · Oxysterols receptor LXR-alpha · EC50 | 80.5 (776) | 1 / 1 | – | 52.3 | 52.3 | 45.3 | 45.3 | 45.3 |
| 홍합(참담치) (506159) | – | 32.5 | protein · OXYPURINOL · Beta-lactamase · Potency | 57.9 (61,719) | 1 / 1 | – | 32.5 | 32.5 | 32.5 | 32.5 | 32.5 |
| 참굴 (836033) | 96.3 | 96.3 | 검수 논문 층 `ahtpdb-ace-ic50-hhl-cushman-cheung` | 96.3 | – | 80.9 | 96.3 | 96.3 | 96.3 | 96.3 | 96.3 |
| 다시마 (377084) | – | 45.0 | protein · PENTACHLOROPHENOL · 15-hydroxyprostaglandin dehydrogenase [NAD(+)] · Potency | 80.1 (24,293) | 1 / 1 | – | 52.7 | 52.7 | 45.0 | 45.0 | 45.0 |
| 감태 (371986) | 67.5 | 67.5 | 검수 논문 층 `wijesinghe-2011-cell-free-ACE-IC50` | 90.0 | – | – | 67.5 | 67.5 | 67.5 | 67.5 | 74.6 |
| 괭생이모자반 (494853) | – | 21.6 | protein · CHEMBL4085945 · Cholinesterase · IC50 | 28.8 (4,944) | 3 / 1 | – | 52.3 | 52.3 | 21.6 | 21.6 | 21.6 |
| 청각 (145086) | – | 39.6 | cancer_cell_line · FORMALDEHYDE · MIA PaCa-2 · IC50 | 70.5 (2,751) | 1 / 1 | – | 50.7 | 50.7 | 39.6 | 39.6 | 39.6 |
| 바지락 (231750) | – | 23.6 | cancer_cell_line · 4-CHOLESTEN 3-ONE · MDA-MB-468 · IC50 | 42.0 (2,452) | 1 / 1 | – | 23.6 | 23.6 | 23.6 | 23.6 | 23.6 |
| 큰가리비 (393716) | – | 54.2 | protein · AGMATINE · RecQ-like DNA helicase BLM · Potency | 96.4 (3,397) | 1 / 1 | – | 54.2 | 54.2 | 54.2 | 54.2 | 54.2 |
| 피조개 (504357) | – | 54.2 | protein · AGMATINE · RecQ-like DNA helicase BLM · Potency | 96.4 (3,397) | 1 / 1 | – | 54.2 | 54.2 | 54.2 | 54.2 | 54.2 |
| 고등어 (127022) | – | 73.1 | pathogen · DOCONEXENT · Plasmodium falciparum · IC50 | 97.5 (46,757) | 1 / 3 | – | 73.1 | 73.1 | 73.1 | 73.1 | 73.1 |

흔한 대사물 상한(원척도 Tukey): 31.0

## 4. 한계

- **화합물의 잠재력이지 종의 효능이 아니다.** 종 안의 함량, 추출 수율, 생체이용률은 모른다. 시험관·세포·병원체 시험값이며 임상 효과나 제품 가치가 아니다.
- **LOTUS는 문헌 자동 추출이다.** 원논문이 그 종에서 그 화합물을 분리했는지는 검수하지 않았다. 대조약이 붙은 사례를 승인 약물 규칙으로 막았지만, 약물이 아닌 대조 물질·오동정은 남을 수 있다.
- **흔한 대사물 규칙은 분포 기반이다.** 분류군 수가 상한 아래인 일반 대사물(예: 특정 지방산)은 남을 수 있다. 로그 척도·필터 없음 민감도로 영향을 공개한다.
- **Cellosaurus 1:1 대응이 안 되는 세포주 표적 11개는 제외했다**(U-87 MG, PBMC, Neuron, M, PBL, ATH-8, BxT, C3H/3T3, Lymphoblastoid, CFU-GM, B(EBV+)). ChEMBL 세포 이름이 Cellosaurus 한 항목으로 정해지지 않아서다. 암세포주가 아닌 선(MT4·MT2·C8166 형질전환, Vero·3T3-L1 자연 불멸화)도 제외한다.
- **병원체 층은 ChEMBL 분류(l1·l2)를 따른다.** 곰팡이·난균·절지동물·식물·척추동물(Homo sapiens ORGANISM 표적 등)은 넣지 않았다.
- **코호트는 ChEMBL 전체다.** 해양 천연물끼리의 비교가 아니다. 백분위는 같은 표적·같은 종말점의 공개 기록 안의 상대 순위다.
- **ChEMBL 37(2026-05-01) 기준이다.** 다음 릴리스에서 코호트 수가 바뀌면 백분위도 바뀐다. 스냅숏 날짜와 릴리스를 함께 기록한다.

## 5. 조사

## 6. 재현 방법

```
PYTHONUTF8=1 python scripts/collect_mbpi_links.py --cache <캐시 폴더>   # 네트워크, 스냅숏 작성
PYTHONUTF8=1 python scripts/build_verified_indices.py --check           # 오프라인, dist/assessments.json 바이트 비교
PYTHONUTF8=1 python -m unittest verification.test_mbpi_chembl           # 합성 스냅숏 규칙 테스트
node verification/test_mbpi_chembl_ui.mjs                               # 화면 재검사·표시 테스트
```

스냅숏(`research/verified-indices/snapshots/mbpi-links-2026-09-30.json`, 조회 기간 2026-09-29 ~ 2026-09-30, `queried_from`·`queried_on`에 기록)에는 ID·이름·pChEMBL 값·코호트 수만 저장한다(ChEMBL CC BY-SA 3.0, Wikidata CC0, WoRMS·Cellosaurus CC BY 4.0). CMNPD(CC BY-NC-SA 4.0)는 찾은 논문 DOI만 기록하고 내용은 저장하지 않는다.
