#!/usr/bin/env bash
# Check that a commit on main arrived the agreed way (AGENTS.md, Merging):
#   - a visual PR, labeled ready-for-human, merged by a Jester, or
#   - a logic/infra PR whose "Code review: passed at <sha>" names its final head.
# GitHub Free can't block a merge that skips npm run merge, so this runs after
# every push to main and fails loudly instead; a failed run emails the owner.
# Usage: scripts/audit-merge.sh <commit-sha>
set -euo pipefail

sha="${1:?Usage: scripts/audit-merge.sh <commit-sha>}"

pr=$(gh api "repos/{owner}/{repo}/commits/$sha/pulls" --jq '.[0].number // empty')
if [[ -z "$pr" ]]; then
  echo "::error::$sha reached main without a pull request."
  exit 1
fi

if gh pr view "$pr" --json labels --jq '.labels[].name' | grep -qx ready-for-human; then
  echo "#$pr is a visual PR (ready-for-human), merged by a Jester."
  exit 0
fi

head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
reviewed=$("$(dirname "$0")/last-reviewed-sha.sh" "$pr")
if [[ "$reviewed" != "$head" ]]; then
  echo "::error::#$pr merged at head $head, but its last passed review is at ${reviewed:-no commit}. Run /code-review on what landed and fix anything serious in a new PR."
  exit 1
fi
echo "#$pr merged at its reviewed head $head."
