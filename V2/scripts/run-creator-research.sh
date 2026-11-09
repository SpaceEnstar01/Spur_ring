#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="${SPUR_NODE_BIN:-$(command -v node || true)}"
if [[ -n "$NODE_BIN" ]] && "$NODE_BIN" -e 'const [a,b]=process.versions.node.split(".").map(Number);if(!((a===22&&b>=19)||a>=24))process.exit(1)' 2>/dev/null; then
  :
elif [[ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  NODE_BIN="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
else
  echo "Node 22.19+ or 24+ required; set SPUR_NODE_BIN." >&2
  exit 1
fi
exec "$NODE_BIN" "$ROOT/agent/integrations/creator-research/run.mjs" "$@"
