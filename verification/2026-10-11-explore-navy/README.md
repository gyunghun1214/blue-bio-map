# 탐색 지도 남색 개편 검증 (2026-10-11)

기준: `main` f678342 (PR #169 병합). 작업 지침: 프로젝트 파일 `prompts/explore-navy-map-claude-code-v2.md`.
보여 주는 방식만 바꿨다. `scripts/`, `config/`, `dist/*.json`, 공개 셀·버블 묶음·도트 밀도 규칙, 4유형 기준은 그대로다.

## 변경 전후 값 비교 (`measure.mjs`)

```
node verification/2026-10-11-explore-navy/measure.mjs <out.json> [screenshot.png]
```
로컬 서버(`python -m http.server 8765 --bind 127.0.0.1 --directory dist`)와 uicheck와 같은 `CHROME_PATH`·`FIXTURE` 환경변수를 쓴다.

- `baseline.json`: 변경 전 `main`, `after.json`: 변경 후.
- `data`가 두 파일에서 한 글자도 다르지 않다: 30종 수, 참굴·미역·해삼·피조개의 기록·셀 수, 확대 5–8단계마다 버블([셀 수, 기록 수])·버블 숫자·도트 수·BBVI 태그·셀 테두리 수, 지표 값과 상태, 미역의 기간별 결과, 목록 필터(분류군·근거·활용 특성 칩 1개·2개 AND) 결과, '활용 × 보전' 유형별 셀 수.
- `layout`만 다르다: 조사량 처음 상태(켜짐 174칸 → 꺼짐 0칸, 의도된 변경 1)와 종별 자동 맞춤의 중심(떠 있는 패널을 비켜 맞춤, 확대 단계 6은 같음).

## 캡처

위성·수심 바탕에 대한 주의: 이 캡처를 만든 클라우드 환경은 NASA GIBS와 GEBCO 주소가 막혀 있어서, 같은 타일 요청에 그 세션에서 만든 **대체 타일**을 돌려줬다(공개 Blue Marble 지구 텍스처를 잘라 실제 GIBS 바다색에 맞춘 것, 수심은 그 텍스처의 해저 음영). 타일 색 조정(`.leaflet-tile-pane` 필터)은 실제와 같게 걸려 있지만 바탕 사진은 실제 타일이 아니다. 실제 색은 미리보기 빌드에서 확인한다. 대체 타일과 원본 텍스처는 저장소에 넣지 않았다.

| 파일 | 내용 |
|---|---|
| `1560-1-bubbles-satellite.png` | 운영 URL 해시(참굴, 확대 6) 버블 화면. 같은 조건의 변경 전 화면은 `before-1560-bubbles-satellite.png` |
| `1560-2-dots-after-bubble-click.png` | 가장 큰 버블(셀 4개)을 누른 뒤 확대 8단계, 도트 452개. 셀 묶음이 패널 사이 빈 지도 가운데에 온다 |
| `1560-3-detail-sea-cucumber-4deg.png` | 해삼 4° 셀과 상세 카드(사진 대신 분류군 아이콘). 참굴 상세는 1번 캡처 오른쪽 |
| `1560-4-value-yellow-outline.png` | '활용 × 보전' 모드, 선택 종 셀의 노란 실선 테두리와 4유형 색 |
| `1560-5-depth.png` | 수심 배경 |
| `1560-tile-failure-basic.png` | 타일 실패 시 경계선 지도와 ⚠ 표시(변경 전은 `before-1560-tile-failure-basic.png`) |
| `1280.png`, `768.png` | 1201–1280px 3열과 태블릿 2열 구조는 그대로, 색만 남색 |
| `390-6-phone-first-screen.png`, `390-6-phone-sheet-open.png` | 휴대폰 첫 화면과 시트 펼침(PR #165 시트 구조, 2배 해상도) |

모든 캡처에는 처음 방문 때 뜨는 멍이 안내 말풍선이 그대로 보인다.

## 검사 결과 (클라우드, 2026-10-11)

- `.github/workflows/verify.yml`의 node 검사 전부와 `test_detail_render.mjs` 통과, Python 352개 통과(데이터가 없어 건너뛰는 사후 검증 스모크 1개 제외).
- `uicheck.mjs`: 변경 전 162 PASS / 4 FAIL → 변경 후 163 PASS / 4 FAIL. 늘어난 하나는 새 검사 'B-1 조사량 처음 꺼짐'. 실패 4개는 변경 전과 같은 것으로, 이 환경에서 GIBS·GEBCO가 막혀서 생긴다(위성 타일, 수심 타일, 공유 링크의 수심 복원, 예전 '기본' 저장값).
- 움직임 줄이기(`--force-prefers-reduced-motion`, CI의 Windows Chrome과 같은 조건)로 돌려도 163 PASS / 4 FAIL, 실패 목록 동일.
- 1560·1366·1281·1280·768·390·360px에서 가로 스크롤 없음. '비교와 지표'·'근거와 방법' 탭과 입장 화면은 픽셀 비교에서 상단 바의 선택 탭 색 말고는 바뀐 곳이 없다(멍이 깜빡임 같은 움직임 제외).
