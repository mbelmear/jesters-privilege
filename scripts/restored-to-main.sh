#!/usr/bin/env bash
# List every file the pull request changed at a reviewed commit that it no
# longer changes at its head: a fix round put the file back as main has it.
# A follow-up review skips these files, and the Spec review rechecks the ticket
# without them (docs/testing.md, Merging).
#
# Like merged-main-only.sh, it compares blobs against each commit's merge-base
# with main, so a merge of main in between doesn't count as a change.
# Usage: scripts/restored-to-main.sh <reviewed> <head> <main>
set -euo pipefail

if (($# != 3)); then
  echo "Usage: restored-to-main.sh <reviewed> <head> <main>" >&2
  exit 2
fi
reviewed=$1
head=$2
main=$3

changed() {
  git diff --name-only --no-renames "$(git merge-base "$1" "$main")" "$1"
}
# Each list first, not in a process substitution, whose failure set -e can't
# see: a head git can't read would otherwise list every file as restored.
was=$(changed "$reviewed" | sort)
now=$(changed "$head" | sort)
comm -23 <(printf '%s\n' "$was") <(printf '%s\n' "$now") | sed '/^$/d'
