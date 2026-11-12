#!/usr/bin/env bash
# Exit 1, naming them, if merging a pull request would close an issue that
# neither its title nor its body's first line names. GitHub closes every issue
# that follows "fix", "close" or "resolve" anywhere in the body: #211's
# "Fix #209 before #145." closed #209 on merge. A ticket a PR means to close
# goes in its title or first line, as "Closes #181, closes #200." does.
# Which issues GitHub will close comes from GitHub (closingIssuesReferences),
# so this never re-parses its keywords.
# Shared by `npm run merge` and `npm run mark-ready`, which hands the merge
# to a Jester.
# Usage: scripts/closing-issues.sh <pr-number> <action>
set -euo pipefail

usage="Usage: scripts/closing-issues.sh <pr-number> <action>"
pr="${1:?$usage}"
action="${2:?$usage}"

unnamed=$(gh pr view "$pr" --json title,body,closingIssuesReferences --jq '
  (.title + "\n" + (.body | split("\n")[0])) as $named
  | [.closingIssuesReferences[].number
     | select(. as $n | $named | test("#\($n)([^0-9]|$)") | not)
     | "#\(.)"]
  | join(", ")')

if [[ -n "$unnamed" ]]; then
  {
    echo "Refusing to $action #$pr: merging it closes $unnamed, which neither its title nor its body's first line names."
    echo "GitHub closes an issue after \"fix\", \"close\" or \"resolve\" anywhere in the body. Reword that line"
    echo "(\"#209 needs fixing first\"), or name the issue in the first line if it should close, then rerun."
  } >&2
  exit 1
fi
