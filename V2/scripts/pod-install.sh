#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUBY_DIR="$ROOT/.tools/ruby/portable-ruby/3.4.5/bin"
if [[ -x "$RUBY_DIR/ruby" && -f "$ROOT/.tools/bin/pod" ]]; then
  export GEM_HOME="$ROOT/.tools/gems"
  export GEM_PATH="$GEM_HOME"
  export PATH="$RUBY_DIR:$ROOT/.tools/bin:$PATH"
fi
# Maven Central currently redirects RN artifacts to this official host.
export ENTERPRISE_REPOSITORY="${ENTERPRISE_REPOSITORY:-https://repo.reactnative.dev/maven2}"
export CP_HOME_DIR="${CP_HOME_DIR:-$ROOT/.tools/cocoapods}"
command -v pod >/dev/null 2>&1 || { echo 'CocoaPods is not installed; see V2/docs/MIGRATION-2026-10-28.md.' >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo 'Add Node 20+ to PATH first.' >&2; exit 1; }
cd "$ROOT/appV2/app_mobile/ios"
exec pod install "$@"
