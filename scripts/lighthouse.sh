#!/usr/bin/env bash
# Lighthouse CI against the built site in out/, with the budget in
# lighthouserc.json. Given page paths, measures only those, three runs each:
#   npm run lighthouse -- /styleguide/paintings.html /404.html
set -euo pipefail

args=()
for page in "$@"; do
  if [[ "$page" != /* ]]; then
    echo "Expected a page path starting with /, such as /404.html, not \"$page\"" >&2
    exit 1
  fi
  args+=("--collect.url=http://localhost${page}")
done
exec npx lhci autorun ${args[@]+"${args[@]}"}
