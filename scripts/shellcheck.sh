#!/usr/bin/env bash
# Runs the shellcheck this repo pins, here and in CI, so a shell script is
# checked before it's pushed whatever the machine has installed. Downloads the
# release binary once into node_modules/.cache and checks it against the
# checksum below, taken when the version was pinned: the release publishes none.
# Usage: scripts/shellcheck.sh <shellcheck args>
set -euo pipefail

version=0.11.0

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)
    platform=darwin.aarch64
    checksum=339b930feb1ea764467013cc1f72d09cd6b869ebf1013296ba9055ab2ffbd26f
    ;;
  Darwin-x86_64)
    platform=darwin.x86_64
    checksum=c2c15e08df0e8fbc374c335b230a7ee958c313fa5714817a59aa59f1aa594f51
    ;;
  Linux-x86_64)
    platform=linux.x86_64
    checksum=b7af85e41cc99489dcc21d66c6d5f3685138f06d34651e6d34b42ec6d54fe6f6
    ;;
  *)
    echo "No shellcheck download for $(uname -s) $(uname -m); see https://github.com/koalaman/shellcheck" >&2
    exit 1
    ;;
esac

root=$(cd "$(dirname "$0")/.." && pwd)
dir="$root/node_modules/.cache/shellcheck-$version"
bin="$dir/shellcheck"

if [[ ! -x $bin ]]; then
  mkdir -p "$dir"
  archive="shellcheck-v$version.$platform.tar.gz"
  curl -fsSL --retry 3 -o "$dir/$archive" \
    "https://github.com/koalaman/shellcheck/releases/download/v$version/$archive"
  (cd "$dir" && echo "$checksum  $archive" | shasum -a 256 -c - >/dev/null) || {
    echo "shellcheck $archive doesn't match its pinned checksum" >&2
    rm -f "$dir/$archive"
    exit 1
  }
  tar -xzf "$dir/$archive" -C "$dir" --strip-components=1 "shellcheck-v$version/shellcheck"
  rm -f "$dir/$archive"
fi

exec "$bin" "$@"
