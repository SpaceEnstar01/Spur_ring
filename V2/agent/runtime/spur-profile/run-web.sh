#!/usr/bin/env bash
# Launch the copied Harness using its supported Node and pnpm versions.
set -euo pipefail

# Use a compatible installed Node; nvm is optional, not a required layout.
if ! command -v node >/dev/null 2>&1; then
  echo "Node is required (22.19+ or 24+). Add it to PATH first." >&2
  exit 1
fi
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (!((major === 22 && minor >= 19) || major >= 24)) { console.error("Harness requires Node 22.19+ or 24+"); process.exit(1) }'
command -v pnpm >/dev/null 2>&1 || { echo "pnpm 11.7.0 is required." >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
HARNESS="$(cd "$ROOT/../deepseek-harness" && pwd)"
PLUGIN="$(cd "$ROOT/../../tools/sandbox/src" && pwd)/index.cjs"
PATCH="$ROOT/cordis.patch.resolved.yml"
ENV_FILE="$ROOT/.env"

sed "s|__SPUR_OFFICE_SANDBOX__|$PLUGIN|g" "$ROOT/cordis.patch.yml" > "$PATCH"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

cd "$HARNESS"
exec pnpm dsh web --patch "$PATCH" "$@"
