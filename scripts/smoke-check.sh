#!/usr/bin/env bash
# Check that production is serving the deploy we just made, run from the
# checkout that built it.
#
# The new version can take a few seconds to reach every Cloudflare location, so
# each check retries for up to a minute before failing the workflow.
#
# Usage: scripts/smoke-check.sh <commit-sha>
set -euo pipefail

commit="${1:?Usage: scripts/smoke-check.sh <commit-sha>}"
domain="jestersprivilegepodcast.com"
site="https://$domain"

fail() {
  echo "Smoke check failed: $*" >&2
  exit 1
}

retry() {
  for _ in $(seq 12); do
    if "$@"; then return 0; fi
    sleep 5
  done
  fail "$@"
}

# Comparing with a build that lost its commit would pass on any deploy of it.
built_manifest_names_commit() {
  grep -q "\"commit\":\"$commit\"" out/build-manifest.json
}

# The whole manifest, since a deploy the feed check started rebuilds the commit
# already live: only its newest Episode, Listen links, or Transcripts differ.
live_manifest_matches_build() {
  [ "$(curl -fsS "$site/build-manifest.json")" = "$(cat out/build-manifest.json)" ]
}

home_page_serves() {
  curl -fsS "$site/" | grep -q "<h1"
}

# Production alone loads Web Analytics' beacon (src/lib/analytics.ts).
home_page_counts_visits() {
  curl -fsS "$site/" | grep -q 'static.cloudflareinsights.com/beacon.min.js'
}

www_redirects_to_apex() {
  [ "$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' \
    "https://www.$domain/about?x=1")" = "301 $site/about?x=1" ]
}

http_redirects_to_https() {
  [ "$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' \
    "http://$domain/x?y=1")" = "301 $site/x?y=1" ]
}

built_manifest_names_commit || fail built_manifest_names_commit
retry live_manifest_matches_build
retry home_page_serves
retry home_page_counts_visits
retry www_redirects_to_apex
retry http_redirects_to_https
echo "Production is serving $commit"
