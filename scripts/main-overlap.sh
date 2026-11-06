#!/usr/bin/env bash
# Commits main gained since a pull request branched off, in files it changes:
# one "<full sha> <subject>" a line, newest first, nothing if there are none.
# They merge cleanly and can still contradict what was reviewed. Used by
# merge-on-green.sh, which holds the merge until someone has read them.
# Usage: scripts/main-overlap.sh <pr head> <main>
set -euo pipefail

if (($# != 2)); then
  echo "Usage: main-overlap.sh <pr head> <main>" >&2
  exit 2
fi
head=$1
main=$2

base=$(git merge-base "$head" "$main")

files=()
# Raw names: a quoted one (an accented path) would match no file.
while IFS= read -r file; do files+=("$file"); done \
  < <(git -c core.quotePath=false diff --name-only "$base" "$head")
((${#files[@]})) || exit 0

git log --format='%H %s' "$base..$main" -- "${files[@]}"
