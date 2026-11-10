#!/usr/bin/env bash
# For each failed check in read-checks.sh's output on stdin, print its failure
# annotations, which hold the error while the run's logs can't yet be read, and
# whether main's head fails the same check: if it does, CI itself is likely
# broken rather than the PR (#200; #196's runner image failed every PR at once).
# It only reports, so it exits 0 whatever GitHub answers.
# Usage: scripts/read-checks.sh <pr> | scripts/explain-failed-checks.sh
set -euo pipefail

lines=15

while IFS=$'\t' read -r name bucket _ link _; do
  [[ $bucket == fail ]] || continue
  echo
  echo "$name failed:"
  annotations=""
  if [[ $link =~ /job/([0-9]+) ]]; then
    # The runner adds "Process completed with exit code N." to every failure.
    annotations=$(gh api "repos/{owner}/{repo}/check-runs/${BASH_REMATCH[1]}/annotations" \
      --jq '.[] | select(.annotation_level == "failure") | .message
        | select(test("^Process completed with exit code [0-9]+\\.$") | not)' 2>/dev/null) || annotations=""
  fi
  if [[ -n $annotations ]]; then
    head -n "$lines" <<<"$annotations" | sed 's/^/  /'
    (($(wc -l <<<"$annotations") <= lines)) || echo "  ... the rest: $link"
  else
    echo "  no failure annotations; read its log: $link"
  fi
  main=$(gh api -X GET "repos/{owner}/{repo}/commits/main/check-runs" -f check_name="$name" \
    --jq 'if (.check_runs | length) == 0 then "none"
      else .check_runs | max_by(.started_at) | .conclusion // "pending" end' 2>/dev/null) || main=""
  case ${main:-unknown} in
    failure) echo "  main's head fails it too, so the cause is likely CI, not this PR." ;;
    success) echo "  main's head passes it." ;;
    pending) echo "  main's head is still running it." ;;
    none) echo "  main's head hasn't run it." ;;
    unknown) echo "  Couldn't read main's run of it." ;;
    *) echo "  main's head: $main." ;;
  esac
done
exit 0
