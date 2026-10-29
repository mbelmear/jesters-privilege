#!/usr/bin/env bash
# List open agent tickets whose blockers are all closed: the ones ready to start.
# Parent issues (the spec) are skipped; their sub-issues are the work.
# Usage: npm run ready
set -euo pipefail

gh issue list --state open --label ready-for-agent --limit 200 \
  --json number,title,assignees,blockedBy,subIssuesSummary \
  --jq '
    map(select(.subIssuesSummary.total == 0))
    | map(select([.blockedBy.nodes[] | select(.state == "OPEN")] | length == 0))
    | sort_by(.number)
    | .[]
    | "#\(.number)  \(.title)" + (if (.assignees | length) > 0 then "  (claimed: \([.assignees[].login] | join(", ")))" else "" end)
  '
