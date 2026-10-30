#!/usr/bin/env bash
# Mark a visual pull request ready for a Jester's review by adding the
# `ready-for-human` label; it changes nothing but the label. First it waits on
# pr-status.sh and labels only when every check passes, the preview is built
# from the head, and the PR merges cleanly with main, so a Jester never
# reviews a preview that can't merge. A push during that wait is refused,
# as its head was never checked.
#
# It takes exactly one argument, a PR number, and passes no other flags to gh.
#
# Usage: npm run mark-ready -- <pr-number>
set -euo pipefail

usage="Usage: npm run mark-ready -- <pr-number>"
if [[ $# -ne 1 || ! "$1" =~ ^[0-9]+$ ]]; then
  echo "$usage" >&2
  exit 2
fi
pr=$1

head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
if ! status=$("$(dirname "$0")/pr-status.sh" "$pr"); then
  echo "$status"
  echo "Refusing to label #$pr: it needs every check green and a clean merge with main." >&2
  exit 1
fi
echo "$status"
if ! grep -q '^Preview: https://' <<<"$status"; then
  echo "Refusing to label #$pr: no preview built from its head yet." >&2
  exit 1
fi
if [[ $(gh pr view "$pr" --json headRefOid --jq .headRefOid) != "$head" ]]; then
  echo "Refusing to label #$pr: its head moved while checks ran; run it again." >&2
  exit 1
fi
gh pr edit "$pr" --add-label ready-for-human
