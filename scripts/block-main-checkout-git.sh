#!/usr/bin/env bash
# Claude Code PreToolUse hook on Bash (.claude/settings.json): refuses a git
# command that would move the main checkout's branch, index or files, since
# that checkout belongs to the human (AGENTS.md); block-main-checkout-edits.sh
# guards Edit and Write. #278's session checked out origin/main detached
# there while reading a Dependabot alert. Reads, fetches, `git stash list` and
# `git worktree` stay allowed. It reads each command in a chain (&&, ||, ;, &, |,
# newlines, braces, parentheses), seeing git behind `VAR=value`, the wrappers
# and options named below, `if` and the like, or a full path, and tracks `cd`,
# `pushd`, `env -C`, `git -C`, `--work-tree`, `--git-dir`, and `GIT_DIR=` and
# `GIT_WORK_TREE=` (exported too); git is refused when any of them names the
# main checkout, since git dir and work tree can point apart.
# `cd -` returns to the directory before. A `cd` lasts to the end of the
# command, even past a `)` or `popd`: #278's review found a quoted `)` ending
# one early, so a worktree command after `(cd <main> …)` is refused; run it as
# a command of its own.
# It reads words, not shell, and recognises only the forms
# tests/unit/scripts/block-main-checkout-git.test.ts pins; git run any other
# way (another program such as `bash -c` or `xargs`, backticks, quoting or
# escaping the word git, an alias, an option it doesn't list) goes unread and
# runs, and nothing flags it afterwards: the human finds the main checkout
# changed. A form found slipping through becomes a test case here. Since it
# splits on separators even inside quotes, a commit message holding
# "; git add" can be refused. Reads the hook's JSON on stdin; exit 2 blocks.
set -euo pipefail

input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input")
dir=$(jq -r '.cwd // empty' <<<"$input")
[[ -z "$command" ]] && exit 0
[[ -z "$dir" ]] && dir=$PWD

# Every git subcommand that writes the working tree, the index, or HEAD.
writes=" checkout switch reset restore stash merge pull rebase cherry-pick revert commit am apply clean rm mv add bisect submodule sparse-checkout update-ref read-tree checkout-index "

# A path as the command would see it from <base> (default $dir), quotes
# dropped.
resolve() {
  local path=${1//\"/} base=${2:-$dir}
  path=${path//\'/}
  path=${path/#\~/$HOME}
  [[ $path == /* ]] || path="$base/$path"
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

# The wrapper options that take the word after them.
takes_value=" env:-u env:--unset env:-C env:--chdir sudo:-u sudo:--user sudo:-g sudo:--group sudo:-h sudo:--host nice:-n nice:--adjustment exec:-a "

exported=()

segments=$(sed -E 's/(&&|\|\||;|&|\||\(|\)|\{|\})/\n/g' <<<"$command")
previous=$dir
while IFS= read -r segment; do
  read -ra words <<<"$segment" || true
  # Words that run the next one as the command: assignments, shell keywords,
  # and wrappers with their options. GIT_DIR= and GIT_WORK_TREE= point git
  # as --git-dir and --work-tree do; env -C runs it from another directory.
  wrapper=""
  pointers=()
  run_dir=$dir
  while ((${#words[@]} > 0)); do
    if [[ ${words[0]} =~ ^GIT_(DIR|WORK_TREE)= ]]; then
      pointers+=("$(resolve "${words[0]#*=}")")
      words=("${words[@]:1}")
    elif [[ ${words[0]} =~ ^[A-Za-z_][A-Za-z0-9_]*= || ${words[0]} =~ ^(if|then|else|elif|do|while|until|!)$ ]]; then
      words=("${words[@]:1}")
    elif [[ ${words[0]} =~ ^(env|command|sudo|exec|nohup|time|nice|builtin)$ ]]; then
      wrapper=${words[0]}
      words=("${words[@]:1}")
    elif [[ -n $wrapper && $takes_value == *" $wrapper:${words[0]} "* ]]; then
      [[ $wrapper:${words[0]} =~ ^env:(-C|--chdir)$ ]] && run_dir=$(resolve "${words[1]:-.}")
      words=("${words[@]:2}")
    elif [[ -n $wrapper && ${words[0]} == -* ]]; then
      words=("${words[@]:1}")
    else
      break
    fi
  done
  ((${#words[@]} > 0)) || continue
  [[ ${words[0]} == */git ]] && words[0]=git
  case ${words[0]} in
    export)
      for word in "${words[@]:1}"; do
        [[ $word =~ ^GIT_(DIR|WORK_TREE)= ]] && exported+=("$(resolve "${word#*=}")")
      done
      ;;
    cd | pushd)
      i=1
      while ((i < ${#words[@]})) && [[ ${words[i]} == -?* ]]; do i=$((i + 1)); done
      if [[ ${words[i]:-} == - ]]; then
        next=$previous
      elif ((i < ${#words[@]})); then
        next=$(resolve "${words[i]}")
      else
        next=$HOME
      fi
      previous=$dir
      dir=$next
      ;;
    git)
      # Where git runs, after any -C; each path is relative to the -C before
      # it, as git reads them.
      base=$run_dir
      i=1
      while ((i < ${#words[@]})) && [[ ${words[i]} == -* ]]; do
        case ${words[i]} in
          -C)
            base=$(resolve "${words[i + 1]:-.}" "$base")
            i=$((i + 2))
            ;;
          --work-tree | --git-dir)
            pointers+=("$(resolve "${words[i + 1]:-.}" "$base")")
            i=$((i + 2))
            ;;
          --work-tree=* | --git-dir=*)
            pointers+=("$(resolve "${words[i]#*=}" "$base")")
            i=$((i + 1))
            ;;
          -c) i=$((i + 2)) ;;
          *) i=$((i + 1)) ;;
        esac
      done
      sub=${words[i]:-}
      # Listing or showing a stash only reads.
      [[ $sub == stash && ${words[i + 1]:-} =~ ^(list|show)$ ]] && sub=""
      if [[ -n $sub && $writes == *" $sub "* ]]; then
        # The +-form keeps bash 3.2 (macOS) from calling an empty array unbound.
        for target in "$base" ${pointers[@]+"${pointers[@]}"} ${exported[@]+"${exported[@]}"}; do
          is_main "$target" && refuse "${words[*]}"
        done
      fi
      ;;
    gh)
      if [[ ${words[1]:-} == pr && ${words[2]:-} == checkout ]] && is_main "$run_dir"; then
        refuse "${words[*]}"
      fi
      ;;
    *) ;;
  esac
done <<<"$segments"
exit 0
