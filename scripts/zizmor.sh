#!/usr/bin/env bash
# Runs the zizmor this repo pins, here and in CI, so template injection,
# `permissions`, and credentials left in a checkout are checked whatever the
# machine has installed. Downloads the release binary once into node_modules/.cache and
# checks it against the checksum below, the digest GitHub lists for the release.
# Usage: scripts/zizmor.sh <zizmor args>
set -euo pipefail

version=1.32.0

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)
    platform=aarch64-apple-darwin
    checksum=6efed18c4539a663fd3c851a2be9533fd8456c4e646d9416206da059154a0d3c
    ;;
  Darwin-x86_64)
    platform=x86_64-apple-darwin
    checksum=6983143c719ada6845a69cc4dd2bacc215f971662fecd8bbd2678388e5ce5969
    ;;
  Linux-x86_64)
    platform=x86_64-unknown-linux-gnu
    checksum=bb110cc765eca9cd7efb2e284a956be5974c60027b0970f16397d86208a9957b
    ;;
  *)
    echo "No zizmor download for $(uname -s) $(uname -m); see https://github.com/zizmorcore/zizmor" >&2
    exit 1
    ;;
esac

root=$(cd "$(dirname "$0")/.." && pwd)
dir="$root/node_modules/.cache/zizmor-$version"
bin="$dir/zizmor"

if [[ ! -x $bin ]]; then
  mkdir -p "$dir"
  archive="zizmor-$platform.tar.gz"
  curl -fsSL --retry 3 -o "$dir/$archive" \
    "https://github.com/zizmorcore/zizmor/releases/download/v$version/$archive"
  (cd "$dir" && echo "$checksum  $archive" | shasum -a 256 -c - >/dev/null) || {
    echo "zizmor $archive doesn't match its pinned checksum" >&2
    rm -f "$dir/$archive"
    exit 1
  }
  tar -xzf "$dir/$archive" -C "$dir" zizmor
  rm -f "$dir/$archive"
fi

exec "$bin" "$@"
