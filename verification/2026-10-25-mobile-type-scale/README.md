# 휴대폰 글자 크기 체계 (2026-10-25, LKH 요청)

LKH 지침 「모바일 글자 크기 체계 올리기 + 매트릭스 점 이름 정리」(prompts/mobile-type-scale-claude-code.md, 이 작업에는 첨부 파일로 받음)대로
휴대폰 폭에서 글자 크기만 바꿨다. 문구·색·자료·PC 화면은 그대로다.

- 기준 커밋: main `46afd7a` (#262 휴대폰 시트 끌기 병합 뒤)
- 크기 체계(휴대폰, 18px 미만): 13(라벨) · 14(보조) · 15(본문) · 16(유지) · 17px(소제목)만. 소수점 크기(12.5·13.5·14.5·15.5)는 없앴다.
- 적용 폭: 첫 화면 ≤760px(intro.css 기준과 같게), 나머지 ≤740px. 741px 이상(첫 화면은 761px 이상)은 한 글자도 안 바뀐다.

## 바뀐 파일

| 파일 | 무엇 |
|---|---|
| `dist/mobile-type.css` (새 파일) | 휴대폰 글자 크기 규칙 전부. 미디어 쿼리 안에만 있고, 원래 크기를 정하던 선택자를 그대로 복사해 파일 순서로 이긴다. `!important`는 원래 규칙이 그런 `.fine`, `#method .mt-ix .mt-ix-w`만. 이 파일과 index.html 한 줄을 빼면 되돌아간다 |
| `dist/index.html` | 모든 CSS 맨 뒤(chatbot.css 다음)에 `mobile-type.css?v=…` 한 줄, `app.js?v=` 갱신 |
| `dist/_headers` | `/mobile-type.css` immutable 캐시 |
| `dist/app.js` | `markBasketPoints()`: 비교 담기에 든 종의 매트릭스 점에 `.in-basket` 클래스(담김 상태를 나타내는 기존 클래스·속성이 없어서 하나 더함). 선택은 기존 `aria-current`, 포커스는 `:focus-visible`을 그대로 씀 |
| `verification/uicheck.mjs`, `verification/type_scale_probe.mjs` | T-1·T-2 검사(아래) |
| `verification/test_client_outdated.mjs` | `?v=` 해시 검사 목록에 `mobile-type.css` 추가 |

`style.css`·`theme.css`·`intro.css`·`compare.css`·`method.css`·`chatbot.css`는 고치지 않았다. 모바일 블록이 글자를 줄이던 규칙(`.tabs button` 12px,
`.notice p` 12px, `.species-card .count` 등)도 원래 줄은 두고 새 파일에서 덮어썼다. `--fs-min`은 `@media (max-width:740px){:root{--fs-min:13px}}`로만
바꿨다(PC 12px 그대로).

## 크기별 개수 (390px, 보이는 글자 요소, 10개 화면 상태 합)

| 크기 | 12 | 12.04 | 12.47 | 12.5 | 13 | 13.5 | 14 | 14.5 | 15 | 15.5 | 16 | 16.965 | 17 | 18 이상 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 전 | 4824 | 10 | 2 | 676 | 3434 | 416 | 1862 | 147 | 212 | 0 | 84 | 2 | 213 | 248 |
| 후 | 0 | 0 | 0 | 0 | 7670 | 0 | 3534 | 0 | 361 | 0 | 84 | 0 | 215 | 248 |

18px 미만 합계가 18개 줄어든 것은 평소 숨긴 매트릭스 점 이름(아래)이다. 18px 이상은 하나도 안 바뀌었다.
화면 상태 = 첫 화면, 탐색 지도(첫 화면·팝업·종 상세 접힘 모두 열기), 멍이 안내 창, 비교와 지표(매트릭스·다른 종 선택과 담기·데이터 표 모든 줄 열기·비교 기준 팝업), 근거와 방법(처음·접힘 모두 열기).
원자료: `before-390-fontsizes.json`, `after-390-fontsizes.json`, `before-1440-fontsizes.json`(각 상태의 요소별 선택자·크기·글자, 상태별 문구 해시).

## 크기 대응표 (390px)

크기를 정하던 규칙(Chromium CDP `CSS.getMatchedStylesForNode`로 찾음, 접힘·팝업·다른 탭처럼 안 보이는 글자까지) → 전 → 후.
단계: 13 라벨 / 14 보조 / 15 본문 / 17 소제목. ‘물려받음’은 그 규칙의 크기를 자식이 물려받은 글자까지 함께 센 것이다.

| 규칙(원래 선택자) | 파일 | 전(px) | 후(px) | 단계 | 예 | 판단 이유(애매한 것만) |
|---|---|---|---|---|---|---|
| `.lang-switch button` | theme.css | 12 | 13 | 라벨 | 한국어 |  |
| `.gate-task` | intro.css | 12 | 13 | 라벨 | Ocean 20 Challenge |  |
| `.gate-why-k` | intro.css | 12 | 13 | 라벨 | 문제 |  |
| `.gate-problems` | intro.css | 13 | 14 | 보조 | 우리 바다 생물의 식량·약 재료  |  |
| `.gate-connect` | intro.css | 12 | 13 | 라벨 | 흩어진 자료를 잇고, 오늘의 이용 | 대주제·연계 출처를 적은 메타 한 줄이라 라벨(첫 화면 높이를 아낌) |
| `.gate-card-sub` | intro.css | 13 | 14 | 보조 | 관측 기록과 생물 근거 |  |
| `.gate-legend` | intro.css | 12 | 13 | 라벨 | 관측 기록이 있는 공개 격자(1° |  |
| `.gate-legend .gate-credit` | intro.css | 12 | 13 | 라벨 | 지구 영상: NASA Blue M |  |
| `.gate-sources p` | intro.css | 12 | 13 | 라벨 | 함께 읽는 공개 자료 |  |
| `.gate-use-when` | intro.css | 13 | 14 | 보조 | 지금 쓸 수 있음 |  |
| `.gate-next-who` | intro.css | 13 | 14 | 보조 | 담당 · alt F4 팀 |  |
| `.gate-next-cost` | intro.css | 13 | 14 | 보조 | 운영비 · 월 0원 · alt F |  |
| `.gate-next-basis` | intro.css | 12 | 13 | 라벨 | Cloudflare 무료 요금제( |  |
| `.gate-next-tag` | intro.css | 12 | 13 | 라벨 | 목표 2027 상반기 |  |
| `.gate-note` | intro.css | 13 | 14 | 보조 | (자료 연결 안내, 연결 실패 때만) | 이번 측정 상태(고정 자료)에서는 안 그려져 표에서 빠지던 것: 사양 6번 문장 목록 |
| `.gate-next-use` · `.gate-share-status` | intro.css | 13 · 12 | 14 · 13 | 보조 · 라벨 | | 지금 화면에 없는 요소: 사양 6번 목록대로 |
| `.brand` | theme.css | 14.5 | 15 | 본문 | Blue-bio |  |
| `.tabs button, .tabs button[data-short]` | theme.css | 12 | 14 | 보조 | 탐색 지도 |  |
| `.expedition-link` | theme.css | 12 | 13 | 라벨 | 바다 탐험 |  |
| `.status-chip` | theme.css | 12 | 13 | 라벨 | 연구 프로토타입 |  |
| `.status-pop .pop-project` | theme.css | 12 | 13 | 라벨 | alt F4 · OCEAN 20  |  |
| `.status-pop .notice-label` | theme.css | 12 | 13 | 라벨 | 공개 기준 자료 |  |
| `.status-pop .notice p` | theme.css | 12.5 | 14 | 보조 | 연구용 산출이며 채집·정책·투자  | 상태 팝업의 고지 문장이라 보조 |
| `.status-pop #connection-state` | theme.css | 12 | 13 | 라벨 | 공개 기준 자료 연결됨 · 30종 |  |
| `.status-pop #snapshot-date` | theme.css | 12 | 13 | 라벨 | 발행 2026-09-24 · 지표 |  |
| `.eyebrow` | style.css | 12 | 13 | 라벨 | MARINE EVIDENCE EX |  |
| `.scope span` | style.css | 12 | 13 | 라벨 | 124–132°E · 33–38. |  |
| `#explore .sheet-summary .type-chip .verdict` | theme.css | 12.5 | 13 | 라벨 | 활용 지표 높음 |  |
| `.sheet-summary .type-chip` | theme.css | 12 | 13 | 라벨 | 활용 연구 검토 |  |
| `.card-scores i small` | theme.css | 12 | 13 | 라벨 | 식량 |  |
| `.card-scores i .mcui-cat` | theme.css | 12 | 13 | 라벨 | (LC) |  |
| `.pane-title>span` | theme.css | 12 | 13 | 라벨 | 30종 |  |
| `button` | style.css | 12.5/14.5 | 13/14.5 | 라벨/ | 필터 더 보기 | font:inherit 단추. 부모(.cmp-more-grid>div 등)를 따라 13. 14.5는 휴대폰에서 안 보이는 오른쪽 패널(PC) |
| `.species-filters label` | theme.css | 12 | 13 | 라벨 | 분류군 |  |
| `.use-title` | theme.css | 12 | 13 | 라벨 | 활용 특성으로 찾기 · 여러 개를 |  |
| `.use-group` | theme.css | 12 | 13 | 라벨 | 신약 |  |
| `#explore .use-chip b` | theme.css | 12 | 13 | 라벨 | 7종 |  |
| `.use-group small` | theme.css | 12 | 13 | 라벨 | (식품 소재) |  |
| `.species-card .group` | style.css | 12 | 13 | 라벨 | 패류 |  |
| `.species-card b` | theme.css | 14.5 | 15 | 본문 | 참굴 |  |
| `.species-card em` | theme.css | 12 | 13 | 라벨 | Magallana gigas |  |
| `.species-card .card-line` | theme.css | 12 | 13 | 라벨 | BBVI 통합 활용 |  |
| `.species-card .card-verdict` | theme.css | 12.5 | 13 | 라벨 | , 판단 |  |
| `.species-card .card-verdict .verdict` | theme.css | 12.5 | 13 | 라벨 | 활용 지표 높음 |  |
| `.species-card .count` | theme.css | 12 | 13 | 라벨 | 지도 표시 기록 |  |
| `.species-card .card-line .cl-cat` | theme.css | 12 | 13 | 라벨 | (LC·예비) |  |
| `.species-card .card-line .cl-cons` | theme.css | 12 | 13 | 라벨 | 어획량 감소 |  |
| `#explore .leaflet-control-attribution` | theme.css | 12 | 13 | 라벨 | Leaflet |  |
| `.map-mode button` | theme.css | 12 | 13 | 라벨 | 출현 기록 |  |
| `.period-filter button` | theme.css | 12 | 13 | 라벨 | 공개 집계 기간 |  |
| `.basemap-switch button` | theme.css | 12 | 13 | 라벨 | 위성 |  |
| `.map-title #copy-link` | theme.css | 12.5 | 13 | 라벨 | 링크 복사 |  |
| `.map-title #reset-map` | theme.css | 12.5 | 13 | 라벨 | 전체 보기 |  |
| `.basemap-status` | theme.css | 12 | 13 | 라벨 | 배경 지도를 불러오지 못해 경계선 |  |
| `.value-mini>.w-badge` | theme.css | 12 | 13 | 라벨 | 탐색 보기 · 사용자 가중치 MB |  |
| `.value-mini .w-badge-reset` | theme.css | 12 | 13 | 라벨 | 공식값으로 |  |
| `.map-title button` | style.css | 12 | 13 | 라벨 | 읽는 법 |  |
| `.vm-y` | theme.css | 12 | 13 | 라벨 | MCUI |  |
| `.map-title` | theme.css | 12.5 | 13 | 라벨 | 50 |  |
| `.vm-x` | theme.css | 12 | 13 | 라벨 | BBVI → |  |
| `.value-legend strong` | theme.css | 12.5 | 13 | 라벨 | BBVI × MCUI 유형 · 출 |  |
| `.value-lead` | theme.css | 12 | 14 | 보조 | 두 지수는 따로 봅니다. 셀 색은 | 범례 문장이라 보조 |
| `.value-axis-y` | theme.css | 12 | 13 | 라벨 | MCUI(보전 시급성) → |  |
| `.value-grid span` | theme.css | 12 | 13 | 라벨 | 보전 연구 우선 검토 |  |
| `.value-grid small` | theme.css | 12 | 13 | 라벨 | BBVI 낮음 · MCUI 높음 |  |
| `.value-axis-x` | theme.css | 12 | 13 | 라벨 | BBVI(활용가치) → |  |
| `.value-key` | theme.css | 12 | 14 | 보조 | 4° 공개 셀 · 민감종 보호로  | 범례 문장(‘노란 굵은 실선 테두리 = …’)이라 보조 |
| `.value-layers` | theme.css | 12 | 13 | 라벨 | 같은 속 친척 종 · 다음 탐색  |  |
| `.legend-why>summary` | theme.css | 12 | 13 | 라벨 | 색의 의미 |  |
| `.legend-why p` | theme.css | 12 | 14 | 보조 | 색은 ‘출현 기록이 있는 셀 ×  |  |
| `.map-ui-bl.legend-collapsed .legend-toggle` | theme.css | 12.5 | 13 | 라벨 | "범례" |  |
| `#explore #map-symbol-label` | theme.css | 12 | 13 | 라벨 | 버블 = 공개 셀 묶음 · 숫자  |  |
| `.map-ui-bl .effort-key` | theme.css | 12 | 13 | 라벨 | 조사량 |  |
| `.effort-key .eb-scale` | theme.css | 12 | 13 | 라벨 | 적음 |  |
| `.map-ui-bl .effort-key small` | theme.css | 12 | 13 | 라벨 | OBIS · 2026-09-25  |  |
| `.map-legend-more>summary` | theme.css | 12 | 13 | 라벨 | 범례 |  |
| `#explore .key-bubble b` | theme.css | 12 | 13 | 라벨 | 큰 버블 = 공개 셀 묶음 · 숫 |  |
| `#explore .key-note` | theme.css | 12 | 14 | 보조 | 점 = 기록이 있는 칸의 위치(넓 |  |
| `.map-legend-more>span` | theme.css | 12 | 14 | 보조 | 축소한 지도에서는 칸을 해역별 버 |  |
| `.map-info` | style.css | 12 | 13 | 라벨 | 확대 |  |
| `.vkey` | theme.css | 12 | 13 | 라벨 | 셀 색 = 선택 종의 유형 |  |
| `.vk-view` | theme.css | 12 | 13 | 라벨 | 모든 종 겹쳐 보기 |  |
| `.map-caption` | theme.css | 12 | 13 | 라벨 | 공개 기준 자료 · 공개 1° 셀 |  |
| `.map-review-note` | theme.css | 12.5 | 14 | 보조 | 선별된 GBIF 출현기록을 공개  |  |
| `.map-judgment` | theme.css | 12.5 | 14 | 보조 | 이 종의 매트릭스 유형: 활용 연 |  |
| `.cell-table table` | style.css | 12 | 13/14 | 라벨/보조 | 참굴의 공개 셀별 근거. 셀 범위 | 표 본문 14, 머리(th) 13: 사양 5번 표 규칙을 셀 목록 표에도 적용 |
| `.fine` | style.css | 12 | 14 | 보조 | 지표는 종 단위 값입니다. 셀 범 | 접힌 근거·출처 설명 문장이 대부분이라 보조. 같은 규칙의 짧은 메타(‘전체 기간’)도 함께 14 |
| `.map-bottom span` | style.css | 12 | 13 | 라벨 | 지도 표시 기록 |  |
| `body` | theme.css | 14.5 | 14.5/15 | /본문 | Magallana gigas | body 14.5px를 물려받던 글: 보이는 것(#decision-detail h4, .decision-axis b, .cp-links, .coord-ok)만 15로. 14.5로 남은 것은 휴대폰에서 안 보이는 오른쪽 패널(PC) |
| `.group-icon small` | theme.css | 12 | 13 | 라벨 | 패류 |  |
| `.gloss` | theme.css | 12/12.04/12.47 | 13 | 라벨 | (관심대상) | max(12px,.86em) → 13px 고정. 전에 12~12.47px이던 풀이 괄호뿐이라 작아지는 곳 없음 |
| `.detail-top span` | theme.css | 12 | 13 | 라벨 | 공개 기준 적용 자료 |  |
| `.detail-top span, .detail-top .verified` | theme.css | 12 | 13 | 라벨 | 학명 연결 확인 |  |
| `#explore .ax-type-name` | theme.css | 12.5 | 13 | 라벨 | 활용 연구 검토 |  |
| `.ax-head small` | theme.css | 12 | 13 | 라벨 | 탐색용 합성지표 |  |
| `.detail-fold.ax-sens-fold>summary` | theme.css | 12.5 | 13 | 라벨 | 가중치별 BBVI |  |
| `.ax-note` | theme.css | 12 | 13 | 라벨 | MFPI 가중치별 BBVI: 0. | ‘한국 국가 평가 기반’ 같은 짧은 주석이라 라벨 |
| `.ax-sub` | theme.css | 12 | 13 | 라벨 | 식량 |  |
| `.ax-sub small` | theme.css | 12 | 13 | 라벨 | ACE 펩타이드 · LQP 펩타이 |  |
| `.ax-sep` | theme.css | 12 | 13 | 라벨 | 합치지 않고 따로 봅니다 |  |
| `.ax-num .ax-cat` | theme.css | 12 | 13 | 라벨 | (LC) |  |
| `.ax-where p` | theme.css | 12 | 14 | 보조 | ‘활용 × 보전’에서는 이 종의  |  |
| `.detail-pane h3` | theme.css | 12 | 13 | 라벨 | 지도에 표시한 기록 |  |
| `#detail-map-summary:has(>h3>.fine)>.evidence-item:nth-of-type(-n+2)>span` | theme.css | 12 | 13 | 라벨 | 지도 표시 기록 |  |
| `#detail-map-summary>.evidence-item>span:first-child` | theme.css | 12.5 | 13 | 라벨 | 해역 |  |
| `#detail-map-summary>.evidence-item>b` | theme.css | 12.5 | 13 | 라벨 | 동중국해 · 황해 · 쿠로시오 해 |  |
| `.evidence-item span:last-child` | style.css | 12 | 13 | 라벨 | (절반을 막는 농도) |  |
| `.detail-limit` | theme.css | 12 | 14 | 보조 | 공개된 관측 기록 기준입니다. |  |
| `.score-disclosure-body` | style.css | 13 | 14 | 보조 | EPA + DHA 149.1 mg |  |
| `.go-checks` | theme.css | 12 | 14 | 보조 | 검증 기록 보기 | .fine 문장 안 단추라 문장과 같은 14 |
| `.score-disclosure:is(.rx-disclosure,.breadth-disclosure,.lit-disclosure) summary span` | theme.css | 12.5 | 13 | 라벨 | 의약 후보 MBPI(보조, 탐색용 |  |
| `.score-disclosure:is(.rx-disclosure,.breadth-disclosure,.lit-disclosure) summary b` | theme.css | 12 | 13 | 라벨 | 63 · 항균 펩타이드 |  |
| `.stock-decline h4` | theme.css | 13.5 | 14 | 보조 | 자원 감소 신호 · KOSIS 어 |  |
| `.detail-pane .why b` | style.css | 13 | 14 | 보조 | 국내 유전자원 · 나고야의정서 |  |
| `.detail-pane .why` | style.css | 13 | 14 | 보조 | 한국 관할 해역 기록의 생물을 연 |  |
| `.detail-more-body` | theme.css | 13 | 14 | 보조 | WoRMS · 학명 원문 ↗ |  |
| `#compare .w-presets .cmp-ghost` | compare.css | 12.5 | 13 | 라벨 | 신약 중심 · MBPI 0.75 |  |
| `#compare .cmp-pop .weight-status` | compare.css | 12 | 13 | 라벨 | BBVI 산출 종 30종 |  |
| `#compare .cmp-pop .weight-control p` | compare.css | 12.5 | 14 | 보조 | 이용 목적(신약 탐색·식량자원 탐 |  |
| `#compare .cmp-basis-moves` | compare.css | 12.5 | 14 | 보조 | 바뀌는 것 |  |
| `#compare .cmp-i` | compare.css | 12 | 13 | 라벨 | i |  |
| `#compare .cmp-panel-head p` | compare.css | 13 | 14 | 보조 | 네 지표 모두 값이 있습니다. 검 |  |
| `#compare .cmp-read-types thead th` | compare.css | 12 | 13 | 라벨 | 쉬운 이름 |  |
| `#compare .cmp-read-types` | compare.css | 12.5 | 14 | 보조 | 보전 지표 높음 |  |
| `#compare .cmp-read-more` | compare.css | 12.5 | 14 | 보조 | MCUI 숫자 옆 괄호는 그 값을 |  |
| `#compare .cmp-sim-flag` | compare.css | 12.5 | 13 | 라벨 | 가상 작동 예시 |  |
| `#compare .matrix .quadrant span` | compare.css | 12 | 13 | 라벨 | 보전 연구 우선 검토 |  |
| `#compare .matrix-ticks i` | compare.css | 12 | 13 | 라벨 | 0 |  |
| `#compare .matrix-ticks b` | compare.css | 12 | 13 | 라벨 | 0 |  |
| `#compare .cmp-legend` | compare.css | 12.5 | 13 | 라벨 | 선택한 종 |  |
| `#compare .cmp-spread-note` | compare.css | 12.5 | 14 | 보조 | 밀집 구간: 겹침 방지를 위한 세 | 설명 문장이라 보조 |
| `#compare .cmp-limit` | compare.css | 12.5 | 14 | 보조 | 두 축은 따로 봅니다 · 점 위치 | ‘두 축은 따로 봅니다 · …’ 문장이라 보조 |
| `#compare .cp-info span` | compare.css | 12 | 13 | 라벨 | i |  |
| `#compare .cp-links .cmp-link` | compare.css | 14.5 | 15 | 본문 | 출현 기록 지도 |  |
| `#compare .dt-card-sub` | compare.css | 12 | 13 | 라벨 | 활용 연구 검토 |  |
| `#compare .dt-hint` | compare.css | 12 | 14 | 보조 | 머리글을 누르면 정렬 · 값을 누 | 표 사용 안내 문장이라 보조 |
| `#compare #comparison .cmp-sort i` | compare.css | 12 | 13 | 라벨 | ↕ |  |
| `#compare #comparison thead .cmp-sort small` | compare.css | 12 | 13 | 라벨 | 식량 |  |
| `#compare #comparison thead th` | compare.css | 12.5 | 13 | 라벨 | 근거 자세히 |  |
| `#compare #comparison tbody th small` | compare.css | 12 | 13 | 라벨 | Magallana gigas |  |
| `#compare #comparison .dt-meta` | compare.css | 12 | 13 | 라벨 | 패류 |  |
| `#compare #comparison .dt-type b` | compare.css | 12.5 | 13 | 라벨 | 활용 지표 높음 |  |
| `#compare #comparison .dt-type small` | compare.css | 12 | 13 | 라벨 | 활용 연구 검토 |  |
| `#compare #comparison td.cmp-val[data-k]::before` | compare.css | 12 | 13 | 라벨 | "식량\a MFPI" |  |
| `#compare #comparison td.cmp-rx::before` | compare.css | 12 | 13 | 라벨 | "의약 표적 보조 MBPI-Rx" |  |
| `#compare #comparison .cv-num .cv-cat` | compare.css | 12 | 13 | 라벨 | (LC) |  |
| `#compare #comparison .dt-x h4` | compare.css | 12 | 13 | 라벨 | BBVI 계산 |  |
| `#compare #comparison .dt-x-main` | compare.css | 13.5 | 14 | 보조 | 0.50 × MFPI 71.6 + |  |
| `#compare #comparison .dt-x-sub` | compare.css | 12 | 13 | 라벨 | 정식 산출 · MFPI·MBPI  |  |
| `td small` | style.css | 12 | 13 | 라벨 | 비교집단 · 라벨 · 원문 근거 |  |
| `#compare #comparison .cmp-more-grid>div` | compare.css | 12.5 | 13 | 라벨 | WoRMS 확인 |  |
| `#compare .ct-toggle` | compare.css | 13 | 14 | 보조 | 담은 생물 |  |
| `#compare .ct-go-btn` | compare.css | 13.5 | 14 | 보조 | 나란히 비교 |  |
| `#compare .ct-go small` | compare.css | 12.5 | 14 | 보조 | 2종 이상 담으면 비교할 수 있습 |  |
| `#compare .cmp-fold>summary` | compare.css | 14.5 | 15 | 본문 | 배치 현황 |  |
| `#method .mt-eyebrow` | method.css | 12 | 13 | 라벨 | EVIDENCE & METHODS |  |
| `#method .mt-k` | method.css | 12 | 13 | 라벨 | OUR RESEARCH SCOPE |  |
| `#method .mt-scope-dims small` | method.css | 12 | 13 | 라벨 | 식량 · 생리활성 · 보전 |  |
| `#method .mt-origins li b` | method.css | 14.5 | 15 | 본문 | WoRMS · OBIS · MBR |  |
| `#method .mt-origins li span` | method.css | 12.5 | 13 | 라벨 | 학명과 출현 기록 |  |
| `#method .mt-step span` | method.css | 12 | 13 | 라벨 | 01 |  |
| `#method .mt-src .mt-k` | method.css | 12 | 13 | 라벨 | FOOD POTENTIAL |  |
| `#method .mt-ix-k` | method.css | 12 | 13 | 라벨 | 활용가치 통합 |  |
| `#method .mt-ix .mt-ix-w` | method.css | 12 | 13 | 라벨 | 공식 가중치 w = 0.50 |  |
| `#method .mt-axis-y` | method.css | 12 | 13 | 라벨 | 보전 시급성 MCUI ↑ |  |
| `#method .mt-q span` | method.css | 12 | 13 | 라벨 | 보전 연구 우선 검토 |  |
| `#method .mt-axis-x` | method.css | 12 | 13 | 라벨 | 활용가치 BBVI → |  |
| `#method .mt-quad-rule` | method.css | 12 | 13 | 라벨 | 각각 50 이상이면 높음 |  |
| `#method .mt-sec-head.row p` | method.css | 13.5 | 14 | 보조 | 출처 · 산출 방법 · 지표의 해 |  |
| `.step` | style.css | 12 | 13 | 라벨 | 자료 연결 |  |
| `#method .mt-nat-lead` | method.css | 14 | 15 | 본문 | 종 정보·분포·실물 소재는 국가  |  |
| `#method .mt-nat-table` | method.css | 13.5 | 14 | 보조 | 국가 해양생물 시스템과 이 지도: |  |
| `#method .mt-nat-table thead th` | method.css | 12.5 | 13 | 라벨 | 시스템 |  |
| `#method .mt-nat-table tbody th>small` | method.css | 12 | 13 | 라벨 | 해양생명자원통합정보시스템 |  |
| `#method .mt-nat-table td:before` | method.css | 12 | 13 | 라벨 | "무엇을 주나" |  |
| `#method .mt-nat-src` | method.css | 12 | 13 | 라벨 | 출처: MBRIS 통합종정보 |  |
| `#method .flow-wrap figcaption` | method.css | 13 | 14 | 보조 | 상자를 누르면 해당 설명(자료 연 |  |
| `#method .type-table` | method.css | 13.5 | 14 | 보조 | 색 |  |
| `#method .mt-ck-table` | method.css | 13.5 | 14 | 보조 | 지표 검증 기록: 지표 · 무엇을 |  |
| `#method .mt-ck-table thead th` | method.css | 12.5 | 13 | 라벨 | 지표 |  |
| `#method .mt-ck-table :is(th,td) small` | method.css | 12 | 13 | 라벨 | 기록 |  |
| `#method .mt-ck-table td:before` | method.css | 12 | 13 | 라벨 | "무엇을 확인했나" |  |
| `#method .mt-ck-pill` | method.css | 12.5 | 13 | 라벨 | 통과 |  |
| `#method .mt-ck-table .mt-ck-fig` | method.css | 12.5 | 13 | 라벨 | 시범 3.15 기록: 순위상관 0 |  |
| `#method .mt-ck-foot` | method.css | 13 | 14 | 보조 | ‘일관성 확인(독립 아님)’은 점 |  |
| `#method .mt-src-parts` | method.css | 12.5 | 13 | 라벨 | 지표 근거 167건 · 데이터셋  |  |
| `.moved-link` | theme.css | 12 | 13 | 라벨 | 원문 이동됨 |  |
| `#method .mt-made-note` | method.css | 13 | 14 | 보조 | 자료 선택, 지표 규칙, 최종 판 |  |
| `.coord-dialog h3 span` | theme.css | 12 | 13 | 라벨 | 시민 · 연구자 · 기관 |  |
| `.coord-steps li` | theme.css | 13.5 | 14 | 보조 | 시민 |  |
| `.coord-note` | theme.css | 12 | 14 | 보조 | 민감종 좌표는 등급과 별도로 검토 |  |
| `.coord-ok` | theme.css | 14.5 | 15 | 본문 | 닫기 |  |
| `footer` | style.css | 12 | 13 | 라벨 | Blue-bio Value Map | 운영·라이선스 메타 줄이라 라벨 |
| `footer .foot-link` | method.css | 12 | 13 | 라벨 | 출처 목록 참조 |  |
| `.bbc-head strong` | chatbot.css | 14.5 | 15 | 본문 | 사용법 안내 도우미 |  |
| `.bbc-titles small` | chatbot.css | 12 | 13 | 라벨 | 안내 캐릭터 멍이 |  |
| `.bbc-reset` | chatbot.css | 12 | 13 | 라벨 | 멍이 원래 자리로 |  |
| `.bbc-note` | chatbot.css | 12 | 13 | 라벨 | 미리 준비한 답변으로 안내해요 |  |
| `.bbc-form button` | chatbot.css | 13.5 | 14 | 보조 | 보내기 |  |
| `#compare .cp-add-note` | compare.css | 12 | 13 | 라벨 | 다시 누르면 비교에서 빠집니다 |  |
| `#compare .cdr-sec p` | compare.css | 13.5 | 14 | 보조 | 활용 연구 검토 |  |
| `#compare .cp-kind-badge` | compare.css | 12 | 13 | 라벨 | 기능성 펩타이드(ACE·XO) |  |
| `#compare .cp-rx .cp-rx-name small` | compare.css | 12 | 13 | 라벨 | 의약 표적만 |  |
| `#compare .cp-cmnpd>b` | compare.css | 12 | 13 | 라벨 | 후보 화합물 탐색 |  |

따로 정한 것:

- **사양과 다르게 한 곳**(‘작아지지 않는다’가 최우선이라): 매트릭스 점 이름은 지금 14px(선택한 종 16px)이라 13px로 내리지 않고 그대로 뒀다. `.matrix-cluster-btn`(이미 14px), `.quadrant strong`(이미 14px)도 그대로.
- 사양에 이름이 있지만 지금 화면에 그 요소가 없는 선택자(`.cmp-chip`, `.cp-chip`, `.cp-status`, `.cp-tag`, `.cp-evidence`, `.cd-note`, `.cd-table td`, `.ct-empty`, `.compact button`, `.cell-summary span`, `.detail-context` 등)도 사양 크기로 넣어 뒀다(나중에 그려질 때를 위해). 화면에 영향은 없다.
- `.pf-menu button`(공개 집계 기간 메뉴)은 14px 그대로: `.period-filter button`을 13px로 덮으면 같은 우선순위의 이 규칙을 순서로 이겨 14 → 13이 되므로 원래 값을 다시 적었다.
- 흐름도 SVG 글자(`.flow .fs`, `.flow .noadd text`)는 `--fs-min`을 쓰지만 SVG 좌표에 묶여 있어 12px 그대로 둔다(사양: 이번 범위 아님). 검사에서도 `svg.flow`만 뺀다.
- 넘침을 막으려고 바꾼 간격(사양이 허용한 여백만): 매트릭스 사분면 안쪽 여백 좌우 10 → 6px(390px에서 ‘활용 · 보전 병행 검토’가 ‘검/토’로 갈리던 것 → 한 줄, 360px은 전보다 줄 수가 줄거나 같음),
  머리글 칸 사이 8 → 6px·로고와 이름 사이 12 → 10px(390px에서 ‘Blue-bio Value Map’이 말줄임 되던 것 → 다 보임. 360px은 전에도 말줄임이었고 지금도 같은 폭).

## 매트릭스 점 이름

- 휴대폰에서는 평소 숨기고, **선택한 종**(`aria-current`), **키보드 포커스**(`:focus-visible`), **비교 담기에 든 종**(`.in-basket`)의 점만 이름이 보인다.
  보이는 이름(선택한 종 말고)에는 패널색 85% 바탕(`--cs-panel`)을 깐다. 선택한 종의 이름 모양은 그대로다.
- 숨김 방식은 `visibility:hidden`: 점 이름 `<span class="point-label">`은 `aria-hidden="true"`이고 점 버튼에 `aria-label`(종 이름·두 지표·유형)이 있어 화면 낭독기가 읽는 이름은
  그대로다. 상자를 남기므로 `declutterPointLabels()`가 재는 이름 크기가 0이 되지 않고, 숨긴 이름의 크기도 바꾸지 않아 겹침 계산·점 모으기 결과가 전과 같다.
  390px 기본 상태에서 30개 점의 `left`/`bottom`이 main과 같고, 매트릭스 아래 안내 문장(‘이름표가 겹치는 점 2개는 …’)도 한 글자 같다.
- 사이트는 처음에 한 종(참굴)이 늘 선택돼 있어 ‘아무 종도 선택하지 않은’ 상태는 없다. 그래서 검사는 ‘처음에는 선택한 종 이름 하나만’으로 본다.
- 점을 탭하면 전처럼 그 종이 선택되고 프로필이 열린다. 새 툴팁·새 동작은 없다.

## 확인

- `compare.mjs`(이 폴더): 같은 폭의 전/후 목록 비교.
  - 390·360px: 모든 상태의 문구(textContent) 같음, 작아진 글자 0, 18px 미만은 13·14·15·16·17px뿐, 13px 미만 0, 가로 넘침 0 → 통과
  - 1440·768px(`--same`): 요소마다 글자 크기·순서·문구가 전과 같음 → 통과
- 한국어 화면 전체 글자(`node verification/test_i18n.mjs --browser`의 ko.txt): main과 이 브랜치가 한 줄도 다르지 않음.
  (이 검사 자체는 main에서도 실패한다: #262가 ‘지도 크게 보기’ 단추를 더한 뒤 `i18n-ko-baseline.txt`를 다시 만들지 않아 1505행이 다르다. 이번 작업과 무관해 그대로 둠.)
- `verification/uicheck.mjs`에 새 검사:
  - T-1: 390px 첫 화면·탐색 지도·비교와 지표(매트릭스, 데이터 표 접힘 모두 열기)·근거와 방법(접힘 모두 열기)에서 보이는 18px 미만 글자가 13·14·15·16·17px뿐, 13px 미만 0 (`type_scale_probe.mjs`)
  - T-2: 390px 매트릭스에서 처음에는 선택한 종 이름 하나만 보이고, 다른 점을 탭하면 그 점 이름만 보이며 그 점의 left/bottom이 그대로, 담은 종의 점은 이름이 보임
  - 1440px 목록·문구 비교는 이번 PR에서 `compare.mjs`로 한 번 확인했고 CI에는 넣지 않았다(앞으로 PC 화면을 바꾸는 작업이 이 기준 파일 때문에 막히지 않게).
- CI 단위 검사(verify.yml의 node·python 전부, Python 3.12) 통과. uicheck(클라우드, Chromium 153) 275 통과 / 4 실패 — 실패 4개는 클라우드에서 지도 타일(GIBS·GEBCO)이 막혀 늘 나는 위성·수심·옛 ‘기본’ 저장·A-5 공유 링크.
- 고친 검사: `test_client_outdated.mjs`(해시 목록에 새 파일 추가). 지운 검사·건너뛴 검사: 없다. 기존 R-1(12px 하한)은 그대로 둔다(T-1이 더 엄격).
- **확인 못 한 것**: 실제 휴대폰(iOS Safari, Android Chrome). 클라우드에는 기기가 없어 Chromium 휴대폰 흉내(390×844·360×780, 터치, 2배)로만 봤다.
  사이트 CSS에는 `-webkit-text-size-adjust`가 없다(iOS Safari는 가로로 돌릴 때 글자를 키울 수 있음). 이 값을 100%로 막으면 안드로이드의 ‘글자 크기’ 접근성 설정까지
  막힐 수 있어 넣지 않았다. 실제 iPhone 세로·가로에서 한 번 봐 주면 좋다.

## 캡처 (390px, 전 `before/` · 후 `after/`)

`390-entry.png`(첫 화면), `390-explore.png`(탐색 지도 전체), `390-compare.png`(비교와 지표 전체), `390-method.png`(근거와 방법 전체),
`390-matrix-none.png`(매트릭스, 처음 상태), `390-matrix-selected.png`(다른 종 선택 + 한 종 담음). 파일 크기를 줄이려고 256색으로 저장했다.

## 다시 돌리기

```
python -m http.server 8765 --bind 127.0.0.1 --directory dist   # 다른 창
FIXTURE=dist/live-snapshot.json node verification/2026-10-25-mobile-type-scale/fontsizes.mjs out-390.json --width=390 [--shots=dir] [--rules] [--all]
node verification/2026-10-25-mobile-type-scale/compare.mjs before-390-fontsizes.json out-390.json
node verification/2026-10-25-mobile-type-scale/compare.mjs before-1440-fontsizes.json out-1440.json --same
```
`--rules`는 글자마다 크기를 정한 CSS 규칙(선택자·파일·줄)을 함께 적고, `--all`은 안 보이는 글자(접힘·팝업·다른 탭)까지 센다(규칙 찾기용).
