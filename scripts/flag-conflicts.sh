#!/usr/bin/env bash
# Comment on a visual PR waiting for a Jester (ready-for-human) when it no
# longer merges cleanly with main, and remove the comment once it does, so the
# conflict is fixed before a Jester opens the preview. With no arguments it
# checks every open ready-for-human PR.
# Usage: scripts/flag-conflicts.sh [pr-number...]
set -euo pipefail

marker="<!-- conflicts-with-main -->"

if [[ $# -gt 0 ]]; then
  prs="$*"
else
  prs=$(gh pr list --state open --label ready-for-human --json number --jq '.[].number')
fi

for pr in $prs; do
  # GitHub works mergeability out in the background; UNKNOWN means not yet.
  state=UNKNOWN
  for _ in $(seq 1 10); do
    state=$(gh pr view "$pr" --json mergeable --jq .mergeable)
    [[ "$state" != UNKNOWN ]] && break
    sleep 6
  done

  id=$(gh api "repos/{owner}/{repo}/issues/$pr/comments" --paginate \
    --jq ".[] | select(.body | startswith(\"$marker\")) | .id" | head -1)

  case "$state" in
    CONFLICTING)
      main=$(git ls-remote origin refs/heads/main | cut -c1-7)
      body=$(printf '%s\n**Conflicts with main** (as of %s). Merge `origin/main` into this branch and resolve before a Jester reviews the preview.' "$marker" "$main")
      if [[ -n "$id" ]]; then
        gh api -X PATCH "repos/{owner}/{repo}/issues/comments/$id" -f body="$body" >/dev/null
      else
        gh pr comment "$pr" --body "$body" >/dev/null
      fi
      echo "#$pr conflicts with main"
      ;;
    MERGEABLE)
      [[ -n "$id" ]] && gh api -X DELETE "repos/{owner}/{repo}/issues/comments/$id"
      echo "#$pr merges cleanly"
      ;;
    *)
      echo "::warning::GitHub hasn't worked out whether #$pr merges cleanly; skipped"
      ;;
  esac
done
