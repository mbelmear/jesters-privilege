#!/usr/bin/env bash
# Claude Code SessionStart hook (.claude/settings.json): says so when this
# checkout is behind origin/main. A session loads AGENTS.md and runs scripts from
# the checkout it starts in, and the main checkout moves only when the human
# pulls, so a retro's fix can miss the very next session: #104's started 19
# commits behind, with an old CI wait and no overlap refusal in its steering.
# Prints to stdout, which the hook adds to the session's context. An unreachable
# origin falls back on the last fetch.
set -euo pipefail

GIT_TERMINAL_PROMPT=0 git fetch --quiet origin main 2>/dev/null || true
behind=$(git rev-list --count HEAD..origin/main)
((behind > 0)) || exit 0

commits=commits
((behind == 1)) && commits=commit
echo "This checkout is $behind $commits behind origin/main, so the AGENTS.md and scripts loaded from it are stale. Before working, read the current steering with git show origin/main:AGENTS.md, and tell the human the main checkout needs a pull."
