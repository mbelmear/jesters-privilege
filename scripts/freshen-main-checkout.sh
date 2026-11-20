#!/usr/bin/env bash
# Claude Code SessionStart hook (.claude/settings.json): brings the main
# checkout up to origin/main, or says it's behind when it can't.
# A session loads AGENTS.md and runs scripts from the checkout it starts in, so
# a stale one misses the latest retro's fix: #104's started 19 commits behind,
# with an old CI wait and no overlap refusal in its steering. A warning wasn't
# enough: #224's started 22 behind and missed a rule only origin/main's
# AGENTS.md had. So a clean main fast-forwards; the human's edits, another
# branch, or a commit of their own keep the warning instead.
# A ticket's worktree stays quiet: it falls behind as main moves, and its
# branch isn't main.
# Prints to stdout, which the hook adds to the session's context. An unreachable
# origin falls back on the last fetch, and says so.
set -euo pipefail

main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
# Once git worktree list has read the checkout, rev-parse can't fail in it.
# shellcheck disable=SC2312
[[ "$(git rev-parse --show-toplevel)" == "$main" ]] || exit 0

if ! GIT_TERMINAL_PROMPT=0 "$(dirname "$0")/fetch.sh" --quiet origin main 2>/dev/null; then
  echo "Couldn't fetch origin, so the main checkout is compared with the last fetch of origin/main."
fi
behind=$(git rev-list --count HEAD..origin/main)
((behind > 0)) || exit 0

commits=commits
((behind == 1)) && commits=commit

before=$(git rev-parse HEAD)
branch=$(git symbolic-ref --quiet --short HEAD || true)
changes=$(git status --porcelain --untracked-files=no)
if [[ "$branch" == main && -z "$changes" ]] &&
  git merge --quiet --ff-only origin/main >/dev/null 2>&1; then
  echo "Fast-forwarded the main checkout $behind $commits to origin/main."
  if ! git diff --quiet "$before" HEAD -- AGENTS.md; then
    echo "AGENTS.md changed, and this session may have loaded it before: read it again."
  fi
  exit 0
fi

echo "Main checkout is $behind $commits behind origin/main: its AGENTS.md and scripts are stale. Read git show origin/main:AGENTS.md."
