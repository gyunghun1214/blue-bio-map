# 멍이 입력창 위 안내 줄 지우기 (2026-11-03, LKH 결정)

사용법 안내 챗봇 '멍이' 창에서 입력창 바로 위의 회색 안내 한 줄(`.bbc-note`)을 지웠다.
AI가 꺼졌을 때의 "미리 준비한 답변으로 안내해요"와 켜졌을 때의 "준비된 답이 없으면 AI(Claude)가 사이트 글로 답해요" 둘 다 없어지고,
그 높이(약 24px)만큼 대화창이 넓어졌다(390px 530→554px, 1440px 374→396px). 대화창 아래와 입력창 사이 빈칸은 0px.

AI 사용을 알리는 표시는 그대로 남는다.

- 첫 인사: AI가 켜지면 "…준비된 답이 없으면 AI(Claude)가 사이트 글로 답해요…"로 바뀌고, 꺼지면 원래 인사로 돌아온다(`checkAi()`의 `[data-welcome]`).
- AI가 만든 답: "AI 답변 · Claude가 사이트 글을 바탕으로 만들었어요" 표시.

## 바꾼 파일

- `dist/chatbot.js`: 창 HTML의 `<p class="bbc-note">` 줄, `noteEl`/`NOTE_FIXED`, `checkAi()` 안 `note`의 안내 줄 부분을 뺐다. 주석을 지금 동작에 맞췄다.
- `dist/chatbot.css`: `.bbc-note` 규칙을 지웠다(다른 CSS에는 없었다).
- `dist/i18n-en.js`: 더 쓰지 않는 영어 문구 두 줄을 지웠다. 첫 인사는 문장 전체가 따로 있는 키라 그대로다.
- `verification/i18n-ko-baseline.txt`, `docs/i18n-review.csv`: 지운 문구 한 줄씩.
- `?v=`: `python scripts/i18n_ui_dict.py stamp`로 `chatbot.js`·`chatbot.css`·`i18n.js`(index.html·expedition.html)와 `i18n-en.js`(i18n.js 안) 값을 맞췄다.

## 고친 검사

- `verification/test_chatbot_faq.mjs`: `bbc-note`가 없다는 확인으로 바꾸고, 화면 문구 목록에서 '입력창 표기'와 지운 AI 문구를 뺐다.
- `verification/uicheck.mjs`: M-10은 `.bbc-note`가 없음을 확인한다. M-12는 AI가 켜지면 첫 인사가 AI 안내 문구로 바뀌고 꺼지면 돌아오는지, 그동안 안내 줄이 없는지 확인한다.

## 돌린 검사 (클라우드, 2026-11-03)

- CI 단위 검사(`.github/workflows/verify.yml`의 unit 단계 전부, Python 3.12 unittest 496개): 모두 통과.
- `node verification/uicheck.mjs`(FIXTURE=dist/live-snapshot.json): 298 PASS / 4 FAIL. FAIL 4개는 클라우드에서 바깥 지도 타일이 막혀 생기는 것(A-5 공유 링크의 수심 지도, 위성 GIBS, 수심 GEBCO, 예전 '기본' 저장값)으로 이번 변경과 상관없다. M-10·M-12 통과.
- 화면 확인(`shots.cjs`, Playwright): 390·1440 × 한국어·EN × AI 끔·켬(가짜 `/api/ask`). 안내 줄 없음, 빈칸 0px, AI를 켜면 첫 인사가 바뀌고 "zqxj 시험" 답에 'AI 답변' 표시, 콘솔 오류 0.

## 스크린샷

`before-*.png`는 바꾸기 전 main(9d2fae8), `after-*.png`는 바꾼 뒤. `-ai`는 가짜 `/api/ask`로 AI를 켠 상태에서 FAQ에 없는 질문을 보낸 화면.
