# 참굴 임시 그림 제거, 분류군 아이콘으로 통일 (2026-10-17)

참굴 임시 그림만 제거하고 다른 29종과 같은 분류군 아이콘으로 통일했다. 값·문구는 그대로다.

- 기준 커밋: main `350d643` (PR #226 머지). 작업 중 main에 PR #230(`945e891`, 첫 지도 버블)과 PR #227(`07f5bbd`, 첫 화면 예시 카드 제거)이 들어와 차례로 병합했고, `index.html` `?v=` 충돌은 main 쪽을 받은 뒤 `app.js?v=`를 다시 계산했다.
- 지침: 원본 [`prompt-original.md`](prompt-original.md), 저장소와 대조해 고친 최종본 [`prompt-final.md`](prompt-final.md)
  (같은 최종본을 프로젝트 공유 폴더 `oyster-group-icon/prompt-final.md`에도 둠. 저장소에는 원본이 가리킨 `prompts/` 폴더가 없다).
  가장 큰 차이: 원본은 쓰는 곳이 없어진 CSS를 지우라고 했지만, `theme.css`의 `#explore .sp-art` 규칙은 다른 29종의 아이콘 칸
  `<span class="sp-art sp-art-icon">`에도 걸려(블록 표시, 1180px 이상 너비별 150/116/104px) 지우면 다른 종 모양이 바뀐다.
  `compare.css`의 `.cp-art-img`는 남겨 둔 `SPECIES_ART` 장치의 짝이라 둔다. 그래서 CSS는 바꾸지 않았고 CSS `?v=`도 그대로다.

## 바뀐 것

| 파일 | 변경 |
|---|---|
| `dist/app.js` | `SPECIES_ART={}`(장치·분기는 그대로), 주석 두 곳: "지금은 모든 종이 분류군 아이콘. 검토한 원본 그림이 생기면 여기에" |
| `dist/index.html` | `app.js?v=` 다시 계산 |
| `dist/vendor/species/magallana-gigas-temp.webp` | **삭제** (206×152 임시 자산) |
| `dist/vendor/species/SOURCE.txt` | 2026-10-17 삭제 기록 한 줄 추가 |
| `verification/test_species_group_icon.mjs` | 새 검사, `.github/workflows/verify.yml`에 추가 |
| `verification/uicheck.mjs` | 넓은 화면 오른쪽 패널: 참굴·홍합 모두 그림 없이 패류 아이콘, 아이콘 크기·자리 같음 |

다른 곳에서 `magallana-gigas-temp`를 적은 곳(`_headers`, 사전 캐시, `preload`, 오프라인 목록)은 없었다.
`expedition.html`/`expedition.js`의 참굴 일러스트, 분류군 아이콘 디자인, 점수·문구는 건드리지 않았다.

## 전/후 측정 (`capture.mjs`, `before-measured.json` · `after-measured.json`)

| 위치 | 참굴 전 | 참굴 후 | 홍합(그대로) |
|---|---|---|---|
| 탐색 지도 오른쪽 패널 1440px | 그림 206×152, 머리 높이 107 | 패류 아이콘 72×72, 80 | 패류 아이콘 72×72, 121(이름 두 줄) |
| 탐색 지도 오른쪽 패널 1280px | 그림, 75 | 패류 아이콘 72×72, 71 | 패류 아이콘 72×72, 71 |
| 탐색 지도 오른쪽 패널 1560px | — | 아이콘 자리 `202,-4,72,72` | `202,-4,72,72` |
| 비교 탭 프로필 1440px | 그림 206×152 | 패류 타일 84×84, 96 | 패류 타일 84×84, 96 |
| 비교 탭 프로필 390px | 그림 116×86 | 패류 타일 84×84, 96 | 패류 타일 84×84, 96 |

머리 높이가 다른 곳(1440px 80 대 121)은 이름 '홍합(참담치)'이 두 줄로 접히기 때문이고, 아이콘 크기와 자리는 같다.
30종 모두 오른쪽 패널에 `<img>`가 없고 `.group-icon`이 있다. 콘솔 오류 0, 404 요청 0.

캡처: `before-1440-panel-oyster.png` → `after-1440-panel-oyster.png`, `after-1440-panel-mussel.png`(비교용),
`before-1440-compare-oyster.png` → `after-1440-compare-oyster.png`, `before-390-compare-oyster.png` → `after-390-compare-oyster.png`.
390px 탐색 지도는 오른쪽 패널을 쓰지 않아(1180px 미만) 그림이 원래 나오지 않았다.

## 검사

- 그림에 묶인 기존 검사: `verification/`에서 `SPECIES_ART`·`magallana-gigas-temp`·`sp-art`·`cp-art`·`참굴 그림` 검색 0건.
  **고친 검사·지운 검사·건너뛴 검사는 없다.**
- 새 검사 `test_species_group_icon.mjs`: `SPECIES_ART` 빈 객체, 30종 모두 `renderSidePanel`·`renderCompareProfile` 결과에 `<img>` 없이 분류군 아이콘,
  `dist/`에 임시 자산 파일과 참조 없음(SOURCE.txt 기록 제외). 바꾸기 전 `app.js`로 돌리면 실패하는 것을 확인했다.
- `verify.yml` 단위 검사 전부(node 검사, `build_posthoc_scorecard.py --csv --check`, `build_aquaculture_tier.py --check`,
  `build_expedition_stops.py --check`, Python unittest): 통과.
- `uicheck.mjs`(클라우드, `FIXTURE=dist/live-snapshot.json`): 229 통과, 4 실패. 실패 4건은 지도 타일이 막힌 클라우드 환경에서 늘 나는 것
  (위성 GIBS, 수심 GEBCO, 기본 바탕 저장, A-5 공유 링크)이고 이번 변경과 무관하다. CI에서는 전부 돈다.
