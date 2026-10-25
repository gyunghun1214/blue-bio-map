# 휴대폰 글 양 줄이기: 지도 읽는 법 시트 · 긴 설명 접기 · 첫 화면 대회 문구 숨김 (2026-10-25)

휴대폰(740px 이하, 첫 화면은 760px 이하)에서만 설명 글을 지우지 않고 시트·접기로 옮겼다. 문구(한국어 textContent)·PC 화면·데이터는 그대로다.

- 기준 커밋: main `46afd7a` (PR #262 병합).
- 지침: 원본 [`prompt-original.md`](prompt-original.md) (LKH가 보낸 `prompts/mobile-compact-text-claude-code.md`, 저장소에는 `prompts/` 폴더가 없다).
- 다른 스레드의 `dist/mobile-type.css`(휴대폰 글자 크기)는 이 브랜치를 만들 때 main에 없었다. 들어오면 `mobile-compact.css`가 그 뒤에 오도록 `test_mobile_compact.mjs`가 검사한다.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `dist/mobile-compact.css` (새 파일) | 휴대폰 접기 · 첫 화면 두 줄 숨김 · 지도 읽는 법 시트. 머리글의 다른 모든 스타일시트 다음(`intro.css` 뒤)에 불러온다 |
| `dist/mobile-compact.js` (새 파일) | 휴대폰에서 접는 칸을 처음에 닫기, 문단 안 '더 보기' 단추, 시트 열고 닫기(포커스 가둠·복귀, 스크롤 잠금). `app.js` 바로 뒤 `defer` |
| `dist/index.html` | 접는 칸 11곳(`<details class="mc-more" open>`) · 문단 단추 1곳(`.mc-rest` + `.mc-more-btn`) · 시트 껍데기 `#map-guide` · `<summary id="map-guide-title">`(id만 더함) · 두 파일 `<link>`/`<script>` · `?v=` |
| `dist/_headers` | `/mobile-compact.css` · `/mobile-compact.js` 1년 캐시(`immutable`) |
| `dist/i18n-en.js` · `dist/i18n.js` · `dist/expedition.html` | 영어 화면 사전에 나뉜 문장 16개를 더함(아래 '영어 화면'). `i18n.js`의 `i18n-en.js?v=`와 두 HTML의 `i18n.js?v=`는 `i18n_ui_dict.py stamp`이 다시 계산한 캐시 값뿐이다(`expedition.html`의 바뀐 곳은 이 한 줄) |
| `verification/test_mobile_compact.mjs` (새 검사) · `.github/workflows/verify.yml` | 마크업·CSS·스크립트 정적 검사, CI 단위 검사에 추가 |
| `verification/uicheck.mjs` | 브라우저 검사 추가(아래 '검사') |
| `verification/test_client_outdated.mjs` | `?v=` 검사 목록에 새 두 파일 |
| `verification/test_cmnpd_candidates_ui.mjs` | ChEMBL 카드 끝 마크업 기대값을 접는 칸에 맞춤(아래 '검사') |
| `verification/i18n-ko-baseline.txt` | 다시 만듦(아래 '검사') |

기존 CSS 파일, `scripts/`, `config/`, `dist/*.json`, 멍이, 기존 id · `data-*` · `role` · `aria-*`, 지표 값, 흐름 SVG는 고치지 않았다.

## 첫 화면

| 선택자 | 휴대폰(760px 이하) |
|---|---|
| `.gate-task` · `.gate-connect` (대회 과제·연결 두 줄) | `display:none`. 글은 DOM에 그대로, 넓은 화면은 그대로 |
| `.gate-kicker` | main에서 이미 760px 이하 숨김이라 손대지 않음 |
| 출처 문단 '근거와 방법' 맨 아래 `.mt-context` | 그대로 |

390px에서 '지도 열기' 단추 아래 끝이 452px → 369px로 올라와 첫 화면 안에 들어온다.

## 탐색 지도: '지도 읽는 법' 시트

### 실제 구조 (지침의 전제와 다른 점)

지침은 네 덩어리가 지도 아래 한곳에 펼쳐져 있다고 보았지만 실제로는 이렇다.

| 덩어리 | 자리 | main의 휴대폰 상태 |
|---|---|---|
| `.map-notes` '지도 읽는 법' | `.map-below` 안(지도 아래 흐름) | `app.js`가 휴대폰에서 닫아 둠(제목 한 줄) |
| `.map-legend-more` 'ⓘ 범례'(큰 버블·점 설명) | 출현 기록 범례 `#occurrence-legend` 안 | 범례 자체가 '범례' 알약으로 접혀 있고(PR #236), 그 안에서도 닫힘 |
| `.map-info` '그 밖의 기능 · 배경 지도 출처' | `.map-legend-more` 안 | 닫힘 |
| `.legend-why` '색의 의미' | 활용 × 보전 유형 범례 `#value-legend` 안 | 닫힘(유형 범례는 '읽는 법 ⓘ'로 여는 팝업) |

네 덩어리가 한 부모 아래에 있지 않아서, 시트는 **열 때 네 덩어리를 `#map-guide .mg-body`로 잠시 옮겨 담고 닫을 때 제자리(주석 표시 자리)로 돌려놓는다.** 지침의 'DOM에서 옮기지 않는다'와 다르다. 닫혀 있을 때(평소)는 DOM 순서·textContent가 main과 같고, 열고 닫은 뒤에도 탐색 지도 textContent가 열기 전과 같음을 uicheck가 확인한다.

### 지금 동작 (740px 이하)

- 여는 곳
  - 활용 × 보전 보기: 미니 매트릭스의 **'읽는 법 ⓘ'**(`#value-info`). 넓은 화면에서는 전처럼 팝업(`#value-legend`)이 뜨고, 휴대폰에서는 시트가 뜬다. 시트에는 '지도 읽는 법' → 유형 범례 전체(`#value-legend`, 그 안의 '색의 의미') → 'ⓘ 범례'(그 안의 '그 밖의 기능') 순으로 담긴다.
  - 출현 기록 보기: 지도 위 '범례' 알약을 펼친 뒤 **'ⓘ 범례'**(`.map-legend-more>summary`). 휴대폰에서만 `aria-controls="map-guide"` · `aria-haspopup="dialog"`가 붙는다. 시트에는 '지도 읽는 법' → 'ⓘ 범례'(그 안의 '그 밖의 기능') → '색의 의미' 순.
- 지도 아래 흐름의 `.map-notes`는 휴대폰에서 숨긴다(시트에서 읽는다). 범례 칩·조사량 막대·선택 종 칩은 그대로.
- 시트: `role="dialog"` `aria-modal="true"` `aria-labelledby="map-guide-title"`(기존 '지도 읽는 법' 제목), 높이 75vh(75dvh) 이하, 오른쪽 위 ✕ 단추 `aria-label="닫기"` 44×44px.
- 닫기: ✕ · 뒤 배경 누르기 · Esc · 화면이 741px 이상으로 넓어짐. 닫으면 포커스가 연 단추로 돌아간다(넓어져서 닫힐 때는 돌리지 않는다).
- 열린 동안: Tab · Shift+Tab이 시트 안에서만 돈다, 뒤 페이지 스크롤 잠금(`html.mg-lock`), 멍이 버튼 숨김. 시트 안의 작은 제목(옮겨 담은 `<summary>`)은 누르지 않고 Tab도 가지 않는다(`tabindex="-1"`, 닫을 때 원래 값으로).
- 움직임: 아래에서 0.22초 올라온다. 사이트의 '움직임 줄이기'(`bbvm-reduce-motion`)나 `prefers-reduced-motion`이면 움직이지 않는다.

## 비교와 지표 · 근거와 방법: 접는 칸

HTML에서는 모두 열려 있고(`<details class="mc-more" open>`, 스크립트가 없어도 글이 보인다), 휴대폰에서만 `mobile-compact.js`가 처음에 닫는다. 넓은 화면은 `details.mc-more{display:contents}` + `::details-content{display:contents}`로 접는 칸이 없는 것처럼 그려지고 단추가 없다. summary는 비어 있고 `aria-label="더 보기"`, 화면의 '더 보기' · '접기'(영어 화면 'More' · 'Collapse')는 CSS `content`로만 그린다. 목록 항목의 시작 마크업(`<li><b>…</b>`)과 `<li>`의 class는 그대로다.

| # | 곳 | 선택자 · 접는 방법 | 휴대폰에서 처음 보이는 것 |
|---|---|---|---|
| 1 | 비교와 지표 '읽는 법' 팝업 목록 | `#cmp-read-pop ul.cmp-read-more` 다섯 항목 중 뒤 셋을 `<details class="mc-more">` 안 둘째 `<ul class="cmp-read-more">`로 | 앞 두 항목 + 더 보기 |
| 2 | 근거와 방법 국가 시스템 비교 표 | `section.mt-nat` 안 `.mt-nat-wrap`(표) + `.mt-nat-src`(출처)를 통째로 | 제목·도입 문장 + 더 보기 |
| 3–5 | 근거와 방법 02 'MFPI · 식량' · 'MBPI · 생리활성' · 'MCUI · 보전' | `#method-02` 각 `<li>`의 첫 문장 뒤를 `<details class="mc-more"><summary></summary><span>…</span></details>` | `<b>` 제목 + 첫 문장 + 더 보기 |
| 6 | 근거와 방법 ChEMBL 카드('왜 MBPI의 주 소스가 ChEMBL인가요?') 둘째 문단 | `#method-chembl`의 둘째 `<p class="fine">`와 `#mt-cmnpd`를 통째로 | 첫 문단 + 더 보기 |
| 7–10 | 근거와 방법 03 'BBVI 가중치' · 'MCUI' · '의약 후보 MBPI' · `#method-mbpi-kind` 'MBPI 근거 종류' | 3–5와 같은 방법(두 문장 이상인 항목만. '규칙 고정' 도입 문단과 'MCUI 자원 감소 신호'는 그대로) | `<b>` 제목 + 첫 문장 + 더 보기 |
| 11 | 근거와 방법 04 '자료를 읽을 때' | `.method-bottom ul.large-list` 열한 항목 중 뒤 여덟을 둘째 `<ul class="large-list">`로 | 앞 세 항목 + 더 보기 |
| 12 | 근거와 방법 '유형과 셀 색' 문단 | `<p>` 안에는 `<details>`를 둘 수 없어(HTML 파서가 문단을 닫는다) 첫 문장 뒤를 `<span class="mc-rest" id="mc-rest-types">`로 감싸고 그 뒤에 `<button class="mc-more-btn" aria-expanded aria-controls="mc-rest-types">` | 첫 문장 + 더 보기 |

지침과 다른 점: 12는 `<details>` 대신 단추 + `span`(위 이유). `#cmp-read-plain`(비교와 지표 '쉬운 말' 문단)은 `app.js`가 채우는 한 문장이라 접지 않았다.

## 보이는 글자 수 (390px, `innerText` 길이)

main(전)과 이 브랜치(후)를 같은 조건(배율 1, 움직임 줄이기, Supabase 저장 사본)으로 잰 값. [`measure.mjs`](measure.mjs) → [`measure.json`](measure.json).

| 화면 | 상태 | 전 | 후 | 차이 |
|---|---|---:|---:|---:|
| 첫 화면 | 처음 | 1,471 | 1,341 | −130 (−9%) |
| 탐색 지도 | 처음 | 4,765 | 4,757 | −8 ('지도 읽는 법' 제목 줄) |
| 비교와 지표 | 처음 | 881 | 881 | 0 |
| 비교와 지표 | '읽는 법' 연 뒤 | 2,262 | 2,007 | −255 (−11%) |
| 근거와 방법 | 처음(01~04 접힘) | 3,171 | 3,171 | 0 |
| 근거와 방법 | 01~04 모두 펼친 뒤 | 11,042 | 8,266 | −2,776 (−25%) |

1440px은 네 화면 모두 전과 후가 같다(첫 화면 1,542 · 탐색 지도 7,428 · 비교와 지표 1,059, '읽는 법' 연 뒤 2,367 · 근거와 방법 3,171, 모두 펼친 뒤 11,159).
네 화면의 textContent는 390px · 1440px 모두, 근거와 방법 · '읽는 법'을 펼친 뒤에도 main과 같다(8/8). 가로 넘침은 360 · 390 · 768 · 1100 · 1440px 세 화면 모두 0.

## PC 화면 (1440 · 1280px)

- 기본 상태: [`../2026-10-25-mobile-ux/pc-diff.mjs`](../2026-10-25-mobile-ux/pc-diff.mjs)로 탐색 지도 · 비교와 지표(매트릭스 · 데이터 표) · 근거와 방법 · 첫 화면 · 바다 탐험을 1440×900 · 1280×720, 움직임 줄이기 · 보통 움직임으로 두 번씩 찍어 견줌. 48장 중 42장은 픽셀까지 같다. 나머지:
  - 움직임 줄이기 1440 탐색 지도(화면 · 전체 길이 2장): '선택 종 비교하기' 단추 둥근 모서리 18픽셀이 채널값 ±1. 같은 쪽 두 번은 같았고 눈으로는 구분되지 않는다(보통 움직임 1440 · 1280에서는 같다).
  - 보통 움직임 바다 탐험(4장): 3D 움직임이라 같은 쪽 두 번 찍은 것끼리도 30만 픽셀 넘게 달라 비교가 되지 않는다. 움직임 줄이기에서는 같다.
- 펼친 상태(`measure.mjs` 4번): 비교와 지표 '읽는 법' 팝업 · 지도 'ⓘ 범례' · 활용 × 보전 '읽는 법 ⓘ' 팝업은 고정된 차이 0. 근거와 방법 01~04를 모두 펼친 화면은 줄바꿈·높이(1440×7879)가 같고, 접는 칸이 문장 사이에 들어간 두 곳('MBPI · 생리활성'의 둘째 줄, '유형과 셀 색' 문단 첫 줄)의 글자 테두리 240픽셀이 채널값 최대 43 다르다. 글자 덩어리가 둘로 나뉘어 그 뒤 글자의 소수점 아래 위치가 달라진 것이고 글자 자리·줄은 그대로다.

## 영어 화면 (`?lang=en`)

`i18n.js`는 링크·강조가 섞인 문장을 `innerHTML` 통째로 사전에서 찾는데, 문장을 첫 문장 + 접는 칸으로 나누자 통째 키가 맞지 않아 한국어 + KO 표시로 남았다. 나뉜 조각 16개(첫 문장, 나머지 `span`, `<b>`가 든 나머지는 그 `innerHTML`)를 기존 영어를 나눠 사전에 더했다(`python scripts/i18n_ui_dict.py add` · `stamp`). 390 · 1440px 영어 화면의 KO 표시 수는 main과 같고(근거와 방법 2 · 비교와 지표 14 · 탐색 지도 5, 모두 이 작업과 무관), 글은 근거와 방법 02의 소제목 세 개 대문자만 다르다: 'MFPI · food' → 'MFPI · Food', 'MBPI · bioactivity' → 'MBPI · Bioactivity', 'MCUI · conservation' → 'MCUI · Conservation'. 이 `<b>`는 이제 따로 번역되는데 같은 한국어 키가 탐색 지도에서 'MBPI · Bioactivity'로 쓰이고 있어 그쪽에 맞췄다.

## 캡처

390px(휴대폰, 배율 2): [`shots390.mjs`](shots390.mjs)

| 화면 | 전 | 후 |
|---|---|---|
| 첫 화면 | [390-gate-before](shots/390-gate-before.png) | [390-gate-after](shots/390-gate-after.png) |
| 탐색 지도(시트 닫힘) | [390-explore-before](shots/390-explore-before.png) | [390-explore-after](shots/390-explore-after.png) |
| 탐색 지도 '범례' → 'ⓘ 범례' | [390-explore-legend-before](shots/390-explore-legend-before.png) (범례 칸 안에서 펼침) | [390-explore-legend-after](shots/390-explore-legend-after.png) (시트) |
| 활용 × 보전 '읽는 법 ⓘ' | [390-explore-value-before](shots/390-explore-value-before.png) (팝업) | [390-explore-value-after](shots/390-explore-value-after.png) (시트) |
| 비교와 지표 '읽는 법' | [390-compare-read-before](shots/390-compare-read-before.png) | [390-compare-read-after](shots/390-compare-read-after.png) |
| 근거와 방법 02 | [390-method-02-before](shots/390-method-02-before.png) | [390-method-02-after](shots/390-method-02-after.png) |
| 근거와 방법 03 | [390-method-03-before](shots/390-method-03-before.png) | [390-method-03-after](shots/390-method-03-after.png) |

1440px: [첫 화면 전](shots/1440-gate-before.png) · [후](shots/1440-gate-after.png), [근거와 방법 모두 펼침 전](shots/1440-method-open-before.png) · [후](shots/1440-method-open-after.png), [활용 × 보전 '읽는 법 ⓘ' 전](shots/1440-explore-value-info-before.png) · [후](shots/1440-explore-value-info-after.png). 1440px 캡처는 저장소 크기 때문에 256색으로 줄여 실었다(픽셀 비교는 줄이기 전 원본으로 했다).

## 검사

- 새로: `verification/test_mobile_compact.mjs`(CI 단위 검사) — CSS가 맨 마지막 스타일시트(`mobile-type.css`가 있으면 그 뒤), 스크립트가 `app.js` 바로 뒤, 1년 캐시, 접는 칸 11곳 모두 `open`·빈 summary·`aria-label="더 보기"`, `<li>` 시작 마크업과 class 없음, 문단 단추가 가리키는 `span`, 시트 껍데기(글자 없음·대화상자·탐색 지도 안), 넓은 화면 `display:contents`, 첫 화면 두 줄은 760px 이하에서만 숨김, 새 CSS 글자 12px 이상, 인라인 처리기 없음.
- `uicheck.mjs`에 더한 브라우저 검사
  - 1440px: 접는 칸이 모두 열려 있고 '더 보기'가 없음, 지도 읽는 법이 제자리, '읽는 법 ⓘ'는 전처럼 팝업이고 시트가 안 뜸.
  - 390px 출현 기록: 'ⓘ 범례' → 시트(대화상자, 제목 '지도 읽는 법', 네 덩어리, 아래 붙음·높이 75% 이하, ✕ '닫기' 44px 이상·누를 수 있음, `aria-expanded`·`aria-controls`, 포커스가 제목), Esc → 네 덩어리 제자리·탐색 지도 textContent가 열기 전과 같음·포커스가 'ⓘ 범례'.
  - 390px 활용 × 보전: '읽는 법 ⓘ' → 시트에 유형 범례 네 칸, Tab 8번 해도 시트 안, ✕ · 뒤 배경으로 닫힘·포커스가 '읽는 법 ⓘ'.
  - 390px 접는 칸: 11곳 이상 모두 닫힘, 이름 '더 보기' 하나, 비어 있음, 44px 이상, `::before`가 '더 보기'/'접기', 문단 단추 동작.
  - 첫 화면 G-5e: 390px에서 대회 두 줄이 안 보이고 글은 페이지에 남음.
- 고친 것
  - `test_cmnpd_candidates_ui.mjs`: ChEMBL 카드가 `…<p class="fine" id="mt-cmnpd"></p></article>`로 끝난다는 기대를 접는 칸 `…<details class="mc-more" open><summary aria-label="더 보기"></summary><p class="fine">…</p><p class="fine" id="mt-cmnpd"></p></details></article>`로 바꿈(같은 순서·같은 글).
  - `i18n-ko-baseline.txt`: 다시 만듦. 바뀐 것은 문장이 접는 칸 앞뒤로 나뉜 줄, 새 `@aria-label=더 보기`·`@aria-label=닫기` 줄, 그리고 PR #262가 더하고 기준 파일에 빠뜨린 `@aria-label=지도 크게 보기` 한 줄.
  - `test_client_outdated.mjs`: `?v=` 검사 목록에 새 두 파일.
- 지운 검사 · 건너뛴 검사: 없음.
- 결과: CI 단위 검사 54개 모두 통과. uicheck 결과는 PR 본문과 CI에 있다.

## 확인하지 못한 것

- 실제 휴대폰, iOS Safari, 화면 낭독기(VoiceOver · TalkBack)로는 보지 못했다. 모두 Linux Chromium 390×844 터치 흉내로 확인했다.
- 화면 안 찾기: Chrome은 찾기 막대(Ctrl+F)로 닫힌 `<details>` 안 글을 찾으면 스스로 펼친다고 알려져 있지만, 헤드리스에서는 찾기 막대를 띄울 수 없어 확인하지 못했다(`window.find`는 글을 찾지만 펼치지 않는다). 문단 안 `.mc-rest`(12번)는 접힌 동안 `display:none`이라 찾지 못한다.
