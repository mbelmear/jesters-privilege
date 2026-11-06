#!/usr/bin/env bash
# Commits main gained since a pull request branched off, in files it changes:
# one "<full sha> <subject>" a line, newest first, nothing if there are none.
# They merge cleanly and can still contradict what was reviewed. Used by
# merge-on-green.sh, which holds the merge until someone has read them; --patch
# shows what those commits changed in those files, to read them by.
# Usage: scripts/main-overlap.sh [--patch] <pr head> <main>
set -euo pipefail

format=(--format='%H %s')
if [[ ${1:-} == --patch ]]; then
  format=(--patch)
  shift
fi

if (($# != 2)); then
  echo "Usage: main-overlap.sh [--patch] <pr head> <main>" >&2
  exit 2
fi
head=$1
main=$2

base=$(git merge-base "$head" "$main")

files=()
# Raw names: a quoted one (an accented path) would match no file. Both sides
# of a rename: main can still be editing the old name.
while IFS= read -r file; do files+=("$file"); done \
  < <(git -c core.quotePath=false diff --no-renames --name-only "$base" "$head")
((${#files[@]})) || exit 0

git log "${format[@]}" "$base..$main" -- "${files[@]}"
