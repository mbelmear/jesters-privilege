#!/usr/bin/env bash
# Lighthouse for this branch beside a base (default origin/main), per page:
# simulated and observed LCP/FCP, and the bytes requested before the observed
# paint, which drive the simulated figure (docs/testing.md, Lighthouse).
# Builds the base in a throwaway worktree. This branch is measured as it
# stands in this checkout (uncommitted changes included), replacing its out/
# and .lighthouseci/, so run it from your own ticket worktree. Usage:
#   npm run lighthouse:compare [-- <base-ref>]
set -euo pipefail

base="${1:-origin/main}"
if [[ "$base" == /* ]]; then
  echo "lighthouse:compare takes a base ref, not a page; every page in lighthouserc.json is measured. To measure one page alone: npm run lighthouse -- $base" >&2
  exit 1
fi
root=$(git rev-parse --show-toplevel)
scratch=$(mktemp -d)
cleanup() {
  git -C "$root" worktree remove --force "$scratch/base" 2>/dev/null || true
  rm -rf "$scratch"
}
trap cleanup EXIT

git fetch --quiet origin
git worktree add --quiet --detach "$scratch/base" "$base"

measure() {
  (cd "$1" && npm run build >/dev/null &&
    rm -rf .lighthouseci && npx lhci collect >/dev/null &&
    mkdir -p "$2" && cp .lighthouseci/lhr-*.json "$2/")
}

echo "Building and measuring ${base}..."
(cd "$scratch/base" && npm ci --no-audit --no-fund --silent)
measure "$scratch/base" "$scratch/reports/base"
echo "Building and measuring this branch..."
measure "$root" "$scratch/reports/head"

npx tsx "$root/scripts/lighthouse-summary.ts" \
  "$base=$scratch/reports/base" "HEAD=$scratch/reports/head"
