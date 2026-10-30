#!/usr/bin/env bash
# Finish a ticket's worktree once its pull request has merged: remove the
# worktree, and delete its branch here and on GitHub. Pull requests are
# squash-merged, so git can't tell the branch is merged (`git branch -d`
# refuses); instead this checks that every file the branch changed reads the
# same in the merge commit, and refuses otherwise, or when the worktree holds
# uncommitted changes. `npm run merge` already deletes the GitHub branch, so
# that step matters mostly for PRs merged in GitHub's UI, such as visual ones.
# Usage: npm run worktree-done -- <pr-number>
set -euo pipefail

pr="${1:?Usage: npm run worktree-done -- <pr-number>}"

read -r state branch merge < <(gh pr view "$pr" \
  --json state,headRefName,mergeCommit \
  -q '"\(.state) \(.headRefName) \(.mergeCommit.oid // "-")"')
if [[ "$state" != MERGED ]]; then
  echo "Refusing: #$pr is $state, not MERGED." >&2
  exit 1
fi

# Work from the main checkout, the first worktree, so removing the ticket's
# worktree never pulls the ground from under this script.
main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
cd "$main"
git fetch --quiet --prune origin

dir=$(git worktree list --porcelain | awk -v ref="branch refs/heads/$branch" '
  /^worktree / { path = substr($0, 10) }
  $0 == ref { print path }')

local_head=$(git rev-parse --verify --quiet "refs/heads/$branch" || true)
remote_head=$(git rev-parse --verify --quiet "refs/remotes/origin/$branch" || true)

if [[ -n "$dir" && -n "$(git -C "$dir" status --porcelain)" ]]; then
  echo "Refusing: $dir has uncommitted changes." >&2
  exit 1
fi
# Each copy of the branch still here must hold what was merged.
for head in $local_head $remote_head; do
  base=$(git merge-base "$head" "$merge^")
  changed=()
  # Raw names: a quoted one (an accented path) would match no file.
  while IFS= read -r file; do changed+=("$file"); done \
    < <(git -c core.quotePath=false diff --name-only "$base" "$head")
  if ((${#changed[@]})) &&
    ! git diff --quiet "$head" "$merge" -- "${changed[@]}"; then
    echo "Refusing: $branch at ${head:0:7} differs from #$pr's merge commit in:" >&2
    git diff --stat "$head" "$merge" -- "${changed[@]}" >&2
    exit 1
  fi
done

if [[ -n "$dir" ]]; then
  git worktree remove "$dir"
  echo "Removed $dir"
fi
if [[ -n "$local_head" ]]; then
  git branch -D "$branch"
fi
if [[ -n "$remote_head" ]]; then
  git push --quiet origin --delete "$branch"
  echo "Deleted $branch on GitHub"
fi
echo "#$pr is done."
