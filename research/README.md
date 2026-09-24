# 조사 자료 접수

팀원 3명이 조사한 근거를 같은 형식으로 모아 나중에 합치기 위한 폴더다. 여기 있는 표는 **검토 전 조사 기록**이다. 운영 DB에 넣거나 점수를 계산하거나 사이트에 표시하지 않는다.

| 분야 | 양식 | 한 행에 적는 것 |
|---|---|---|
| ① 생리활성 | `templates/bioactivity.csv` | 기원종 → 화합물 → 실험(표적·assay·값) → 논문 하나 |
| ② 식량 | `templates/food.csv` | 영양 성분 하나, 가식부 비율, 양식 여부 또는 어획 통계 하나 |
| ③ 종·보전 | `templates/species.csv` | WoRMS 학명·AphiaID, 출현 범위 또는 IUCN 평가 하나 |

`examples/`는 **합성 예시**다. 학명·ID·URL·DOI·값이 모두 가짜이며 일부 행은 일부러 틀리게 써 두었다. 실제 자료로 옮겨 쓰지 않는다.

## 작성 순서

1. `templates/`에서 자기 분야 양식을 복사해 `submissions/`에 `<분야>_<주제>.csv`로 저장한다. 예: `food_oyster.csv`. 파일 이름은 `bioactivity`, `food`, `species` 중 하나로 시작해야 한다.
2. 먼저 종을 확정한다. WoRMS에서 학명을 찾아 정명(accepted name)과 AphiaID를 적고 `match_level`을 고른다. 확정하지 못하면 `unresolved`로 두고 AphiaID를 비워 둔다.
3. 근거 하나를 한 행에 적는다. 한 논문에 값이 여러 개면 행을 나눈다. `record_id`는 파일 안에서 겹치지 않게 적는다(예: `F-001`).
4. 찾아보지 않은 항목, 찾았지만 없던 항목, 열리지 않던 항목도 행으로 남긴다. 아래 `data_status` 표를 따른다.
5. 엑셀에서 **CSV UTF-8(쉼표로 분리)** 형식으로 저장한다. 열 이름과 순서는 바꾸지 않는다.
6. 검사 도구를 돌려 오류를 고친다.
7. 브랜치를 만들어 `submissions/`의 파일만 커밋하고 PR을 연다. 다른 팀원이 원문을 열어 몇 행을 대조한 뒤 `review_status`를 `cross_checked`로 바꾼다.

## Markdown 원고와 CSV를 함께 쓰는 방법

조사 내용을 Markdown으로 먼저 정리했다면(예: PR #3의 `research/food/*.md`) 원고를 지우거나 통째로 CSV로 바꾸지 않는다. 두 파일은 역할이 다르다.

- **Markdown 원고**: 원문 근거 설명을 보존한다. 시료·분모·방법, 왜 이 값을 채택하지 않았는지, 원문 위치(표·절), 남은 불확실성. 사람이 읽고 판단하는 기록이다.
- **CSV 행**: 원고에서 **근거 하나씩 검토할 수 있는 것만** 옮긴다. 원출처(URL/DOI)가 있고, 값·단위·기준량을 한 행으로 적을 수 있는 경우다.

옮기는 순서:

1. 원고의 근거 표에서 출처가 분명한 값 하나를 고른다. 요약 사이트나 원고 자체가 아니라 원출처 URL/DOI를 적는다.
2. 원고에 적힌 분모와 시료 상태를 `unit`·`basis`·`sample_state`에 그대로 옮긴다. 건조 시료 %를 생것 100 g 값으로 바꾸지 않는다.
3. `limitations`에 원고 경로(예: `PR #3 research/food/sea_squirt.md`)와 원문 위치(예: `Table 3`)를 적는다. 긴 설명은 원고에 남기고 CSV에는 한두 문장만 쓴다.
4. 옮긴 사람이 원문을 직접 열어 값을 대조했다면 `self_checked`, 원고만 보고 옮겼다면 `unreviewed`로 둔다.
5. 원문이 열리지 않거나 이용조건을 확인하지 못했다면 `license_unclear`로 두고 이유를 `limitations`에 적는다.
6. 비교용으로만 언급했거나 종·분모가 불명확한 값은 옮기지 않거나, 옮기더라도 `match_level=unresolved`, `license_unclear`로 보류한다.

예시: `submissions/food_wakame_sea_squirt.csv`, `submissions/species_sea_squirt.csv`(PR #3 원고와 WoRMS에서 시험 삼아 옮긴 실제 출처 행).

## 검사

저장소 폴더에서 Python 3만 있으면 된다(추가 설치 없음).

```
python scripts/check_research.py                     # submissions/ 전체
python scripts/check_research.py research/examples   # 합성 예시로 동작 확인
```

`ERROR`가 하나라도 있으면 끝에 "제출 전에 고쳐 주세요"가 나온다. `WARN`은 확인만 하면 된다. 검사를 통과해도 내용이 맞는지는 알 수 없다. 원문 대조는 사람이 한다.

## 공통 열

| 열 | 적는 법 |
|---|---|
| `record_id` | 파일 안에서 고유한 번호 |
| `scientific_name` | 원출처에 적힌 학명 그대로 |
| `aphia_id` | WoRMS AphiaID, 숫자만 (예: `140658`) |
| `match_level` | `accepted` 원출처 학명이 정명 · `synonym` 동의어를 정명에 연결 · `genus` 속 수준만 일치 · `related` 근연종 자료 · `unresolved` 미확정 |
| `claim` | 원출처가 말하는 내용을 한 문장으로 요약. 원문을 붙여넣지 않는다 |
| `value`, `unit` | 원출처 값과 단위 그대로. 환산했다면 `limitations`에 적는다 |
| `data_status` | 아래 표 |
| `source_url`, `doi` | 원출처 주소. DOI는 `10.`으로 시작하는 부분만. 검색 결과 페이지나 요약 사이트가 아니라 원출처 |
| `accessed` | 조회일 `YYYY-MM-DD` |
| `license` | 원출처의 이용조건 (예: `CC BY 4.0`, `출판사 약관, 재배포 불가`) |
| `review_status` | `unreviewed` · `self_checked` 본인이 원문 재확인 · `cross_checked` 다른 팀원이 대조 |
| `limitations` | 표본 수, 지역·계절 차이, 근연종 자료, 환산 여부 등 |

### data_status: 결측을 0으로 바꾸지 않는다

| 값 | 뜻 | `value` | 출처·조회일 |
|---|---|---|---|
| `found` | 자료 있음 | 필수 | 필수, `license`·`limitations`도 필수 |
| `no_data` | 찾아봤지만 자료 없음 | **비움** | 찾아본 곳 필수, `claim`에 검색한 이름·검색어·범위(예: `'Halocynthia roretzi iodine', PubMed 전체, 결과 0건`) |
| `not_searched` | 아직 조회 안 함 | **비움** | 없어도 됨 |
| `no_access` | 접근 불가(유료, 로그인, 링크 깨짐) | **비움** | 시도한 곳 필수 |
| `license_unclear` | 자료는 있으나 이용조건 미확정 | 적어도 됨(공개 전 확인) | 필수 |

"없음"을 0, `-`, `N/A`로 적지 않는다. 0은 실제로 측정된 0일 때만 `found`와 함께 쓴다.

## 분야별 열

**① 생리활성 (`bioactivity`)**: `compound_name`, `compound_id`(`CID:숫자` 또는 InChIKey), `experiment_type`(`in_vitro`·`in_vivo`·`clinical`·`in_silico`·`other`), `target`(효소·세포주·균주 등), `assay`(측정 방법과 지표, 예: IC50 효소 저해). 추출물 전체의 결과라면 `compound_name`에 추출물로 적고 `limitations`에 남긴다.

`link_level`로 연결이 어디까지 확인됐는지 구분한다(`found`·`license_unclear` 행은 필수).

| `link_level` | 뜻 | 필요한 것 | 비워 두는 것 |
|---|---|---|---|
| `assay` (완전 연결) | 종 → 화합물 → 정량 실험 → 논문 모두 확인 | 화합물명, 실험 유형, 표적, assay, 값(숫자), 단위. `license_unclear`여도 실험 정보는 필요 | - |
| `compound` (부분 연결) | 종에서 화합물이 보고된 것만 확인, 정량 실험은 못 찾음 | 화합물명, claim, 출처 | `value`, `unit`, `experiment_type`, `target`, `assay` (하나라도 있으면 오류) |

`active`처럼 말로 된 결과는 `value`에 쓰지 않고 `claim`에 적는다. 정량값이 없으면 `assay`가 아니라 `compound` 행이다. 부분 연결 행은 확인하지 못한 실험 정보를 채우지 않아도 검사를 통과한다. 나중에 정량 실험 논문을 찾으면 행을 고치지 말고 `assay` 행을 새로 추가한다.

**② 식량 (`food`)**: `topic`은 `nutrition`·`edible_portion`·`aquaculture`·`fishery`. `item`에 성분·항목(예: `protein`)을 적는다. 영양값은 `unit`과 `basis`(예: `per 100 g edible portion`, `per 100 g dry weight`)가 모두 필요하고 `sample_state`(생·건조·조리)도 적는다. 양식·어획은 `region`과 `period`가 필요하다.

**③ 종·보전 (`species`)**: `topic`은 `taxonomy`·`occurrence`·`iucn`. 출현은 `region`(해역·국가 수준)과 `period`가 필요하다. IUCN은 `value`에 범주(`LC`, `DD` 등), `iucn_scope`(`global` 또는 지역 평가 범위), `assessment_year`가 필요하다. `DD`·`NE`를 낮은 위험으로 해석하지 않는다.

## 저장소에 넣지 않는 것

- 비공개·민감종 좌표, 개별 관측 지점 좌표: 해역·국가 수준으로만 적는다. 양식에 없는 열(위도·경도 등)은 검사에서 오류가 난다.
- API 키, 비밀번호, 로그인 쿠키
- 논문·보고서 원문 전체, PDF, 표 전체 복사: 요약과 해당 값만 적는다. 긴 칸은 경고가 뜬다.
- 이름, 연락처, 이메일 등 개인정보: 이메일 형식은 검사에서 오류가 난다.
