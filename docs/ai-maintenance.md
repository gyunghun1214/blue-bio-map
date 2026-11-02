# AI 점검·관리 (주간 점검 + Claude 수정안)

2026-11-02 LKH 요청: 사이트를 AI가 스스로 점검하고, 고칠 안까지 만드는 체계. **설치만 하고, 실제 수정 PR은 꺼 둔 상태로 둔다.**
원칙은 하나다. **AI는 점검하고 고칠 안을 초안으로 만든다. 병합(=라이브 반영)은 언제나 사람이 한다.**

## 흐름

```
매주 월요일 09:00 (KST)
  주간 점검 (.github/workflows/weekly-check.yml)
    ├ 자동 검사 전체 다시 돌리기 (verify.yml: 코드·자료 검사, 브라우저 화면 검사)
    ├ 바깥 링크 확인 (scripts/check_links.py)
    ├ 라이브 사이트가 main과 같은지 (scripts/weekly_check.py live)
    └ 보고서 + AI 정리 (scripts/weekly_check.py report: 비밀값 ANTHROPIC_API_KEY가 있으면 Claude, 없으면 GitHub Models)
          └ 고칠 것이 있으면 이슈 (라벨 weekly-check; 열린 이슈가 있으면 댓글)
                └ [꺼져 있음] Claude 수정안 (.github/workflows/ai-fix.yml)
                      └ 초안(draft) PR + 검사 → 사람이 보고 병합
```

- 주간 점검은 사이트 파일(`dist/`)을 고치지 않는다. 보고서는 Actions 실행 요약과 artifact `weekly-report`에도 남는다.
- 바로 돌리기: Actions → 주간 점검 (AI 정리) → Run workflow.
- '확인 불가' 링크(봇을 막는 사이트)는 고칠 것으로 세지 않는다. 이미 알고 그대로 두기로 한 링크는
  `config/weekly-check.json`의 `known_links`에 적으면 '참고'로만 나온다.
- AI 정리는 덧붙임일 뿐이다. 2026-11-02 첫 실행에서 GitHub Models가 이 저장소에 '200 OK'만 돌려줘 정리가 비었고,
  표(고칠 것·참고)는 그대로 나왔다. 비밀값 `ANTHROPIC_API_KEY`를 넣으면 Claude가 정리한다(분기 자료 확인과 같은 키).
- 일시적인 DNS 실패('Temporary failure in name resolution')는 '깨짐'이 아니라 '확인 불가'로 센다.
- 멍이 AI가 꺼져 있으면(`/api/ask` → `ai:false`) '참고'로만 적는다. 열쇠가 끝나 일부러 끈 경우도 있어서다.

## Claude 수정안 켜는 법 (지금은 꺼져 있음)

Settings → Secrets and variables → Actions 에서:

| 종류 | 이름 | 값 | 뜻 |
|---|---|---|---|
| Secret | `ANTHROPIC_API_KEY` | Anthropic 콘솔의 API 키 | 쓴 만큼 API 크레딧에서 나감 |
| (또는) Secret | `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` 으로 만든 값 | Claude 구독 사용량에서 나감 |
| Variable | `AI_FIX_ENABLED` | `true` | Claude 수정안 단계 켜기 (이슈에 `ai-fix` 라벨, 또는 수동 실행) |
| Variable | `AI_FIX_AUTO` | `true` | 주간 점검이 이슈를 열면 바로 Claude 수정안까지 (없으면 사람이 라벨을 붙일 때만) |
| Variable | `AI_FIX_MODEL` | 예: `claude-sonnet-5-5` | 비우면 `claude-opus-5-5` |
| Variable | `AI_FIX_MAX_TURNS` | 예: `20` | 비우면 30 |

PR이 만들어지려면 Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"를 켠다.
꺼져 있으면 PR 대신 이슈 댓글에 수정안 브랜치 이름을 남긴다.

끄기: `AI_FIX_ENABLED`를 지우거나 `false`로. 주간 점검(이슈까지)은 그대로 돈다.

## 안전장치

1. **두 단계 분리.** Claude가 도는 job은 읽기 권한만 있다(`contents: read`, 저장소 열쇠도 남기지 않음). Claude는 파일만 고치고
   commit·push·PR·바깥 접속을 할 수 없다. PR은 다음 job이 만든다.
2. **고칠 수 있는 범위.** `scripts/ai_fix_guard.py`가 막는다: 점수·평가 자료(`dist/assessments.json`, `dist/matrix-readiness.json`,
   `config/`, `scripts/build_verified_indices.py`), 배포·보안·AI 설정(`.github/`, `worker/`, `wrangler.jsonc`, `dist/_headers`,
   `CLAUDE.md`), 10파일·300줄 넘는 수정. 걸리면 PR을 만들지 않고 이슈에 이유만 남긴다.
3. **할 일 지시.** `config/ai-fix-prompt.md` (Claude가 고칠 수 없는 곳에 있음): 점수·숫자를 만들지 않기, 화면 문구 규칙(`CLAUDE.md`),
   링크는 점검 표에 이미 있는 새 주소로만 바꾸기, 끝나면 요약 쓰기.
4. **초안 PR만.** 언제나 draft로 만들고 `verify.yml` 전체 검사를 돌린다. 어떤 작업 흐름도 병합하지 않는다.
5. **동작 고정.** `anthropics/claude-code-action`은 커밋(v1.0.266)으로 고정해 남이 태그를 옮겨도 바뀌지 않는다.

검사: `python -m unittest verification/test_weekly_check.py` (고칠 것 가르기, 알려진 링크, AI 숫자 거르기, 안전장치, 꺼진 채 설치).

## 비용

- 주간 점검: GitHub Actions 시간(비공개 저장소 무료 한도 안). AI 정리는 고칠 것이 있는 주에만 한 번 부르며,
  Claude면 짧은 정리 한 번이라 몇 센트 수준(추정), 키가 없으면 GitHub Models(무료)를 시도한다.
  verify.yml 전체를 매주 한 번 더 돌리므로 Windows 실행 시간이 주 25분쯤 늘어난다(무료 한도에서 2배로 계산).
- Claude 수정안(켤 때만): Claude Opus 5.5 기준 입력 100만 토큰당 4달러, 출력 100만 토큰당 20달러.
  작은 링크 수정 한 번은 대략 1~3달러로 추정한다(실제 금액은 Anthropic 콘솔 사용량에서 확인). 고칠 것이 없는 주에는 돌지 않는다.
