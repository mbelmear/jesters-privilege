#!/usr/bin/env bash
# Shellchecks scripts for lint:shell and the commit hook: warnings and errors,
# plus SC2312, a command inside $(...) or <(...) whose failure set -e can't see.
# Its empty output then reads as an answer: #226's restored-to-main.sh listed
# every file as restored when git couldn't read a commit. Read such a command
# into a variable first, or disable SC2312 on the line, saying why its failure
# is harmless there.
# Usage: scripts/lint-shell.sh <script>...
set -euo pipefail

shellcheck="$(dirname "$0")/shellcheck.sh"
status=0
"$shellcheck" --severity=warning "$@" || status=1
"$shellcheck" --enable=check-extra-masked-returns --include=SC2312 "$@" || status=1
exit "$status"
