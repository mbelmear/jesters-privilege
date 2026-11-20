#!/usr/bin/env bash
# git fetch, waiting out another session's fetch. Several sessions work in
# parallel (AGENTS.md), and a fetch that finds a ref locked by another fails
# with "cannot lock ref": #256's worktree-done did, and a rerun moments later
# went through. So that failure is retried a few times, FETCH_RETRY_DELAY
# seconds apart; any other fails at once, as git fetch would.
# Usage: scripts/fetch.sh <git fetch arguments>
set -euo pipefail

attempts=5
delay="${FETCH_RETRY_DELAY:-1}"

for ((attempt = 1; ; attempt++)); do
  # Keeps git's stderr to read, and passes its stdout through.
  if { err=$(git fetch "$@" 2>&1 1>&3 3>&-); } 3>&1; then
    # What a fetch reports, such as refs pruned, is on stderr too.
    [[ -z "$err" ]] || printf '%s\n' "$err" >&2
    exit 0
  fi
  if [[ "$err" != *"cannot lock ref"* ]] || ((attempt == attempts)); then
    printf '%s\n' "$err" >&2
    exit 1
  fi
  sleep "$delay"
done
