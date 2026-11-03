# 멍이 AI 답 대기 중 해변 파도 (2026-11-03, LKH 결정)

AI 답을 기다리는 대기 말풍선("멍이가 사이트 글에서 답을 찾는 중이에요…") 글자 아래에 해변 파도 띠를 붙였다. 글자는 그대로다.
준비된 FAQ 답에는 기다림이 없으므로 파도도 나오지 않는다. 답이 오거나, `no_answer`로 끝나거나, 실패·시간 초과여도 말풍선과 함께 사라진다.

- 그림: `dist/chatbot.js`의 `WAVE`(인라인 SVG, `aria-hidden="true"`, viewBox 240×32, `preserveAspectRatio="none"`으로 말풍선 폭에 맞춤)
- 크기: 높이 32px, 폭은 말풍선 안쪽 폭(한국어 240px, 영어 266~296px)
- 움직임(`dist/chatbot.css`, `prefers-reduced-motion:no-preference` 안에만): 물이 모래 위로 밀려왔다 빠짐 2.6초,
  앞 물결 2.6초, 먼바다 물결 3.9초(반대 방향), 흰 물마루 2초. 모두 끊김 없이 반복
- 움직임 줄이기: 물이 조금 올라온 멈춘 그림 한 장
- 색: 바다는 `--teal`·`--teal-fill`, 모래는 `chatbot.css` 지역 변수 `--bbc-sand`(`--surface`에 따뜻한 색을 섞음). 유형 색은 쓰지 않음
- 사이트에는 어두운 테마가 없다(theme.css에 prefers-color-scheme·data-theme 없음). 밝은 테마 하나에서만 확인했다

## 확인 (`wave_check.cjs`, 로컬 정적 서버 + 가짜 `/api/ask` 7초 늦은 답)

390·1440 × 한국어·EN × 움직임 줄이기 켬·끔 8조합 모두:
- 대기 말풍선 안에 파도가 있고, 말풍선 밖으로 넘치지 않음. `aria-hidden="true"`
- 움직임 켬이면 `bbc-wash` 애니메이션, 줄이기면 `none`
- 답이 온 뒤 `.bbc-wait`·`.bbc-wave` 0개, 마지막 말풍선은 답
- 페이지 오류·콘솔 오류 없음(클라우드에서 막은 바깥 지도 타일·Supabase 요청 실패만)
- 가로 넘침: 390 EN에서 문서 폭 394px. 파도와 무관하게 챗봇을 열기 전부터 있는 것(`.status-chips`). 범위 밖이라 그대로 둠

`verification/uicheck.mjs` M-12도 가짜 답을 1초 늦게 줘서 대기 중 `.bbc-wait` 안 `.bbc-wave`(aria-hidden)와, 답·no_answer 뒤 남지 않음을 본다(CI browser 작업).

## 파일

- `before-*`·`after-*`: 같은 대기 화면에서 파도를 뺀 것과 넣은 것. `answered-*`: 답이 온 뒤
- `wait-1440-ko-motion.gif`: 대기 말풍선 연속 캡처(약 0.25초 간격 12장)
- 실제 사이트에서는 AI가 켜져 있을 때(`GET /api/ask` → `{"ai":true}`)만 보인다. 오프라인 시연(`BBVM_OFFLINE`)에서는 AI에 묻지 않으므로 나오지 않는다
