#!/usr/bin/env bash
# Claude Code PreToolUse hook on Bash (.claude/settings.json): refuses a git
# command that would move the main checkout's branch, index or files, since
# that checkout belongs to the human (AGENTS.md); block-main-checkout-edits.sh
# guards Edit and Write. #278's session checked out origin/main detached
# there while reading a Dependabot alert. Reads, fetches, and `git worktree`
# stay allowed. It follows each command in a chain (&&, ||, ;, |, newlines,
# a subshell's parentheses), tracking `cd`, `pushd`, `git -C`, `--work-tree`
# and `--git-dir`, and sees git behind `VAR=value`, `env`, `command`, `sudo`
# or a full path, so `cd <main> && git checkout` from elsewhere is caught too.
# It guards against slips, not evasion: git inside `$(…)` or `bash -c` goes
# unread, and since it splits on separators even inside quotes, a commit
# message holding "; git add" can be refused. Reads the hook's JSON on stdin;
# exit 2 blocks.
set -euo pipefail

input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input")
dir=$(jq -r '.cwd // empty' <<<"$input")
[[ -z "$command" ]] && exit 0
[[ -z "$dir" ]] && dir=$PWD

# Every git subcommand that writes the working tree, the index, or HEAD.
writes=" checkout switch reset restore stash merge pull rebase cherry-pick revert commit am apply clean rm mv add bisect submodule sparse-checkout update-ref read-tree checkout-index "

# A path as the command would see it from $dir, quotes dropped.
resolve() {
  local path=${1//\"/}
  path=${path//\'/}
  path=${path/#\~/$HOME}
  [[ $path == /* ]] || path="$dir/$path"
  printf '%s\n' "$path"
}

is_main() {
  local target=${1%/} top main
  target=${target%/.git}
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

segments=$(sed -E 's/(&&|\|\||;|\||\(|\)|\{|\})/\n/g' <<<"$command")
while IFS= read -r segment; do
  read -ra words <<<"$segment" || true
  # Words that run the next one as the command: assignments and wrappers.
  while ((${#words[@]} > 0)) && [[ ${words[0]} =~ ^[A-Za-z_][A-Za-z0-9_]*= || ${words[0]} =~ ^(env|command|sudo|exec|nohup|time)$ ]]; do
    words=("${words[@]:1}")
  done
  ((${#words[@]} > 0)) || continue
  [[ ${words[0]} == */git ]] && words[0]=git
  case ${words[0]} in
    cd | pushd)
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
          --work-tree | --git-dir)
            target=$(resolve "${words[i + 1]:-.}")
            i=$((i + 2))
            ;;
          --work-tree=* | --git-dir=*)
            target=$(resolve "${words[i]#*=}")
            i=$((i + 1))
            ;;
          -c) i=$((i + 2)) ;;
          *) i=$((i + 1)) ;;
        esac
      done
      sub=${words[i]:-}
      # Listing or showing a stash only reads.
      [[ $sub == stash && ${words[i + 1]:-} =~ ^(list|show)$ ]] && sub=""
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
