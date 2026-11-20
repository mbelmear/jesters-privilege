#!/usr/bin/env bash
# Claude Code SessionStart hook (.claude/settings.json): says when Merge audit
# hasn't passed on the latest merges to main. It fails a merge with neither a
# passed review recorded at its head nor the ready-for-human label, and it
# failed on 32 merges, #222 to #268, unread (#268's retro), so a session now
# opens with the streak: the merges since its last pass that didn't pass. A
# cancelled or skipped run is a merge that counts as neither; any other
# conclusion (failure, timed_out, startup_failure) didn't pass.
# Prints to stdout, which the hook adds to the session's context.
set -euo pipefail

limit=20
if ! runs=$(gh run list --workflow merge-audit.yml --branch main --status completed \
  --limit "$limit" --json conclusion --jq '.[].conclusion' 2>/dev/null); then
  echo "Couldn't read Merge audit's runs (gh run list --workflow merge-audit.yml), so whether recent merges kept their review is unknown."
  exit 0
fi

not_passed=0
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
    *) not_passed=$((not_passed + 1)) ;;
  esac
  merges=$((merges + 1))
done <<<"$runs"
((not_passed > 0)) || exit 0

noun=merges
((merges == 1)) && noun=merge
of=""
((not_passed == merges)) || of="$not_passed of "
# Every run read and none passed: the streak may run further back. Fewer
# than the limit is the whole history.
none_passed_note=""
[[ "$passed" == true ]] || ((merges < limit)) || none_passed_note=", and none of the $limit runs read passed"
echo "Merge audit didn't pass on ${of}the last $merges $noun to main$none_passed_note. It fails a merge with neither a passed review recorded at its head nor the ready-for-human label (docs/testing.md, Merging). Tell the user before merging anything else; gh run list --workflow merge-audit.yml shows which."
