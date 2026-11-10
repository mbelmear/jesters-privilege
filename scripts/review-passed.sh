#!/usr/bin/env bash
# Record that /code-review passed on a pull request's head commit, as the
# "Code review: passed at <sha>" comment that `npm run merge` and
# `npm run mark-ready` require.
#
# It takes exactly two arguments, passes no other flags to gh, and refuses
# unless the reviewed commit is the PR's head, or only clean merges of main
# follow it (merged-main-only.sh): a push of the PR's own after the review
# needs a review of its own. The pre-push hook makes a branch merge main
# whenever main has moved, so a commit reviewed before its first push often
# reaches the PR under one (#193). merge and mark-ready carry a review over
# such merges to the head (require-review.sh).
#
# Usage: npm run review-passed -- <pr-number> <reviewed full SHA>
set -euo pipefail

usage="Usage: npm run review-passed -- <pr-number> <reviewed full SHA>"
if [[ $# -ne 2 || ! "$1" =~ ^[0-9]+$ || ! "$2" =~ ^[0-9a-f]{40}$ ]]; then
  echo "$usage" >&2
  exit 2
fi
pr=$1
reviewed=$2

# Straight after a push GitHub can still show the commit before it, so wait
# for it to catch up, as pr-status and mark-ready do (#115).
if ! head=$("$(dirname "$0")/wait-pushed-head.sh" "$pr"); then
  exit 1
fi
if [[ "$reviewed" != "$head" ]]; then
  # Unfetched, a merge of newer main looks like commits of the PR's own.
  git fetch --quiet origin main "$head" || echo "Couldn't fetch main and $head; checking what's here." >&2
fi
if [[ "$reviewed" != "$head" ]] &&
  ! "$(dirname "$0")/merged-main-only.sh" "$reviewed" "$head" origin/main; then
  echo "Refusing: #$pr's head is $head, but the review was of $reviewed. Review the new commits first." >&2
  exit 1
fi

gh pr comment "$pr" --body "Code review: passed at $reviewed"
