# 탐색 지도 PC 확대: Ctrl(⌘) + 스크롤 · 터치패드 핀치 (2026-10-17)

지도 위에서만 Ctrl(⌘) + 스크롤 · 터치패드 핀치로 지도가 한 단계씩 확대·축소된다. 그냥 스크롤과 지도 밖 동작은 그대로다.

- 기준 커밋: main `350d643` (PR #226 머지). 작업 중 main에 PR #230(`945e891`, 첫 지도 버블 통일)과 PR #227(`07f5bbd`, 첫 화면 예시 카드 제거), PR #229(`648f17a`, 참굴 아이콘 통일), PR #233(`9578401`, MCUI SCALE 카드 삭제), PR #231(`647f322`, 첫 화면 파문 로딩)이 들어와 차례로 병합했고, `index.html` `?v=` 충돌은 main 쪽을 받은 뒤 `app.js`·`theme.css` `?v=`를 다시 계산했다. 병합 뒤 검사를 다시 돌린 결과가 [`results.md`](results.md)다.
- 지침: 원본 [`prompt-original.md`](prompt-original.md), 저장소와 대조해 고친 최종본 [`prompt-final.md`](prompt-final.md)
  (같은 최종본을 프로젝트 공유 폴더 `map-ctrl-wheel-zoom/prompt-final.md`에도 둠. 저장소에는 `prompts/` 폴더가 없다).
  가장 큰 차이 두 가지:
  1. 리스너를 `#map`이 아니라 `.map-stage`에 단다. 지도 위에 뜬 범례·버튼은 `#map`의 형제 요소라, `#map`에만 달면 그 위 Ctrl + 휠이 페이지 확대가 된다.
  2. iPhone·iPad Safari는 두 손가락 터치에도 `gesture*` 이벤트를 보낸다. 손가락이 닿아 있는 동안에는 `gesture*`를 처리하지 않고 Leaflet `touchZoom`에 맡겨, 휴대폰에서 두 번 확대되지 않게 했다.

## 바뀐 것

| 파일 | 내용 |
|---|---|
| `dist/app.js` | `initMap()`이 `initWheelZoom()`을 부른다. `scrollWheelZoom:false`, `minZoom 3`·`maxZoom 8`, `maxBounds`, 정수 줌은 그대로 |
| `dist/theme.css` | 안내 상자 `.map-wheel-hint` (`--x-panel`·`--x-text`·`--x-border2`, 15px, '움직임 줄이기'에서 전환 효과 없음) |
| `dist/index.html` | `#map` `aria-label` 뒤에 확대 방법을 덧붙임, '그 밖의 기능 · 배경 지도 출처' 목록 첫 줄 '확대', `app.js`·`theme.css` `?v=` |
| `verification/uicheck.mjs` | 새 검사 15개 (아래) |

동작:

- **Ctrl 또는 ⌘ + 휠** (Chrome·Edge·Firefox의 터치패드 핀치도 `ctrlKey` 휠로 온다): `.map-stage` 안에서만 `preventDefault()` 하고, `deltaY`를 모아 한 단계씩 움직인다. 중심은 커서 위치(`map.setZoomAround(map.mouseEventToContainerPoint(e), …)`). 지도 밖(오른쪽 패널, 근거 서랍, 지도 아래 영역)에서는 건드리지 않아 브라우저 페이지 확대가 그대로 된다.
- **Safari 핀치** (`gesturestart`/`gesturechange`/`gestureend`): 직전 단계 대비 `scale` 1.25배 이상 또는 0.8배 이하일 때 한 단계, 그 값을 새 기준으로. 제스처 중에 오는 `ctrlKey` 휠은 무시한다(둘 다 와도 한 번만). 손가락이 닿아 있으면(`touchstart`~`touchend`) 처리하지 않는다.
- **그냥 휠**: 페이지 스크롤 그대로(`preventDefault()` 없음). `#map` 위에서 굴리면 지도 가운데에 1.5초 안내가 뜬다. 계속 굴리는 동안에는 한 번으로 치고, 한 번 페이지를 연 동안 3번까지만 띄운다(저장하지 않음). 마우스·터치패드 기기(`(hover:hover) and (pointer:fine)`)에서만, `aria-hidden="true"`, `pointer-events:none`.
  - Windows·기타: `Ctrl + 스크롤로 지도를 확대합니다`
  - macOS: `⌘ + 스크롤 또는 두 손가락을 벌려 지도를 확대합니다` (macOS의 평소 스크롤이 두 손가락 쓸기라 '벌려'를 넣음)
- 확대 뒤에는 Leaflet `moveend`/`zoomend`가 해시 `m=`과 버블·점을 그대로 갱신한다. 새 코드는 이 흐름을 따로 부르지 않는다.
- 키보드 `+`/`−`(Leaflet `keyboard`, 기본값 켜짐)와 휴대폰 두 손가락 확대(`touchZoom`), `+`/`−` 버튼은 바꾸지 않았다.

## 문턱값과 간격

| 값 | 최종 | 지침 시작값 |
|---|---|---|
| 픽셀 휠(`deltaMode 0`) 한 단계 | 60px 누적 | 60px |
| 줄 휠(`deltaMode 1`, Firefox) 한 단계 | 1줄 | 1줄 |
| 쪽 휠(`deltaMode 2`) | 이벤트 하나 = 한 단계 | (지침에 없음) |
| 단계 사이 간격 | 150ms (그동안 온 Ctrl 휠도 막기만 함) | 150ms |
| 누적값 초기화 | 단계 뒤, 방향이 바뀔 때, 250ms 쉬었을 때 | (최종본에서 정함) |
| Safari 핀치 한 단계 | ×1.25 / ×0.8 | ×1.25 / ×0.8 |

실제 기기에서 확인하지 못해 시작값을 그대로 두었다. 상수는 `app.js`의 `WHEEL_STEP_PX` 등 한 줄에 모여 있다.

## 기기·브라우저별 확인

이 작업은 클라우드 세션에서 했고 실제 기기가 없다. 아래 '확인한 방법'은 Headless Chromium에서 이벤트를 흉내 낸 결과이며, 실제 기기 확인은 사용자 확인으로 남긴다.

| 환경 | 확인한 방법 | 결과 | 실제 기기 |
|---|---|---|---|
| Windows Chrome·Edge 마우스 휠 + Ctrl | DevTools 입력(`Input.dispatchMouseEvent` `mouseWheel`, `modifiers:2`, `deltaY -100`)과 합성 `WheelEvent` | 한 단계 확대, 페이지 배율(`visualViewport.scale`·`devicePixelRatio`) 그대로 | 사용자 확인 필요 |
| Windows 노트북 터치패드 핀치 | `ctrlKey` 휠 `deltaY 8` × 10 | 한 단계만 움직임 | 사용자 확인 필요 |
| Firefox 휠 + Ctrl | `deltaMode 1`, `deltaY -1` | 한 단계 | 사용자 확인 필요 |
| macOS Chrome 핀치, ⌘ + 휠 | `ctrlKey` 작은 값 연속, `metaKey` 휠 | 한 단계 | 사용자 확인 필요 |
| macOS Safari 핀치 | 합성 `gesturestart`/`gesturechange(scale 1.3)`/`gestureend` | 한 단계, 제스처 중 Ctrl 휠은 더하지 않음 | 사용자 확인 필요 |
| 휴대폰 (iPhone·iPad Safari) | 손가락 2개 `touchstart` 뒤 `gesturechange(scale 1.5)` | 새 코드는 줌을 바꾸지 않고 막지도 않음(Leaflet `touchZoom` 몫), 터치 기기에서는 안내 없음 | 사용자 확인 필요 |
| 그냥 휠 | 합성 휠·DevTools 입력 | 막지 않음, 줌 그대로, 안내 1번 | 사용자 확인 필요 |
| 지도 밖 Ctrl(⌘) + 휠 | `#side-panel`·종 목록에 합성 휠 | 막지 않음(브라우저 확대), 지도 줌 그대로 | 사용자 확인 필요 |

터치 기기 안내 검사는 DevTools가 `hover`/`pointer` 미디어를 흉내 내지 못하고 터치 흉내를 끈 뒤에도 값이 돌아오지 않아(Chromium 1194에서 확인), 검사 안에서만 `matchMedia`의 그 질의에 답을 대신 준다.

## 안내 캡처

지도 위에서 그냥 휠을 한 번 굴리고 0.4초 뒤(나타나는 효과 0.2초가 끝난 뒤). [`capture.mjs`](capture.mjs)로 다시 찍을 수 있다(`node capture.mjs <출력 폴더>`, 바깥 타일은 막고 찍음).

- [`hint-1560.png`](hint-1560.png): 1560×900 3열 배치, Windows 문구
- [`hint-1560-mac.png`](hint-1560-mac.png): 같은 화면, macOS 문구(`userAgentData.platform` = macOS로 흉내)
- [`hint-1024.png`](hint-1024.png): 1024×768 좁은 배치. 페이지가 60px 스크롤되면서 안내가 뜬다(그냥 휠이 지도에 걸리지 않음)

## 검사

새 검사 (`verification/uicheck.mjs`, 'Map wheel' / 'Map pinch' / 'Map zoom is described'):

1. 그냥 휠: 막지 않음, 줌 그대로
2. 그냥 휠 안내: 연속 휠은 1번으로, 문구, `aria-hidden`, `pointer-events:none`
3. 안내가 1.5초 뒤 사라지고 3번 뒤에는 뜨지 않음
4. Ctrl 휠: 막음, 한 단계 확대, 해시 `m=` 갱신
5. 확대 중심이 커서 위치
6. 작은 값 10번 = 한 단계
7. Firefox 줄 단위, ⌘(metaKey)
8. 줌 3–8 범위 유지
9. 지도 위 범례에서 Ctrl 휠도 지도 확대
10. 지도 밖 Ctrl(⌘) 휠은 브라우저 몫
11. Safari 제스처 한 단계, 제스처 중 Ctrl 휠 무시
12. 손가락 터치 중 제스처는 Leaflet 몫
13. DevTools 실제 입력 경로: Ctrl 휠 확대, 그냥 휠 그대로, 페이지 배율 그대로
14. 터치 기기에서는 안내 없음
15. `aria-label`·'그 밖의 기능' 설명, Leaflet `keyboard`·`touchZoom` 켜짐, `scrollWheelZoom` 꺼짐

고친 검사: 없다. 지운 검사: 없다. 건너뛴 검사: 없다. (기존 검사에 휠·Ctrl 기대값이 없었다. `uicheck.mjs`의 `setZoom`은 검사 준비용이다.)

결과는 [`results.md`](results.md).
