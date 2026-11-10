#!/usr/bin/env bash
# Explain a pull request's failed checks: print each one's ##[error] lines,
# and say when main's newest finished run of the same workflow fails that
# check too, which points at main or the runners rather than the PR. Reads
# `gh pr checks` output on stdin; run by merge-on-green.sh when a check fails.
# #114 spent two merge attempts on a WebKit launch failure main already had
# (#196), and reading the error took four calls. It shows 10 failed tests a
# check and counts the rest. Never fails: it only explains.
# Usage: gh pr checks <n> | scripts/explain-failed-checks.sh
set -uo pipefail

while IFS=$'\t' read -r name state _ url _; do
  [[ "$state" == "fail" && "$url" =~ /runs/([0-9]+)/job/([0-9]+) ]] || continue
  run=${BASH_REMATCH[1]}
  job=${BASH_REMATCH[2]}

  # Each failed test's title once (retries repeat it), with the first
  # "Error:" line under it, which holds the cause. Lines a step logs start
  # with a timestamp; a message's own lines don't.
  errors=$(gh api --allow-escape-sequences "repos/{owner}/{repo}/actions/jobs/$job/logs" 2>/dev/null |
    sed $'s/\x1b\\[[0-9;]*m//g' | awk -v url="$url" '
      /^[0-9-]+T[0-9:.]+Z / {
        wanted = 0
        # The step'"'"'s own closing error isn'"'"'t a failed test.
        if (sub(/^[^ ]* ##\[error\]/, "") && !/^Process completed with exit code/ &&
          !seen[$0]++ && shown++ < 10) {
          print
          wanted = 1
        }
        next
      }
      wanted && /^ *Error:/ { print; wanted = 0 }
      END { if (shown > 10) print "  …and " shown - 10 " more in the job'"'"'s log: " url }
    ')
  if [[ -n "$errors" ]]; then
    echo "$name failed with:"
    echo "$errors"
  fi

  workflow=$(gh api "repos/{owner}/{repo}/actions/runs/$run" --jq .workflow_id 2>/dev/null) || continue
  # Main's newest push run that ran to the end: ci.yml cancels a run the next
  # push supersedes, and a cancelled run's jobs end "cancelled", not "failure".
  latest=$(gh run list --branch main --workflow "$workflow" --event push --limit 20 \
    --json databaseId,url,conclusion \
    --jq '[.[] | select(.conclusion == "success" or .conclusion == "failure")][0] | "\(.databaseId)\t\(.url)"' 2>/dev/null) || continue
  main_run=${latest%%$'\t'*}
  main_url=${latest#*$'\t'}
  [[ "$main_run" =~ ^[0-9]+$ ]] || continue
  if gh api --paginate "repos/{owner}/{repo}/actions/runs/$main_run/jobs" \
    --jq '.jobs[] | select(.conclusion == "failure") | .name' 2>/dev/null | grep -qxF "$name"; then
    echo "main's newest finished push run of this workflow fails $name too ($main_url), so this PR may not be the cause. Look for an open issue (gh issue list) before rerunning it."
  fi
done
exit 0
