#!/usr/bin/env bash
# Lighthouse for this branch beside a base (default origin/main), per page:
# simulated and observed LCP/FCP, and the bytes requested before the observed
# paint, which drive the simulated figure (docs/testing.md, Lighthouse).
# Builds the base in a throwaway worktree. This branch is measured as it
# stands in this checkout (uncommitted changes included), replacing its out/
# and .lighthouseci/, so run it from your own ticket worktree. Given pages,
# measures only those; otherwise every page in lighthouserc.json. A page one
# build lacks, such as a new one, shows "–" on that side. After the figures,
# it prints the CSS rules that changed in each page's early stylesheets, so a
# utility new to every page's stylesheet shows by name
# (CODING_STANDARDS.md, Performance). Usage:
#   npm run lighthouse:compare [-- [<base-ref>] [<page>...]]
#   npm run lighthouse:compare -- /styleguide/home/simple.html /episodes/1.html
set -euo pipefail

base="origin/main"
if [[ $# -gt 0 && "$1" != /* ]]; then
  base="$1"
  shift
fi
pages=()
for page in "$@"; do
  if [[ "$page" != /* ]]; then
    echo "Expected a page path starting with /, such as /404.html, not \"$page\"" >&2
    exit 1
  fi
  pages+=("$page")
done
root=$(git rev-parse --show-toplevel)
if [[ ${#pages[@]} -eq 0 ]]; then
  # Every budgeted page, for the stylesheet diff; lhci reads the list itself.
  while IFS= read -r page; do pages+=("$page"); done < <(node -e '
    const { ci } = require(process.argv[1]);
    for (const url of ci.collect.url) console.log(new URL(url).pathname);
  ' "$root/lighthouserc.json")
  named=false
else
  named=true
fi
scratch=$(mktemp -d)
cleanup() {
  git -C "$root" worktree remove --force "$scratch/base" 2>/dev/null || true
  rm -rf "$scratch"
}
trap cleanup EXIT

git fetch --quiet origin
# After the fetch, so a branch only on the remote counts, named as
# origin/<branch>.
if ! git rev-parse --quiet --verify "${base}^{commit}" >/dev/null; then
  echo "\"$base\" is not a commit. Pages start with /, such as /404.html; a base ref comes before them." >&2
  exit 1
fi
git worktree add --quiet --detach "$scratch/base" "$base"

# The file a page's path is built to: / is index.html.
page_file() {
  if [[ "$2" == */ ]]; then echo "$1/out$2index.html"; else echo "$1/out$2"; fi
}

# Builds a checkout and measures the named pages it has (all of
# lighthouserc.json's when none were named). lhci stops at a missing page, so
# one the build lacks is left out, and its column shows "–".
measure() {
  (cd "$1" && npm run build >/dev/null)
  local urls=()
  if $named; then
    for page in "${pages[@]}"; do
      if [[ -f "$(page_file "$1" "$page")" ]]; then
        urls+=("--collect.url=http://localhost${page}")
      else
        echo "  $page isn't in this build; skipping it." >&2
      fi
    done
    [[ ${#urls[@]} -gt 0 ]] || { mkdir -p "$2"; return; }
  fi
  (cd "$1" && rm -rf .lighthouseci &&
    npx lhci collect ${urls[@]+"${urls[@]}"} >/dev/null &&
    mkdir -p "$2" && cp .lighthouseci/lhr-*.json "$2/")
}

# A page's stylesheets as the build links them, one formatted file, so two
# builds compare rule by rule even though the bundler renames changed files.
stylesheets() {
  local html
  html=$(page_file "$1" "$2")
  [[ -f "$html" ]] || return 0
  grep -o '/_next/static/[^"]*\.css' "$html" | sort -u | while read -r css; do
    cat "$1/out$css"
    echo
  done | npx prettier --parser css
}

echo "Building and measuring ${base}..."
(cd "$scratch/base" && npm ci --no-audit --no-fund --silent)
measure "$scratch/base" "$scratch/reports/base"
echo "Building and measuring this branch..."
measure "$root" "$scratch/reports/head"

npx tsx "$root/scripts/lighthouse-summary.ts" \
  "$base=$scratch/reports/base" "HEAD=$scratch/reports/head"

# Each distinct change once, under the pages it reached: most pages share one
# stylesheet, so a rule new to it would otherwise print once per page.
echo
echo "Stylesheet rules changed (${base} → HEAD), on pages both builds have:"
changed=false
for page in "${pages[@]}"; do
  [[ -f "$(page_file "$scratch/base" "$page")" ]] || continue
  [[ -f "$(page_file "$root" "$page")" ]] || continue
  diff=$(diff -u --label "$base" --label HEAD \
    <(stylesheets "$scratch/base" "$page") <(stylesheets "$root" "$page") || true)
  [[ -n "$diff" ]] || continue
  changed=true
  # Bash 3.2 (macOS) has no associative arrays: one file per distinct diff,
  # named by its hash, and a list of the pages it reached beside it.
  key=$(printf '%s' "$diff" | shasum | cut -c1-12)
  [[ -f "$scratch/css-$key.diff" ]] || printf '%s\n' "$diff" >"$scratch/css-$key.diff"
  printf ' %s' "$page" >>"$scratch/css-$key.pages"
done
if $changed; then
  for pages_file in "$scratch"/css-*.pages; do
    echo " $(cat "$pages_file")"
    sed 's/^/    /' "${pages_file%.pages}.diff"
  done
else
  echo "  none"
fi
