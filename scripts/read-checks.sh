#!/usr/bin/env bash
# Print a pull request's checks, and exit as gh pr checks does: 0 when all pass,
# 8 while any is pending, and 1 once any has failed or on another error. It reads
# again when gh can't connect, for up to half an hour, rather than ending a long
# wait over a dropped connection or a laptop's sleep.
# Usage: scripts/read-checks.sh <pr-number>
set -euo pipefail

pr="${1:?Usage: scripts/read-checks.sh <pr-number>}"
attempts=30
errors=$(mktemp)
trap 'rm -f "$errors"' EXIT

for ((attempt = 1; attempt <= attempts; attempt++)); do
  status=0
  results=$(gh pr checks "$pr" 2>"$errors") || status=$?
  if ! grep -Eq 'error connecting to|dial tcp|connection reset|timeout|EOF' "$errors"; then
    cat "$errors" >&2
    [[ -z $results ]] || echo "$results"
    exit "$status"
  fi
  ((attempt == attempts)) || sleep 60
done
echo "Couldn't reach GitHub to read #$pr's checks after $attempts tries. Run this again once it's back." >&2
exit 1
