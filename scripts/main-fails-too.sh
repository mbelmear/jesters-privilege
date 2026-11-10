#!/usr/bin/env bash
# Say when main's newest finished push run of a failed check's workflow fails
# that check too, which points at main or the runners rather than the PR.
# Given checks as gh pr checks prints them; merge-on-green.sh and pr-status.sh
# call it after failed-job-logs.sh. #194 spent two merge attempts on a WebKit
# launch failure main already had (#196). It only explains, so it never fails.
# Usage: scripts/main-fails-too.sh < <checks>
set -uo pipefail

# -e is left off on purpose: a lookup that fails is named below, and the run
# goes on to the next check.
compare() {
  local name=$1 run=$2 workflow latest main_run main_url failed
  workflow=$(gh api "repos/{owner}/{repo}/actions/runs/$run" --jq .workflow_id 2>/dev/null) || return 1
  # Main's newest push run that ran to the end: ci.yml cancels a run the next
  # push supersedes, and a cancelled run's jobs end "cancelled", not "failure".
  latest=$(gh run list --branch main --workflow "$workflow" --event push --limit 20 \
    --json databaseId,url,conclusion \
    --jq '[.[] | select(.conclusion == "success" or .conclusion == "failure")][0] | "\(.databaseId)\t\(.url)"' 2>/dev/null) || return 1
  main_run=${latest%%$'\t'*}
  main_url=${latest#*$'\t'}
  # None of the last 20 finished: nothing to compare with.
  [[ "$main_run" =~ ^[0-9]+$ ]] || return 0
  failed=$(gh api --paginate "repos/{owner}/{repo}/actions/runs/$main_run/jobs" \
    --jq '.jobs[] | select(.conclusion == "failure") | .name' 2>/dev/null) || return 1
  if grep -qxF "$name" <<<"$failed"; then
    echo "main's newest finished push run of this workflow fails $name too ($main_url), so this PR may not be the cause. Look for an open issue (gh issue list) before rerunning it."
  fi
}

while IFS=$'\t' read -r name state _ url _; do
  [[ "$state" == "fail" && "$url" =~ /runs/([0-9]+)/job/[0-9]+ ]] || continue
  compare "$name" "${BASH_REMATCH[1]}" || echo "Couldn't check main's newest run for $name: $url"
done
exit 0
