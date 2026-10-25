# 2026-10-25 휴대폰 영어 눈썹 글 숨김 + 반복 설명 한 곳으로

모바일 한국어 화면에서 영어 눈썹 글을 숨기고 반복 설명은 한 곳에만 보이게 함. 문구·PC 화면·영어 화면·데이터는 그대로.

- 지침: 원본 [`prompt-original.md`](prompt-original.md) (LKH가 보낸 `prompts/mobile-labels-dedupe-claude-code.md`, 저장소에는 `prompts/` 폴더가 없다).
- 기준 커밋: `be04cb3` (main). 선행 작업 두 개의 병합 커밋: #266 휴대폰 글자 크기 체계 `ecb8faf`, #264 휴대폰 설명 글 접기 `be04cb3`.
- 범위: 휴대폰(740px 이하) 한국어 화면만. 넓은 화면(741px 이상)과 영어 화면(`html.lang-en`)은 그대로. 정적 HTML만 다루고 `app.js`가 그리는 글은 범위 밖.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `dist/mobile-dedupe.css` (새 파일) | 휴대폰 한국어 화면에서만 눈썹 글·`.dup-m`·시트 안 `.dup-sheet` 숨김, `.see-also` 단추 모양(글자는 `content`로만, 14px, 높이 44px, 민트 링크 색, 포커스 링). 모든 스타일시트 맨 뒤(`mobile-compact.css` 다음) |
| `dist/mobile-dedupe.js` (새 파일) | `.see-also[data-see]` 누름 처리. 새 라우터 없이 `app.js`의 `setView` · `methodGo`와 시트를 여는 기존 단추를 쓴다 |
| `dist/index.html` | class · id · 단추만 더함(`apply_markup.py`, 13곳, 바꾼 뒤 글자 같음을 스크립트가 확인), CSS · JS 불러오기 |
| `dist/_headers` | `/mobile-dedupe.css` · `/mobile-dedupe.js` 1년 캐시 |
| `dist/i18n-en.js` · `i18n.js` · `expedition.html` | 영어 사전 6줄(쪼개진 문장 조각, 단추 이름 둘), `stamp`로 `?v=` 다시 계산 |
| `verification/i18n-ko-baseline.txt` | 한국어 화면 글 기준 다시 만듦(문단이 span으로 나뉜 곳, 단추 aria-label) |
| `verification/test_mobile_dedupe.mjs` (새 파일) · `verify.yml` | 마크업 · CSS · 스크립트 검사, CI에 추가 |
| `verification/uicheck.mjs` | 1440px · 390px 한국어 · 390px 영어 검사(아래 '검사') |
| `verification/test_mobile_compact.mjs` · `test_client_outdated.mjs` | 고친 기대값(아래 '고친 검사') |

### 더한 class · id · 단추

- `.dup-m`(휴대폰 한국어에서 숨김, 7곳): 비교와 지표 '읽는 법'의 '두 축을 따로 보는 이유' 문단 · `p.cmp-read-plain`, '비교 기준' 팝업의 `공식 산출값은 w = 0.50으로 고정입니다.`(span), 근거와 방법 '자료를 읽을 때'의 기록 수 · 붉은 점 · 바다만 칠함 · 버블 항목 넷.
- `.dup-sheet`(지도 시트 안에서 뒤에 오는 쪽만 숨김, 2곳): '셀 색은 바다 부분에만 칠합니다. 4° 셀은 …' 두 문장(범례 `.map-legend-more` 안 span과 '색의 의미' 문단 안 span).
- 새 `id` 둘(기존 id는 그대로): `#mt-quad-card`(근거와 방법 2×2 카드), `#mt-types-note`('유형과 셀 색' 아래 '종 단위 유형입니다.' 문단).
- `.see-also` 단추 넷(`<button type="button" class="see-also" data-see="…" aria-label="…"></button>`, 글자는 CSS `content`):

| 자리 | 단추 글 | 대상 | 누르면 |
|---|---|---|---|
| 비교와 지표 '읽는 법' '두 축을 따로 보는 이유' | 근거와 방법에서 자세히 보기 → | `#mt-quad-card` | 근거와 방법 탭, 카드로 이동, `.flash` |
| 비교와 지표 '읽는 법' 쉬운 이름 줄 | 근거와 방법에서 자세히 보기 → | `#mt-types-note` | 근거와 방법 탭, 접힌 문단(`mc-rest-types`) 펼침 |
| 비교와 지표 '비교 기준' 팝업 가중치 설명 | 근거와 방법에서 자세히 보기 → | `#method-03` | 근거와 방법 03 '규칙 고정' 펼침, 첫 항목 접는 칸 펼침 |
| 근거와 방법 '자료를 읽을 때' | 지도 읽는 법 보기 → | `#map-guide` | 탐색 지도 탭, '지도 읽는 법' 시트 열림(보기에 맞는 기존 단추를 누름) |

**뒤로 가기**: 이 사이트의 탭 이동은 주소 해시를 쓰지 않고(`app.js`: "In-page moves are buttons, not href=\"#…\"", `writeHash`는 `replaceState`) 브라우저 뒤로 가기로 이전 탭에 돌아가지 않는다. 이번 단추도 같은 방식이라 뒤로 가기는 이전 탭으로 돌아가지 않는다(기존 '전체 출처·방법 보기 →', '비교와 지표에서 보기 →'와 같음).

## A1. 대문자 영어 라벨(390px, 네 화면, 접힌 곳까지 연 상태)

`scan.mjs`로 모음(`/^[A-Z0-9 &·\-]{3,}$/`, 자식 요소 없음). 결과: 전 33개 → 후 23개.

| 라벨 | 화면 | 선택자 | 바로 아래 한국어 제목 | 처리 | 이유 |
|---|---|---|---|---|---|
| HOW TO READ | 비교와 지표 '읽는 법' | `#cmp-read-pop .matrix-explanation>.eyebrow` | 두 축을 따로 보는 이유 | 숨김 | 같은 자리 한국어 제목 |
| EVIDENCE & METHODS | 근거와 방법 | `.mt-eyebrow` | 바다의 기록을, 다음 연구의 단서로. | 숨김 | 탭 이름과 제목이 있음 |
| OUR RESEARCH SCOPE | 근거와 방법 | `.mt-k` | 근거의 출발점 | 숨김 | 같은 뜻 |
| THE EVIDENCE JOURNEY | 근거와 방법 | `.mt-k` | 서로 다른 자료를, 연결된 근거로. | 숨김 | 같은 뜻 |
| FOOD POTENTIAL · BIOACTIVITY POTENTIAL · CONSERVATION URGENCY | 근거와 방법 흐름 카드 | `.mt-k` | 식량 잠재력 · 생리활성 잠재력 · 보전 시급성 | 숨김 | 같은 뜻, 오른쪽 MFPI·MBPI·MCUI 칩은 남김 |
| TRACEABLE · COMPARABLE | 근거와 방법 강점 카드 | `.mt-k` | 각 카드 한국어 제목 | 숨김 | 같은 뜻 |
| TWO PERSPECTIVES | 근거와 방법 | `.mt-k` | 활용과 보전을 함께 | 숨김 | 같은 뜻 |
| MARINE EVIDENCE EXPLORER | 탐색 지도 | `.intro .eyebrow` | — | (이미 숨김) | `style.css`가 휴대폰에서 이미 숨김 |
| MFPI · MBPI · MCUI · BBVI | 흐름 카드 칩, 지도 | `.mt-tag` 등 | — | 남김 | 지표 이름 |
| OBIS · GBIF · IUCN · KOSIS · MBRIS · CC BY · NASA GIBS · GEBCO WMS | 첫 화면 · 근거와 방법 | — | — | 남김 | 자료 이름 · 라이선스 |
| CHEMBL…, 836033, 232, 100 | 종 상세 · 지도 · 첫 화면 | — | — | 남김 | 자료 값 · 숫자 |
| 01–03 · 01–04 | 흐름 단계, 접이식 제목 | `.mt-n` · `.mt-acc-n` · `.mt-step` | — | 남김 | 단계 번호 |

영어 라벨만 있고 한국어 제목이 없는 눈썹 글은 없다.

## B1. 반복 설명

`scan.mjs` → `group.mjs`(문장 단위, 같은 문장 · 2-gram 자카드 0.75 이상 · 20자 이상) → `build_groups.py` → [`dedupe-groups.json`](dedupe-groups.json). 지침 배경 표의 여덟 묶음은 뜻이 같아도 글자가 달라 손으로 묶었다(`groups`, 9개). 자동으로 잡힌 나머지 73개(`auto_groups`)는 2개가 위 묶음과 같고, 71개는 그대로 둠(출처·문헌 이름 44 · `app.js` 글 11 · 학명·종 카드 9 · 검증 기록 파일 이름 3 · 기타 4, 이유는 파일에).

| 묶음 | 나오는 곳 | 기준 위치 | 처리 | 이유 |
|---|---|---|---|---|
| 4° 셀 = 민감종 보호로 넓게 공개, 테두리만 | 지도 시트 범례 · 시트 '색의 의미' | 지도 '지도 읽는 법' 시트 | 화면 안 숨김(시트에서 뒤에 오는 쪽) | 시트는 출현 기록 보기에서 범례 → 색의 의미, 활용 × 보전 보기에서 색의 의미 → 범례 순 |
| 셀 색은 바다 부분에만 | 지도 시트 두 곳 · 근거와 방법 | 지도 시트 | 화면 안 숨김 + 탭 사이 숨김·링크 | 지도 표시 규칙 |
| 붉은 점 = 기록이 있는 칸의 위치 | 지도 시트 · 근거와 방법 | 지도 시트 | 탭 사이 숨김·링크 | 지도 칩·`#map-review-note`는 `app.js` 글(범위 밖), 범례 `.key-note` 한 줄은 범례 옆 줄이라 남김 |
| 기록 수 = 공개 관측 기록 건수 | 지도 시트 · 근거와 방법 | 지도 시트 | 탭 사이 숨김·링크 | 시트 안 `#map-review-note` 반복은 `app.js` 글(범위 밖) |
| 축소한 지도의 붉은 버블 | 지도 시트 · 근거와 방법 | 지도 시트 | 탭 사이 숨김·링크 | 같은 '자료를 읽을 때' 묶음의 링크 하나를 같이 씀 |
| 쉬운 이름 = 기준선 50 위·아래, 유형 = 연구 순서 | 비교와 지표 · 근거와 방법 | 근거와 방법 '유형과 셀 색' | 탭 사이 숨김·링크 | 설명 문단 |
| 두 축을 따로 봄 | 비교와 지표 · 근거와 방법 · 지도 범례 | 근거와 방법 2×2 카드 | 비교와 지표 설명 문단만 숨김·링크 | 그래프·범례 옆 한 줄, 일부만 겹치는 목록 줄은 남김(규칙 3·5) |
| MCUI 괄호 = 범주, '어획량 감소' | 비교와 지표 '읽는 법' · 근거와 방법 | 근거와 방법 | 그대로 둠 | 다른 내용과 ' · '로 이어진 한 항목이라 일부만 겹침(규칙 5), `#matrix-note`는 `app.js` 글 |
| 공식 가중치 w = 0.50 고정 | 비교와 지표 '비교 기준' · 근거와 방법 03 | 근거와 방법 03 '규칙 고정' | 탭 사이 숨김(span)·링크 | 슬라이더 눈금·단추·흐름도 상자의 짧은 라벨은 남김 |

숨긴 문장 앞뒤를 읽어 '이것은'처럼 숨긴 문장을 가리키는 말이 남지 않는지 확인했다(남는 곳 없음).

### PC에도 남아 있는 반복

이번에는 휴대폰만 다뤘으므로 넓은 화면에는 위 표의 반복이 모두 그대로 있다: 4° 셀 문장(범례와 '색의 의미'), 바다만 칠함 · 붉은 점 · 기록 수 · 버블(지도 범례와 근거와 방법 '자료를 읽을 때'), 쉬운 이름 문장 · 두 축 설명 · 가중치 0.50 고정(비교와 지표와 근거와 방법). 넓은 화면은 탭이 나란히 보이지 않아 같은 문제가 덜하지만, 정리할지는 팀이 판단할 일이다. `app.js`가 그리는 반복(`#map-review-note`, `#map-symbol-label` 칩, `#map-legend-note`, `#matrix-note`)도 화면 크기와 관계없이 남아 있다.

## 390px에서 보이는 글자 수(innerText, 한국어)

`measure.mjs`(전 = 8766 `be04cb3`, 후 = 8765 이 브랜치), 결과 [`measure.json`](measure.json).

| 화면 | 처음 상태 전 → 후 | 접힌 곳 모두 연 상태 전 → 후 |
|---|---|---|
| 첫 화면 | 1,341 → 1,341 | — |
| 탐색 지도 | 4,757 → 4,757 | 4,757 → 4,757 (시트는 닫힌 상태로 셈) |
| 비교와 지표 | 841 → 841 | 1,967 → 1,830 (−137, −7.0%, '읽는 법' · '비교 기준' 열림) |
| 근거와 방법 | 2,830 → 2,661 (−169, −6.0%) | 7,925 → 7,656 (−269, −3.4%) |

1440px은 네 화면 모두 전후 같다(처음 상태 · 모두 연 상태).

## 캡처(`shots/`)

- 390px 전체 페이지 전/후: `390-gate-*`, `390-explore-*`, `390-compare-*`, `390-method-*` (첫 화면 · 탐색 지도 · 비교와 지표는 처음 상태에서 숨긴 글이 접힌 곳 안에만 있어 전후가 같다)
- 바뀐 곳 가까이(왼쪽 전, 오른쪽 후): `390-method-top-before-after.png`(눈썹 글), `390-compare-read-before-after.png`('읽는 법'), `390-method-reading-before-after.png`('자료를 읽을 때'), `390-map-sheet-value-before-after.png`(활용 × 보전 시트)
- 1440px 전/후(절반 크기): `1440-*-before/after.png`, 전후 픽셀이 같다
- 390px 영어 화면: `390-en-method-after.png`(눈썹 글 그대로, 단추 없음)

## 검사

- `node verification/test_mobile_dedupe.mjs`(CI): 불러오는 순서 · 캐시 · 단추 넷(글자 없음, 이름, 대상 id와 탭) · 숨기는 글 목록 · CSS가 휴대폰 한국어에만 숨김 · 새 글자 12px 이상 · 해시와 인라인 처리기 없음.
- `uicheck.mjs`에 더함: 1440px(단추 안 보임, 눈썹 글 9개 보임, 반복 문장 그대로) · 390px 한국어(허용 목록 밖 대문자 라벨 0, `dedupe-groups.json` 묶음마다 화면당 한 번 이하 · 기준 위치에는 보임, 단추 넷의 이름 · 44px · 누르면 대상 탭과 대상이 화면 안 · 접힌 곳 펼침 · 시트 열림) · 390px 영어(눈썹 글 보임, 단추 0, 숨긴 반복 0).
- `measure.mjs`: 네 화면 `textContent` 390 · 1440 × 한국어 · 영어 전후 모두 같음, 360 · 390 · 768 · 1100 · 1440px 가로 넘침 0, 1440px 다섯 화면 두 번씩 찍어 '고정된 차이' 픽셀 0(차이 자체가 0).
- 직접 확인: 키보드로 단추에 포커스가 가고 링이 보임, Enter로 이동, 콘솔 오류 없음(uicheck 'No uncaught page errors').
- 실행 결과(클라우드, 2026-10-25): CI 단위 검사 전부 통과, `python -m unittest` 496개 통과(3 건너뜀은 원래 있던 것), `test_i18n.mjs --browser` 통과, uicheck 286 PASS / 4 FAIL — 실패 넷은 이 환경에서 지도 타일이 막혀 생기는 원래 실패(A-5 공유 링크, 위성, 수심, 저장된 기본 지도)다.
- 실제 휴대폰에서는 확인하지 못했다(Playwright 390px · 360px 휴대폰 흉내로만 확인).

### 고친 검사 / 지운 검사 / 건너뛴 검사

- 고친 검사: `test_mobile_compact.mjs`의 'mobile-compact.css가 맨 마지막 스타일시트' → 'mobile-dedupe.css를 뺀 마지막'. `test_client_outdated.mjs`의 `?v=` 목록에 두 새 파일 더함. `i18n-ko-baseline.txt` 다시 만듦.
- 지운 검사: 없다. 건너뛴 검사: 없다.

## 다시 돌리기

```
python verification/2026-10-25-mobile-labels-dedupe/apply_markup.py            # 이미 적용됨(한 번만)
node verification/2026-10-25-mobile-labels-dedupe/scan.mjs tmp/scan-390.json   # dist를 8765에 띄운 뒤
node verification/2026-10-25-mobile-labels-dedupe/group.mjs tmp/scan-390.json > tmp/groups-raw.json
python verification/2026-10-25-mobile-labels-dedupe/build_groups.py tmp/groups-raw.json
node verification/2026-10-25-mobile-labels-dedupe/measure.mjs                 # 기준 8766, 이 브랜치 8765
```
