#!/usr/bin/env bash
# Refuses a commit whose staged changes add leftover conflict markers. It runs
# before lint-staged because Prettier reformats markers into a Markdown file,
# and lint, typecheck, and unit tests don't read one, so a merge once committed
# them with every check passing. `git diff --check` also reports whitespace,
# which Prettier fixes and a Markdown line break needs, so only the markers count.
set -euo pipefail

markers=$(git diff --cached --check | grep 'leftover conflict marker$' || true)
if [[ -n $markers ]]; then
  echo "$markers" >&2
  echo "Resolve the conflict, stage the result, and commit again." >&2
  exit 1
fi
