# 근거와 방법 심해 디자인 (2026-10-15)

시안: 프로젝트 파일 `prompts/근거와방법_첨부/최종_디자인시안.png`, 프롬프트 v2: `prompts/method-deep-sea-claude-code-v2.md`.
`00-mockup-vs-ours.png` = 왼쪽 시안, 오른쪽 이 브랜치 1440px.

## 시안과 다른 점 (실제 데이터·기능이 이김)
- 연구 범위 숫자는 불러온 자료에서 채운다: 30종 = 운영 발행 8 + 조사 후보 22 (`data.publishedCount`·`candidateCount`, 시안 숫자와 같음). 불러오기 전·실패 시 '—'.
- 네 사분면 이름은 보고서의 `method.matrix.types`(plain·label)에서 읽는다. 현재 값은 시안 표와 같다.
- 헤더·바닥글은 기존 것을 그대로 쓴다(시안의 'OCEAN 20 CHALLENGE · alt F4', '근거와 방법 · 디자인 시안' 문구는 쓰지 않음).
- 출처 영역은 접지 않는다. 첫 화면 '전체 출처·방법 보기'와 '자료 출처 보기'가 `#all-sources`에 바로 닿고, 종별 WoRMS 인용문·원문·이용조건 링크와 지도·글꼴 저작권 표기는 그대로다. 시안보다 길다.
- 연구 범위 카드의 3 근거 영역 · 2 해석의 축에는 작은 설명(식량·생리활성·보전 / 활용가치·보전 시급성)을 함께 적었다.

## 확인 (capture.mjs, FIXTURE=dist/live-snapshot.json, results.json)
28 PASS / 0 FAIL: 1440·768·390 가로 넘침 없음, 숫자 = 자료, 접힘 기본값, 연결선 5개가 각 상자 오른쪽 끝 → 대상 상자 왼쪽 끝(BBVI–MCUI 선 없음),
버튼 3개 이동(해시 그대로), 흐름도 상자 → 접힌 설명 펼침·강조, 키보드 Enter, 출처·저작권 유지, 다른 탭 갔다 오기, 390px 버튼·접기 머리 44px 이상, 콘솔 오류 없음.

실행: `python -m http.server 8765 --bind 127.0.0.1 --directory dist` 후
`FIXTURE=dist/live-snapshot.json node verification/2026-10-15-method-deep-sea/capture.mjs` (Playwright 필요, 클라우드에서는 CHROME_PATH 지정).
