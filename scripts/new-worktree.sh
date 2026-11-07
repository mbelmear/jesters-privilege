#!/usr/bin/env bash
# Start a ticket in its own worktree, next to the main checkout, branched from a
# fresh origin/main, with dependencies installed. A bare `git worktree add` has
# no node_modules, so npx would quietly run some other copy of a tool.
# The worktree is ../jp-<issue>; a non-number such as retro-17 works too. If npm
# ci or typegen fails, cd in and rerun it rather than running this script again.
# npm run worktree fetches, then runs origin/main's copy of this script, so a
# main checkout that is behind still gets today's setup.
# Usage: npm run worktree -- <issue> <branch>
set -euo pipefail

issue="${1:?Usage: npm run worktree -- <issue> <branch>}"
branch="${2:?Usage: npm run worktree -- <issue> <branch>}"

# Without one, git guesses from the hostname, and stops committing when that
# changes, as it did midway through merging #179.
if ! git config user.email >/dev/null; then
  cat >&2 <<'MSG'
Set your git identity first, with your name and GitHub's noreply address:
  git config --global user.name "<name>"
  git config --global user.email "<id>+<login>@users.noreply.github.com"
MSG
  exit 1
fi

# The main checkout is the first worktree; new ones sit beside it.
main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
dir="$(dirname "$main")/jp-$issue"

git worktree add "$dir" -b "$branch" origin/main
# typegen writes the route types, so a bare tsc agrees with npm run typecheck.
(cd "$dir" && npm ci --no-audit --no-fund && npx next typegen)

echo "Ready: $dir on $branch"
