#!/usr/bin/env bash
# Print a pull request's head commit. Run from a checkout of the PR's branch,
# it first waits for GitHub to show the commit checked out here, so a
# review-passed run straight after `git push` checks that commit, not the
# one before it (#57). pr-status and mark-ready do the same in
# src/lib/pr-gate/snapshot.ts, which replaces this as the other commands move
# there (#250). Fails if GitHub still shows another commit
# after a minute: push or pull until they match.
# Usage: scripts/wait-pushed-head.sh <pr-number>
set -euo pipefail

pr="${1:?Usage: scripts/wait-pushed-head.sh <pr-number>}"

branch=$(gh pr view "$pr" --json headRefName --jq .headRefName)
local_head=""
# Run outside the branch's checkout, there's no local head to wait for.
# shellcheck disable=SC2312
if [[ $(git rev-parse --abbrev-ref HEAD 2>/dev/null) == "$branch" ]]; then
  local_head=$(git rev-parse HEAD)
fi

for _ in $(seq 1 12); do
  head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
  if [[ -z "$local_head" || "$head" == "$local_head" ]]; then
    echo "$head"
    exit 0
  fi
  sleep 5
done
echo "#$pr is at ${head:0:7} on GitHub, but $branch here is at ${local_head:0:7}; push or pull until they match." >&2
exit 1
