#!/usr/bin/env bash
# Run by the pre-commit hook: when the staged changes touch a first-screen file
# (first-screen-files.sh), says to run `npm run lighthouse:compare` before
# review, while there's time to act on it. It only warns; merge and mark-ready
# refuse the PR without the run (first-screen-cost.sh). #247 changed one line
# of src/app/layout.tsx and found the rule only when opening its PR, after
# review (docs/testing.md, Merging).
set -euo pipefail

files=$(git diff --cached --name-only | "$(dirname "$0")/first-screen-files.sh")
if [[ -n "$files" ]]; then
  joined=$(paste -sd, - <<<"$files")
  {
    echo "This commit changes ${joined//,/, }, on the first screen."
    echo "Run \`npm run lighthouse:compare\` before review and put its figures in the PR body (docs/testing.md, Merging)."
  } >&2
fi
