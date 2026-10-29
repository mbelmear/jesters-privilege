#!/usr/bin/env bash
# Mark a visual pull request ready for a Jester's review by adding the
# `ready-for-human` label, and nothing else.
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

gh pr edit "$1" --add-label ready-for-human
