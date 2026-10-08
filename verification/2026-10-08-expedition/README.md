# 2026-10-08 바다 탐험 화면 확인

이 PC(Windows 11, Chrome, Node 24, Python 3.13)에서 `python -m http.server 8765 --bind 127.0.0.1 --directory dist`를 켜고 실행했다.

- `node verification/expedition_check.mjs verification/2026-10-08-expedition` → 56 PASS / 0 FAIL (`expedition-check-results.json`, 스크린샷 `*.jpg`)
  - 데스크톱 1440×900, 모바일 390×844(터치), 모션 감소, WebGL 끔(`--disable-webgl --disable-3d-apis`) 네 환경.
  - 각 환경: 탐험 시작 → 지점 1 도착 → 발견 단계 1→3 → 상세 열기(키보드 Enter)·닫기(Esc, 포커스 복귀) → 빠른 연속 이동으로 지점 3 → 지점 1 재방문(상세 열람 상태 유지) → '지도에서 보기'로 기존 지도에서 그 종 선택 확인.
  - 파일 이름의 숫자는 순서다. `desktop-6-sailing-*ms`는 지점 1→3 항해 중 0.9초 간격 3장(녹화 대신).
- `node verification/uicheck.mjs verification/2026-10-08-expedition` → 146 PASS / 0 FAIL (`ui-check-results.json`). 기존 화면 스크린샷은 바뀐 것이 없어 지웠다.
- 프레임·용량(실제 GPU, ANGLE D3D11, Intel Iris Xe, 헤드리스): 데스크톱 항해 중 60 fps, 모바일 에뮬레이션(CPU 4배 감속) 60 fps. SwiftShader(소프트웨어 렌더링)에서는 약 5 fps라 '카드 목록' 안내가 뜬다.
- 첫 로딩(압축 없는 로컬 서버 기준) 약 1.5 MB. gzip 기준 탐험 HTML·JS·CSS·지점 JSON 31 KB, Three.js 171 KB, 해안선(countries.json) 96 KB, 글꼴 별도. 카드 목록은 Three.js를 받기 전에 먼저 보인다.
