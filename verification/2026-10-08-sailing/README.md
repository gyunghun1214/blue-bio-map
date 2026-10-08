# 바다 탐험 항해 속도 확인 (2026-10-08)

클라우드 작업 환경(Linux, Node 22, Python 3.12, Chromium 헤드리스 + SwiftShader, GPU 없음)에서 돌린 결과다.

- `before/`(main d9397f2)와 `after/`(이 브랜치): 지점 1(톳) → 2(참굴) 구간을 0.5초 간격으로 찍은 화면. `compare.jpg`는 둘을 위아래로 붙인 것.
  - before: 배가 카메라보다 빨라 화면 밖으로 나갔다가 도착 근처에서 다시 잡힌다.
  - after: 배가 천천히 출발해 화면 가운데에서 항적을 끌며 나아가고, 카메라가 뒤로 물러나 섬과 바다가 지나가는 것이 보인 뒤 감속해 도착한다.
  - SwiftShader가 2–4 fps라 프레임 시간이 0.1초로 잘려 화면 속 시간이 실제보다 느리게 간다. 두 폴더의 장 수는 실제 초를 뜻하지 않는다. 실제 구간 시간은 `docs/expedition/design.md`의 표(순수 함수로 계산, 60 fps 기준).
- `after-check/`: `node verification/expedition_check.mjs` 결과 **65 PASS / 0 FAIL**(main은 56 PASS, 새 검사 9개: 출발 1초 뒤에도 항해 중, 첫 구간 25·50·75 % 전진, 긴 항해(지점 3 → 8) 중 안내 문구와 '바로 도착', Space·버튼 바로 도착, 모션 감소에서 버튼 없음). 4 fps는 헤드리스 SwiftShader 수치이고 실제 GPU의 프레임률은 이 환경에서 잴 수 없다.
- `uicheck.mjs`(운영 DB 대신 `FIXTURE=dist/live-snapshot.json`): 151 PASS / 3 FAIL로 main 기준선과 같다. 세 실패(A-5 배경 지도 복원, 위성·수심 타일)는 이 환경이 외부 지도 타일을 막아서 생기는 것이고 이번 변경과 무관하다.
- 탐험 브라우저 검사 소요: main 3분 19초 → 이 브랜치 3분 29초(같은 환경, 다른 작업과 겹쳐 돌린 대략값).
