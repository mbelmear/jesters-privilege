#!/usr/bin/env bash
# Start a ticket in its own worktree, next to the main checkout, branched from a
# fresh origin/main, with dependencies installed. A bare `git worktree add` has
# no node_modules, so npx would quietly run some other copy of a tool.
# The worktree is ../jp-<issue>; a non-number such as retro-17 works too. If npm
# ci or typegen fails, cd in and rerun it rather than running this script again.
# It also says when the session's loaded rules are older than the worktree's.
# Usage: npm run worktree -- <issue> <branch>
set -euo pipefail

issue="${1:?Usage: npm run worktree -- <issue> <branch>}"
branch="${2:?Usage: npm run worktree -- <issue> <branch>}"

# The main checkout is the first worktree; new ones sit beside it.
main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
dir="$(dirname "$main")/jp-$issue"

git fetch --quiet origin
git worktree add "$dir" -b "$branch" origin/main
# typegen writes the route types, so a bare tsc agrees with npm run typecheck.
(cd "$dir" && npm ci --no-audit --no-fund && npx next typegen)

echo "Ready: $dir on $branch"
# A session loads the main checkout's AGENTS.md, which can lag origin/main.
if ! cmp -s "$main/AGENTS.md" "$dir/AGENTS.md"; then
  echo "AGENTS.md differs from the main checkout's, the one this session loaded: read $dir/AGENTS.md before starting."
fi
