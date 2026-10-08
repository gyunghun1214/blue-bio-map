# 바다 탐험 첫 버전 진행 기록

브랜치 `feat/ocean-expedition` (origin/main 531ea45에서 시작). 세션이 끊기면 `git status` → `git log` → 이 파일의 마지막 체크포인트부터 이어간다.

## C1 준비 (2026-10-08)

- 시작 상태: `fix/octopus-page-recheck` 브랜치, 추적 파일 변경 없음. 추적 안 되는 `verification/artifacts/`(예전 패널 리뷰 캡처)만 있어 손대지 않고 진행했다(브랜치 전환에 영향 없음).
- 열린 PR: #152(verified-4.8, `fix/octopus-page-recheck`)만 있다. 지표 버전과 `app.js`의 `VERIFIED`·`?v=` 해시를 바꾸므로, 이 브랜치는 `app.js`를 건드리지 않고 진입 링크를 `index.html` 헤더와 `theme.css`에만 둔다. 충돌은 `index.html`의 `?v=` 한 줄에서만 날 수 있다.
- 로컬 도구: Node 24.21(CI는 22), Python 3.13.2(CI는 3.12, 이 PC에 3.12 없음), Chrome 설치됨. 버전 차이는 기록만 하고 CI에서 22/3.12로 다시 확인한다.
- 쓸 스킬·도구: frontend-design(시각 방향), 데스크톱 앱 내장 브라우저(레퍼런스 관찰·화면 확인), Playwright 플러그인(필요 시 브라우저 조작), cloudflare web-perf(첫 로딩·프레임 점검 참고). 브라우저 검사는 기존 `verification/uicheck.mjs`의 Chrome DevTools 방식(의존성 없음)을 그대로 넓힌다.
- 기준선(main 531ea45, 이 PC): `node --check` 5개, `verification/test_*.mjs` 17개, `python -m unittest`(verification), `build_verified_indices.py`·`build_matrix_readiness.py`·`build_trait_evidence.py --check`, `uicheck.mjs` 모두 통과. **기존 실패 없음.** (`build_peptide_cohort.py`·`build_xo_cohort.py --check`는 비공개 원자료 `--source`가 필요해 CI에서도 돌리지 않는다.)

## 다음 할 일

- C2 레퍼런스 관찰 → `docs/expedition/reference.md`
