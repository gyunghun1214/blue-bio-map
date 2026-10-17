# 참굴 임시 그림 제거, 다른 29종과 같은 분류군 아이콘으로 통일 — Claude Code 작업 지침 (최종본)

원본 지침(`prompt-original.md`)을 main `350d643`과 대조해 고친 판이다. 원본과 다른 점은 맨 아래 '원본에서 고친 점'에 있다.

## 목표

탐색 지도 오른쪽 패널(`#sp-species`)과 비교 탭 프로필(`#cmp-profile`)에서 참굴(AphiaID 836033)만 실사풍 그림
(`dist/vendor/species/magallana-gigas-temp.webp`, 시안에서 잘라 낸 임시 자산)을 쓴다. 참굴도 다른 29종처럼
분류군 아이콘 타일(`.group-icon[data-group="패류"]`)을 쓰게 한다. **화면 표시만 바꾼다. 값·문구·다른 종 모양은 그대로.**

- 저장소 `gyunghun1214/blue-bio-map`, 최신 `main`에서 세션 지정 브랜치로 작업.

## 할 것

1. `dist/app.js`
   - `const SPECIES_ART={};` 로 비운다. `SPECIES_ART`, `cmpArtOf`, `cmpArt`, `renderSidePanel`의 그림 분기는 남긴다(검토한 원본 그림이 생기면 한 줄로 다시 넣는 자리).
   - 두 주석(`SPECIES_ART` 위, `cmpArtOf` 위)을 "지금은 모든 종이 분류군 아이콘을 쓴다. 검토한 원본 그림이 생기면 여기에 넣는다"로 고친다.
2. 자산: `dist/vendor/species/magallana-gigas-temp.webp` 삭제. `dist/vendor/species/SOURCE.txt`는 남기고 삭제 기록 한 줄을 덧붙인다.
   `git grep magallana-gigas-temp`로 남은 참조가 SOURCE.txt(기록)와 이 작업의 기록 폴더뿐인지 확인한다.
3. CSS는 **바꾸지 않는다.**
   - `theme.css`의 `#explore .sp-art{…}` 규칙(1318행, 1180px 이상 높이·너비별 1412·1429·1451행)은 그림 `<img>`만이 아니라
     아이콘 칸 `<span class="sp-art sp-art-icon">`에도 걸린다(`display:block`, 너비 150/116/104px, 여백). 지우면 다른 29종 패널 머리가 바뀐다.
   - `compare.css`의 `.cp-art-img`는 지금 쓰는 곳이 없지만, 남겨 둔 `SPECIES_ART` 장치가 그림을 다시 넣을 때 필요하므로 둔다.
   - 그래서 CSS `?v=` 해시도 바뀌지 않는다.
4. `index.html`의 `app.js?v=`를 LF로 맞춘 내용의 sha256 앞 10자로 다시 계산한다(README '공개 배포', `test_client_outdated.mjs`).

## 바꾸지 않을 것

분류군 아이콘 디자인(`--gi`, `--g`, `.group-icon` 크기), 참굴의 이름·학명·유형·점수·문구·버튼, `expedition.html`/`expedition.js`의 `ART`,
`scripts/`, `config/`, `dist/*.json`, 다른 탭·첫 화면·멍이.

## 검사

1. 기존 검사 중 이 그림에 묶인 것: `verification/`에서 `SPECIES_ART`, `magallana-gigas-temp`, `sp-art`, `cp-art`, `참굴 그림`을 찾는다
   (main `350d643` 기준 0건 → 고친 검사·지운 검사·건너뛴 검사 없음).
2. 새 정적 검사 `verification/test_species_group_icon.mjs`를 만들고 **`.github/workflows/verify.yml` 목록에 넣는다**(CI는 파일 이름을 하나씩 적어 돌린다).
   - `SPECIES_ART`가 빈 객체이고, 30종 모두 `renderSidePanel`·`cmpArt`가 그림 없이 `.group-icon`을 만든다(app.js를 vm으로 읽어 실제 함수로 확인).
   - `dist/`(SOURCE.txt 제외)에 `magallana-gigas-temp`라는 글자가 없고, 그 파일도 없다.
3. `uicheck.mjs`에도 한 줄: 넓은 화면에서 참굴·홍합을 차례로 골라 `#sp-species`와 비교 탭 `#cmp-profile`에 `img.sp-art`/`img.cp-art-img`가 없고 `.group-icon[data-group="패류"]`가 있으며, 패널 머리 높이가 같다.
4. CI 전체(`verify.yml`의 node 검사, `build_expedition_stops.py --check`, Python unittest)와 로컬 `uicheck.mjs`.
   클라우드에서는 지도 타일이 막혀 생기는 환경 실패 4건(위성·수심·기본 바탕 저장·A-5 공유 링크)은 회귀가 아니다.
5. 직접 확인(캡처): 1440px 오른쪽 패널 참굴·홍합 나란히, 390px 아래 시트 참굴·홍합, 비교 탭 참굴 프로필. 콘솔 오류·404 없음.

## 남길 것

`verification/2026-10-17-oyster-group-icon/`: `README.md`(기준 커밋, 지침 원본·최종본, 바뀐 파일, 지운 자산, 전/후 캡처, 검사 결과),
`prompt-original.md`, `prompt-final.md`, `capture.mjs`, 전/후 캡처. 저장소에는 `prompts/` 폴더가 없으므로 지침은 이 폴더에 둔다.

PR 본문 첫 줄(속성 두 줄 다음): "참굴 임시 그림만 제거하고 다른 29종과 같은 분류군 아이콘으로 통일. 값·문구는 그대로."

## 머지

같은 시각 다른 스레드(MCUI SCALE 카드 삭제, 첫 화면 예시 카드, 지도 Ctrl 확대, 첫 지도 버블)가 `app.js`와 `?v=`를 바꾼다.
머지 직전 main을 다시 받아 병합하고, 충돌이 나면 main 쪽을 받은 뒤 `SPECIES_ART` 변경을 다시 적용하고 `?v=`를 다시 계산한다. CI 녹색 확인 뒤 ready for review → 머지 → 라이브 확인(`?fresh=<random>`).

## 원본에서 고친 점

1. 경로: 자산·코드는 `dist/` 아래(`dist/vendor/species/…`, `dist/app.js`).
2. CSS 정리 단계를 뺐다: `.sp-art`는 아이콘 칸과 같이 쓰는 규칙이라 지우면 다른 29종 모양이 바뀌고, `.cp-art-img`는 남긴 장치의 짝이다.
3. 기존 검사 중 그림에 묶인 것은 없다(검색 0건). 새 검사는 `verify.yml`에 이름을 적어야 CI에서 돈다.
4. 지침 경로 `prompts/…`는 저장소에 없다 → 기록 폴더에 원본·최종본을 둔다.
5. 동시에 `app.js`를 바꾸는 다른 스레드가 있어 머지 직전 재병합·해시 재계산 단계를 넣었다.
