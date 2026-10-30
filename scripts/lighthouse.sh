#!/usr/bin/env bash
# Lighthouse CI against the built site in out/, with the budget in
# lighthouserc.json. Given page paths, measures only those, three runs each:
#   npm run lighthouse -- /styleguide/paintings.html /404.html
# Then prints each page's figures (scripts/lighthouse-summary.ts), so a
# budget miss shows by how much and from which bytes.
set -euo pipefail

args=()
for page in "$@"; do
  if [[ "$page" != /* ]]; then
    echo "Expected a page path starting with /, such as /404.html, not \"$page\"" >&2
    exit 1
  fi
  args+=("--collect.url=http://localhost${page}")
done

# Reports from an earlier run would mix into the summary.
rm -rf .lighthouseci
status=0
npx lhci autorun ${args[@]+"${args[@]}"} || status=$?

# The summary reads only Lighthouse reports, not lhci's other JSON files.
reports=$(mktemp -d)
trap 'rm -rf "$reports"' EXIT
cp .lighthouseci/lhr-*.json "$reports/"
npx tsx scripts/lighthouse-summary.ts "this checkout=$reports"
exit "$status"
