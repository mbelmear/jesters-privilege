#!/usr/bin/env bash
# Finish a ticket's worktree once its pull request has merged: remove the
# worktree, and delete its branch here and on GitHub. Pull requests are
# squash-merged, so git can't tell the branch is merged (`git branch -d`
# refuses); instead this checks that every file the branch changed reads the
# same in the merge commit, and refuses otherwise, or when the worktree holds
# uncommitted changes.
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
git fetch --quiet origin

dir=$(git worktree list --porcelain | awk -v ref="branch refs/heads/$branch" '
  /^worktree / { path = substr($0, 10) }
  $0 == ref { print path }')

if head=$(git rev-parse --verify --quiet "refs/heads/$branch"); then
  if [[ -n "$dir" && -n "$(git -C "$dir" status --porcelain)" ]]; then
    echo "Refusing: $dir has uncommitted changes." >&2
    exit 1
  fi
  base=$(git merge-base "$head" "$merge^")
  changed=()
  while IFS= read -r file; do changed+=("$file"); done \
    < <(git diff --name-only "$base" "$head")
  if ((${#changed[@]})) &&
    ! git diff --quiet "$head" "$merge" -- "${changed[@]}"; then
    echo "Refusing: $branch differs from #$pr's merge commit in:" >&2
    git diff --stat "$head" "$merge" -- "${changed[@]}" >&2
    exit 1
  fi
fi

if [[ -n "$dir" ]]; then
  git worktree remove "$dir"
  echo "Removed $dir"
fi
if [[ -n "${head:-}" ]]; then
  git branch -D "$branch"
fi
if git ls-remote --exit-code --heads origin "$branch" >/dev/null; then
  git push --quiet origin --delete "$branch"
  echo "Deleted $branch on GitHub"
fi
echo "#$pr is done."
