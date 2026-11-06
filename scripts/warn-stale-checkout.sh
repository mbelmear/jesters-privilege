#!/usr/bin/env bash
# Claude Code SessionStart hook (.claude/settings.json): says so when the main
# checkout is behind origin/main. A session loads AGENTS.md and runs scripts from
# the checkout it starts in, and the main checkout moves only when the human
# pulls, so a retro's fix can miss the very next session: #104's started 19
# commits behind, with an old CI wait and no overlap refusal in its steering.
# A ticket's worktree stays quiet: it falls behind as main moves, and the human
# has nothing to pull there.
# Prints to stdout, which the hook adds to the session's context. An unreachable
# origin falls back on the last fetch, and says so.
set -euo pipefail

main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
[[ "$(git rev-parse --show-toplevel)" == "$main" ]] || exit 0

if ! GIT_TERMINAL_PROMPT=0 git fetch --quiet origin main 2>/dev/null; then
  echo "Couldn't fetch origin, so the main checkout is compared with the last fetch of origin/main."
fi
behind=$(git rev-list --count HEAD..origin/main)
((behind > 0)) || exit 0

commits=commits
((behind == 1)) && commits=commit
echo "Main checkout is $behind $commits behind origin/main: its AGENTS.md and scripts are stale. Read git show origin/main:AGENTS.md."
