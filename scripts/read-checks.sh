#!/usr/bin/env bash
# Print a pull request's checks, and exit as gh pr checks does: 0 when all pass,
# 8 while any is pending, 1 once any has failed. gh also exits 1 when it can't
# reach GitHub, but then reports no checks, so this reads again rather than
# ending a long wait over a dropped connection or a laptop's sleep. It gives up
# after half an hour.
# Usage: scripts/read-checks.sh <pr-number>
set -euo pipefail

pr="${1:?Usage: scripts/read-checks.sh <pr-number>}"
attempts=30

for ((attempt = 1; attempt <= attempts; attempt++)); do
  status=0
  results=$(gh pr checks "$pr") || status=$?
  if ((status == 0)) || [[ -n $results ]]; then
    echo "$results"
    exit "$status"
  fi
  ((attempt == attempts)) || sleep 60
done
echo "Couldn't read #$pr's checks after $attempts tries. Run this again once GitHub is back." >&2
exit 1
