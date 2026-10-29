#!/usr/bin/env bash
# Print whether a pull request merges cleanly with main: MERGEABLE,
# CONFLICTING, or UNKNOWN if GitHub still hasn't worked it out after a minute
# (it computes mergeability in the background).
# Usage: scripts/wait-mergeable.sh <pr-number>
set -euo pipefail

pr="${1:?Usage: scripts/wait-mergeable.sh <pr-number>}"

state=UNKNOWN
for _ in $(seq 1 10); do
  state=$(gh pr view "$pr" --json mergeable --jq .mergeable)
  [[ "$state" != UNKNOWN ]] && break
  sleep 6
done
echo "$state"
