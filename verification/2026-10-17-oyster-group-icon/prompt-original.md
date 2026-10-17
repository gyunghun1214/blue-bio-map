# 참굴 실사 그림 제거, 다른 종과 같은 분류군 아이콘으로 통일 — Claude Code 작업 지침

## 배경

탐색 지도 오른쪽 패널(`#sp-species`)과 비교 탭 종 프로필(`#cmp-profile`)에서 **참굴(AphiaID 836033)만 실사풍 그림**이 나온다. 나머지 29종은 분류군 아이콘 타일(`.group-icon[data-group]`, `theme.css`의 선 아이콘 + 분류군 색 바탕)을 쓴다. 그래서 참굴만 다른 사이트처럼 보인다.

이 그림은 `vendor/species/SOURCE.txt`에 적힌 대로 **디자인 시안 화면에서 잘라 낸 임시 자산**(`vendor/species/magallana-gigas-temp.webp`, 206×152)이다. 이 작업은 참굴도 다른 종처럼 분류군 아이콘(패류)으로 되돌리는 것이다. **화면 표시만 바꾼다.**

- 저장소: `gyunghun1214/blue-bio-map`, 최신 `main`에서 시작
- 작업 브랜치: 세션에 지정된 브랜치. 없으면 `ui/oyster-group-icon`

## 지금 구조 (배포본 `app.js`에서 확인함)

- `const SPECIES_ART={836033:{src:'vendor/species/magallana-gigas-temp.webp',w:206,h:152,alt:'참굴 그림 · 임시 자산'}};`
- `renderSidePanel(s)`: `art=SPECIES_ART[s.aphiaID]`가 있으면 `<img class="sp-art">`를 넣고, 없으면 `<span class="sp-art sp-art-icon">${groupBadge(s)}</span>`를 넣는다.
- 비교 탭: `cmpArtOf=id=>SPECIES_ART[id]||null`, `cmpArt(s)`가 있으면 `<img class="cp-art-img">`, 없으면 `<span class="cp-tile">${cmpIcon(s)}</span>`
- `expedition.html`의 `ART[836033]`(코드로 그린 SVG 일러스트)은 **이 작업과 별개**다. 건드리지 않는다.

## 할 것

1. **`app.js`**
   - `SPECIES_ART`에서 `836033` 항목을 지워 `const SPECIES_ART={};`로 만든다. 장치(`SPECIES_ART`, `cmpArtOf`, `cmpArt`, `renderSidePanel`의 분기)는 남긴다. 나중에 **원본 그림을 받았을 때** 다시 한 줄로 넣을 수 있게 하기 위해서다.
   - 위의 주석 두 곳("참굴's is a temporary cut-out…", "species artwork: the explore map's SPECIES_ART (참굴…)")을 "지금은 모든 종이 분류군 아이콘을 쓴다. 검토한 원본 그림이 생기면 여기에 넣는다"는 뜻으로 고친다.
2. **자산 정리**
   - `vendor/species/magallana-gigas-temp.webp`를 지운다.
   - `vendor/species/SOURCE.txt`는 지우지 말고 "2026-10-17: 임시 자산 삭제. 모든 종이 분류군 아이콘을 씀"을 한 줄 덧붙인다. 폴더가 비면 `SOURCE.txt`만 남긴다.
   - `dist/_headers`, 서비스 워커·사전 캐시 목록, `index.html`의 `preload`처럼 이 파일 이름을 적은 곳이 있으면 함께 지운다(`grep -r magallana-gigas-temp`).
3. **CSS**: `.sp-art` 중 `<img>` 전용 규칙과 `.cp-art-img` 규칙은 남겨도 되지만, 쓰는 곳이 없어지면 지운다. **`.sp-art-icon`, `.cp-tile`, `.group-icon` 규칙은 그대로 둔다.**
4. **크기 확인**: 참굴 패널이 이제 다른 종(예: 홍합 `#s=506159`)과 **똑같이** 보여야 한다. 그림이 있던 자리 크기 때문에 참굴 패널만 위쪽 여백이 남거나 제목 줄이 다르게 접히면 고친다. 다른 종 쪽 모양은 바꾸지 않는다.

## 절대 바꾸지 않을 것

- 분류군 아이콘 디자인(`theme.css`의 `--gi` SVG, `--g` 색, `.group-icon` 크기)
- 참굴의 이름, 학명, 유형, BBVI·MCUI 값과 문구, 버튼
- `expedition.html` / `expedition.js`의 `ART` 일러스트
- `scripts/`, `config/`, `dist/*.json`
- 다른 탭과 첫 화면, 멍이

## 검사

1. 먼저 이 그림에 묶인 검사를 찾는다. `verification/` 아래에서 `SPECIES_ART`, `magallana-gigas-temp`, `sp-art`, `cp-art-img`, `참굴 그림`으로 검색한다.
   - 찾으면 **기대값을 고친다.** 참굴도 `.group-icon[data-group="패류"]`가 나오는지 보도록 바꾼다. 검사를 지우거나 건너뛰지 않는다.
2. 새 검사 하나를 더한다.
   - 30종 모두 오른쪽 패널과 비교 탭 프로필에 `<img class="sp-art">`/`<img class="cp-art-img">`가 없고 `.group-icon`이 있다.
   - 배포 폴더에 `magallana-gigas-temp.webp`를 가리키는 참조가 없다.
3. CI 전체(`verify.yml`의 `node verification/test_*.mjs`, `python scripts/build_expedition_stops.py --check`, `python -m unittest discover -s verification -p 'test_*.py'`)와 로컬 `verification/uicheck.mjs`를 돌린다.
4. 직접 확인한다.
   - 1280px 이상(`min-width:1180px` 오른쪽 패널)과 390px(아래 시트)에서 참굴과 홍합의 패널 머리 모양이 같다.
   - 비교 탭에서 참굴을 고르면 프로필 머리가 다른 종과 같은 타일이다.
   - 콘솔 오류와 404 요청이 없다.
5. `app.js`를 고쳤으므로 `index.html`의 `?v=` 해시를 다시 계산한다(README 53행 규칙, LF로 맞춘 파일 내용 sha256 앞 10자, `test_client_outdated.mjs`). CSS를 고쳤다면 그 파일 해시도 다시 계산한다.

## 남길 것

- `verification/2026-10-17-oyster-group-icon/README.md`(다른 날짜 폴더 형식)
  - 기준 커밋, 이 프롬프트 경로(`prompts/oyster-art-to-group-icon-claude-code.md`)
  - 바뀐 파일, 지운 자산
  - 전/후 캡처: 탐색 지도 오른쪽 패널(참굴 · 홍합 나란히), 비교 탭 참굴 프로필
  - 고친 검사 / 지운 검사 / 건너뛴 검사(없으면 '없다')
- PR 본문 첫 줄: "참굴 임시 그림만 제거하고 다른 29종과 같은 분류군 아이콘으로 통일. 값·문구는 그대로."

## 완료 기준

- [ ] 탐색 지도 패널과 비교 탭에서 30종이 모두 같은 분류군 아이콘 체계로 보인다
- [ ] `magallana-gigas-temp.webp` 파일과 그 참조가 없다(SOURCE.txt에 삭제 기록)
- [ ] `SPECIES_ART` 장치는 빈 상태로 남아 있다
- [ ] `expedition.html`의 참굴 일러스트는 그대로다
- [ ] CI 전체 통과, uicheck 통과, 콘솔 오류·404 없음
