#!/usr/bin/env bash
# Exit 1, naming the file, if a pull request changes the header, the footer, or
# the root layout and its body carries no `npm run lighthouse:compare` output:
# CODING_STANDARDS.md, Performance, "A change to the first screen shows its
# cost". #233 changed both and reached review without the run (#51). Review
# still judges the rest of that rule, what a page fetches before its paint.
# Shared by `npm run merge` and `npm run mark-ready`.
# Usage: scripts/first-screen-cost.sh <pr-number> <action>
set -euo pipefail

usage="Usage: scripts/first-screen-cost.sh <pr-number> <action>"
pr="${1:?$usage}"
action="${2:?$usage}"

# Every page renders these before its first paint.
changed=$(gh pr view "$pr" --json files,body --jq '
  if ((.body // "") | contains("lighthouse:compare")) then ""
  else [.files[].path
        | select(test("^src/(components/(site-header|header-frame|site-footer)\\.tsx|app/layout\\.tsx)$"))]
       | join(", ") end')

if [[ -n "$changed" ]]; then
  {
    echo "Refusing to $action #$pr: it changes $changed, and its body has no \`npm run lighthouse:compare\` output."
    echo "Run it against main (docs/testing.md, Performance), add its figures to the body, then rerun."
  } >&2
  exit 1
fi
