#!/usr/bin/env bash
# For each failed check in read-checks.sh's output on stdin, say whether main's
# head fails the same check: if it does, CI itself is likely broken rather than
# the PR (#200; #196's runner image failed every PR at once, and #192's stop
# took eight lookups to tell from a broken PR). failed-job-logs.sh says why the
# job failed; this says whose failure it likely is. merge-on-green.sh calls
# both once its wait ends; pr-status does the same in
# src/lib/pr-gate/failed-checks.ts, which replaces both once merge moves there (#250).
# It only reports, so it exits 0 whatever GitHub answers.
# Usage: scripts/failed-on-main.sh < <checks>
set -euo pipefail

failed=$(awk -F'\t' '$2 == "fail" { print $1 }')
while IFS= read -r name; do
  [[ -n "$name" ]] || continue
  main=$(gh api -X GET "repos/{owner}/{repo}/commits/main/check-runs" -f check_name="$name" \
    --jq 'if (.check_runs | length) == 0 then "none"
      else .check_runs | max_by(.started_at) | .conclusion // "pending" end' 2>/dev/null) || main=""
  case ${main:-unknown} in
    failure) echo "$name: main's head fails it too, so the cause is likely CI, not this PR." ;;
    success) echo "$name: main's head passes it." ;;
    pending) echo "$name: main's head is still running it." ;;
    none) echo "$name: main's head hasn't run it." ;;
    unknown) echo "$name: couldn't read main's run of it." ;;
    *) echo "$name: main's head ended it as $main." ;;
  esac
done <<<"$failed"
exit 0
