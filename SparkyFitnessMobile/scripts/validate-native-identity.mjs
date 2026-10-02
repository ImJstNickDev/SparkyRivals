// Read-only checks of clean prebuild output. Run with the SAME profile/env as prebuild.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import identifiers from '../app.identifiers.js';

const require = createRequire(import.meta.url);
// Reuse the parsers shipped with the installed Expo config toolchain.
const expoRequire = createRequire(require.resolve('expo/config-plugins'));
const plist = expoRequire('@expo/plist').default;
const xcode = expoRequire('xcode');
const { parseStringPromise } = expoRequire('xml2js');
const root = fileURLToPath(new URL('../', import.meta.url));
const id = identifiers.resolveAppIdentity();
const args = process.argv.slice(2);
const argument = (name) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const platform = argument('--platform') || 'all';
assert.ok(['all', 'ios', 'android'].includes(platform), 'Invalid --platform');
const snapshot = { identity: id, platforms: {} };
const read = (file) => readFileSync(join(root, file), 'utf8');
const unquote = (value) => String(value).replace(/^"|"$/g, '');
const parsePlist = (file) => plist.parse(read(file));

if (platform !== 'android') {
  const projects = readdirSync(join(root, 'ios')).filter((file) =>
    file.endsWith('.xcodeproj')
  );
  assert.equal(projects.length, 1, 'Expected one generated Xcode project');
  const project = xcode
    .project(join(root, 'ios', projects[0], 'project.pbxproj'))
    .parseSync();
  const configs = Object.values(
    project.hash.project.objects.XCBuildConfiguration
  ).filter((entry) => entry.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER);
  const expected = [
    id.iosBundleIdentifier,
    id.widgetBundleIdentifier,
    id.expoWidgetBundleIdentifier,
    id.watchBundleIdentifier,
    id.watchWidgetBundleIdentifier,
  ];
  assert.equal(
    configs.length,
    expected.length * 2,
    'Expected Debug/Release for all five targets'
  );
  const targets = [];
  for (const entry of configs) {
    const settings = entry.buildSettings;
    const bundle = unquote(settings.PRODUCT_BUNDLE_IDENTIFIER);
    assert.ok(expected.includes(bundle), `Unexpected Apple bundle: ${bundle}`);
    const info = parsePlist(join('ios', unquote(settings.INFOPLIST_FILE)));
    const entitlements = parsePlist(
      join('ios', unquote(settings.CODE_SIGN_ENTITLEMENTS))
    );
    assert.deepEqual(entitlements['com.apple.security.application-groups'], [
      id.appGroup,
    ]);
    if (id.appleTeamId)
      assert.equal(unquote(settings.DEVELOPMENT_TEAM), id.appleTeamId);
    if (id.buildNumber) {
      // Expo writes the host version directly into Info.plist; native targets
      // may instead expand CURRENT_PROJECT_VERSION at compile time.
      const version =
        info.CFBundleVersion && !String(info.CFBundleVersion).includes('$(')
          ? info.CFBundleVersion
          : settings.CURRENT_PROJECT_VERSION;
      assert.equal(Number(version), id.buildNumber);
    }
    const schemes = (info.CFBundleURLTypes || []).flatMap(
      (item) => item.CFBundleURLSchemes
    );
    if (bundle === id.iosBundleIdentifier) {
      assert.ok(schemes.includes(id.scheme));
      assert.equal(entitlements['com.apple.developer.healthkit'], true);
      if (id.mode === 'custom' && !id.isDev)
        assert.ok(!schemes.some((scheme) => scheme.startsWith('exp+')));
    }
    if (bundle === id.widgetBundleIdentifier)
      assert.equal(info.APP_URL_SCHEME, id.scheme);
    if (bundle === id.watchBundleIdentifier) {
      assert.equal(
        unquote(settings.INFOPLIST_KEY_WKCompanionAppBundleIdentifier),
        id.iosBundleIdentifier
      );
      assert.ok(schemes.includes(id.watchScheme));
      assert.equal(entitlements['com.apple.developer.healthkit'], true);
    }
    if (
      [id.watchBundleIdentifier, id.watchWidgetBundleIdentifier].includes(
        bundle
      )
    )
      assert.equal(info.WATCH_URL_SCHEME, id.watchScheme);
    targets.push({
      bundle,
      configuration: entry.name,
      settings,
      info,
      entitlements,
    });
  }
  for (const bundle of expected)
    assert.deepEqual(
      targets
        .filter((target) => target.bundle === bundle)
        .map((target) => target.configuration)
        .sort(),
      ['Debug', 'Release']
    );
  snapshot.platforms.ios = targets.sort((a, b) =>
    `${a.bundle}/${a.configuration}`.localeCompare(
      `${b.bundle}/${b.configuration}`
    )
  );
}
if (platform !== 'ios') {
  const gradle = read('android/app/build.gradle');
  assert.ok(gradle.includes(`applicationId '${id.androidPackage}'`));
  assert.ok(gradle.includes(`namespace '${id.androidPackage}'`));
  assert.match(
    gradle,
    /release\s*\{[\s\S]*?signingConfig signingConfigs.release/
  );
  assert.equal(
    (gradle.match(/signingConfig signingConfigs.debug/g) || []).length,
    1
  );
  assert.ok(gradle.includes('Release signing is incomplete'));
  assert.ok(gradle.includes('gradle.taskGraph.whenReady'));
  if (id.buildNumber)
    assert.match(gradle, new RegExp(`versionCode ${id.buildNumber}\\b`));
  const manifest = await parseStringPromise(
    read('android/app/src/main/AndroidManifest.xml')
  );
  const schemes = manifest.manifest.application
    .flatMap((app) => app.activity || [])
    .flatMap((activity) => activity['intent-filter'] || [])
    .flatMap((filter) => filter.data || [])
    .map((data) => data.$['android:scheme'])
    .filter(Boolean);
  assert.ok(schemes.includes(id.scheme));
  if (id.mode === 'custom' && !id.isDev)
    assert.ok(!schemes.some((scheme) => scheme.startsWith('exp+')));
  const sources = [
    'widget/CalorieWidget.kt',
    'widget/MacroWidget.kt',
    'workoutnotification/WorkoutNotificationModule.kt',
  ].map((file) =>
    read(`android/app/src/main/java/com/sparkyapps/sparkyfitness/${file}`)
  );
  for (const source of sources) {
    assert.ok(source.includes(`${id.scheme}://`));
    assert.ok(!source.includes('{{APP_URL_SCHEME}}'));
    if (id.mode === 'custom')
      assert.ok(!source.includes('sparkyfitnessmobile://'));
  }
  snapshot.platforms.android = { gradle, manifest, sources };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  return value;
}
const serialized = JSON.stringify(canonical(snapshot), null, 2) + '\n';
if (argument('--compare'))
  assert.equal(
    serialized,
    readFileSync(resolve(argument('--compare')), 'utf8'),
    'Native metadata changed across prebuilds'
  );
if (argument('--snapshot'))
  writeFileSync(resolve(argument('--snapshot')), serialized);
console.log(
  `${id.mode}/${id.variant} ${platform}: native identity checks passed (${createHash('sha256').update(serialized).digest('hex')})`
);
