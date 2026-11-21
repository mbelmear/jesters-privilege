#!/usr/bin/env bash
# Print the commit named by a pull request's newest "Code review: passed at
# <sha>" comment, or nothing if it has none, for the post-merge audit. The
# PR gate's lastReviewed (src/lib/pr-gate/review.ts) is held to the same
# reading by tests/unit/scripts/last-reviewed-sha.test.ts. It reads every
# comment, where the gate counts only those from accounts with write access:
# the gate's own carried-over review is posted by github-actions[bot].
# Usage: scripts/last-reviewed-sha.sh <pr-number>
set -euo pipefail

pr="${1:?Usage: scripts/last-reviewed-sha.sh <pr-number>}"

gh pr view "$pr" --json comments --jq '.comments[].body' |
  sed -n 's/^Code review: passed at \([0-9a-f]\{40\}\).*/\1/p' | tail -n 1
