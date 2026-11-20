#!/usr/bin/env bash
# Claude Code SessionStart hook (.claude/settings.json): says when Merge audit
# has failed on the latest merges to main, each a PR merged without a passed
# review recorded at its head. It failed on 32 merges, #222 to #268, unread
# (#268's retro), so a session now opens with the streak: the failures since
# its last pass, a cancelled or skipped run counting as neither.
# Prints to stdout, which the hook adds to the session's context.
set -euo pipefail

limit=20
if ! runs=$(gh run list --workflow merge-audit.yml --branch main --status completed \
  --limit "$limit" --json conclusion --jq '.[].conclusion' 2>/dev/null); then
  echo "Couldn't read Merge audit's runs (gh run list --workflow merge-audit.yml), so whether recent merges kept their review is unknown."
  exit 0
fi

failed=0
while IFS= read -r conclusion; do
  case "$conclusion" in
    success) break ;;
    failure) failed=$((failed + 1)) ;;
    *) ;;
  esac
done <<<"$runs"
((failed > 0)) || exit 0

count=$failed
((failed == limit)) && count="$limit or more"
merges=merges
((failed == 1)) && merges=merge
echo "Merge audit failed on the last $count $merges to main: each merged without a passed review recorded at its head (docs/testing.md, Merging). Tell the user before merging anything else; gh run list --workflow merge-audit.yml shows which."
