#!/usr/bin/env bash
# Start a ticket in its own worktree, next to the main checkout, branched from a
# fresh origin/main, with dependencies installed. A bare `git worktree add` has
# no node_modules, so npx would quietly run some other copy of a tool.
# Usage: npm run worktree -- <issue-number> <branch>
set -euo pipefail

issue="${1:?Usage: npm run worktree -- <issue-number> <branch>}"
branch="${2:?Usage: npm run worktree -- <issue-number> <branch>}"

# The main checkout is the first worktree; new ones sit beside it.
main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
dir="$(dirname "$main")/jp-$issue"

git fetch --quiet origin
git worktree add "$dir" -b "$branch" origin/main
(cd "$dir" && npm ci --no-audit --no-fund)

echo "Ready: $dir on $branch"
