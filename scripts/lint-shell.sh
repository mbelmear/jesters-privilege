#!/usr/bin/env bash
# Shellchecks scripts for lint:shell and the commit hook: warnings and errors,
# plus SC2312, a masked failure (docs/testing.md, lint:shell, says why).
# Usage: scripts/lint-shell.sh <script>...
set -euo pipefail

shellcheck="$(dirname "$0")/shellcheck.sh"
status=0
"$shellcheck" --severity=warning "$@" || status=1
"$shellcheck" --enable=check-extra-masked-returns --include=SC2312 "$@" || status=1
exit "$status"
