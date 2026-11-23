#!/usr/bin/env bash
# Lints every workflow with actionlint, the same version CI's "Lint workflows"
# job runs, so a workflow change is checked before it's pushed. Each `run:`
# block goes through scripts/shellcheck.sh, so it's checked whatever the
# machine has installed. Downloads the release binary
# once into node_modules/.cache and checks it against the release's checksums.
# Usage: npm run lint:workflows [-- <actionlint args>]
set -euo pipefail

# Keep in step with the docker://rhysd/actionlint tag in .github/workflows/ci.yml.
version=1.7.12

# shellcheck disable=SC2312 # uname's output is the answer; a failure falls to *)
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) platform=darwin_arm64 ;;
  Darwin-x86_64) platform=darwin_amd64 ;;
  Linux-x86_64) platform=linux_amd64 ;;
  *)
    # shellcheck disable=SC2312 # only the message uses it
    echo "No actionlint download for $(uname -s) $(uname -m); see https://github.com/rhysd/actionlint" >&2
    exit 1
    ;;
esac

root=$(cd "$(dirname "$0")/.." && pwd)
dir="$root/node_modules/.cache/actionlint-$version"
bin="$dir/actionlint"

if [[ ! -x $bin ]]; then
  base="https://github.com/rhysd/actionlint/releases/download/v$version"
  archive="actionlint_${version}_${platform}.tar.gz"
  sums=$(curl -fsSL --retry 3 "$base/actionlint_${version}_checksums.txt")
  checksum=$(awk -v archive="$archive" '$2 == archive { print $1 }' <<<"$sums")
  [[ -n $checksum ]] || {
    echo "actionlint's release lists no checksum for $archive" >&2
    exit 1
  }
  "$root/scripts/install-release-binary.sh" "$base/$archive" "$checksum" actionlint "$bin"
fi

# Downloads shellcheck now, if it's missing: actionlint runs it in parallel.
"$root/scripts/shellcheck.sh" --version >/dev/null

cd "$root"
exec "$bin" -color -shellcheck="$root/scripts/shellcheck.sh" "$@"
