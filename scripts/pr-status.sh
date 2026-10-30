#!/usr/bin/env bash
# Wait for a pull request's current head to finish CI and get its preview,
# then report: every check, the preview URL built from that head, and whether
# the PR merges cleanly with main. Exits 1 if a check fails or it conflicts.
# Read-only. Usage: npm run pr-status -- <pr-number>
# mark-ready.sh reads the "Preview: https://" line; keep its shape.
set -euo pipefail

pr="${1:?Usage: npm run pr-status -- <pr-number>}"

state=$(gh pr view "$pr" --json state --jq .state)
if [[ "$state" != OPEN ]]; then
  echo "#$pr is $state; nothing to wait for."
  exit 1
fi
head=$("$(dirname "$0")/wait-pushed-head.sh" "$pr")
echo "#$pr at ${head:0:7}"

# A PR that already conflicts would only be refused after the checks, so say
# so now. Main can still move during the wait, so it's checked again at the end.
if [[ $("$(dirname "$0")/wait-mergeable.sh" "$pr") == CONFLICTING ]]; then
  echo "Merges cleanly with main: no (CONFLICTING); merge origin/main in and push first."
  exit 1
fi

# Checks appear a few seconds after a push.
for _ in $(seq 1 30); do
  [[ $(gh pr view "$pr" --json statusCheckRollup --jq '.statusCheckRollup | length') -gt 0 ]] && break
  sleep 5
done
failed=0
gh pr checks "$pr" --watch >/dev/null 2>&1 || failed=1
{ gh pr checks "$pr" || true; } | cut -f1,2

# The deploy workflow edits one comment per PR, naming the commit it built.
preview=""
for _ in $(seq 1 30); do
  comment=$(gh pr view "$pr" --json comments \
    --jq '[.comments[].body | select(startswith("<!-- deploy-preview -->"))] | last // ""')
  if [[ "$comment" == *"Built from $head"* ]]; then
    preview=$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' <<<"$comment" | head -1 || true)
    break
  fi
  sleep 10
done
echo "Preview: ${preview:-none built from ${head:0:7} yet}"

mergeable=$("$(dirname "$0")/wait-mergeable.sh" "$pr")
echo "Merges cleanly with main: $([[ $mergeable == MERGEABLE ]] && echo yes || echo "no ($mergeable)")"

[[ $failed -eq 0 && $mergeable == MERGEABLE ]]
