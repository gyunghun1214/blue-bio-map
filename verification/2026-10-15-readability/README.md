# 읽기 쉬운 화면: 영어 원문·글자 크기·약어 (2026-10-15)

같은 확인 스크립트(`verification/readability_check.mjs`)로 main(543edf2, verified-4.19)과 이 변경을 375·768·1440px에서 쟀다.
잰 화면: 첫 화면(지구), 지도 첫 화면, 30종 상세(접힌 내용 모두 펼침), 상태 안내·범례, 멍이 도움말, 비교와 지표(행 모두 펼침, 비교 기준),
근거와 방법(접힌 내용 모두 펼침), 바다 탐험. Supabase 두 요청은 `dist/live-snapshot.json`으로 답했다.

| 항목 | main | 이 변경 |
|---|---:|---:|
| 영어 문장(한글 없이 4단어 이상, 중복 제외) | 978 | 491 |
| └ 그중 `lang` 표시 없는 문장 | 978 | **0** |
| 12px 미만 글자(화면 상태별 합, 375 / 768 / 1440px) | 1,273 / 1,261 / 850 | **0 / 0 / 0** |
| 11px 미만 글자(같은 방식) | 216 / 656 / 275 | **0 / 0 / 0** |
| 한국어 이름 없이 처음 나온 약어(MFPI·MBPI·BBVI·MCUI) | 19 | **0** |
| 가로 넘침(페이지 전체) | 0 | 0 |

- 남은 491문장은 모두 원문으로 둔 것이다: 논문·데이터셋 제목, 학술지·기관 이름, 학명 목록, 측정 기록(표적·균주·배지), 라이선스 원문, 지도 이용 고지.
  모두 `lang="en"`(학명 목록 `la`, 러시아어·일본어 게재명 `ru`·`ja`) 블록 안에 있다. 목록: `english-after.txt`(`[en]` = lang 표시됨).
- 한국어로 바꾼 설명 문구 262개는 `dist/screen-text-ko.json`에 있다(키 = 자료의 영어 원문 그대로). 숫자·날짜·범주는 원문과 같다(`verification/test_screen_text_ko.mjs`).
  자료 파일(JSON)과 점수는 바꾸지 않았다.
- 지도 이용 고지(NASA GIBS, GEBCO)는 원문을 「」 안에 그대로 두고 한국어 설명을 붙였다.
- 스크린샷(375px): `375-map.png`(지도), `375-compare.png`(비교와 지표), `375-method.png`(근거와 방법 첫 화면), `375-method-sources.png`(출처 목록: 제목 원문 + 한국어 메모).
- 수치 원본: `summary.json`, 변경 전 영어 문장 목록: `english-before.txt`.

다시 재기: dist/를 127.0.0.1:8765로 띄운 뒤

```
FIXTURE=dist/live-snapshot.json node verification/readability_check.mjs <출력폴더>            # 12px 기준
FIXTURE=dist/live-snapshot.json node verification/readability_check.mjs <출력폴더> --min=11   # 11px 기준
```

CI는 `uicheck.mjs`의 R-1(390·1440px, 지도·비교·방법)로 같은 기준을 본다.
