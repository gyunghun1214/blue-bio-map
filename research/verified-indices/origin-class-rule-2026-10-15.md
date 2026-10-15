# 화합물 기원 분류 규칙 (origin_class) · 2026-10-15

이 문서는 출력(`dist/origin-review.json`)을 만들기 전에 따로 커밋한 사전 등록이다. 분류 결과(의심 항목 수, 종 목록, 참고값)를 본 뒤에는 이 규칙과 `origin-review-2026-10-15.json`의 사실 기록을 고치지 않는다. 고칠 일이 생기면 새 날짜의 규칙 문서와 기록 파일을 만들고 이 파일은 그대로 둔다.

## 1. 무엇을 묻는가

MBPI 점수 항목(`bioactivity_trace[]`) 하나마다 "이 물질을 이 종이 만든 것인가"를 묻는다. 효능 값이 맞는지, 서열이 이 종에만 있는지는 묻지 않는다(그것은 기존 `caveat`·근거 프로필이 다룬다).

## 2. 다섯 분류 (코드 상수 `scripts/build_origin_review.py`의 `CLASSES`)

| 분류 | 뜻 | 기록 사실(`facts`) |
|---|---|---|
| `sample_mismatch` | 점수에 쓴 값을 다른 생물에서 분리한 시료로 잰 기록이 있음 | `other_species_sample` |
| `artifact_possible` | 건조·추출·가공·시약 처리 중 의도하지 않은 화학 변화(산화, 가열 반응, 색소 분해, 시약 부가물)로 생길 수 있음 | `processing_product` |
| `associated_possible` | 먹이·공생균·발효 미생물 등 다른 생물이 만든 것일 수 있음 | `other_producer` |
| `producer_confirmed` | 이 종이 스스로 만든다는 근거가 있음 | `own_production` |
| `unknown` | 위 사실이 하나도 기록되지 않음 | (없음) |

## 3. 판정 순서 (코드 상수 `ORDER`)

한 항목에 사실이 여러 개면 아래 순서에서 먼저 걸리는 것이 분류가 된다. 나머지 사실도 출력에 함께 남긴다.

1. `other_species_sample` → `sample_mismatch` (시료가 이 종이 아니면 나머지 질문이 성립하지 않음)
2. `processing_product` → `artifact_possible` (생물 안에 없던 물질일 수 있음)
3. `other_producer` → `associated_possible` (생물 안에 있지만 다른 생물이 만들었을 수 있음)
4. `own_production` → `producer_confirmed`
5. 아무 사실도 없음 → `unknown`

`producer_confirmed`만 "확인됨"이고 나머지 넷은 모두 "의심"이다(코드 상수 `CONFIRMED`).

## 4. 사실을 정하는 기준

사실은 `research/verified-indices/origin-review-2026-10-15.json`에 출처와 함께 적는다. 근거는 이미 검토된 기록(종-화합물 연결 검토 `mbpi-link-review-4.0-2026-10-04.json`, 항목 `caveat`, 소재 표 `mbpi-material-4.14-2026-10-14.json`의 `paper_basis`, AMP 기록의 `origin_evidence`)과 이번에 확인한 문헌이다. 긍정 근거가 있을 때만 사실을 적는다.

- **펩타이드(가수분해·자가분해·소화물)**: 이 종 조직의 단백질을 효소(자기 효소 포함)로 분해해 얻은 서열은 원료 단백질이 이 종의 것이므로 `own_production`이다. 의도한 효소 분해는 연구 대상 공정 그 자체라서 `processing_product`(의도하지 않은 화학 변화)로 보지 않는다.
- **발효물 펩타이드**: 미생물이 함께 자란 발효물에서 찾은 서열은 그 미생물의 단백질에서 나왔을 수 있으므로, 원문이 서열을 이 종의 단백질 기록과 맞춰 보이지 않았으면 `other_producer`다.
- **유전자 서열 펩타이드**: 이 종의 유전체·전사체·자기 단백질 기록이 서열을 암호화하면 `own_production`이다(AMP 기록 `origin_evidence`, 소재 표 `paper_basis`).
- **동물의 카로티노이드**: 동물은 카로티노이드를 새로 합성하지 못하고 먹이에서 얻어 바꾼다(Maoka 2011, 10.3390/md9020278). 그래서 `other_producer`다.
- **조류의 색소·폴리페놀·지방산 대사물**: 그 분류군이 스스로 만드는 물질군(갈조류 플로로탄닌, 모자반류 크로메놀, 녹조류 카로티노이드, 홍조류 상처 반응 에이코사노이드)은 `own_production`이다.
- **산화·분해·가열 반응 산물**: 푸코스테롤 산화물(사링고스테롤 등), 엽록소 분해물(페오포바이드), 마이야르·발효 반응으로 알려진 베타카볼린(flazin)은 `processing_product`다.
- **다른 종 시료**: 기존 기록(`caveat`, 사후 검증 `caveats`)이 점수 값을 잰 시료의 기원을 다른 생물로 적은 경우만 `other_species_sample`이다. 시판품·합성품으로 잰 값은 다른 종 시료가 아니다. ChEMBL 활성 문서의 시료 기원을 이번에 새로 읽지 않은 항목은 `tested_material: "not_read"`로 남기고 사실로 세지 않는다(한계, 6절).

## 5. 참고값 `mbpi_origin_strict`

`producer_confirmed` 항목만 남겨 지금 MBPI와 같은 방식(코호트 안 조정값 `adjusted`의 최댓값, 소수 첫째 자리 반올림)으로 다시 계산한 값이다. 남는 항목이 없으면 `null`(계산할 항목 없음)이다. 이 값은 점수가 아니다. MFPI·MBPI·MCUI·BBVI, 사분면 유형, 50선, 가중치, 지도 색, 순위 어디에도 들어가지 않는다. 지표 빌드(`build_verified_indices.py`)는 이 파일을 읽지 않는다.

## 6. 화면

- 의심 항목은 MBPI 점수 근거 목록에서 항목 이름 아래에 `⚠ 분류 이름 · 사유 한 줄`을 붙인다.
- 종 프로필(비교와 지표)의 MBPI 아래에 `최상위 근거 기원: 확인됨` 또는 `최상위 근거 기원: 의심(분류 이름)`을 보이고, 의심이면 `참고: 기원 확인 항목만 MBPI …`을 함께 적는다. 펼친 MBPI 상세에도 같은 줄과 참고값을 둔다.
- 문구는 사실만 담담하게 쓴다.

## 7. 한계

- ChEMBL 항목의 활성 문서가 어떤 시료로 쟀는지는 기존 기록에 적힌 경우만 반영했다. 나머지는 `not_read`로 남긴다.
- `own_production`의 근거는 분리·검출 보고와 분류군의 알려진 생합성에 기댄다. 동위원소 표지나 유전자 확인 같은 직접 생합성 증명은 펩타이드 유전자 서열 항목에만 있다.
- 사후 검증 3종(Conus magus, Halichondria okadai, Ecteinascidia turbinata)은 30종 밖이라 참고 표로만 분류한다.

## 8. 점수 반영

점수 반영 여부는 `research/prereg-origin-2026-10-15.md`에 초안으로만 둔다. 반영은 팀 승인 뒤 새 지표 버전에서 한다.
