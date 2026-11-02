# 멍이 AI 답 아래 'AI 답변' 표시 지우기 (2026-11-03, LKH 결정)

사용법 안내 챗봇 '멍이' 창에서 AI(Claude)가 만든 답 말풍선 아래에 붙던 회색 작은 글자
"AI 답변 · Claude가 사이트 글을 바탕으로 만들었어요"(영어 화면 "AI answer · written by Claude from the site text")를 지웠다.
AI 답 말풍선은 이제 다른 말풍선과 같은 모양이다. 글 끝에서 말풍선 끝까지의 여백이 첫 인사 말풍선과 같다(390px 40→14px, 첫 인사 14px; 1440px 38→13px, 첫 인사 13px).

AI 사용을 알리는 곳은 이제 첫 인사 하나다. AI를 쓸 수 있으면 첫 인사가
"…준비된 답이 없으면 AI(Claude)가 사이트 글로 답해요…"로 바뀌고, 쓸 수 없으면 원래 인사로 돌아온다(`checkAi()`의 `[data-welcome]`, 바꾸지 않음).
기다리는 말 "멍이가 사이트 글에서 답을 찾는 중이에요…", 묻는 순서(칩 → 종 값 → 거의 같은 질문 → AI → 키워드 답 → 탭 안내), `worker/`는 그대로다.

## 바꾼 파일

- `dist/chatbot.js`: `askAi()`에서 `.bbc-ai-tag` `<small>`을 붙이던 줄을 지웠다. 말풍선의 `bbc-ai` 클래스는 남겼다(검사 M-12가 AI 답을 찾는 손잡이, 걸린 CSS 없음). 더 쓰지 않는 `const m=`만 뺐다. 위 주석을 지금 동작에 맞췄다.
- `dist/chatbot.css`: `.bbc-ai-tag` 규칙을 지웠다(다른 CSS에는 없었다).
- `dist/i18n-en.js`: 더 쓰지 않는 영어 문구 한 줄을 지웠다. `verification/i18n-ko-baseline.txt`·`docs/i18n-review.csv`에는 이 문구가 없어 그대로다.
- `?v=`: `python scripts/i18n_ui_dict.py stamp`로 맞췄다. `chatbot.js` be99c427ff→a28401e878, `chatbot.css` bdd9069e14→edd17c4a1b, `i18n.js` 323b597471→9662b2b9ca(index.html·expedition.html), `i18n-en.js` fc9f7ccad1→030e95fd1f(i18n.js 안).

## 고친 검사

- `verification/test_chatbot_faq.mjs`: 화면 문구 목록에서 지운 문구를 뺐다(기다리는 말은 남아 금지어 검사를 계속 받는다). `chatbot.js`·`chatbot.css`에 `bbc-ai-tag`와 그 문구가 없다는 것, 첫 인사의 AI 안내 문장이 있다는 것을 확인한다. (3c) 주석을 지금 동작으로 고쳤다.
- `verification/uicheck.mjs` M-12: AI 답 말풍선에 `.bbc-ai-tag`가 없고(`tag===''`) 말풍선 글자 전체가 AI 답 글자와 정확히 같은지 확인한다. 첫 인사 확인은 그대로다.

## 돌린 검사 (클라우드, 2026-11-03)

- CI 단위 검사(`.github/workflows/verify.yml`의 unit 단계 명령 전부, Python unittest 포함 67개): 모두 통과.
- `node verification/uicheck.mjs`(FIXTURE=dist/live-snapshot.json): 결과는 PR 설명에 적는다.
- 화면 확인(`shots.cjs`, Playwright): 390×844·1440×900 × 한국어·`?lang=en`, 가짜 `/api/ask`로 AI를 켜고 "zqxj 시험"을 보냈다. 바꾼 뒤 AI 답 아래 표시 없음, 첫 인사는 AI 안내 문구, 콘솔 오류 0.

## 스크린샷

`before-*.png`는 바꾸기 전 main(cf3bc84), `after-*.png`는 바꾼 뒤. 모두 AI를 켠 상태에서 칩 하나를 누른 뒤 FAQ에 없는 질문을 보낸 화면이다.
