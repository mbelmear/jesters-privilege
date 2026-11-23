#!/usr/bin/env bash
# Claude Code SessionStart hook (.claude/settings.json): says when GitHub's
# Actions allowlist and .github/allowed-actions.json differ. The unit tests
# check every workflow's `uses:` against the file, so a file behind the
# setting passes an action GitHub then refuses with `startup_failure`, as
# #281's first CI run hit (#287).
# Prints to stdout, which the hook adds to the session's context.
set -euo pipefail

# The repo the session opened, wherever its working directory is.
cd "${CLAUDE_PROJECT_DIR:-.}"

api="repos/{owner}/{repo}/actions/permissions/selected-actions"
file=.github/allowed-actions.json
# Key order and pattern order don't matter to GitHub, so neither counts.
canonical='{github_owned_allowed, patterns_allowed: (.patterns_allowed | sort), verified_allowed} | tojson'

if ! live=$(gh api "$api" 2>/dev/null) || ! live=$(jq -r "$canonical" <<<"$live" 2>/dev/null); then
  echo "Couldn't read GitHub's Actions allowlist (gh api '$api'), so whether $file matches it is unknown."
  exit 0
fi
if ! want=$(jq -r "$canonical" "$file" 2>/dev/null); then
  echo "Couldn't read $file, so whether it matches GitHub's Actions allowlist is unknown."
  exit 0
fi

[[ "$live" != "$want" ]] || exit 0
echo "GitHub's Actions allowlist (gh api '$api') differs from $file, which the unit tests check every workflow's uses: against. GitHub: $live. The file: $want. Tell the user, and make them match in a worktree (docs/testing.md, In CI)."
