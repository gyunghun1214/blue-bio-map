# 탐색 지도 점·버블 색을 이전 빨간색으로 되돌리기 — 최종 지침 (저장소 대조 후 고친 판)

원본: [`prompt-original.md`](prompt-original.md). 2026-10-17 `main` `6e362fa`와 git 전체 이력(`git fetch --unshallow`)에 대조해 고쳤다.

## 원본과 다른 점

1. **청회색이 들어온 커밋이 다르다.** 남색 지도 작업(PR #170, 2026-10-11)은 점을 더 밝은 빨강 `#ff6464`로 바꿨을 뿐이다.
   청회색 `#A9C6D4`는 탐색 지도 3열 시안 PR #218(커밋 `bcbe7ab`, 머지 `55d5d87`, 2026-10-15)에서 들어왔다.
   `git log -S '청회색'`도 이 커밋만 가리킨다. 그래서 값의 출처는 **`bcbe7ab^`**(= `bcbe7ab` 바로 앞)이다.
2. **CSS는 값을 다시 적지 않고 덧씌운 줄을 지운다.** #218은 `dist/theme.css` 끝쪽에 `/* occurrence marks: neutral blue-grey, no glow */`
   아래 다섯 줄을 덧붙여 청회색을 입혔고, 그 위의 빨간 규칙(`.bubble-symbol`, `.occ-bubble`, `.bubble-count`, `.map-symbol`)은 파일에 그대로 남아 있다.
   그 여섯 줄(주석 포함)을 지우면 `bcbe7ab^`의 범례 견본·버블 그림자·버블 숫자색이 그대로 돌아온다.
3. **`dist/app.js`는 `bcbe7ab`가 바꾼 색 값만 되돌린다.** `DOT_FILL '#A9C6D4'` → `DOT_RED '#ff6464'`,
   점 `opacity .85 → .9`, `fillOpacity .9 → .88`, 버블 테두리 `#C9DCE5 → #ff8d84`, 셀 틀 옅은 채움 `fillOpacity .08 → .1`.
   버블 테두리 두께(#218에서 2.2 → 2)는 색이 아니라 그대로 둔다. 진하기 단계 `BUBBLE_FILL`은 #218에서 바뀌지 않았다(단계 수 같음).
4. **'출현 기록' 보기의 4° 셀 점선 테두리도 빨간색으로 돌아온다.** 이 테두리는 셀 틀의 채움색(= 점 색)을 쓰므로 #218 전에는 `#ff6464`였다.
   원본의 '4° 셀 테두리는 바꾸지 않는다'는 '활용 × 보전' 보기의 유형 색 테두리를 뜻하므로 그쪽은 그대로다.
   `verification/test_map_boundary.mjs`의 4° 테두리 기대값도 #218 전 값 `#ff6464`로 되돌린다.
5. **사용법 안내 도우미(`dist/chatbot.js`)의 두 답도 '청회색'을 말한다.** 화면 문구이므로 `bcbe7ab^`의 문장으로 되돌린다
   (개요 답 1줄, `red-dots` 질문·낱말·답 3줄). 멍이 그림·움직임은 건드리지 않는다.
6. **`prompts/` 폴더는 저장소에 없다.** 원본·최종 지침은 이 폴더(`verification/2026-10-17-explore-dots-red/`)에 두고,
   같은 최종본을 프로젝트 공유 폴더 `prompts/explore-dots-red-revert-claude-code-v2.md`에도 둔다. 폴더 날짜는 작업한 날(2026-10-17)이다.
7. **클라우드에서는 위성·수심 타일이 막혀 있다**(GIBS·GEBCO). 캡처는 타일 없는 어두운 바탕에서 찍히고, uicheck의 타일 관련 4건은 환경 실패다.
   대비는 위성·수심 바탕의 대표 색 위에 버블을 겹친 값으로 계산해 README에 적는다.

## 할 일

- 브랜치: 세션 지정 브랜치 `ui/explore-dots-red-ekvwrl`, 최신 `main`에서 시작
- `dist/app.js`: 위 3번 값. 화면 문구 '청회색' 5곳(셀 팝업 2, 버블 툴팁 1, 범례 설명 1, 검토 문구 2)을 `bcbe7ab^`의 '붉은'으로
- `dist/index.html`: 범례 3곳·'근거와 방법 > 자료를 읽을 때' 3곳의 '청회색'을 '붉은'으로(`bcbe7ab^` 문장과 같은지 대조). `?v=` 재계산(app.js·theme.css·chatbot.js)
- `dist/theme.css`: 위 2번 여섯 줄 삭제
- `dist/chatbot.js`: 위 5번
- 검사 기대값: `verification/test_map_boundary.mjs`(점 색·팝업 문구·4° 테두리), `verification/uicheck.mjs`(지도 설명·셀 팝업 문구) — 모두 `bcbe7ab^`의 기대값으로
- 바꾸지 않을 것: 원본 목록 그대로(점 위치·크기, 버블 묶음·크기·숫자·구간, 유형 색, 선택·hover 테두리, 조사량 음영, 배경 지도, 패널 디자인, 다른 탭, 첫 화면, `expedition.html`, `og.png`, `scripts/`, `config/`, `dist/*.json`). 왼쪽 위 칩의 유형 색 점도 그대로.

## 검사

- CI(`verify.yml`)의 node·python 검사 전부, Python 3.12
- `verification/uicheck.mjs`(FIXTURE=dist/live-snapshot.json, `--no-sandbox` 크롬 래퍼). 타일 4건은 환경 실패로 적는다
- 이 폴더 `capture.mjs`: 390·768·1100·1440px 가로 넘침, 축소(버블)·확대(점) 색, 범례 견본 색, 칩 점 = 유형 색, 기간 필터·링크로 다시 연 화면·움직임 줄이기에서 같은 색, 선택 셀 노란 테두리, '청회색' 낱말이 화면에 없음
- 머지 후 라이브(`?fresh=<임의값>`)에서 '붉은 점' 문구 확인

## 남길 것

README(기준 커밋, 지침 경로, 값 출처 표, 대비, 문구 전/후, 고친·지운·건너뛴 검사), 캡처(전/후 1440, 후 390, 확대·축소 각 1장).
PR 본문 첫 줄: "탐색 지도 점·버블 색만 남색 지도 작업 이전 빨간색으로 되돌림. 위치·크기·셀 색·데이터는 그대로."
→ 1번 때문에 "탐색 지도 점·버블 색만 탐색 지도 시안(PR #218) 이전 빨간색으로 되돌림. 위치·크기·셀 색·데이터는 그대로."로 고쳐 쓴다.
