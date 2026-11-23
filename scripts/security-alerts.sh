#!/usr/bin/env bash
# Claude Code SessionStart hook (.claude/settings.json): names the repo's open
# Dependabot alerts, if any. A minimatch alert sat open from 2026-11-05 to
# 2026-11-22 because nothing showed it (#278's retro).
# Prints to stdout, which the hook adds to the session's context.
set -euo pipefail

alerts_api="repos/{owner}/{repo}/dependabot/alerts?state=open"
if ! alerts=$(gh api "$alerts_api&per_page=100" \
  --jq '.[] | "\(.security_advisory.severity) \(.dependency.package.name)"' 2>/dev/null); then
  echo "Couldn't read the open Dependabot alerts (gh api '$alerts_api'), so whether any are open is unknown."
  exit 0
fi

count=0
named=""
while read -r severity package; do
  [[ -n "$package" ]] || continue
  count=$((count + 1))
  named+="${named:+, }$package ($severity)"
done <<<"$alerts"
((count > 0)) || exit 0

noun=alerts
((count == 1)) && noun=alert
echo "$count open Dependabot $noun: $named. Tell the user; gh api '$alerts_api' has the advisories, and docs/testing.md (Dependency advisories) says how to fix one."
