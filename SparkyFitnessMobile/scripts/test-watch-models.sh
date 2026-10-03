#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v swiftc >/dev/null || { echo 'Swift compiler required (run on macOS with Xcode).' >&2; exit 1; }
watch_test_dir=$(mktemp -d)
trap 'rm -rf "$watch_test_dir"' EXIT
swiftc \
  targets/watch/Domain/CheckInModels.swift \
  targets/watch/Domain/WorkoutModels.swift \
  targets/watch/Domain/WatchPage.swift \
  targets/watch/Domain/ChallengeModels.swift \
  targets/watch/Domain/ChallengeSurfaceSnapshot.swift \
  targets/watch/Adapters/ContextPayloadMapper.swift \
  targets/watch/Adapters/ChallengePayloadMapper.swift \
  targets/watch/Infrastructure/ComplicationPublisher.swift \
  __tests__/watch/ChallengeModelChecks.swift \
  -o "$watch_test_dir/checks"
"$watch_test_dir/checks" __tests__/fixtures/watch-challenges.json
