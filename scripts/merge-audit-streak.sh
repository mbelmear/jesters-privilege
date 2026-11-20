#!/usr/bin/env bash
# Claude Code SessionStart hook (.claude/settings.json): says when Merge audit
# has failed on the latest merges to main, each a PR merged without a passed
# review recorded at its head. It failed on 32 merges, #222 to #268, unread
# (#268's retro), so a session now opens with the streak: the merges since
# its last pass that didn't pass. A cancelled or skipped run is a merge that
# counts as neither; any other conclusion (failure, timed_out,
# startup_failure) is an audit that didn't pass.
# Prints to stdout, which the hook adds to the session's context.
set -euo pipefail

limit=20
if ! runs=$(gh run list --workflow merge-audit.yml --branch main --status completed \
  --limit "$limit" --json conclusion --jq '.[].conclusion' 2>/dev/null); then
  echo "Couldn't read Merge audit's runs (gh run list --workflow merge-audit.yml), so whether recent merges kept their review is unknown."
  exit 0
fi

failed=0
merges=0
passed=false
while IFS= read -r conclusion; do
  [[ -n "$conclusion" ]] || continue
  case "$conclusion" in
    success)
      passed=true
      break
      ;;
    cancelled | skipped) ;;
    *) failed=$((failed + 1)) ;;
  esac
  merges=$((merges + 1))
done <<<"$runs"
((failed > 0)) || exit 0

noun=merges
((merges == 1)) && noun=merge
of=""
((failed == merges)) || of="$failed of "
# Every run read and none passed: the streak may run further back. Fewer
# than the limit is the whole history.
since=""
[[ "$passed" == true ]] || ((merges < limit)) || since=", and none of the $limit runs read passed"
echo "Merge audit didn't pass on ${of}the last $merges $noun to main$since. It fails a merge without a passed review recorded at its head (docs/testing.md, Merging). Tell the user before merging anything else; gh run list --workflow merge-audit.yml shows which."
