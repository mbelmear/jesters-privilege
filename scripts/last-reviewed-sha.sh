#!/usr/bin/env bash
# Print the commit named by a pull request's newest "Code review: passed at
# <sha>" comment, or nothing if it has none. Shared by require-review.sh
# (merge) and the post-merge audit so both read reviews the same way; the PR
# gate's lastReviewed (src/lib/pr-gate/review.ts) is held to the same reading
# by tests/unit/lib/pr-gate/review.test.ts.
# Usage: scripts/last-reviewed-sha.sh <pr-number>
set -euo pipefail

pr="${1:?Usage: scripts/last-reviewed-sha.sh <pr-number>}"

gh pr view "$pr" --json comments --jq '.comments[].body' |
  sed -n 's/^Code review: passed at \([0-9a-f]\{40\}\).*/\1/p' | tail -n 1
