#!/usr/bin/env bash
# Record that /code-review passed on a pull request's head commit, as the
# "Code review: passed at <sha>" comment that `npm run merge` and
# `npm run mark-ready` require.
#
# It takes exactly two arguments, passes no other flags to gh, and refuses
# unless the reviewed commit is still the PR's head, or only clean merges of
# main follow it (merged-main-only.sh): a push after the review needs a review
# of its own. The pre-push hook can make that merge before the PR exists, so
# the reviewed commit was never a head to record (#114). merge and mark-ready
# carry a recorded review over later clean merges themselves (require-review.sh).
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
if [[ "$reviewed" == "$head" ]]; then
  gh pr comment "$pr" --body "Code review: passed at $head"
  exit 0
fi

# Unfetched, a merge of newer main looks like commits of the PR's own.
git fetch --quiet origin main "$head" || echo "Couldn't fetch main and $head; checking what's here." >&2
if "$(dirname "$0")/merged-main-only.sh" "$reviewed" "$head" origin/main; then
  gh pr comment "$pr" --body "Code review: passed at $head (reviewed $reviewed: only clean merges of main since)"
  exit 0
fi
own=$(git rev-list --no-merges "$reviewed..$head" --not origin/main 2>/dev/null || true)
if [[ -z "$own" ]] && git merge-base --is-ancestor "$reviewed" "$head" 2>/dev/null; then
  echo "Refusing: #$pr's head is $head, and a merge since $reviewed changes the PR's files, through main's change or one of its own. Review it with $reviewed as the fixed point (docs/testing.md, Merging: a merge of main that changes the PR's files), then record that review at $head." >&2
else
  echo "Refusing: #$pr's head is $head, but the review was of $reviewed. Review the new commits first." >&2
fi
exit 1
