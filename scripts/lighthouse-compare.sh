#!/usr/bin/env bash
# Lighthouse for this branch beside a base (default origin/main), per page:
# simulated and observed LCP/FCP, and the bytes requested before the observed
# paint, which drive the simulated figure (docs/testing.md, Lighthouse).
# Builds the base in a throwaway worktree. This branch is measured as it
# stands in this checkout (uncommitted changes included), replacing its out/
# and .lighthouseci/, so run it from your own ticket worktree. Given pages,
# measures only those; otherwise every page in lighthouserc.json. Usage:
#   npm run lighthouse:compare [-- [<base-ref>] [<page>...]]
#   npm run lighthouse:compare -- /styleguide/home/simple.html /episodes/1.html
set -euo pipefail

base="origin/main"
if [[ $# -gt 0 && "$1" != /* ]]; then
  base="$1"
  shift
fi
urls=()
for page in "$@"; do
  if [[ "$page" != /* ]]; then
    echo "Expected a page path starting with /, such as /404.html, not \"$page\"" >&2
    exit 1
  fi
  urls+=("--collect.url=http://localhost${page}")
done
root=$(git rev-parse --show-toplevel)
scratch=$(mktemp -d)
cleanup() {
  git -C "$root" worktree remove --force "$scratch/base" 2>/dev/null || true
  rm -rf "$scratch"
}
trap cleanup EXIT

git fetch --quiet origin
# After the fetch, so a branch only on the remote counts.
if ! git rev-parse --quiet --verify "${base}^{commit}" >/dev/null; then
  echo "\"$base\" is not a commit. Pages start with /, such as /404.html; a base ref comes before them." >&2
  exit 1
fi
git worktree add --quiet --detach "$scratch/base" "$base"

measure() {
  (cd "$1" && npm run build >/dev/null &&
    rm -rf .lighthouseci && npx lhci collect ${urls[@]+"${urls[@]}"} >/dev/null &&
    mkdir -p "$2" && cp .lighthouseci/lhr-*.json "$2/")
}

echo "Building and measuring ${base}..."
(cd "$scratch/base" && npm ci --no-audit --no-fund --silent)
measure "$scratch/base" "$scratch/reports/base"
echo "Building and measuring this branch..."
measure "$root" "$scratch/reports/head"

npx tsx "$root/scripts/lighthouse-summary.ts" \
  "$base=$scratch/reports/base" "HEAD=$scratch/reports/head"
