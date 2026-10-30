#!/usr/bin/env bash
# Lighthouse CI against the built site in out/, with the budget in
# lighthouserc.json. Given page paths, measures only those, three runs each:
#   npm run lighthouse -- /styleguide/paintings.html /404.html
set -euo pipefail

args=()
for page in "$@"; do
  args+=("--collect.url=http://localhost${page}")
done
exec npx lhci autorun ${args[@]+"${args[@]}"}
