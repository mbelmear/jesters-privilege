#!/usr/bin/env bash
# Mark a visual pull request ready for a Jester's review by adding the
# `ready-for-human` label, and nothing else. Labels only a head whose checks
# all pass, with its preview built and no conflict with main (pr-status.sh),
# so a Jester never reviews a preview that can't merge.
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

if ! "$(dirname "$0")/pr-status.sh" "$1"; then
  echo "Not labelled: #$1 needs every check green and a clean merge with main first." >&2
  exit 1
fi
gh pr edit "$1" --add-label ready-for-human
