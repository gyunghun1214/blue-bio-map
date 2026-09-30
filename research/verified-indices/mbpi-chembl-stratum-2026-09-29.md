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
| 연결 검수 | 주 항목을 만드는 모든 종→화합물 연결을 원문 제목·초록(Crossref, Europe PMC)과 저장된 InChIKey의 PubChem 기록으로 검수(`mbpi-link-review-2026-09-30.json`). 네 분류(구조 불일치, 오염물, 종 조직 아님, 보편 대사물) 중 하나에 해당하는 적극적 근거가 있을 때만 제외. 원논문 연결에 쓰던 제외 분류를 LOTUS 연결에도 똑같이 적용. 검수 항목의 DOI 집합이 스냅숏과 다르면 빌드 중단, 검수 항목 없는 주 항목도 빌드 중단 | 원논문, PubChem |
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

2.3 → 3.1에서 MBPI가 새로 생긴 종은 5종이다: 멍게 13.5, 톳 45.3, 홍합(참담치) 10.1, 괭생이모자반 21.6, 청각 0.4. 미역·참굴·감태는 검수 논문 층이 그대로 최댓값이라 값이 같다. MFPI·MCUI는 바뀌지 않았다. BBVI는 새 ChEMBL 점수가 모두 독립 조건(min(연결 DOI, ChEMBL 문서) ≥ 2)에 미달이라 새로 생기지 않았다.

"3.1 검수 전"은 연결 검수를 넣기 전 커밋(2d44a77)의 값이다. 독립 검증(§5)에서 그 10종 중 8종의 최댓값이 이 종의 천연물이 아닌 연결에서 나온 것으로 확인되어 검수를 넣었다. 다시마·바지락·큰가리비·피조개·고등어는 검수 후 남은 ChEMBL 항목이 없어 MBPI를 내지 않는다(상태 "일부 근거 확인").

민감도 열(필터 없음 … 약물 필터 없음)은 그 규칙 하나만 바꾼 종 MBPI다. 검수 제외는 모든 민감도 보기에도 그대로 적용된다.

| 종 | 2.3 MBPI | 3.1 검수 전 | 3.1 MBPI | 점수 항목 (층 · 화합물 · 표적 · 종말점) | 백분위 (코호트 n) | 연결 DOI / ChEMBL 문서 | BBVI | 검수 제외 | 필터 없음 | 로그 상한 | 최소 10 | 최소 100 | 약물 필터 없음 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 미역 (145721) | 19.6 | 19.6 | 19.6 | 검수 논문 층 `ahtpdb-ace-ic50-hhl-cushman-cheung` | 26.1 | – | – | (5E,8E,11E,14E)-icosa-5,8,11,14-tetraenoic acid (ubiquitous_metabolite) | 54.8 | 54.8 | 19.6 | 19.6 | 19.6 |
| 멍게 (250680) | – | 43.4 | 13.5 | protein · HALOCYNTHIAXANTHIN · Human immunodeficiency virus type 1 reverse transcriptase · IC50 | 17.9 (7,735) | 3 / 1 | – | oxypurinol (structure_mismatch) | 69.7 | 69.7 | 13.5 | 13.5 | 13.5 |
| 톳 (494972) | – | 45.3 | 45.3 | protein · CHEMBL275911 · Oxysterols receptor LXR-alpha · EC50 | 80.5 (776) | 1 / 1 | – | – | 52.3 | 52.3 | 45.3 | 45.3 | 45.3 |
| 홍합(참담치) (506159) | – | 32.5 | 10.1 | protein · HALOCYNTHIAXANTHIN · Human immunodeficiency virus type 1 reverse transcriptase · IC50 | 17.9 (7,735) | 1 / 1 | – | 7-methylxanthine (structure_mismatch), oxypurinol (structure_mismatch) | 10.1 | 10.1 | 10.1 | 10.1 | 10.1 |
| 참굴 (836033) | 96.3 | 96.3 | 96.3 | 검수 논문 층 `ahtpdb-ace-ic50-hhl-cushman-cheung` | 96.3 | – | 80.9 | – | 96.3 | 96.3 | 96.3 | 96.3 | 96.3 |
| 다시마 (377084) | – | 45.0 | – | 없음 (검수 후 남은 ChEMBL 항목 없음) | – | – | – | pentachlorophenol (contaminant), (E)-2-nonenal (ubiquitous_metabolite), butyl isobutyl phthalate (contaminant) | 52.7 | 52.7 | – | – | – |
| 감태 (371986) | 67.5 | 67.5 | 67.5 | 검수 논문 층 `wijesinghe-2011-cell-free-ACE-IC50` | 90.0 | – | – | – | 67.5 | 67.5 | 67.5 | 67.5 | 74.6 |
| 괭생이모자반 (494853) | – | 21.6 | 21.6 | protein · CHEMBL4085945 · Cholinesterase · IC50 | 28.8 (4,944) | 3 / 1 | – | – | 52.3 | 52.3 | 21.6 | 21.6 | 21.6 |
| 청각 (145086) | – | 39.6 | 0.4 | pathogen · CHEMBL5287816 · SARS-CoV-2 · IC50 | 0.8 (926) | 1 / 1 | – | formaldehyde (ubiquitous_metabolite), cacodylic acid (dimethylarsinic acid) (contaminant) | 50.7 | 50.7 | 0.4 | 0.4 | 0.4 |
| 바지락 (231750) | – | 23.6 | – | 없음 (검수 후 남은 ChEMBL 항목 없음) | – | – | – | ergosta-4,24(28)-dien-3-one (not_tissue), 4-cholesten-3-one (not_tissue) | – | – | – | – | – |
| 큰가리비 (393716) | – | 54.2 | – | 없음 (검수 후 남은 ChEMBL 항목 없음) | – | – | – | agmatine (ubiquitous_metabolite) | – | – | – | – | – |
| 피조개 (504357) | – | 54.2 | – | 없음 (검수 후 남은 ChEMBL 항목 없음) | – | – | – | agmatine (ubiquitous_metabolite) | – | – | – | – | – |
| 고등어 (127022) | – | 73.1 | – | 없음 (검수 후 남은 ChEMBL 항목 없음) | – | – | – | docosahexaenoic acid (doconexent) (ubiquitous_metabolite) | 54.8 | 54.8 | – | – | – |

흔한 대사물 상한(원척도 Tukey): 31.0

## 4. 한계

- **화합물의 잠재력이지 종의 효능이 아니다.** 종 안의 함량, 추출 수율, 생체이용률은 모른다. 시험관·세포·병원체 시험값이며 임상 효과나 제품 가치가 아니다.
- **LOTUS는 문헌 자동 추출이다.** 점수를 정하는 주 항목의 연결 32건과 같은 분류의 원문 연결 1건은 원문 제목·초록과 PubChem 기록으로 검수했다(15건 제외). 초록만 읽었으므로 본문에서만 드러나는 오동정은 남을 수 있다. 민감도 보기에만 쓰이는 연결은 검수하지 않았다.
- **흔한 대사물 울타리는 흔함이 아니라 정리된 문헌 양을 잰다.** 위키데이터 P703 분류군 수는 LOTUS가 정리한 문헌이 많을수록 커진다. 그래서 펜타클로로페놀(1개), DHA(5개), 포름알데히드(7개), 옥시퓨리놀(22개), 아그마틴(23개)이 울타리 31을 통과했다. 검수가 이 빈틈을 막지만, 새 스냅숏마다 주 항목 연결을 다시 검수해야 한다(DOI가 바뀌면 빌드가 멈춘다).
- **검수는 사람의 판단이다.** 분류 네 가지와 판단 근거(논문 제목·PMID·PubChem 동의어)를 항목마다 공개해 다른 사람이 같은 자료로 다시 판단할 수 있게 했다. 종별 예외가 아니라 모든 종의 주 항목 연결에 같은 분류를 적용했다.
- **qHTS Potency 값.** PubChem BioAssay 자료집(CHEMBL1201862)의 qHTS Potency는 ChEMBL pChEMBL 규칙을 통과하지만 확인 시험이 아니다. 이번 검수에서 제외된 옥시퓨리놀·펜타클로로페놀·아그마틴 항목이 모두 이 자료집의 값이었다. 남은 항목에는 이 자료집 값이 최댓값인 종이 없다.
- **Cellosaurus 1:1 대응이 안 되는 세포주 표적 11개는 제외했다**(U-87 MG, PBMC, Neuron, M, PBL, ATH-8, BxT, C3H/3T3, Lymphoblastoid, CFU-GM, B(EBV+)). ChEMBL 세포 이름이 Cellosaurus 한 항목으로 정해지지 않아서다. 암세포주가 아닌 선(MT4·MT2·C8166 형질전환, Vero·3T3-L1 자연 불멸화)도 제외한다.
- **병원체 층은 ChEMBL 분류(l1·l2)를 따른다.** 곰팡이·난균·절지동물·식물·척추동물(Homo sapiens ORGANISM 표적 등)은 넣지 않았다.
- **코호트는 ChEMBL 전체다.** 해양 천연물끼리의 비교가 아니다. 백분위는 같은 표적·같은 종말점의 공개 기록 안의 상대 순위다.
- **ChEMBL 37(2026-05-01) 기준이다.** 다음 릴리스에서 코호트 수가 바뀌면 백분위도 바뀐다. 스냅숏 날짜와 릴리스를 함께 기록한다.

## 5. 조사

**독립 검증 (2026-09-30, 워크플로 에이전트 3개 + 비평 1개, 커밋 2d44a77 대상).**

- 자료 일치: 주 항목 10개와 그 밖의 9개를 실시간으로 다시 조회했다. 위키데이터 P703 진술·참고문헌 DOI, ChEMBL 활동 25건(부모·표적·종말점·관계·pChEMBL·문서), 코호트 중앙값, 표적 유형·세포주 층, PubChem CID, WoRMS AphiaID가 모두 스냅숏과 같았다. 36개 항목의 백분위·계수·조정값을 스냅숏에서 다시 계산해 모두 일치했다. 울타리 31.0도 다시 계산해 같았다.
- 과학적 타당성: 36개 항목 중 13개가 이 종의 천연물이 아니었다. 새 MBPI 10종 중 8종의 최댓값이 여기에 해당했다. 옥시퓨리놀(멍게·홍합)과 7-메틸잔틴(홍합)은 카로티노이드 alloxanthin·heteroxanthin과 이름이 겹쳐 생긴 구조 오류다(PubChem 동의어 'Alloxanthine', 'Heteroxanthine'). 펜타클로로페놀과 프탈레이트(다시마)는 오염물이다. 포름알데히드(청각)와 아그마틴(큰가리비·피조개)은 보편 대사물이다. DHA(고등어)는 흔한 지방산이다. 4-콜레스텐-3-온(바지락)은 배설물 분석 논문에서 나왔다.
- 처리: 연결 검수 파일을 만들고 빌더에 연결했다(§2 "연결 검수"). 비평의 지적 중 날짜 문제(재조회하지 않은 증거 파일의 snapshot_date를 앞당김)는 되돌렸다. 새 스냅숏은 증거 날짜 이후이기만 하면 된다. 원문 연결 출처(Europe PMC, CMNPD CC BY-NC-SA 4.0) 등록, 원문 연결은 P703이 없는 종에만 쓴다는 조건, 항목별 근거 수준 2 표시, "정보충분도 낮음" 상태도 넣었다.
- 위키데이터 진술 순위: LINK_QUERY는 모든 순위의 P703 진술을 읽고, COUNT_QUERY(`wdt:P703`)는 deprecated를 뺀다. 연결된 분류군 21개에 deprecated P703 진술이 0건임을 확인했다(2026-09-30 WDQS). 그래서 이번 스냅숏은 그대로 두고, 다음 수집부터 LINK_QUERY에서도 deprecated를 빼도록 수집기를 고쳤다. 스냅숏에는 실제로 쓴 쿼리가 기록되어 있다.

**버린 대안.**

- *위키데이터 역할 규칙*(P2868 subject has role 또는 P366 has use 진술이 있는 화합물 제외): 현재 스냅숏에서 6개(포름알데히드, 아그마틴, 옥시퓨리놀, 카코딜산, DHA, 펜타클로로페놀)를 거르고 진짜 천연물은 거르지 않는다. 그러나 4-콜레스텐-3-온, 7-메틸잔틴, 프탈레이트를 놓친다. 또 아스타잔틴·루테인·플로로글루시놀처럼 상업 용도가 있는 진짜 천연물도 역할 진술을 갖고 있어, 울타리가 바뀌면 함께 빠진다. 누구나 고칠 수 있는 필드라 역할 자료도 스냅숏에 저장해야 한다. 이런 이유로 원리 있는 규칙이 아니라 대용 지표라고 판단했다.
- *ChEMBL natural_product 표시, NP-likeness 점수, max_phase ≥ 1*: 모두 진짜 천연물과 오염 연결이 섞여 나뉘지 않았다(검증 에이전트 확인).
- *종별 제외 목록*: 판단 원칙 4(일관성)에 어긋난다. 검수는 종이 아니라 연결 단위이고, 모든 종의 주 항목 연결에 같은 네 분류를 적용한다.

## 6. 재현 방법

```
PYTHONUTF8=1 python scripts/collect_mbpi_links.py --cache <캐시 폴더>   # 네트워크, 스냅숏 작성
PYTHONUTF8=1 python scripts/build_verified_indices.py --check           # 오프라인, dist/assessments.json 바이트 비교
PYTHONUTF8=1 python -m unittest verification.test_mbpi_chembl           # 합성 스냅숏 규칙 테스트
node verification/test_mbpi_chembl_ui.mjs                               # 화면 재검사·표시 테스트
```

스냅숏(`research/verified-indices/snapshots/mbpi-links-2026-09-30.json`, 조회 기간 2026-09-29 ~ 2026-09-30, `queried_from`·`queried_on`에 기록)에는 ID·이름·pChEMBL 값·코호트 수만 저장한다(ChEMBL CC BY-SA 3.0, Wikidata CC0, WoRMS·Cellosaurus CC BY 4.0). CMNPD(CC BY-NC-SA 4.0)는 찾은 논문 DOI만 기록하고 내용은 저장하지 않는다.
