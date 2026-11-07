#!/usr/bin/env bash
# Refuses a commit whose staged changes add leftover conflict markers. It runs
# before lint-staged because Prettier reformats markers into a Markdown file,
# and lint, typecheck, and unit tests don't read one, so a merge once committed
# them with every check passing. `git diff --check` also reports whitespace,
# which Prettier fixes and a Markdown line break needs, so only the markers count.
set -euo pipefail

# git exits 2 when it finds a problem, and above that when it can't look.
status=0
report=$(git diff --cached --check) || status=$?
if ((status != 0 && status != 2)); then
  exit "$status"
fi
markers=$(grep 'leftover conflict marker$' <<<"$report" || true)
if [[ -n $markers ]]; then
  echo "$markers" >&2
  echo "Resolve the conflict, stage the result, and commit again." >&2
  exit 1
fi
