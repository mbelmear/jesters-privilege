#!/usr/bin/env bash
# Merge a pull request only once its head commit has passed review and every
# check.
#
# main's ruleset requires a pull request and passing checks, but nothing on
# GitHub requires the review comment, so this script is that enforcement. It
# refuses to merge unless:
#   1. the newest "Code review: passed at <sha>" comment names the PR's head, or
#      only clean merges of main came after it (require-review.sh),
#   2. the PR has at least one check (it waits for them to appear after a push),
#   3. it merges cleanly with main, checked throughout the wait, since a conflict
#      would only send the checks round again (#165 waited 45 minutes on one),
#   4. every check passes (it waits for pending ones, stops at the first failure),
#   5. nothing main gained meanwhile touches the PR's files, or the newest such
#      commit is the one passed to --overlap-read. Those commits merge cleanly
#      and can still contradict what was reviewed, as #155 did #156's new line.
# The merge is pinned to the reviewed commit, so a push during the wait fails it;
# GitHub's "Head branch was modified" with the head unchanged gets one retry.
#
# Usage: npm run merge -- <pr-number> [--overlap-read <sha>]
set -euo pipefail

usage="Usage: npm run merge -- <pr-number> [--overlap-read <sha>]"
pr="${1:?$usage}"
overlap_read=""
if (($# > 1)); then
  [[ "$#" -eq 3 && "$2" == "--overlap-read" ]] || {
    echo "$usage" >&2
    exit 2
  }
  overlap_read=$3
fi

head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)

"$(dirname "$0")/require-review.sh" "$pr" "$head" merge

refuse_if_conflicting() {
  # A failed fetch leaves the last one's answer, and the next round tries again.
  git fetch --quiet origin main "$head" || true
  # With a commit missing, merge-tree's exit 1 wouldn't mean a conflict.
  git cat-file -e "$head^{commit}" 2>/dev/null && git cat-file -e origin/main 2>/dev/null || return 0
  local merged=0
  git merge-tree --write-tree --quiet origin/main "$head" >/dev/null || merged=$?
  if ((merged == 1)); then
    echo "Refusing to merge #$pr: it conflicts with main. Merge origin/main in, fix it, and review again." >&2
    exit 1
  fi
}

# Checks appear a few seconds after a push, but never on a head pushed while it
# conflicts: GitHub skips pull_request runs then (docs/testing.md, Conflict watch).
checks=0
for _ in $(seq 1 30); do
  refuse_if_conflicting
  # A dropped connection counts as no checks yet.
  checks=$(gh pr view "$pr" --json statusCheckRollup --jq '.statusCheckRollup | length') || checks=0
  ((checks > 0)) && break
  sleep 5
done
if ((checks == 0)); then
  echo "Refusing to merge #$pr: no checks reported yet. Wait for CI to start, then retry." >&2
  exit 1
fi

while true; do
  refuse_if_conflicting
  status=0
  results=$("$(dirname "$0")/read-checks.sh" "$pr") || status=$?
  ((status == 8)) || break
  sleep 60
done
echo "$results"
if ((status != 0)); then
  "$(dirname "$0")/failed-job-logs.sh" <<<"$results" >&2
  "$(dirname "$0")/failed-on-main.sh" <<<"$results" >&2
  exit "$status"
fi

# After the wait, since that's when main moves.
git fetch --quiet origin main "$head"
refuse_if_conflicting
overlap=$("$(dirname "$0")/main-overlap.sh" "$head" origin/main)
newest=${overlap%%$'\n'*}
newest=${newest%% *}
if [[ -n "$overlap" && "$newest" != "$overlap_read" ]]; then
  {
    echo "Refusing to merge #$pr: main has gained commits in its files since it branched:"
    echo "$overlap"
    echo "Read them against the PR:  scripts/main-overlap.sh --patch $head origin/main"
    echo "If the PR still holds:  npm run merge -- $pr --overlap-read $newest"
    echo "If it needs changing, merge origin/main in, fix it, and review again."
  } >&2
  exit 1
fi

# GitHub once refused #193's merge with "Head branch was modified" while its
# head stood still, and merged it at the next try, so the retro of #177 gave
# that refusal of an unchanged head one more, after a pause for GitHub to
# settle; any other refusal stops here.
merge_pr() { gh pr merge "$pr" --squash --delete-branch --match-head-commit "$head"; }
errors=$(mktemp)
trap 'rm -f "$errors"' EXIT
if ! merge_pr 2>"$errors"; then
  cat "$errors" >&2
  grep -q "Head branch was modified" "$errors" || exit 1
  now=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
  if [[ "$now" != "$head" ]]; then
    echo "Refusing to merge #$pr: its head moved to $now during the merge. Review it, then rerun." >&2
    exit 1
  fi
  echo "#$pr's head is still ${head:0:7}; trying the merge once more." >&2
  sleep 10
  merge_pr
fi
echo "Merged #$pr, and the production deploy has started; a failure opens an issue. Next: npm run worktree-done -- $pr"
