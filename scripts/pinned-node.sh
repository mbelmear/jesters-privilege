# shellcheck shell=sh
# Sourced by the commit hooks: runs them with the Node major .nvmrc pins, as
# CI's setup-node does, so `npm run check` passes or fails here as it will
# there. A shell whose own node is another major gets one of nvm's installs of
# the pinned major put first on PATH; with none installed, the hook stops and
# says how to get it. Node 26 failed a test the hook runs that 24 passes,
# refusing #247's commit for a reason CI never sees.
# Usage: . scripts/pinned-node.sh (from the repository root)

pinned_major=$(sed 's/^v//; s/\..*//' .nvmrc)
current_major=$(node --version 2>/dev/null | sed 's/^v//; s/\..*//')
if [ "$current_major" != "$pinned_major" ]; then
  pinned_bin=""
  for dir in "${NVM_DIR:-$HOME/.nvm}/versions/node/v$pinned_major."*; do
    [ -x "$dir/bin/node" ] && pinned_bin="$dir/bin"
  done
  if [ -z "$pinned_bin" ]; then
    echo "Node ${current_major:-(none)} runs this hook, and .nvmrc pins $pinned_major, which CI runs." >&2
    echo "Install it (\`nvm install\`) or switch to it (\`nvm use\`), then commit again." >&2
    exit 1
  fi
  PATH="$pinned_bin:$PATH"
  export PATH
fi
