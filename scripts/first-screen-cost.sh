#!/usr/bin/env bash
# Exit 1, naming the file, if a pull request changes the header, the footer, or
# the root layout and its body carries no `npm run lighthouse:compare` output:
# CODING_STANDARDS.md, Performance, "A change to the first screen shows its
# cost". #233 changed the header and footer and reached review without the
# run (#51). Review still judges the rest of that rule: what these files render
# (the mobile menu, the player dock) and what a page fetches before its paint.
# Shared by `npm run merge` and `npm run mark-ready`.
# Usage: scripts/first-screen-cost.sh <pr-number> <action>
set -euo pipefail

usage="Usage: scripts/first-screen-cost.sh <pr-number> <action>"
pr="${1:?$usage}"
action="${2:?$usage}"

has_run=$(gh pr view "$pr" --json body --jq '(.body // "") | contains("lighthouse:compare")')
if [[ $has_run == true ]]; then
  exit 0
fi
paths=$(gh pr view "$pr" --json files --jq '.files[].path')
first_screen=$("$(dirname "$0")/first-screen-files.sh" <<<"$paths")
joined=$(paste -sd, - <<<"$first_screen")
changed=${joined//,/, }

if [[ -n "$changed" ]]; then
  {
    echo "Refusing to $action #$pr: it changes $changed, and its body has no \`npm run lighthouse:compare\` output."
    echo "Run it against main (docs/testing.md, Performance), add its figures to the body, then rerun."
  } >&2
  exit 1
fi
