#!/usr/bin/env bash
# Merge a pull request only once its head commit has passed review and every
# check.
#
# main's ruleset requires a pull request and passing checks, but nothing on
# GitHub requires the review comment, so this script is that enforcement. It
# refuses to merge unless:
#   1. the newest "Code review: passed at <sha>" comment names the PR's head
#      (require-review.sh),
#   2. the PR has at least one check, and
#   3. every check passes (it waits for pending ones, stops at the first failure).
# The merge is pinned to the reviewed commit, so a push during the wait fails it.
#
# Usage: npm run merge -- <pr-number>
set -euo pipefail

pr="${1:?Usage: npm run merge -- <pr-number>}"

head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)

"$(dirname "$0")/require-review.sh" "$pr" "$head" merge

checks=$(gh pr view "$pr" --json statusCheckRollup --jq '.statusCheckRollup | length')
if [[ "$checks" -eq 0 ]]; then
  echo "Refusing to merge #$pr: no checks reported yet. Wait for CI to start, then retry." >&2
  exit 1
fi

gh pr checks "$pr" --watch --fail-fast
gh pr merge "$pr" --squash --delete-branch --match-head-commit "$head"
