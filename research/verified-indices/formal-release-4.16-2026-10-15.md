# `verified-4.16` — 근거 프로필: 문헌 양과 독립 재현을 따로 표시 (2026-10-15)

계기: 팀장(LKH)이 2026-10-15 '근거 논문 1편' 라벨 정리를 요청했다(프롬프트 v2: 프로젝트 파일 `prompts/evidence-profile-claude-code-v2.md`). 30종 가운데 29종의 MBPI·BBVI에 붙은 '단일 논문'(화면 '근거 논문 1편') 라벨의 실제 뜻은 "MBPI 최상위 항목이 독립 논문으로 재현되지 않았다"인데, 화면은 이를 그 종의 근거 논문이 1편뿐인 것처럼 보였다. 신청서는 MBPI가 "보고 문헌 수와 독립 반복 검증 여부를 근거 수준으로 반영"한다고 적었으므로 두 축을 따로 보인다.

번호: 같은 날 다른 변경('보전 평가 공백 14종 표시')이 4.15를 쓸 수 있어 이 변경은 4.16을 쓴다. 기준은 `verified-4.14`(PR #186)다.

## 바뀌지 않은 것 (표시 전용)

점수·규칙 전부. 근거 계수(재현 없음 0.75, ChEMBL은 연결 계수 × 활성 계수, 예 0.5625), 층화 규칙, 백분위 산식, 식품 가중치 0.5, 매트릭스 구분선 50, 사후 검증 사례와 판정, `bbvi_label`·`mbpi_label` 값('단일 논문'), `mbpi_breadth`, 유형. 30종의 `scores`·`scores_unrounded`·유형이 4.14와 같다(`Verified416Tests.test_nothing_but_the_profile_and_the_version_moved`). 4.14 공개본은 `archive/assessments-verified-4.14.json`에 보관했고 4.14 설정으로 빌드하면 바이트 단위로 같다(`Verified414Tests`).

사후 검증이 실패한 원인(근거 계수와 다른 기원 재현 제외)은 결과를 본 뒤 고치면 사후 조정이 되므로 손대지 않았다. 바꿔야 한다는 판단이 나오면 `research/` 아래 사전 등록 초안으로만 쓰고, 검증셋(Halichondria okadai, Ecteinascidia turbinata, Conus magus)에 같은 규칙을 적용한다는 조건을 넣는다.

## 새 필드 `evidence_profile` (종마다, 설정 `evidence_profile`)

| 필드 | 뜻 |
|---|---|
| `item_count` | 점수에 쓰인 MBPI 항목 수(`mbpi_breadth.item_count`와 같음) |
| `independent_paper_count` | 모든 점수 항목의 원논문 + 쓰인 재현 논문 DOI 수(`mbpi_breadth`와 같음) |
| `top_item_replication` | `replicated`: 최상위 항목의 독립 원논문이 2편 이상(라벨 없음) · `attempted_not_counted`: 2편 미만이고 규칙이 세지 않은 재현 행이 있음 · `none`: 재현 행 없음 |
| `replication_exclusion_codes`, `replication_exclusion_reason_ko` | 세지 않은 재현 행의 사유를 네 코드로 묶음: 다른 기원 시료(4.11 규칙) · 효능 값 차이 기준(1.0) 초과 · 점수 값과 같은 논문 · 원 측정과 같은 연구 그룹일 수 있음(검토 제외) |
| `attempted_count` | 세지 않은 재현 행 수 |
| `unscored_related_count` | 공개된 관련 문헌 목록(`dist/supplementary-literature.json`)의 그 종 행 수. 점수에 쓰지 않음 |
| `top_item_percentile`, `top_item_evidence_factor` | 최상위 항목의 근거 계수 적용 전 백분위와 계수 |
| `mbpi_without_top_item` | 최상위 항목을 뺐을 때의 MBPI = 2위 항목 보정값(MBPI는 항목 최댓값). 항목이 1개면 null |

## 결과

- 독립 재현 확인 1종: 미역. 재현 기록 있음(기준 외) 4종: 톳·참굴(다른 기원 시료), 큰가리비(다른 기원 시료 · 효능 값 차이 초과), 갑오징어(다른 기원 시료 · 같은 연구 그룹 가능성). 재현 없음 25종.
- 참굴: 항목 6 · 독립 논문 4편 · 재현 시도 1건(옥수수 α-제인 합성 LQP) · 관련 문헌 0편 · 계수 적용 전 백분위 96.31 · 최상위 항목 제외 시 MBPI 62.6.
- 감태: 항목 10 · 독립 논문 11편 · 관련 문헌 3편 · 독립 재현 확인 중.
- 나머지 25종(감태 포함)은 '독립 재현 확인 중'.

## 화면

- '근거 논문 1편'을 모두 없앴다. 라벨 낱말은 '최상위 근거 독립 재현 확인 중'(JSON 값 '단일 논문'은 그대로, `plainWords()`가 바꿈). 매트릭스 빈 점·범례도 같은 말, 채운 점은 '최상위 근거 독립 재현 확인'.
- 종 카드(30종)와 종 프로필(탐색 상세·비교 탭 프로필)에 근거 프로필 한 줄. 카드의 '관련 문헌 N편 · 점수 미사용' 줄은 이 줄에 합쳤다.
- 화면 문구는 담담하게 쓴다(팀장 피드백 2026-10-15: 약점을 앞세우지 않는다, 사실은 바꾸지 않는다). 상태 이름은 '독립 재현 확인' · '재현 기록 있음(기준 외)' · '독립 재현 확인 중'이다. 카드와 프로필 앞면에는 양과 상태만 보인다. 제외 사유, 근거 계수, '최상위 항목 제외 시 MBPI'와 계수 적용 전 백분위(점수 의존도)는 접힌 MBPI 근거 상세와 근거와 방법 탭에만 둔다. 카드는 관련 문헌이 0편이면 그 칸을 생략한다.
- 재현 없는 MBPI·BBVI는 화면에서 정수. 반올림이 매트릭스 구분선을 넘나들게 하거나 0이 아닌 값을 0으로 만드는 경우만 소수 첫째 자리를 둔다(청각 MBPI 0.4). 정렬·유형은 `scores_unrounded`, JSON·CSV는 공개값 그대로.
- 근거와 방법 '지표를 어떻게 읽나요?'에 '근거 수준을 어떻게 읽나요?' 문단, 안내 챗봇에 '근거 논문 1편이 무슨 뜻이에요?' 항목.

## 검사

- `python scripts/build_verified_indices.py --check`: 4.16 설정으로 공개본 재현. 4.14 설정 빌드는 `archive/assessments-verified-4.14.json`과 같다.
- 단위 검사: Python 419개 통과(건너뜀 2), node 검사 22개 통과.
- 화면 검사(uicheck): 199 통과 · 4 실패. 실패 4건은 클라우드에서 지도 타일(GIBS·GEBCO)이 막혀 생기는 환경 실패다(위성·수심 기본 지도, 2026-10-03 이전 '기본' 저장, 공유 링크 A-5). 새 검사: 30종 카드 모두 근거 프로필 줄, 화면 어디에도 '근거 논문 1편' 없음, 참굴 비교표 MBPI 72·BBVI 72, 참굴 비교 탭 프로필의 근거 프로필과 최상위 항목 제외 시 MBPI 63.
- 바다 탐험 검사: 75 통과 · 0 실패.
- 계보: `lineage.py diff --from verified-4.14 --to verified-4.16` 점수 변화 0건, `validate` 6개 모두 통과(`reports/lineage_validation_verified-4.16.md`).
