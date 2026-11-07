#!/usr/bin/env bash
# Exit 0 if everything after a reviewed commit is merges of main that leave the
# pull request's own changes as they were, so the review still holds; otherwise
# exit 1. The pre-push hook makes a branch merge main whenever main has moved,
# which with several sessions merging is most pushes.
#
# It compares the blobs of every file the PR changes, before and after, so main
# touching one of those files, or a merge commit adding a change of its own,
# refuses. main-overlap.sh sees only the first, and only commits still to merge. What it can't see is main changing something the PR relies on in
# another file; CI runs on the merged code.
# Usage: scripts/merged-main-only.sh <reviewed> <head> <main>
set -euo pipefail

if (($# != 3)); then
  echo "Usage: merged-main-only.sh <reviewed> <head> <main>" >&2
  exit 2
fi
reviewed=$1
head=$2
main=$3

git merge-base --is-ancestor "$reviewed" "$head" || exit 1

own=$(git rev-list --no-merges "$reviewed..$head" --not "$main")
[[ -z "$own" ]] || exit 1

changes() {
  git diff --raw --no-renames --abbrev=40 "$(git merge-base "$1" "$main")" "$1"
}
[[ "$(changes "$reviewed")" == "$(changes "$head")" ]]
