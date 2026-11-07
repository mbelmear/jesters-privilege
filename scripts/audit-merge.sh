#!/usr/bin/env bash
# Check that a commit on main arrived the agreed way (docs/testing.md, Merging):
#   - a visual PR, labeled ready-for-human (merged by a Jester; agents merge
#     with the same GitHub login, so the label is the only signal; mark-ready
#     adds it only to a reviewed head, but a push after labelling goes
#     unchecked here), or
#   - a logic/infra PR whose "Code review: passed at <sha>" names its final head.
# main's ruleset requires passing checks but can't require the review comment,
# so a merge that skips npm run merge can still land; this runs after every
# push to main and fails loudly instead; a failed run emails whoever triggered it.
# Usage: scripts/audit-merge.sh <commit-sha>
set -euo pipefail

sha="${1:?Usage: scripts/audit-merge.sh <commit-sha>}"

# GitHub links a merge commit to its PR a few seconds after the merge.
pr=""
for _ in $(seq 1 6); do
  pr=$(gh api "repos/{owner}/{repo}/commits/$sha/pulls" --jq '.[0].number // empty')
  [[ -n "$pr" ]] && break
  sleep 10
done
if [[ -z "$pr" ]]; then
  echo "::error::$sha reached main without a pull request."
  exit 1
fi

labels=$(gh pr view "$pr" --json labels --jq '.labels[].name')
if grep -qx ready-for-human <<<"$labels"; then
  echo "#$pr is labeled ready-for-human, a visual PR for a Jester to merge."
  exit 0
fi

head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
reviewed=$("$(dirname "$0")/last-reviewed-sha.sh" "$pr")
if [[ "$reviewed" != "$head" ]]; then
  echo "::error::#$pr merged at head $head, but its last passed review is at ${reviewed:-no commit}. Run /code-review on what landed and fix anything serious in a new PR."
  exit 1
fi
echo "#$pr merged at its reviewed head $head."
