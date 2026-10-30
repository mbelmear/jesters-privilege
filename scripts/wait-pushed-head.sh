#!/usr/bin/env bash
# Print a pull request's head commit. Run from a checkout of the PR's branch,
# it first waits for GitHub to show the commit checked out here, so a
# pr-status or mark-ready run straight after `git push` checks that commit,
# not the one before it (#57). Fails if GitHub still shows another commit
# after a minute: push first, or check out the PR's branch.
# Usage: scripts/wait-pushed-head.sh <pr-number>
set -euo pipefail

pr="${1:?Usage: scripts/wait-pushed-head.sh <pr-number>}"

branch=$(gh pr view "$pr" --json headRefName --jq .headRefName)
local_head=""
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
echo "#$pr is at ${head:0:7} on GitHub, but $branch here is at ${local_head:0:7}; push it first." >&2
exit 1
