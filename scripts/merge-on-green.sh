#!/usr/bin/env bash
# Merge a pull request only once its head commit has passed review and every
# check.
#
# GitHub Free doesn't enforce branch protection on this private repo, so this
# script is the enforcement. It refuses to merge unless:
#   1. the newest "Code review: passed at <sha>" comment names the PR's head,
#   2. the PR has at least one check, and
#   3. every check passes (it waits for pending ones, stops at the first failure).
# The merge is pinned to the reviewed commit, so a push during the wait fails it.
#
# Usage: npm run merge -- <pr-number>
set -euo pipefail

pr="${1:?Usage: npm run merge -- <pr-number>}"

head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)

reviewed=$("$(dirname "$0")/last-reviewed-sha.sh" "$pr")
if [[ "$reviewed" != "$head" ]]; then
  echo "Refusing to merge #$pr: head is $head, but the last passed review is at ${reviewed:-no commit}." >&2
  # Review only the new commits, unless a rebase dropped the reviewed one.
  since=origin/main
  if [[ -n "$reviewed" ]] && git merge-base --is-ancestor "$reviewed" "$head" 2>/dev/null; then
    since=$reviewed
  fi
  echo "Run /code-review with $since as the fixed point, then: gh pr comment $pr --body \"Code review: passed at $head\"" >&2
  exit 1
fi

checks=$(gh pr view "$pr" --json statusCheckRollup --jq '.statusCheckRollup | length')
if [[ "$checks" -eq 0 ]]; then
  echo "Refusing to merge #$pr: no checks reported yet. Wait for CI to start, then retry." >&2
  exit 1
fi

gh pr checks "$pr" --watch --fail-fast
gh pr merge "$pr" --squash --delete-branch --match-head-commit "$head"
