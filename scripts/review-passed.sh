#!/usr/bin/env bash
# Record that /code-review passed on a pull request's head commit, as the
# "Code review: passed at <sha>" comment that `npm run merge` and
# `npm run mark-ready` require.
#
# It takes exactly two arguments, passes no other flags to gh, and refuses
# unless the reviewed commit is still the PR's head: a push after the review
# needs a review of its own.
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
  echo "Refusing: #$pr's head is $head, but the review was of $reviewed. Review the new commits first." >&2
  exit 1
fi

gh pr comment "$pr" --body "Code review: passed at $head"
