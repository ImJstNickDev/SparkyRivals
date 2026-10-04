#!/usr/bin/env bash
# Local production pair; credentials come only from private Gradle properties/env.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${EXPO_BUILD_NUMBER:?Allocate a new phone version code first}"
: "${EXPO_WEAR_BUILD_NUMBER:?Allocate a new Wear version code first}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk}"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export NODE_ENV=production
if [[ "${APP_CONFIG_ONLY:-0}" == 1 ]]; then
  echo 'Owned release cannot use APP_CONFIG_ONLY' >&2
  exit 1
fi
"$JAVA_HOME/bin/java" -version
# This replaces generated projects only; all maintained native sources live in targets/plugins.
pnpm build:profile sparkyrivals-production-internal pnpm exec expo prebuild --clean --platform android --no-install
pnpm build:profile sparkyrivals-production-internal pnpm validate:native --platform android
# Expo Constants and Metro evaluate dynamic config during Gradle as well.
# Preserve the profile through BOTH prebuild and native compilation.
pnpm build:profile sparkyrivals-production-internal bash -c \
  'cd android && ./gradlew :app:assembleRelease :wear:assembleRelease :wear:testDebugUnitTest --console=plain --max-workers=4 -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=1g -Djava.util.concurrent.ForkJoinPool.common.parallelism=4"'
python3 scripts/verify-android-release.py \
  --phone android/app/build/outputs/apk/release/app-release.apk \
  --wear android/wear/build/outputs/apk/release/wear-release.apk \
  --phone-code "$EXPO_BUILD_NUMBER" --wear-code "$EXPO_WEAR_BUILD_NUMBER"
