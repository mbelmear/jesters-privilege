#!/usr/bin/env bash
# Finish a ticket's worktree once its pull request has merged: remove the
# worktree, and delete its branch here and on GitHub. Pull requests are
# squash-merged, so git can't tell the branch is merged (`git branch -d`
# refuses); instead merge-holds-branch.sh checks the merge commit holds the
# branch's work, and this refuses otherwise, when the worktree holds
# uncommitted changes, or when its folder survives removal. `npm run merge` already deletes the GitHub branch, so
# that step matters mostly for PRs merged in GitHub's UI, such as visual ones.
# Usage: npm run worktree-done -- <pr-number>
set -euo pipefail

pr="${1:?Usage: npm run worktree-done -- <pr-number>}"
holds="$(cd "$(dirname "$0")" && pwd)/merge-holds-branch.sh"

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
  "$holds" "$head" "$merge" || exit 1
done

# A folder git fails to delete stops being a worktree all the same (#175's
# kept 29 entries, node_modules among them), so the branch's config remembers
# it: a rerun, which git lists no worktree for, still checks it's gone.
# `git branch -D` drops the record with the branch.
if [[ -n "$dir" ]]; then
  git config "branch.$branch.worktree-folder" "$dir"
  git worktree remove "$dir" || true
else
  dir=$(git config "branch.$branch.worktree-folder" || true)
fi
if [[ -n "$dir" && -e "$dir" ]]; then
  echo "Refusing: $dir is still there. Close whatever has it open, delete it, and rerun." >&2
  exit 1
fi
if [[ -n "$dir" ]]; then
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
