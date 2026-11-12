#!/usr/bin/env bash
# Exit 1, naming them, if merging a pull request would close an issue that
# neither its title names nor its body's first line closes. GitHub closes
# every issue that follows "fix", "close" or "resolve" in the body: #211's
# "Fix #209 before #145." closed #209 on merge. A ticket a PR means to close
# goes in its title or first line, as "Closes #181, closes #200." does.
# What the body and sidebar close comes from GitHub (closingIssuesReferences).
# The squash merge's body is the PR's commit messages (the repo's
# squash_merge_commit_message is COMMIT_MESSAGES), and GitHub closes what they
# name too, which that list leaves out: #213's commit quoted #211's line and
# closed #209 again. So commit messages are read for GitHub's keywords
# (close, closes, closed, fix, fixes, fixed, resolve, resolves, resolved, then
# an optional colon) before #N, owner/repo#N, or an issue's URL. gh cuts a long
# first line with "…" and opens the body with "…", so the two are rejoined.
# Shared by `npm run merge` and `npm run mark-ready`, which hands the merge
# to a Jester.
# Usage: scripts/closing-issues.sh <pr-number> <action>
set -euo pipefail

usage="Usage: scripts/closing-issues.sh <pr-number> <action>"
pr="${1:?$usage}"
action="${2:?$usage}"

unnamed=$(gh pr view "$pr" --json title,body,closingIssuesReferences,commits --jq '
  def closes:
    [scan("(?i)\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\\s+"
           + "(?:#|[\\w.-]+/[\\w.-]+#|https://github\\.com/[\\w.-]+/[\\w.-]+/issues/)"
           + "([0-9]+)")
     | .[0] | tonumber];
  ([.title | scan("#([0-9]+)") | .[0] | tonumber]
   + ((.body // "") + "\n" | split("\n")[0] | closes)) as $own
  | [.closingIssuesReferences[].number]
    + [.commits[]
       | .messageHeadline + "\n" + .messageBody
       | sub("…\n…"; "")
       | closes[]]
  | unique
  | map(select(. as $n | $own | any(. == $n) | not) | "#\(.)")
  | join(", ")')

if [[ -n "$unnamed" ]]; then
  {
    echo "Refusing to $action #$pr: merging it closes $unnamed, which neither its title names nor its body's first line closes."
    echo "GitHub closes an issue after \"fix\", \"close\" or \"resolve\" anywhere in the body or a commit message."
    echo "Reword that line (\"#209 needs fixing first\"; amend or rebase for a commit),"
    echo "or put \"Closes #N.\" in the body's first line if it should close, then rerun."
  } >&2
  exit 1
fi
