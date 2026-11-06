#!/usr/bin/env bash
# Lighthouse CI against the built site in out/, with the budget in
# lighthouserc.json. Given page paths, measures only those, three runs each:
#   npm run lighthouse -- /styleguide/paintings.html /404.html
# Then prints each page's figures (scripts/lighthouse-summary.ts), so a
# budget miss shows by how much and from which bytes.
#
# `/`, the first page measured, has read 3168, 214, 19 ms of blocking time on CI
# across three runs of one build. That points to the runner warming up, though
# nothing has tested it, so `/` runs once first, unmeasured (docs/testing.md).
set -euo pipefail

args=()
for page in "$@"; do
  if [[ "$page" != /* ]]; then
    echo "Expected a page path starting with /, such as /404.html, not \"$page\"" >&2
    exit 1
  fi
  args+=("--collect.url=http://localhost${page}")
done

# A warm-up that fails isn't the verdict: the run below reports the cause.
npx lhci collect --collect.url=http://localhost/ --collect.numberOfRuns=1 >/dev/null || true

# Reports from an earlier run, or the warm-up, would mix into the summary.
rm -rf .lighthouseci
status=0
npx lhci autorun ${args[@]+"${args[@]}"} || status=$?

# A run that failed before measuring leaves no reports to summarise.
if compgen -G ".lighthouseci/lhr-*.json" >/dev/null; then
  npx tsx scripts/lighthouse-summary.ts "this checkout=.lighthouseci"
fi
exit "$status"
