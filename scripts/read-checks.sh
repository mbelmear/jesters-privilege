#!/usr/bin/env bash
# Print a pull request's checks, and exit as gh pr checks does: 0 when all pass,
# 8 while any is pending, and 1 once any has failed or on another error. Unlike
# gh, it also exits 1 once any was cancelled, naming it. It reads again when gh
# can't connect, for up to half an hour, rather than ending a long wait over a
# dropped connection or a laptop's sleep.
# Usage: scripts/read-checks.sh <pr-number>
set -euo pipefail

pr="${1:?Usage: scripts/read-checks.sh <pr-number>}"
attempts=30
errors=$(mktemp)
trap 'rm -f "$errors"' EXIT

# A failed job's link says only that it failed; its log says why. For each
# failed job this prints its log from the first error on, read through the
# jobs API, which serves a finished job's log while the rest of its run goes on
# (gh run view --log-failed waits for the whole run). #193 took five calls to
# find a missing library without it.
print_failed_jobs_errors() {
  local name url log
  while IFS=$'\t' read -r name url; do
    if log=$(gh api --allow-escape-sequences "repos/$(sed -E 's#^https://github.com/([^/]+/[^/]+)/actions/runs/[0-9]+/job/([0-9]+).*#\1/actions/jobs/\2#' <<<"$url")/logs" 2>/dev/null); then
      echo "$name failed:" >&2
      # Without the colours and the timestamps the runner adds.
      sed -E $'s/\x1b\\[[0-9;]*m//g; s/^[0-9T:.-]+Z //' <<<"$log" |
        awk '/##\[error\]/ { found = 1 } found && n++ < 20' >&2
    else
      echo "Couldn't read $name's log: $url" >&2
    fi
  done < <(awk -F'\t' '$2 == "fail" && $4 ~ /\/job\/[0-9]+/ { print $1 "\t" $4 }' <<<"$1")
}

for ((attempt = 1; attempt <= attempts; attempt++)); do
  status=0
  results=$(gh pr checks "$pr" 2>"$errors") || status=$?
  if ! grep -Eq 'error connecting to|dial tcp|connection reset|timeout|EOF' "$errors"; then
    cat "$errors" >&2
    [[ -z $results ]] || echo "$results"
    print_failed_jobs_errors "$results"
    # gh counts a cancelled check as neither failed nor pending, so exits 0.
    cancelled=$(awk -F'\t' '$2 == "cancel" { print $1 " was cancelled. Rerun it from its run: " $4 }' <<<"$results")
    if [[ -n $cancelled ]]; then
      echo "$cancelled" >&2
      exit 1
    fi
    exit "$status"
  fi
  ((attempt == attempts)) || sleep 60
done
echo "Couldn't reach GitHub to read #$pr's checks after $attempts tries. Run this again once it's back." >&2
exit 1
