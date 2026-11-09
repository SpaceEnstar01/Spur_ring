#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/appV2/app_mobile"
npm run lint
node node_modules/typescript/bin/tsc --noEmit
npm test -- --runInBand --watchman=false
