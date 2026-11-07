#!/usr/bin/env bash
# Exit 0 if a pull request's newest "Code review: passed at <sha>" comment
# names the given head; otherwise say which commits still need a review and
# exit 1. Shared by `npm run merge` and `npm run mark-ready`, so both refuse
# an unreviewed head the same way. A head that adds only clean merges of main
# keeps its review (merged-main-only.sh), recorded as a comment on that head
# for the post-merge audit, which reads the same line.
# Usage: scripts/require-review.sh <pr-number> <head-sha> <action>
set -euo pipefail

usage="Usage: scripts/require-review.sh <pr-number> <head-sha> <action>"

pr="${1:?$usage}"
head="${2:?$usage}"
action="${3:?$usage}"

reviewed=$("$(dirname "$0")/last-reviewed-sha.sh" "$pr")
if [[ "$reviewed" != "$head" ]]; then
  if [[ -n "$reviewed" ]]; then
    # Unfetched, a merge of newer main looks like commits of the PR's own, and
    # the check below refuses.
    git fetch --quiet origin main "$head" || echo "Couldn't fetch main and $head; checking what's here." >&2
    if "$(dirname "$0")/merged-main-only.sh" "$reviewed" "$head" origin/main; then
      gh pr comment "$pr" --body "Code review: passed at $head (carried over from $reviewed: only clean merges of main since)"
      exit 0
    fi
  fi
  echo "Refusing to $action #$pr: head is $head, but the last passed review is at ${reviewed:-no commit}." >&2
  # Review only the new commits, unless a rebase dropped the reviewed one.
  since=origin/main
  if [[ -n "$reviewed" ]] && git merge-base --is-ancestor "$reviewed" "$head" 2>/dev/null; then
    since=$reviewed
  fi
  echo "Review it (docs/testing.md, Merging) with $since as the fixed point, then: npm run review-passed -- $pr $head" >&2
  exit 1
fi
