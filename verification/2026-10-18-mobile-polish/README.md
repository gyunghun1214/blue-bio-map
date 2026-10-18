# 휴대폰 화면 정리: 아래 탭바 · 멍이 안내 · 접는 설명 · 숫자 강조 (2026-10-18)

기준 커밋 4c4cc8d. 요청: LKH, 프로젝트 스레드 '모바일 화면 캡처와 개선 제안'(시민 판정단은 QR → 휴대폰). 캡처와 제안 11가지는 프로젝트 파일 `mobile-review-2026-10-18/README.md`; 그중 LKH가 고른 1·2·3·10·11을 한 PR로. 740px 이하에서만 바뀌고(멍이는 767px 이하), 데이터·점수·문구는 그대로.

| # | 바꾼 것 | 파일 |
|---|---|---|
| 1 | 멍이 말풍선('멍이가 사용법을 알려드릴게요')은 첫 화면(지구본)이 닫혀 지도가 보인 뒤 7초, 또는 그 전에 스크롤·멍이 밖 탭이 있으면 바로 접히고 다시 보이지 않는다(`bbChatHintSeen`). 400px 이하에서는 '처음이세요?' 앞말을 뺀다 | `chatbot.js` showHint/hintWhenGateGone, `chatbot.css` |
| 2 | 휴대폰 대화창은 화면 84%(최대 680px) 아래 시트. 전에는 70vh에서 다시 지도 컨트롤을 피해 260px까지 줄어 손가락 두 마디만 남았다(place()의 maxHeight 계산을 휴대폰에서는 건너뜀). 답이 오면 끝이 아니라 답의 첫 줄로 올린다 | `chatbot.js` place/answer, `chatbot.css` |
| 3 | 탭은 아래 고정 탭바(탐색 지도 · 비교와 지표 · 근거와 방법 + 오른쪽 1/4 바다 탐험), 전체 이름 12px과 선 아이콘(마스크 SVG). 머리글은 로고 + 상태 칩 한 줄. 지도 범례는 '범례' 알약으로 접힌 채 시작(`legend-collapsed`, 누르면 전처럼). `--bbc-bar`(탭바 높이 + safe-area)를 body padding, 멍이 버튼·말풍선, 비교 담기 트레이가 읽는다 | `theme.css`, `compare.css`, `app.js` 초기화 |
| 10 | 지도 아래 설명 세 문단(출처 줄·표시 안내·유형 안내)은 `<details class="map-notes">` '지도 읽는 법' 뒤로(휴대폰에서 닫힘, 그 밖에서는 `display:contents`). 종 상세의 '근거 상태' 막대와 'MFPI 가중치별 BBVI' 줄은 `.detail-fold`(휴대폰에서만 닫혀 렌더, `foldOpen()`). 비교의 가중치 슬라이더는 '비교 기준'을 열었을 때만, 밀집 구간 설명은 숨김 | `index.html`, `app.js`, `theme.css`, `compare.css` |
| 11 | 점수 숫자는 크고 밝게(시트 요약 17px 흰색, 카드 14px), 이름은 작게; 유형 칩은 알약; 카드 폭 220 → 228px('생리활성'이 한 줄). 색은 더 쓰지 않음(유형 4색 + 청록 그대로) | `theme.css` |

## 검사

- `node verification/uicheck.mjs`: 휴대폰 첫 화면 검사의 탭 기대값을 바꿈(세 줄임말 → 고정 탭바·전체 이름·아이콘·바다 탐험 칸·body 여백). 클라우드(스냅샷 FIXTURE, 타일 막힘)에서 통과 245 / 실패 4(위성·수심·저장된 기본·A-5 = 막힌 타일, 전과 같음).
- `verification/test_*.mjs` 34개 통과(`test_detail_render.mjs`는 main에서도 같은 1건으로 실패, CI 미포함).
- `audit.mjs`(폭·탭별 가로 넘침·32px 미만 누름 대상·12px 미만 글자): 360·390·430 × 탐색·비교·방법 모두 넘침 0, 12px 미만 0.
- `hint.mjs`: 지구본 화면에서는 말풍선 숨김 → 지도 직후 보임(멍이 버튼 바닥 72px = 탭바 위) → 8초 뒤 숨김·저장 → 새로고침 뒤 안 보임.
- 다시 재기: `python -m http.server 8765 --bind 127.0.0.1 --directory dist` 후 `node verification/2026-10-18-mobile-polish/audit.mjs`(`W`/`H`), `node verification/2026-10-18-mobile-polish/hint.mjs`. 막힌 타일 대신 `TILES=<폴더>`(z/y/x.jpeg)를 주면 지도 배경이 나온다.

## 캡처(390×844, 2배)

- `1-before-390-explore.png` / `2-after-390-explore.png`: 탐색 지도 첫 화면 전/후
- `3-before-390-guide.png` / `4-after-390-guide.png`: 멍이 안내 창 전/후
- `5-after-390-compare.png`, `6-after-390-detail.png`: 비교와 지표, 종 상세(접힌 칸)
