#!/usr/bin/env bash
# Explain a pull request's failed checks: print each one's ##[error] lines,
# and say when main's newest finished run of the same workflow fails that
# check too, which points at main or the runners rather than the PR. Reads
# `gh pr checks` output on stdin; run by merge-on-green.sh when a check fails.
# #114 spent two merge attempts on a WebKit launch failure main already had
# (#196), and reading the error took four calls. Never fails: it only explains.
# Usage: gh pr checks <n> | scripts/explain-failed-checks.sh
set -uo pipefail

while IFS=$'\t' read -r name state _ url; do
  [[ "$state" == "fail" && "$url" =~ /runs/([0-9]+)/job/([0-9]+) ]] || continue
  run=${BASH_REMATCH[1]}
  job=${BASH_REMATCH[2]}

  # Each failed test's title once (retries repeat it), with the first
  # "Error:" line under it, which holds the cause. Lines a step logs start
  # with a timestamp; a message's own lines don't.
  errors=$(gh api --allow-escape-sequences "repos/{owner}/{repo}/actions/jobs/$job/logs" 2>/dev/null |
    sed $'s/\x1b\\[[0-9;]*m//g' | awk '
      /^[0-9-]+T[0-9:.]+Z / {
        wanted = 0
        if (sub(/^[^ ]* ##\[error\]/, "") && !seen[$0]++ && shown++ < 10) {
          print
          wanted = 1
        }
        next
      }
      wanted && /^ *Error:/ { print; wanted = 0 }
    ')
  if [[ -n "$errors" ]]; then
    echo "$name failed with:"
    echo "$errors"
  fi

  workflow=$(gh api "repos/{owner}/{repo}/actions/runs/$run" --jq .workflow_id 2>/dev/null) || continue
  latest=$(gh run list --branch main --workflow "$workflow" --status completed --limit 1 \
    --json databaseId,url --jq '.[] | "\(.databaseId)\t\(.url)"' 2>/dev/null) || continue
  main_run=${latest%%$'\t'*}
  main_url=${latest#*$'\t'}
  [[ -n "$main_run" ]] || continue
  if gh api --paginate "repos/{owner}/{repo}/actions/runs/$main_run/jobs" \
    --jq '.jobs[] | select(.conclusion == "failure") | .name' 2>/dev/null | grep -qxF "$name"; then
    echo "main's newest finished run of this workflow fails $name too ($main_url), so this PR may not be the cause. Look for an open issue (gh issue list) before rerunning it."
  fi
done
exit 0
