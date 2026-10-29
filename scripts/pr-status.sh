#!/usr/bin/env bash
# Wait for a pull request's current head to finish CI and get its preview,
# then report: every check, the preview URL built from that head, and whether
# the PR merges cleanly with main. Exits 1 if a check fails or it conflicts.
# Read-only. Usage: npm run pr-status -- <pr-number>
set -euo pipefail

pr="${1:?Usage: npm run pr-status -- <pr-number>}"

state=$(gh pr view "$pr" --json state --jq .state)
if [[ "$state" != OPEN ]]; then
  echo "#$pr is $state; nothing to wait for."
  exit 1
fi
head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
echo "#$pr at ${head:0:7}"

# Checks appear a few seconds after a push.
for _ in $(seq 1 30); do
  [[ $(gh pr view "$pr" --json statusCheckRollup --jq '.statusCheckRollup | length') -gt 0 ]] && break
  sleep 5
done
failed=0
gh pr checks "$pr" --watch >/dev/null 2>&1 || failed=1
gh pr checks "$pr" | cut -f1,2

# The deploy workflow edits one comment per PR, naming the commit it built.
preview=""
for _ in $(seq 1 30); do
  comment=$(gh pr view "$pr" --json comments \
    --jq '[.comments[].body | select(startswith("<!-- deploy-preview -->"))] | last // ""')
  if [[ "$comment" == *"Built from $head"* ]]; then
    preview=$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' <<<"$comment" | head -1)
    break
  fi
  sleep 10
done
echo "Preview: ${preview:-none built from ${head:0:7} yet}"

mergeable=UNKNOWN
for _ in $(seq 1 10); do
  mergeable=$(gh pr view "$pr" --json mergeable --jq .mergeable)
  [[ "$mergeable" != UNKNOWN ]] && break
  sleep 6
done
echo "Merges cleanly with main: $([[ $mergeable == MERGEABLE ]] && echo yes || echo "no ($mergeable)")"

[[ $failed -eq 0 && $mergeable == MERGEABLE ]]
