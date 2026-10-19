# 첫 화면 인트로 4–8초 끊김 (2026-10-19)

첫 진입 인트로(`dist/intro.js`의 `INTRO_TIMELINE`: 물방울 → 파문 → 지구, 8초)가 4–8초에 끊기던 문제를 재고, 원인을 찾고, 고친 기록이다.
요청 프롬프트와 고친 프롬프트는 Claude 프로젝트 공유 폴더의 `intro-jank-fix/`(prompt-original.md, prompt-final.md)에 있다.

## 요약

- **원인**: 4–8초 내내 GPU 프로세스의 메인 스레드(CrGpuMain)가 초당 974–999ms 바빴다. 대부분이 2D 캔버스의 그리기 명령을 GPU가
  다시 실행하는 일(`RasterDecoderImpl::DoRasterCHROMIUM::Deserializing`)이었고, 그 그림은 파문 고리였다. 고리 하나를 굵은 선 세 번(골, 빛, 마루)으로
  긋고, 고리마다 점이 최대 512개, 고리가 최대 12개라 매 프레임 수천 개의 굵은 선이 GPU로 넘어갔다. 페이지는 GPU를 기다리느라 프레임을 늦게 냈다.
- **바꾼 것**: 파문(물방울, 고리, 글자가 사라진 뒤의 로더 시트)을 전체 화면 WebGL 셰이더 한 번으로 그린다. 픽셀마다 2D 캔버스가 칠할 값을
  같은 순서로 계산한다. WebGL을 못 쓰는 화면, 소프트웨어 렌더러, 셰이더 실패, 컨텍스트 손실, 움직임 끄기에서는 예전 2D 방식 그대로다.
- **그림**: 같은 순간을 찍어 비교하면 평균 차이 0.52/255 이하, 24단계 넘게 다른 픽셀 0.001% 이하로 눈으로 구별되지 않는다
  ([frames-cloud/compare.md](frames-cloud/compare.md)).
- **부드러움**: 수정 후 PC 측정은 PC가 측정 도중 오프라인이 되어 아직 없다(아래 '다시 재는 법'). 수정 전 측정과 원인 분석은 PC에서 했다.

## 수정 전 (PC, 2026-10-19)

Windows 11, Intel Iris Xe(ANGLE D3D11), Chrome 155, 배율 150%(dpr 1.5), 화면에 띄운 Chrome, main 4494a95. 3회 실행 중 2회째부터의 중앙값(fps).

| 구간 | 0–1 | 1–2 | 2–3 | 3–4 | 4–5 | 5–6 | 6–7 | 7–8 | 8–9 | 9–10 |
|---|---|---|---|---|---|---|---|---|---|---|
| 577×549, trace | 8.5 | 44 | 60 | 41.5 | 15 | 12 | 9.5 | 9 | 29.5 | 60 |
| 최대화 1707×932, trace | 9 | 35 | 60 | 34 | 8 | 3 | 4 | 4 | 26 | 60 |
| 577×549, trace 없음 | 3 | 8.5 | 5 | 16.5 | 9.5 | 6.5 | 7.5 | 4 | 37 | 60 |
| 최대화, trace 없음 | 2 | 13 | 5 | 17 | 8 | 3 | 3 | 2 | 2 | 48 |

원래 보고(4–5초 45, 5–7초 30, 7–8초 12–30fps)보다 훨씬 낮았다. trace를 켜지 않아도 빨라지지 않았다.

trace에서 본 것(577×549, 3회):

1. **4–8초의 저하**: CrGpuMain이 3–8초에 초당 974–999ms 바빴고, 2초마다 1.26–1.69초가 `DoRasterCHROMIUM::Deserializing`(렌더러의 2D 캔버스
   그리기를 GPU가 재생)이었다. 렌더러의 JS는 초당 0.1–0.15초뿐이다. 3.7–4.2초의 50–67ms 간격도 모두 이 일이었다.
2. **4.22초 첫 프레임**: 지구가 처음 그려지는 프레임에서 `ProxyMain::BeginMainFrame`이 320–411ms. 그 안에서 rAF가 GPU를 기다렸다
   (`CommandBufferProxyImpl::WaitForGetOffset` 95–139ms). GPU 쪽에서는 그 무렵 셰이더 만들기가 11–49번 있었다.
3. **7초 근처 0.3–0.7초 멈춤**: CrGpuMain이 `OnReleaseMemory`(base/memory_coordinator) 작업 하나를 347–741ms 돌렸다(3회 모두).
4. **0–2초**: 앱 자체를 불러오는 시간(app.js 실행, 레이아웃, 데이터)과 겹친다. 인트로 밖의 일이다.

JS 실행이 원인이 아니라는 원래 보고는 맞았다(렌더러의 JS는 초당 0.1–0.15초). 마스크·파문·바다 캔버스를 함께 끄면
(`--ablate nomask,noripple,nosea`) 6–8초는 50fps 안팎으로 올랐지만 4.22초에 1.7초 멈춤이 남았다.

## 바꾼 것 (`dist/intro.js`)

- `rippleShader()`: 파문 캔버스에 2D 캔버스가 그리던 것을 같은 순서로 계산하는 프래그먼트 셰이더. 글자가 사라진 뒤 로더 시트와 그 구멍(drawSheet),
  물방울(drawDrop), 고리마다 골·빛·마루(drawRing)를 source-over로 쌓는다. 고리는 같은 다각형(같은 점 수, 같은 흔들림)이고, 선은 픽셀(1×1 상자)
  중 선 띠가 덮는 면적을 정확히 계산한다.
- `initRipple()`·`rippleReady()`: 셰이더는 글자가 떠 있는 동안 만들고(`KHR_parallel_shader_compile`로 기다리지 않고 매 프레임 확인), 빈 그림을
  한 번 그린 뒤 2D 캔버스 자리에 넣는다. 그 전까지와 실패하면 2D 캔버스가 예전처럼 그린다(`rippleFail`, `freeRipple`).
- `setLoader()`·`drawSheet()`: 글자가 다 사라진 뒤(약 5.1초)에는 로더의 전체 화면 마스크를 매 프레임 바꾸지 않고, 로더 시트를 파문 캔버스에
  같은 구멍으로 그린다(로더는 opacity 0, 마스크 없음, 클릭은 그대로 받음). 구멍이 화면 끝을 지나면(약 6.8초) 아무것도 그리지 않는다.
- 화면 밖으로 나간 고리(`ringOn`)와 이미 빈 캔버스는 그리지 않는다. 지구 위 선(해안선, 셀, 연구 범위)은 고리가 잦아들기 시작하기 전(over 0)에는
  그리지 않는다(어차피 투명도 0).
- 바꾸지 않은 것: `INTRO_TIMELINE`, 물방울·파문·지구의 모양과 색, 진입 화면 문구, 움직임 끄기, `shouldShowGate`.

## 같은 그림인지

[frames-cloud/compare.md](frames-cloud/compare.md): 수정 전/후를 멈춘 시계에서 같은 순간(1.6–7.9초 18곳)에 찍어 픽셀마다 비교했다. 화면 3가지
(577×549 dpr 1.5, 1440×900, 390×844 휴대폰), 경로 3가지(새 방식, WebGL이 없을 때의 예전 방식, 움직임 끄기). 3초·5.5초·7.5초 비교 그림:

- [577x549-t3.jpg](frames-cloud/577x549-t3.jpg) · [577x549-t5.5.jpg](frames-cloud/577x549-t5.5.jpg) · [577x549-t7.5.jpg](frames-cloud/577x549-t7.5.jpg)
  (왼쪽 수정 전, 가운데 수정 후, 오른쪽 차이 ×8)

## 검사

- `node --check dist/intro.js`, `node verification/test_intro_ui.mjs`, `node verification/test_client_outdated.mjs`(intro.js `?v=` 갱신), CI의 나머지
  단위 검사, `python -m unittest discover -s verification -p "test_*.py"`(3.12): 모두 통과.
- `verification/uicheck.mjs`: 클라우드에서 251 통과, 4 실패(위성·수심 지도 타일이 막힌 환경 탓, main과 같음). CI(Windows)에서는 모두 통과.
- `verification/2026-10-18-intro-ripple-8s/check.mjs`: 8초 길이, 지구가 늦을 때, 움직임 끄기, 다시 보기, 키보드 모두 통과. 6.8초 항목은 '로더 마스크가
  있음'으로 열리는 중을 확인하던 것을, 마스크 대신 파문 캔버스가 구멍을 그리는 새 방식도 인정하도록 고쳤다(고친 기준으로 두 화면 모두 통과).

## 다시 재는 법

PC(실제 GPU)에서, 저장소 밖에 main과 이 브랜치를 따로 꺼내 두 포트에 띄운 뒤:

```
python -m http.server 8791 --bind 127.0.0.1 --directory <main 체크아웃>\dist
python -m http.server 8792 --bind 127.0.0.1 --directory <수정본 체크아웃>\dist
node verification/2026-10-19-intro-jank/measure.mjs out --url http://127.0.0.1:8791/ --size 577x549 --runs 3 --trace --label before
node verification/2026-10-19-intro-jank/measure.mjs out --url http://127.0.0.1:8792/ --size 577x549 --runs 3 --trace --label after
```

`--size max`(최대화), trace 없이도 같은 순서로 번갈아 잰다. 실행 중 Chrome 창을 최소화하거나 덮으면 그 회차는 무효다(rAF가 멈춤).
결과는 `out/<label>-<size>.md`의 표(2회째부터의 중앙값)를 본다. 헤더의 '파문 WebGL'이 새 방식으로 잰 것이다.

## 파일

- `measure.mjs`: 구간별 fps, 긴 프레임, 메인 스레드 지연, `--trace`(GPU 프로세스 포함 스레드별 바쁜 시간, 긴 간격마다 한 일, 셰이더 만들기),
  `--layers`, `--ablate`.
- `frames.mjs`: 멈춘 시계에서 같은 순간 찍기(`shoot`)와 비교(`compare`).
- `frames-cloud/`: 클라우드 비교 표와 그림.
