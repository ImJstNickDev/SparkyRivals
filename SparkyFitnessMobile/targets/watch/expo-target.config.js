const { resolveAppIdentity } = require('../../app.identifiers.js');
const fs = require('fs');
const path = require('path');

const escapePlistString = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// Mirrors targets/widget/expo-target.config.js's syncInfoPlist: makes the app
// group readable at Swift runtime via Bundle.main, since declaring it in
// `entitlements` below only wires up code-signing, not an Info.plist key.
//
// Also registers the deep-link scheme. This target is built with
// GENERATE_INFOPLIST_FILE = YES and INFOPLIST_FILE pointing at this file, so
// Xcode merges its generated keys on top of what's written here rather than
// replacing it.
const syncInfoPlist = (appGroup, bundleIdentifier, watchScheme) => {
  const plistPath = path.join(__dirname, 'Info.plist');
  fs.writeFileSync(
    plistPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>APP_GROUP_IDENTIFIER</key>
    <string>${escapePlistString(appGroup)}</string>
    <key>WATCH_URL_SCHEME</key>
    <string>${escapePlistString(watchScheme)}</string>
    <key>CFBundleURLTypes</key>
    <array>
      <dict>
        <key>CFBundleURLName</key>
        <string>${escapePlistString(bundleIdentifier)}</string>
        <key>CFBundleURLSchemes</key>
        <array>
          <string>${escapePlistString(watchScheme)}</string>
        </array>
      </dict>
    </array>
    <!-- Without this an HKWorkoutSession gets no background runtime, so
         heart-rate sampling stops the moment the screen turns off - which on
         a watch is most of a workout. This is what makes the Workout tab's
         live HR actually survive a set. -->
    <key>WKBackgroundModes</key>
    <array>
      <string>workout-processing</string>
    </array>
    <key>NSHealthShareUsageDescription</key>
    <string>Used to track heart rate during a workout started from SparkyFitness.</string>
    <key>NSHealthUpdateUsageDescription</key>
    <string>Used to record workout sessions started from SparkyFitness.</string>
  </dict>
</plist>
`
  );
};

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => {
  const identity = resolveAppIdentity();
  const { appGroup } = identity;
  // Convention for watchOS companion apps: "<phone-bundle-id>.watchkitapp".
  const bundleIdentifier = identity.watchBundleIdentifier;
  syncInfoPlist(appGroup, bundleIdentifier, identity.watchScheme);

  return {
    type: 'watch',
    name: 'SparkyFitnessWatch',
    displayName: identity.mode === 'custom' ? identity.name : undefined,
    bundleIdentifier,
    // Reuses the phone app's adaptive icon for now — swap for a dedicated
    // Watch icon (has its own required sizes) once the design is settled.
    icon: '../../assets/icons/adaptiveicon.png',
    // watchOS 10 is the floor for the SwiftUI APIs used in this target.
    // Lower this if your physical Watch is running an older watchOS.
    deploymentTarget: '10.0',
    // Needed so the Daily Energy Goal complication (targets/watch-widget, a
    // separate process) can read what this app writes — WatchConnectivity
    // delivers into this app, but a widget extension can't see this app's
    // own private storage, only shared App Group storage. Reuses the same
    // group id as the phone's widgets; that's harmless, App Groups don't
    // sync across physical devices anyway, this is just a naming convention.
    // Confirmed working on Adam's free Personal Team (2026-08-17) — the
    // "requires a paid account" caveat this comment used to carry doesn't
    // apply.
    entitlements: {
      'com.apple.security.application-groups': [appGroup],
      // Needed to start an HKWorkoutSession and read live heart rate for the
      // Workout tab. Standard (non-clinical) HealthKit access, hence the
      // empty access array — see NSHealthShareUsageDescription /
      // NSHealthUpdateUsageDescription above for the prompts this unlocks.
      'com.apple.developer.healthkit': true,
      'com.apple.developer.healthkit.access': [],
    },
  };
};
