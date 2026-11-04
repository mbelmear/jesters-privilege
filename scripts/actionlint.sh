#!/usr/bin/env bash
# Lints every workflow with actionlint, the same version CI's "Lint workflows"
# job runs, so a workflow change is checked before it's pushed. actionlint
# runs shellcheck on each `run:` block only when shellcheck is on the PATH
# (CI's image has it); without it, this says so and lints the rest. Downloads the release binary
# once into node_modules/.cache and checks it against the release's checksums.
# Usage: npm run lint:workflows [-- <actionlint args>]
set -euo pipefail

# Keep in step with the docker://rhysd/actionlint tag in .github/workflows/ci.yml.
version=1.7.12

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) platform=darwin_arm64 ;;
  Darwin-x86_64) platform=darwin_amd64 ;;
  Linux-x86_64) platform=linux_amd64 ;;
  *)
    echo "No actionlint download for $(uname -s) $(uname -m); see https://github.com/rhysd/actionlint" >&2
    exit 1
    ;;
esac

root=$(cd "$(dirname "$0")/.." && pwd)
dir="$root/node_modules/.cache/actionlint-$version"
bin="$dir/actionlint"

if [[ ! -x $bin ]]; then
  mkdir -p "$dir"
  base="https://github.com/rhysd/actionlint/releases/download/v$version"
  archive="actionlint_${version}_${platform}.tar.gz"
  curl -fsSL -o "$dir/$archive" "$base/$archive"
  curl -fsSL -o "$dir/checksums.txt" "$base/actionlint_${version}_checksums.txt"
  (cd "$dir" && grep " $archive\$" checksums.txt | shasum -a 256 -c - >/dev/null) || {
    echo "actionlint $archive doesn't match the release's checksum" >&2
    rm -f "$dir/$archive"
    exit 1
  }
  tar -xzf "$dir/$archive" -C "$dir" actionlint
  rm -f "$dir/$archive"
fi

if ! command -v shellcheck >/dev/null; then
  echo "lint:workflows: shellcheck isn't installed, so the run: blocks go unchecked; CI checks them" >&2
fi

cd "$root"
exec "$bin" -color "$@"
