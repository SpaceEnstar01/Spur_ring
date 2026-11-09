#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec xcodebuild \
  -workspace "$ROOT/appV2/app_mobile/ios/SuprRing.xcworkspace" \
  -scheme SuprRing \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$ROOT/.build/ios" \
  -jobs 4 CODE_SIGNING_ALLOWED=NO build "$@"
