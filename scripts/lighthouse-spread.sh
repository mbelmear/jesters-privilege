#!/usr/bin/env bash
# How far each budgeted page's Lighthouse figures moved across main's last N
# CI runs (default 10): the range of its medians and of its single runs, with
# its early bytes beside them, so a budget can be set from what the runner
# holds (docs/testing.md, Lighthouse). Downloads each run's lighthouse-reports,
# which CI keeps for 14 days; a run without them is skipped. Usage:
#   npm run lighthouse:spread [-- <runs>]
set -euo pipefail

count="${1:-10}"
if [[ ! "$count" =~ ^[1-9][0-9]*$ ]]; then
  echo "Expected a number of CI runs, such as 10, not \"$count\"" >&2
  exit 1
fi
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT

args=()
ids=$(gh run list --branch main --workflow CI --limit "$count" \
  --json databaseId -q '.[].databaseId')
for id in $ids; do
  if gh run download "$id" -n lighthouse-reports -D "$dir/$id" >/dev/null 2>&1; then
    args+=("$id=$dir/$id")
  fi
done
if [[ ${#args[@]} -eq 0 ]]; then
  echo "None of main's last $count CI runs kept its lighthouse-reports" >&2
  exit 1
fi
npx tsx "$(dirname "$0")/lighthouse-summary.ts" --spread "${args[@]}"
