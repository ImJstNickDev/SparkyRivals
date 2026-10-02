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

const syncInfoPlist = (appGroup, appScheme) => {
  const plistPath = path.join(__dirname, 'Info.plist');
  const escapedAppGroup = escapePlistString(appGroup);
  fs.writeFileSync(
    plistPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>APP_GROUP_IDENTIFIER</key>
    <string>${escapedAppGroup}</string>
    <key>APP_URL_SCHEME</key>
    <string>${escapePlistString(appScheme)}</string>
    <key>NSExtension</key>
    <dict>
      <key>NSExtensionPointIdentifier</key>
      <string>com.apple.widgetkit-extension</string>
    </dict>
  </dict>
</plist>
`
  );
};

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => {
  const identity = resolveAppIdentity();
  const { appGroup } = identity;
  syncInfoPlist(appGroup, identity.scheme);

  return {
    type: 'widget',
    name: 'CalorieTracker',
    bundleIdentifier: identity.widgetBundleIdentifier,
    icon: '../../assets/icons/adaptiveicon.png',
    entitlements: {
      'com.apple.security.application-groups': [appGroup],
    },
  };
};
