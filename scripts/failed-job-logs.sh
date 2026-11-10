#!/usr/bin/env bash
# Print each failed check's job log from its first error on, given checks as
# gh pr checks prints them (read-checks.sh). A failed job's link says only that
# it failed; its log says why. The jobs API serves a finished job's log while
# the rest of its run goes on, where gh run view --log-failed waits for the
# whole run: #193 took five calls to find a missing library without this.
# merge-on-green.sh and pr-status.sh call it once their wait ends.
# Usage: scripts/failed-job-logs.sh < <checks>
set -euo pipefail

while IFS=$'\t' read -r name url; do
  # https://github.com/<owner>/<repo>/actions/runs/<run>/job/<job>
  job_logs=$(sed -E 's#^https://github.com/([^/]+/[^/]+)/actions/runs/[0-9]+/job/([0-9]+).*#repos/\1/actions/jobs/\2/logs#' <<<"$url")
  if ! log=$(gh api --allow-escape-sequences "$job_logs" 2>/dev/null); then
    echo "Couldn't read $name's log: $url"
    continue
  fi
  # Without the colours and the timestamps the runner adds.
  errors=$(sed -E $'s/\x1b\\[[0-9;]*m//g; s/^[0-9T:.-]+Z //' <<<"$log" |
    awk '/##\[error\]/ { found = 1 } found && n++ < 20')
  if [[ -z $errors ]]; then
    echo "$name failed, with no ##[error] line in its log: $url"
    continue
  fi
  echo "$name failed:"
  echo "$errors"
done < <(awk -F'\t' '$2 == "fail" && $4 ~ /\/job\/[0-9]+/ { print $1 "\t" $4 }')
