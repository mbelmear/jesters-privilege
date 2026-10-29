#!/usr/bin/env bash
# Merge a pull request only once every check has passed.
#
# GitHub Free doesn't enforce branch protection on this private repo, so this
# script is the enforcement: it waits for pending checks, stops at the first
# failure, and refuses to merge a PR with no checks at all.
#
# Usage: npm run merge -- <pr-number>
set -euo pipefail

pr="${1:?Usage: npm run merge -- <pr-number>}"

gh pr checks "$pr" --watch --fail-fast
gh pr merge "$pr" --squash --delete-branch
