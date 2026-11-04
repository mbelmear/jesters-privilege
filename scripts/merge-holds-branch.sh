#!/usr/bin/env bash
# Whether a squash-merge commit holds all of a branch's work: exits 0 if it
# does, 1 (naming the files) if not. Used by worktree-done.sh before it
# deletes the branch.
# Usage: scripts/merge-holds-branch.sh <branch head> <merge commit>
set -euo pipefail

head="${1:?Usage: merge-holds-branch.sh <branch head> <merge commit>}"
merge="${2:?Usage: merge-holds-branch.sh <branch head> <merge commit>}"

base=$(git merge-base "$head" "$merge^")

# The same change, whatever else main gained first: a patch id ignores line
# numbers, so another PR editing the same file elsewhere doesn't count.
patch_id() { git diff "$1" "$2" | git patch-id --stable | cut -d' ' -f1; }
if [[ "$(patch_id "$base" "$head")" == "$(patch_id "$merge^" "$merge")" ]]; then
  exit 0
fi

# Otherwise, the merge commit's version of every file the branch changed.
changed=()
# Raw names: a quoted one (an accented path) would match no file.
while IFS= read -r file; do changed+=("$file"); done \
  < <(git -c core.quotePath=false diff --name-only "$base" "$head")
if ((${#changed[@]})) &&
  ! git diff --quiet "$head" "$merge" -- "${changed[@]}"; then
  echo "Refusing: ${head:0:7} differs from the merge commit ${merge:0:7} in:" >&2
  git diff --stat "$head" "$merge" -- "${changed[@]}" >&2
  exit 1
fi
