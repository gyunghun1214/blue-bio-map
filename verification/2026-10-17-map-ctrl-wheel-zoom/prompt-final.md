# 탐색 지도 PC 확대: Ctrl + 스크롤 · 터치패드 핀치로 지도만 확대 — Claude Code 작업 지침 (최종본)

> 원본(`prompt-original.md`)을 main `350d643`과 대조해 고친 판이다. 고친 곳은 맨 아래 '원본에서 고친 점'에 모았다.

## 배경

탐색 지도는 휴대폰에서는 두 손가락으로 바로 확대·축소된다. 그런데 PC에서는 **오른쪽 아래 + / − 버튼으로만** 확대할 수 있다.

- 지도는 `app.js`의 `initMap()`에서 `L.map('map',{…,scrollWheelZoom:false,…})`로 만든다. 그래서 휠 확대가 꺼져 있다.
  - 끈 이유는 지도 위에서 휠을 굴릴 때 페이지 스크롤이 지도에 걸려 멈추지 않게 하기 위해서로 보인다. 이 동작은 유지한다.
- 이 상태에서 Ctrl을 누르고 휠을 굴리거나 터치패드로 핀치하면, 브라우저가 **페이지 전체를 확대**한다. 사용자는 지도를 확대하려 했는데 화면 글자와 패널이 모두 커진다.

이 작업은 **지도 위에서만** Ctrl + 휠과 터치패드 핀치가 지도를 확대·축소하게 하는 것이다(구글 지도 임베드와 같은 방식). 그냥 휠은 지금처럼 페이지를 스크롤한다.

- 저장소: `gyunghun1214/blue-bio-map`, 최신 `main`에서 시작
- 작업 브랜치: 세션에 지정된 브랜치. 없으면 `ui/map-ctrl-wheel-zoom`
- 지도 위에 떠 있는 버튼·범례(`.map-ui-*`, `#map-chip`, `#value-mini`, `#value-key`)는 `#map` 안이 아니라 형제 요소로 `.map-stage` 안에 있다.

## 할 것

### 1. Ctrl(또는 ⌘) + 휠, 터치패드 핀치 → 지도 확대·축소

- `scrollWheelZoom:false`는 **그대로 둔다.** 대신 `initMap()`에서 지도와 그 위에 뜬 버튼·범례를 함께 감싼 **`.map-stage`**(`map.getContainer().closest('.map-stage')`)에 `wheel` 리스너를 직접 단다. 범례 위에서 Ctrl + 휠을 해도 페이지가 아니라 지도가 확대되어야 사용자가 보기에 '지도 위'와 맞는다. **`{passive:false}`**로 달아야 `preventDefault()`가 먹는다. 오른쪽 패널(`#side-panel`)·근거 서랍·지도 아래 영역은 `.map-stage` 밖이므로 지도 밖이다.
- 조건: `e.ctrlKey || e.metaKey`일 때만 처리한다.
  - Chrome·Edge·Firefox(Windows·macOS)는 **터치패드 핀치를 `ctrlKey:true`인 `wheel` 이벤트로** 보낸다. 그래서 이 한 조건으로 Ctrl + 휠과 핀치를 함께 처리한다.
  - 처리할 때 `e.preventDefault()`로 브라우저 페이지 확대를 막는다. **지도 밖에서는 막지 않는다.** 페이지 확대는 지도 밖에서 그대로 되어야 한다(접근성).
- 확대 방식
  - 확대 단계는 지금처럼 **정수 줌**을 유지한다(`zoomSnap` 기본값 1). 셀 묶음 버블과 URL의 `m=` 값이 정수 줌을 전제로 하고 있으므로 바꾸지 않는다.
  - `deltaY`를 누적해서 문턱값을 넘을 때 한 단계씩 움직인다. 마우스 휠 한 칸은 바로 한 단계, 터치패드처럼 작은 값이 연속으로 오면 모아서 한 단계가 되게 한다. 시작값은 `deltaMode===0`(픽셀)일 때 문턱 약 **60px**, `deltaMode===1`(줄)일 때 **1줄**이다. 실제 기기로 확인하고 조정한다.
  - 한 번 움직인 뒤 약 **150ms** 동안은 다음 단계를 받지 않는다(관성 스크롤로 여러 단계가 한꺼번에 넘어가지 않게). 그동안 온 이벤트도 `preventDefault()`는 한다(막지 않으면 그 사이에 페이지가 확대된다).
  - 움직인 뒤, 방향이 바뀔 때, 약 250ms 동안 휠이 없을 때 누적값을 0으로 되돌린다(오래전 작은 값이 남아 다음 핀치를 엉뚱하게 시작하지 않게).
  - 확대 중심은 **커서 위치**다. `map.setZoomAround(map.mouseEventToContainerPoint(e), next)`를 쓴다.
  - `minZoom:3` / `maxZoom:8`, `maxBounds`는 그대로 지킨다. 끝에 닿으면 더 움직이지 않는다.
  - '움직임 줄이기'(`prefers-reduced-motion`)일 때는 기존처럼 애니메이션 없이 바뀐다(`zoomAnimation:!still` 그대로).
- **Safari(macOS) 핀치**: Safari는 핀치를 `wheel`이 아니라 비표준 `gesturestart` / `gesturechange` / `gestureend`로 보낸다. `.map-stage`에 이 세 이벤트를 `{passive:false}`로 달고 `preventDefault()`를 한다. `gesturechange`의 `e.scale`이 **직전 단계 기준** 약 1.25배를 넘거나 0.8배 밑으로 가면 한 단계 움직이고, 그 `scale`을 새 기준으로 삼는다(같은 150ms 간격). 중심은 `e.clientX/Y`를 `map.mouseEventToContainerPoint(e)`로 바꿔서 쓴다. 이벤트가 없는 브라우저에서는 아무 일도 하지 않는다.
  - **iPhone·iPad Safari도 두 손가락 터치에 `gesture*` 이벤트를 보낸다.** 그대로 두면 Leaflet `touchZoom`과 함께 두 번 확대된다. 그래서 `.map-stage`에서 손가락이 닿아 있는 동안(`touchstart`~`touchend`/`touchcancel`, passive로 센다)에는 `gesture*`를 건드리지 않고 Leaflet에 맡긴다. iPad 트랙패드 핀치처럼 손가락 터치가 없을 때만 처리한다.
  - `gesture*`가 진행 중일 때 들어오는 `ctrlKey` 휠은 무시한다(브라우저가 둘 다 보내도 한 번만 움직이게).
- 확대 후에는 기존 `moveend`/`zoomend` 흐름(해시 `m=` 갱신, 버블·점 다시 그리기)이 그대로 돌아야 한다. 새 코드가 이 흐름을 따로 부르지 않는다. Leaflet 이벤트에 맡긴다.

### 2. 그냥 휠을 굴렸을 때 안내 (한 번에 짧게)

- 지도 위에서 **Ctrl 없이** 휠을 굴리면 페이지는 지금처럼 스크롤한다. `preventDefault()`를 하지 않는다.
- 그때 지도 가운데에 반투명 안내를 약 **1.5초** 띄운다. 문구는 다음과 같다.
  - Windows·기타: `Ctrl + 스크롤로 지도를 확대합니다`
  - macOS(`navigator.userAgentData?.platform` → 없으면 `navigator.platform`으로 판단): `⌘ + 스크롤 또는 두 손가락을 벌려 지도를 확대합니다`
    (macOS에서는 '두 손가락'만 쓰면 평소 스크롤인 두 손가락 쓸기와 헷갈리므로 '벌려'를 넣는다)
- 안내는 `#map` 위에서 굴렸을 때만 띄운다(범례·버튼 패널은 자기 내용을 스크롤할 수 있다).
- 안내는 연속 스크롤 중 깜빡이지 않게 디바운스한다. 한 세션에서 **3번까지만** 띄운다(이후에는 안 띄움, 변수에만 기록하고 저장소는 쓰지 않음).
- 안내 요소: `pointer-events:none`, `aria-hidden="true"`(스크린리더에는 아래 3번의 상시 설명으로 알린다). 색은 탐색 지도 공유 토큰(`theme.css` `:root`의 `--x-panel`·`--x-text`·`--x-border`)을 쓴다. 글자는 12px 미만으로 쓰지 않는다(`--fs-min`). '움직임 줄이기'에서는 서서히 나타나는 효과를 끈다.
- **터치 기기에서는 띄우지 않는다**(`matchMedia('(hover:hover) and (pointer:fine)')`일 때만).

### 3. 접근성 · 설명

- 지도 컨테이너의 `aria-label`(또는 지도 설명 문구)에 "Ctrl(⌘) + 스크롤, 터치패드 핀치, +/− 버튼, 키보드 +/− 로 확대·축소"를 더한다. 기존 문구는 지우지 않고 덧붙인다.
- Leaflet 기본 키보드 확대(`keyboard:true`, 지도에 포커스가 있을 때 `+`/`−`)가 꺼져 있지 않은지 확인한다. 꺼져 있으면 켠다.
- 지도 범례의 '그 밖의 기능 · 배경 지도 출처' 접기(`index.html` `.map-info`) 목록에 "확대: Ctrl(⌘) + 스크롤 · 터치패드 핀치 · +/− 버튼" 한 줄을 더한다.

## 절대 바꾸지 않을 것

- `scrollWheelZoom:false`(그냥 휠 = 페이지 스크롤)
- `minZoom`, `maxZoom`, `maxBounds`, `maxBoundsViscosity`, 정수 줌
- 휴대폰 두 손가락 확대(Leaflet `touchZoom`)와 + / − 버튼 동작·위치
- 지도 밖에서의 브라우저 페이지 확대(Ctrl + 휠, 핀치)
- 셀·버블·점의 그리기 규칙, 해시 `m=` 형식, 다른 탭과 첫 화면, `expedition.html`

## 검사

1. 먼저 관련 검사를 찾는다. `verification/` 아래에서 `scrollWheelZoom`, `wheel`, `ctrlKey`, `setZoom`, `zoom`으로 검색한다. 기존 기대값과 충돌하면 **기대값을 고친다.** 지우거나 건너뛰지 않는다.
2. 새 검사를 더한다(Playwright/uicheck 방식).
   - 지도 위에서 `ctrlKey:true` 휠(`deltaY:-100`) → 줌이 1 오르고, 이벤트의 `defaultPrevented`가 `true`다.
   - 지도 위에서 Ctrl 없는 휠 → 줌은 그대로이고 `defaultPrevented`가 `false`다(페이지 스크롤 유지).
   - 지도 **밖**(예: 오른쪽 패널)에서 `ctrlKey:true` 휠 → `defaultPrevented`가 `false`다.
   - `deltaY:-8` 같은 작은 값을 10번 연속 보내면 한 단계만 오른다(누적 + 150ms 간격).
   - `maxZoom` 8에서 더 확대해도 8이고, `minZoom` 3에서 더 축소해도 3이다.
   - 범례 패널(`.map-ui-bl`) 위 Ctrl 휠도 지도를 확대한다.
   - 확대 중심: 지도 왼쪽 위 1/4 지점에서 확대하면, 그 지점 아래 위경도가 확대 전과 거의 같다(지도 가운데가 아님).
   - 그냥 휠 안내: 뜨고, 1.5초 뒤 사라지고, 4번째부터는 뜨지 않는다. 터치 기기 흉내(`hover:none`)에서는 뜨지 않는다.
   - `gesturechange`(손가락 터치 없음) `scale` 1.3 → 한 단계 확대. `touchstart` 뒤의 `gesturechange`는 줌을 바꾸지 않는다.
   - 실제 입력 경로 확인: CDP `Input.dispatchMouseEvent`(`mouseWheel`, `modifiers:2`)로 Ctrl 휠을 보내면 지도 줌이 오르고 `visualViewport.scale`·`devicePixelRatio`(페이지 확대)는 그대로다.
   - 확대 후 해시의 `m=` 줌 값이 바뀐다.
3. CI 전체(`verify.yml`의 `node verification/test_*.mjs`, `python scripts/build_expedition_stops.py --check`, `python -m unittest discover -s verification -p 'test_*.py'`)와 로컬 `verification/uicheck.mjs`를 돌린다.
4. 직접 확인한다(실제 기기). 클라우드 세션처럼 실제 기기가 없으면 위 이벤트 흉내로 확인하고, 기기 확인 표에 **확인한 방법을 사실대로** 적는다(실제 기기 확인은 '사용자 확인 필요'로 남긴다). 이 때문에 머지를 미루지 않는다.
   - Windows Chrome/Edge: 마우스 휠 + Ctrl, 노트북 터치패드 핀치
   - macOS Chrome·Safari: 터치패드 핀치, ⌘ + 휠
   - 휴대폰: 두 손가락 확대가 전과 같다, 안내가 뜨지 않는다
   - 그냥 휠로 페이지 스크롤이 지도에 걸리지 않는다(3열 배치 경계 1180px보다 좁아 페이지가 길게 이어지는 폭에서 특히)
   - 지도 밖에서 Ctrl + 휠은 브라우저 확대가 된다
5. `app.js`(필요하면 CSS)를 고쳤으므로 `index.html`의 `?v=` 해시를 다시 계산한다(README 53행 규칙, LF로 맞춘 파일 내용 sha256 앞 10자, `test_client_outdated.mjs`).

## 남길 것

- `verification/2026-10-17-map-ctrl-wheel-zoom/README.md`(다른 날짜 폴더 형식, 예: `2026-10-17-explore-dots-red/`)
  - 기준 커밋, 지침 원본 `prompt-original.md`·최종본 `prompt-final.md`(같은 폴더. 저장소에는 `prompts/` 폴더가 없다)
  - 기기·브라우저별 확인 표(Windows 휠, Windows 터치패드, macOS Chrome 핀치, macOS Safari 핀치, 휴대폰)
  - 최종 문턱값과 간격(60px / 150ms를 바꿨다면 바꾼 값과 이유)
  - 안내 문구 캡처 1장
  - 고친 검사 / 지운 검사 / 건너뛴 검사(없으면 '없다')
- PR 본문 첫 줄: "지도 위에서만 Ctrl(⌘) + 스크롤 · 터치패드 핀치로 지도 확대. 그냥 스크롤과 지도 밖 동작은 그대로."

## 완료 기준

- [ ] PC 지도 위에서 Ctrl(⌘) + 휠과 터치패드 핀치로 지도만 한 단계씩 확대·축소되고, 페이지는 확대되지 않는다
- [ ] 확대 중심이 커서 위치다
- [ ] 그냥 휠은 페이지를 스크롤하고, 짧은 안내가 최대 3번 뜬다
- [ ] 지도 밖의 브라우저 확대와 휴대폰 두 손가락 확대는 전과 같다
- [ ] CI 전체 통과, uicheck 통과, 콘솔 오류 없음

## 원본에서 고친 점 (main `350d643` 대조)

1. 리스너 위치: `#map`만이 아니라 `.map-stage`. 지도 위에 뜬 범례·버튼은 `#map`의 형제 요소라, 원본대로면 그 위 Ctrl + 휠은 페이지 확대가 된다.
2. iPhone·iPad Safari는 두 손가락 터치에도 `gesture*`를 보낸다. 원본대로면 휴대폰 확대가 Leaflet `touchZoom`과 겹쳐 두 번 확대되어 '휴대폰 두 손가락 확대는 그대로' 조건을 깬다. 손가락 터치 중에는 처리하지 않는다.
3. `gesture*`와 Ctrl 휠이 함께 오는 경우, 쉬는 동안의 이벤트도 막기, 누적값 초기화, 제스처 기준 갱신을 정했다.
4. macOS 안내 문구 '두 손가락으로' → '두 손가락을 벌려'(두 손가락 쓸기는 macOS의 평소 스크롤).
5. 토큰 이름: `--mt-*`/`--cs-*`는 '비교와 지표'·'근거와 방법' 토큰이고, 탐색 지도는 `--x-*`다.
6. 좁은 화면 경계: 1100px → 지금 3열 배치 경계 1180px.
7. 프롬프트 경로: 저장소에 `prompts/`가 없어 검증 폴더에 원본·최종본을 둔다.
8. 검사 추가: 범례 위 Ctrl 휠, 확대 중심, 안내 횟수·터치 기기, 제스처, CDP 실제 휠 입력에서 페이지 확대 없음.
9. 실제 기기 확인을 할 수 없는 환경에서의 기록 방법.

확인한 것: `keyboard` 옵션은 어디서도 끄지 않는다(Leaflet 1.9.4 기본 `keyboard:true`). 지도 `aria-label`은 `index.html`의 `#map`에 '한반도 주변 공개 격자 지도'로 있다. 해시 `m=`은 `writeHash()`가 `moveend`에서 `줌/위도/경도`로 쓴다. 기존 검사에는 휠·Ctrl 기대값이 없다(`uicheck.mjs`의 `setZoom`은 검사 준비용).
