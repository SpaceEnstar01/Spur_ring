#!/usr/bin/env bash
set -euo pipefail

command -v node >/dev/null 2>&1 || { echo "Node is required on PATH." >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/../runtime/spur-profile/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export SPUR_OFFICE_PORT="${SPUR_OFFICE_PORT:-3081}"
export SPUR_OFFICE_PUBLIC_BASE="${SPUR_OFFICE_PUBLIC_BASE:-https://api.hispurring.com}"

cd "$ROOT"
exec node server.mjs
