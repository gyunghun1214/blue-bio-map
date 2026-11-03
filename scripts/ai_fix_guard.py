#!/usr/bin/env python3
"""Claude 수정안의 안전장치: Claude가 고친 파일 목록을 보고 PR로 올려도 되는 범위인지 판단한다.
.github/workflows/ai-fix.yml 이 Claude 실행 뒤에 부른다. 표준 라이브러리만 쓴다. 설명: docs/ai-maintenance.md

    git diff --numstat | python scripts/ai_fix_guard.py      # 통과하면 0, 막히면 1과 이유

막는 것
- 점수·평가 자료와 그 규칙: dist/assessments.json, dist/matrix-readiness.json, config/, scripts/build_verified_indices.py
- 배포·보안·AI 설정: .github/, worker/, wrangler 설정, dist/_headers, CLAUDE.md
- 너무 큰 수정: 파일 MAX_FILES개 또는 바뀐 줄 MAX_LINES줄 초과 (작고 확인하기 쉬운 수정만 받는다)
"""
from __future__ import annotations

import sys

MAX_FILES = 10
MAX_LINES = 300
BLOCKED_PREFIXES = (".github/", "worker/", "config/", ".ai-fix/")
BLOCKED_FILES = {"dist/assessments.json", "dist/matrix-readiness.json", "dist/_headers", "CLAUDE.md",
                 "scripts/build_verified_indices.py", "wrangler.toml", "wrangler.json", "wrangler.jsonc"}


def check(numstat: str) -> list[str]:
    reasons, files, lines = [], 0, 0
    for row in numstat.splitlines():
        parts = row.split("\t")
        if len(parts) != 3:
            continue
        added, removed, path = parts
        path = path.strip()
        files += 1
        lines += (int(added) if added.isdigit() else 0) + (int(removed) if removed.isdigit() else 0)
        if path in BLOCKED_FILES or path.startswith(BLOCKED_PREFIXES) or "=>" in path:
            reasons.append(f"손대면 안 되는 파일: {path}")
    if files > MAX_FILES:
        reasons.append(f"파일 {files}개 (최대 {MAX_FILES})")
    if lines > MAX_LINES:
        reasons.append(f"바뀐 줄 {lines}줄 (최대 {MAX_LINES})")
    return reasons


def main() -> int:
    reasons = check(sys.stdin.read())
    for r in reasons:
        print(r)
    return 1 if reasons else 0


if __name__ == "__main__":
    sys.exit(main())
