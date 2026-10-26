# 탐색 지도 '공개 집계 기간' 칩: 글자와 펼침 표시 겹침 (2026-10-26, LKH 요청)

LKH 지침 「탐색 지도 '공개 집계 기간 · 전체' 칩: 글자와 펼침 표시(⌃/⌄) 겹침 고치기」(prompts/map-period-chip-caret-overlap-claude-code.md,
이 작업에는 첨부 파일로 받음)대로 겹침만 고쳤다. 문구·선택지·기본값·글자 크기·색·칩 위치·기간 바꾸기 동작·URL 해시는 그대로다.

- 기준 커밋: main `3a5aca1` (#272 멍이 휴대폰 가림 병합 뒤). 작업 중 병합된 #273(지도 출처 ⓘ)·#277(멍이 크기·끌기) main `e7cccff`을 합친 뒤
  새 검사(164 PASS)·CI 단위 단계·uicheck를 다시 돌렸다. `?v=`는 stamp를 다시 돌려도 바뀌지 않았다.
- 실제 원인: `theme.css`의 `.period-filter button{padding:4px 10px}`(선택자 점수 0,1,1)이 칩 버튼 `.pf-toggle{padding:8px 34px 8px 14px}`(0,1,0)을
  이겨서, 화살표 자리로 잡아 둔 오른쪽 여백 34px가 10px로 줄었다. 화살표(`::after`)는 오른쪽에서 14px에 그대로 있어서 값 글자가 화살표 밑으로
  13.7px 들어갔다. 휴대폰만이 아니라 **모든 폭(360·390·768·1440)에서 같은 13.7px** 겹쳤다. 모바일 글자 크기 작업(#266)은 원인이 아니다
  (390px 글자 13px는 그 전에도 칩 폭 안에 있었고, 겹침 폭은 글자 크기와 상관없이 같다).

## 먼저 확인한 것

1. **칩 구조**: `<select>`가 아니라 버튼과 펼침 목록이다.
   `#period-filter.period-filter[role=group]` 안에 `<button class="pf-toggle" aria-expanded aria-controls="pf-menu"><span class="pf-k">공개 집계 기간</span> · <b>전체</b></button>`,
   그 아래 `<div id="pf-menu" class="pf-menu" role="group" hidden>`에 `<button data-period="all|2000–2015|…">`. 만드는 곳은 `dist/app.js` `renderPeriodFilter()`.
2. **화살표 그리는 방식**: `.pf-toggle::after` 하나(7×7 상자의 오른쪽·아래 테두리 1.8px를 45° 돌린 V). 브라우저 기본 화살표는 없다(`<select>`가 아님).
   칩 안의 화살표는 하나다: Chromium과 WebKit(Playwright) 모두 `::before/::after` 내용·svg·img를 세어 1개(아래 검사). iOS Safari 실제 기기는 이 작업
   환경(클라우드)에서 열 수 없어 **확인하지 못했다.** 대신 WebKit Playwright 검사를 CI에 넣었다(아래 '검사').
3. **계산 값(고치기 전, Chromium, 칩 왼쪽 기준이 아니라 화면 좌표)**

   | 폭 | 글자 크기 | 버튼 padding | 버튼 폭 | 값 `<b>` 오른쪽 | 화살표 왼쪽–오른쪽 | 겹침 |
   |---|---|---|---|---|---|---|
   | 360 / 390 | 13px | 4px 10px | 131.7px | 132.7 | 119.1–130.4 (폭 11.3) | 13.7px |
   | 768 | 12px | 4px 10px | 124.0px | 409.0 | 395.4–406.7 | 13.7px |
   | 1440 | 15px | 4px 10px 4px 16px | 153.1px | 1025.8 | 1012.2–1023.5 | 13.7px |

   값이 `2000년 이전`·`2000–2015`·`2016–2026`이어도 같은 13.7px 겹쳤다(칩 폭이 글자에 맞춰 늘어나므로).
4. **규칙이 있는 파일과 이기는 규칙**
   - `style.css` `.period-filter button{padding:2px 10px;font-size:12px}` (옛 칩 모양, 뒤 규칙에 짐)
   - `theme.css:91` `.period-filter button{padding:4px 10px;font-size:12px}` → **padding이 여기서 이김**(0,1,1)
   - `theme.css` `.pf-toggle{padding:8px 34px 8px 14px;font-size:14px}` (0,1,0) → padding·글자 크기 모두 짐
   - `theme.css` `@media (min-width:1180px)` `#explore .pf-toggle{font-size:15px;padding-left:16px}` → 1440에서 글자 15px·왼쪽 16px
   - `theme.css` `@media (min-width:1180px) and (max-width:1599px)` `html.lang-en #explore .pf-toggle{padding-right:32px}` (영어 화면만)
   - `mobile-type.css` `@media (max-width:740px)` `.period-filter button{font-size:13px}` → 휴대폰 글자 13px
   - `mobile-compact.css`, `mobile-dedupe.css`에는 이 칩 규칙이 없다. 휴대폰 CSS 순서(mobile-type → mobile-compact → mobile-dedupe 마지막)는 그대로다.

## 바꾼 것 (`dist/theme.css`만, + `index.html`의 `theme.css?v=`)

| 규칙 | 전 | 후 |
|---|---|---|
| `.pf-toggle` 오른쪽 여백 | `34px` (실제로는 위 규칙에 져서 10px) | `calc(var(--pf-caret-r) + var(--pf-caret-w) + 8px)` = 14 + 13 + 8 = 35px |
| `.pf-toggle::after` `right` | `14px` | `var(--pf-caret-r)` (14px, 같은 자리) |
| 새 `.period-filter .pf-toggle{padding-right:…}` | 없음 | 위 `calc`를 0,2,0 선택자로 한 번 더 적어 `.period-filter button`을 이김. **padding만** 적어 글자 크기는 이전 규칙 그대로 |
| 새 `.period-filter .pf-toggle .pf-k` | 없음 | `min-width:0;overflow:hidden;text-overflow:ellipsis` (칩이 좁아질 때 라벨 쪽만 말줄임. 지금 폭들에서는 줄지 않음) |
| 새 `.period-filter .pf-toggle b` | 없음 | `flex:none` (값은 줄지 않음) |
| 새 `.map-ui-tl:has(#pf-menu:not([hidden])){z-index:501}` | 없음 | 아래 '같이 고친 것' |

화살표는 새로 만들지 않았고 모양·위치(오른쪽 14px, 세로 가운데)도 그대로다. 칩 폭은 원래 `inline-flex` 자동 폭이라 고정 폭이 원인이 아니었다.
여백이 25px 늘어 칩이 그만큼 넓어졌다(390: 133.7 → 158.7px). 영어 화면 1180–1599px는 원래 `padding-right:32px` 규칙이 그대로 이긴다(간격 8.3px).

**같이 고친 것**: PC 폭(1180px 이상)에서 기간 목록을 펼치면 첫 줄 `전체`가 바로 아래 줄의 '링크 복사 · 전체 보기' 밑에 깔려 눌리지 않았다
(두 줄 모두 `z-index:500`, 아래 줄이 문서에서 뒤). 새 검사의 '목록이 다른 컨트롤 밑에 있지 않다'에서 걸려, 목록이 열려 있는 동안만 칩 줄을 501로
올렸다. 닫혀 있을 때 쌓임 순서는 그대로다. 캡처: `before/chromium-1440-menu-open.png` → `after/chromium-1440-menu-open.png`.

## 결과 (고친 뒤, Chromium)

| 폭 | 글자 크기 | 버튼 padding | 버튼 폭(전체) | 값과 화살표 사이 |
|---|---|---|---|---|
| 360 / 390 | 13px (그대로) | 4px 35px 4px 10px | 156.7px | 11.3px |
| 768 | 12px (그대로) | 4px 35px 4px 10px | 149.0px | 11.3px |
| 1440 | 15px (그대로) | 4px 35px 4px 16px | 178.1px | 11.3px |

네 선택지 모두 같은 간격이고 값이 잘리지 않는다. 360~1440px 가로 넘침 없음. 기간을 고르면 지도 레이어 수와 링크(`p=`)가 바뀌고 다시 `전체`로 돌아온다.
`활용 × 보전`에서 Tab을 누르면 칩에 포커스 링이 보인다. 영어 화면(`?lang=en`) 1280·1440·390에서도 간격 8.3 / 8.3 / 11.3px.

캡처(2배 해상도 칩 확대): `before/`와 `after/`의 `chromium-390-전체.png`, `chromium-390-2000년_이전.png`, `chromium-360-2000년_이전.png`,
`chromium-1440-전체.png`. WebKit 수치는 CI `webkit` 작업 로그(`gap …px`)에 남는다. iOS Safari 실제 기기 캡처는 없다(위 2번).

## 검사

- **새 검사** `verification/period_chip_check.mjs` (Playwright, Chromium과 WebKit): 360·390·768·1440에서 칩 메뉴로 네 선택지를 하나씩 골라
  값 `<b>` 오른쪽이 화살표 왼쪽보다 4px 이상 왼쪽 · 값이 잘리지 않음 · 화살표 하나 · '출현 기록 / 활용 × 보전', '위성 · 수심', 확대 버튼과 사각형
  교차 없음 · 가로 넘침 없음 · 링크에 기간 · 고를 때마다 같은 글자 크기 · 지도가 기간에 따라 다시 그려짐 · 열린 목록이 다른 컨트롤 밑에 있지 않음 ·
  키보드 포커스 링. Chromium 164 PASS / 0 FAIL, 고치기 전 main에서는 16건(모든 폭·선택지의 겹침) FAIL.
- **CI**: `verify.yml`에 `webkit` 작업(ubuntu, Playwright 공식 이미지 `mcr.microsoft.com/playwright:v1.63.0-noble` + `playwright@1.63.0`)을 더해
  이 검사를 두 엔진으로 돌린다. 처음에는 `install --with-deps`로 브라우저 시스템 라이브러리를 apt로 받았는데 15분 제한에 걸려, 라이브러리가
  든 이미지로 바꿨다. 이미지에 Python이 없어 검사가 `--serve`로 `dist/`를 직접 띄운다.
  Windows 작업은 의존성 없이 설치된 Chrome을 쓰므로 Playwright를 거기 넣지 않았다. 단위 작업에 `node --check verification/period_chip_check.mjs`.
- CI 단위 단계 58개 명령(`node verification/test_*.mjs`, `python scripts/build_expedition_stops.py --check`, Python 3.12 `unittest discover` 등) 모두 통과.
- `uicheck.mjs`(로컬, `FIXTURE=dist/live-snapshot.json`): 287 PASS / 4 FAIL(main `e7cccff`을 합친 뒤 290 PASS / 4 FAIL). 4건은 클라우드에서 지도 타일(NASA GIBS·GEBCO)이 막혀 생기는
  환경 실패(위성·수심 타일, 저장된 '기본' 기본값, A-5 공유 링크 배경)로 main에서도 같다.
- 이 칩에 묶인 기존 검사: `uicheck.mjs`의 기간 필터 검사(`#period-filter [data-period]` 클릭, 레이어 수·셀 표·해시·요약), `test_map_boundary.mjs`
  (팝업의 '공개 집계 기간 …' 문구). 둘 다 그대로 통과, 기대값 충돌 없음.
- 고친 검사: 없다. 지운 검사: 없다. 건너뛴 검사: 없다.
- `?v=`: `python scripts/i18n_ui_dict.py stamp`로 다시 계산, `theme.css?v=6780d1e81e → 38ddb5e8b4`만 바뀜. 한국어 문구를 바꾸지 않아 `i18n-ko-baseline.txt`는 그대로.
- 직접 확인하지 못한 것: iOS Safari 실제 기기, Android Chrome 실제 기기(클라우드 환경). 휴대폰 폭은 Chromium 모바일 에뮬레이션(터치)과 WebKit으로 대신했다.
