#!/usr/bin/env bash
# Claude Code PreToolUse hook (.claude/settings.json): refuses an Edit, Write,
# or NotebookEdit inside the main checkout, which belongs to the human
# (AGENTS.md). Work goes in a worktree: `npm run worktree -- <issue> <branch>`.
# Reads the hook's JSON on stdin; exit 2 blocks the tool call.
set -euo pipefail

file=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
[[ -z "$file" ]] && exit 0

dir=$(dirname "$file")
while [[ ! -d "$dir" ]]; do dir=$(dirname "$dir"); done
main=$(git -C "$dir" worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p') || exit 0
[[ -z "$main" ]] && exit 0

real_dir=$(cd "$dir" && pwd -P)
real_main=$(cd "$main" && pwd -P)
if [[ "$real_dir/" == "$real_main/"* ]]; then
  echo "Refusing to edit $file: the main checkout belongs to the human (AGENTS.md). Make the change in a worktree: npm run worktree -- <issue> <branch>." >&2
  exit 2
fi
