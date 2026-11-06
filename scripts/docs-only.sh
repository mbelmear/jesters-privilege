#!/usr/bin/env bash
# Print "true" if the only files that differ between two commits are under
# docs/ or top-level Markdown, which nothing built or browser-tested reads, and
# "false" otherwise. CI and the preview skip their build and browser jobs on
# true (docs/testing.md, CI).
# Usage: scripts/docs-only.sh <base> <head>
set -euo pipefail

if (($# != 2)); then
  echo "Usage: docs-only.sh <base> <head>" >&2
  exit 2
fi

# Both sides of a rename: moving code into docs/ still changes the code. A
# quoted name (an accented path) matches neither pattern, so it runs every job.
files=$(git diff --no-renames --name-only "$1" "$2")

while IFS= read -r file; do
  if [[ ! "$file" =~ ^docs/ && ! "$file" =~ ^[^/]+\.md$ ]]; then
    echo false
    exit 0
  fi
done <<<"$files"
echo true
