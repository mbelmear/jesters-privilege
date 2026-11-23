#!/usr/bin/env bash
# Downloads a release archive, checks it against a SHA-256, and installs one
# file from it as an executable at <bin>, for the pinned-tool scripts
# (shellcheck.sh, zizmor.sh, actionlint.sh). Several can start at once on an
# empty cache, as Jest's parallel suites do on a fresh worktree (#274's first
# commit failed so): each works in its own temporary directory beside <bin>
# and renames the file into place, which is atomic, so none reads another's
# half-written archive and a running one never sees a half-written binary.
# Usage:
#   scripts/install-release-binary.sh <url> <sha256> <path in archive> <bin>
set -euo pipefail

url=$1 checksum=$2 member=$3 bin=$4
dir=$(dirname "$bin")
mkdir -p "$dir"
work=$(mktemp -d "$dir/.install.XXXXXX")
trap 'rm -rf "$work"' EXIT

archive="$work/archive.tar.gz"
curl -fsSL --retry 3 -o "$archive" "$url"
echo "$checksum  $archive" | shasum -a 256 -c - >/dev/null 2>&1 || {
  echo "$(basename "$url") doesn't match its pinned checksum" >&2
  exit 1
}
tar -xzf "$archive" -C "$work" "$member"
mv -f "$work/$member" "$bin"
