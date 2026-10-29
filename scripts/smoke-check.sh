#!/usr/bin/env bash
# Check that production is serving the deploy we just made.
#
# The new version can take a few seconds to reach every Cloudflare location, so
# each check retries for up to a minute before failing the workflow.
#
# Usage: scripts/smoke-check.sh <commit-sha>
set -euo pipefail

commit="${1:?Usage: scripts/smoke-check.sh <commit-sha>}"
site="https://jestersprivilegepodcast.com"

retry() {
  for _ in $(seq 12); do
    if "$@"; then return 0; fi
    sleep 5
  done
  echo "Smoke check failed: $*" >&2
  return 1
}

manifest_has_commit() {
  curl -fsS "$site/build-manifest.json" | grep -q "\"commit\":\"$commit\""
}

home_page_serves() {
  curl -fsS "$site/" | grep -q "<h1"
}

www_redirects_to_apex() {
  [ "$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' \
    "https://www.jestersprivilegepodcast.com/about?x=1")" = "301 $site/about?x=1" ]
}

retry manifest_has_commit
retry home_page_serves
retry www_redirects_to_apex
echo "Production is serving $commit"
