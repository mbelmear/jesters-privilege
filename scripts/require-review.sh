#!/usr/bin/env bash
# Exit 0 if a pull request's newest "Code review: passed at <sha>" comment
# names the given head; otherwise say which commits still need a review and
# exit 1. Shared by `npm run merge` and `npm run mark-ready`, so both refuse
# an unreviewed head the same way.
# Usage: scripts/require-review.sh <pr-number> <head sha> <what is refused>
set -euo pipefail

pr="${1:?Usage: scripts/require-review.sh <pr-number> <head sha> <action>}"
head="${2:?Usage: scripts/require-review.sh <pr-number> <head sha> <action>}"
action="${3:?Usage: scripts/require-review.sh <pr-number> <head sha> <action>}"

reviewed=$("$(dirname "$0")/last-reviewed-sha.sh" "$pr")
if [[ "$reviewed" != "$head" ]]; then
  echo "Refusing to $action #$pr: head is $head, but the last passed review is at ${reviewed:-no commit}." >&2
  # Review only the new commits, unless a rebase dropped the reviewed one.
  since=origin/main
  if [[ -n "$reviewed" ]] && git merge-base --is-ancestor "$reviewed" "$head" 2>/dev/null; then
    since=$reviewed
  fi
  echo "Run /code-review with $since as the fixed point, then: npm run review-passed -- $pr $head" >&2
  exit 1
fi
