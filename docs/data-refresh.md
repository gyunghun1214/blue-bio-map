# 분기 자료 확인 (AI 정리 · 검토 대기)

2026-11-02 추가. 운영 계획의 "자료는 분기마다 갱신"을 사람 손 대신 예약 작업으로 시작한다.

## 하는 일

1. **모으기**: 3·6·9·12월 28일 09:00(KST)에 GitHub Actions가 공개 자료를 다시 받는다. 첫 정기 실행은 2026-12-28.
   - WoRMS: 30종 학명이 지금도 승인명인지, 기록이 스냅샷 뒤에 고쳐졌는지
   - IUCN 적색목록 범주: GBIF에 실린 IUCN 체크리스트 사본으로 30종을 다시 읽음, 사본의 갱신일(새 판 신호)
   - OBIS·GBIF 출현 기록 수: 자체 예비평가(Rapid LC)에 쓴 16종을 저장된 같은 조회 조건으로 다시 셈(10% 넘게 달라지면 '바뀜')
2. **비교하기**: 사이트가 쓰는 값(`dist/assessments.json`, 스냅샷 2026-10-15 · 방법 4.19)과 한 줄씩 맞춰 `바뀜 / 확인 불가 / 같음`으로 나눈다. 이 표는 규칙으로 만든다(AI가 만들지 않음).
3. **AI 정리**: GitHub Models(Actions 토큰, 별도 키 없음)가 표를 읽고 "먼저 볼 것"을 한국어로 정리한다. 규칙: 표에 없는 숫자·종을 만들지 않고, 점수를 다시 계산하거나 반영을 결정하지 않는다. 표에 없는 숫자가 정리에 나오면 목록에 경고를 붙인다. AI 호출이 실패하면 표만으로 목록을 만든다.
4. **검토 대기**: 결과를 `reports/data-refresh/<날짜>/`에 담은 draft PR "검토 대기: 분기 자료 확인 <날짜>"를 연다. 이 PR은 기록만 담고 `dist/`를 건드리지 않으므로, 병합하거나 닫아도 화면은 바뀌지 않는다(작업 안에서 `git diff --exit-code -- dist/`로도 확인).
5. **사람이 반영**: 팀이 원문을 열어 확인하고, 반영할 항목만 기존 수집 스크립트(`collect_*.py` → `build_*.py`)로 따로 갱신 PR을 만든다. 점수·화면 확인과 방법 변경 기록은 지금처럼 한다.

## 실행

- 정기: `.github/workflows/data-refresh.yml`의 `schedule` (cron `0 0 28 3,6,9,12 *`)
- 바로: Actions → "분기 자료 확인 (AI 정리 · 검토 대기)" → Run workflow
- 시험: 스크립트나 작업 파일을 고친 PR에서 자동으로 확인만 돈다(검토 대기 PR은 만들지 않음, 결과는 실행 요약·artifact).
- 로컬: `python scripts/refresh_check.py --out refresh-out --no-ai`
- 검사: `python -m unittest verification/test_refresh_check.py` (네트워크 없이 심은 차이 4건만 '바뀜'으로 잡는지)

## 필요한 설정

- PR을 만들려면 Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"가 켜져 있어야 한다. 꺼져 있으면 같은 내용을 이슈로 남긴다.
- AI 정리는 `permissions: models: read`만 쓴다. GitHub Models 무료 한도 안에서 한 번 실행에 요청 1~2번.

## 넣지 않은 것

- KOSIS 어업생산 통계는 인증키가 있어야 해서 이번 자동 확인에 넣지 않았다. 키를 저장소 비밀값으로 넣으면 같은 방식으로 더할 수 있다.
- IUCN 적색목록 API도 토큰이 필요해 GBIF 사본으로 읽는다. 사본이 바뀌었다고 알리면 반영 전에 IUCN 원문을 직접 확인한다.
