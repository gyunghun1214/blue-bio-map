# 오프라인 시연 (발표장 인터넷·Supabase가 안 될 때)

인터넷 없이 노트북 한 대에서 지도를 그대로 띄우는 방법이다. 평소 사이트(온라인)는 바뀌지 않는다.

## 행사 전에 한 번 (인터넷 필요)

1. 시연할 노트북에 이 저장소의 최신 main을 받는다. `git pull`, 또는 GitHub의 **Code → Download ZIP**을 받아 압축을 푼다.
2. 저장소 폴더의 **`offline-demo-prepare.cmd`** 를 더블클릭한다.
   - 위성(NASA GIBS Blue Marble)·수심(GEBCO) 배경 지도 타일 1,046개를 `dist/offline-tiles/`에 저장한다. 수십 MB, 몇 분 걸린다.
   - 범위: 지도 전체 범위는 확대 3~7단계, 처음 보이는 한반도 화면(30~43°N, 122~136°E)은 가장 가까운 8단계까지(`scripts/offline/tile-plan.json`).
   - 중간에 끊겨도 다시 실행하면 빠진 것만 받는다. 끝에 "준비 끝"이 나오면 된다.
3. 인터넷을 끄고(와이파이 끄기) 아래 "행사 당일"을 한 번 해 본다.

타일을 받지 않아도 시연은 된다. 그때 지도는 경계선만 있는 지도로 바뀌고 화면에 그 이유가 표시된다.

## 행사 당일

1. 저장소 폴더의 **`offline-demo.cmd`** 를 더블클릭한다.
2. 검은 창이 뜨고 브라우저가 `http://127.0.0.1:8770/?offline=1` 로 열린다. "지도 들어가기"(Enter)를 누른다.
3. 시연이 끝나면 검은 창을 닫는다(서버가 꺼진다).

설치할 것은 없다(Windows 기본 PowerShell). 관리자 권한·방화벽 허용도 필요 없다. 이 컴퓨터 안(127.0.0.1)에서만 열리고 밖으로는 아무 요청도 보내지 않는다.

## 오프라인 시연 모드에서 달라지는 것

| 부분 | 온라인(평소) | 오프라인 시연 |
|---|---|---|
| 운영 종 자료 | Supabase 공개 API | `dist/live-snapshot.json` (저장한 공개 자료 사본, 날짜 표시) |
| 상단 상태 줄 | 공개 기준 자료 연결됨 | 오프라인 시연 · 저장된 공개 자료 사본 (날짜 기준) |
| 위성·수심 지도 | NASA GIBS·GEBCO 서버 | `dist/offline-tiles/` (없으면 경계선 지도) |
| 멍이 챗봇 | FAQ + AI 답변 | FAQ만 (AI 질문에는 "오프라인 시연 중이라 AI 답변은 쉬고 있어요") |
| 바다 탐험, 글꼴, 지도 도구 | 원래부터 저장소 안 파일 | 같음 |

- 모드는 그 브라우저 탭에서 계속 유지된다(새로고침해도). 끝내려면 주소에 `?offline=0` 을 붙여 연다.
- 공유 링크에는 `?offline=1` 이 붙지 않는다.
- 저장된 사본(`live-snapshot.json`)은 2026-10-09에 운영 DB와 같은지 확인했다(발행 8종, 공개 셀 210개, 기록 3,899건). 운영 DB를 바꾸면 행사 전에 `python scripts/snapshot_live.py` 로 다시 저장하고 PR로 올린다.

## 다른 컴퓨터(macOS·Linux)에서

PowerShell 7(`pwsh`)이 있으면 같은 스크립트가 돈다: `pwsh scripts/offline/serve.ps1`. 없으면 `python3 -m http.server 8770 --bind 127.0.0.1 --directory dist` 로 열고 `http://127.0.0.1:8770/?offline=1` 로 들어간다.

## 점검

`verification/offline_check.mjs` 가 서버를 띄운 상태에서 외부 요청을 모두 끊은 Chrome으로 15개 항목을 확인한다(자료 사본, 상태 줄, 타일 경로와 범위, 챗봇, 바다 탐험, 외부 요청 0건, `?offline=0` 복귀). CI(`verify.yml`)는 Windows PowerShell 5.1로 `serve.ps1` 을 띄워 이 검사를 돌린다.
