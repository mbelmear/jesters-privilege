#!/usr/bin/env bash
# Claude Code PreToolUse hook on Bash (.claude/settings.json): refuses a git
# command that would move the main checkout's branch, index or files, since
# that checkout belongs to the human (AGENTS.md); block-main-checkout-edits.sh
# guards Edit and Write. The 2026-11-22 session checked out origin/main
# detached there while reading a Dependabot alert. Reads, fetches, and
# `git worktree` stay allowed. It follows each command in a chain (&&, ||, ;,
# |, newlines), tracking `cd` and `git -C`, so `cd <main> && git checkout`
# from elsewhere is caught too. Reads the hook's JSON on stdin; exit 2 blocks.
set -euo pipefail

input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input")
dir=$(jq -r '.cwd // empty' <<<"$input")
[[ -z "$command" ]] && exit 0
[[ -z "$dir" ]] && dir=$PWD

# Every git subcommand that writes the working tree, the index, or HEAD.
writes=" checkout switch reset restore stash merge pull rebase cherry-pick revert commit am apply clean rm mv add "

# A path as the command would see it from $dir, quotes dropped.
resolve() {
  local path=${1//\"/}
  path=${path//\'/}
  path=${path/#\~/$HOME}
  [[ $path == /* ]] || path="$dir/$path"
  printf '%s\n' "$path"
}

is_main() {
  local target=$1 top main
  [[ -d $target ]] || return 1
  top=$(git -C "$target" rev-parse --show-toplevel 2>/dev/null) || return 1
  main=$(git -C "$target" worktree list --porcelain 2>/dev/null) || return 1
  main=$(sed -n '1s/^worktree //p' <<<"$main")
  [[ -n $main ]] || return 1
  top=$(cd "$top" && pwd -P) || return 1
  main=$(cd "$main" && pwd -P) || return 1
  [[ $top == "$main" ]]
}

refuse() {
  echo "Refusing \`$1\`: it would change the main checkout, and the main checkout belongs to the human (AGENTS.md). Run it in your worktree instead (npm run worktree -- <issue> <branch>); to read main, use origin/main." >&2
  exit 2
}

segments=$(sed -E 's/(&&|\|\||;|\|)/\n/g' <<<"$command")
while IFS= read -r segment; do
  read -ra words <<<"$segment" || true
  ((${#words[@]} > 0)) || continue
  case ${words[0]} in
    cd)
      if ((${#words[@]} > 1)); then dir=$(resolve "${words[1]}"); else dir=$HOME; fi
      ;;
    git)
      target=$dir
      i=1
      while ((i < ${#words[@]})) && [[ ${words[i]} == -* ]]; do
        case ${words[i]} in
          -C)
            target=$(resolve "${words[i + 1]:-.}")
            i=$((i + 2))
            ;;
          -c) i=$((i + 2)) ;;
          *) i=$((i + 1)) ;;
        esac
      done
      sub=${words[i]:-}
      if [[ -n $sub && $writes == *" $sub "* ]] && is_main "$target"; then
        refuse "${words[*]}"
      fi
      ;;
    gh)
      if [[ ${words[1]:-} == pr && ${words[2]:-} == checkout ]] && is_main "$dir"; then
        refuse "${words[*]}"
      fi
      ;;
    *) ;;
  esac
done <<<"$segments"
exit 0
