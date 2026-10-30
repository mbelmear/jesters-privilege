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

# A run that failed before measuring leaves no reports to summarise.
if compgen -G ".lighthouseci/lhr-*.json" >/dev/null; then
  npx tsx scripts/lighthouse-summary.ts "this checkout=.lighthouseci"
fi
exit "$status"
