// Read-only checks of clean prebuild output. Run with the SAME profile/env as prebuild.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
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
expoRequire('@expo/env').load(root, { silent: true });
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
  // Apple targets use Xcode synchronized filesystem groups, not per-file references.
  const groups = Object.values(
    project.hash.project.objects.PBXFileSystemSynchronizedRootGroup || {}
  ).filter((entry) => typeof entry === 'object');
  for (const target of ['widget', 'watch', 'watch-widget']) {
    assert.ok(
      groups.some((group) => unquote(group.path) === target),
      `Missing synchronized ${target} sources`
    );
  }
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
    'widget/ChallengeWidget.kt',
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
  const receivers = manifest.manifest.application
    .flatMap((app) => app.receiver || [])
    .map((r) => r.$['android:name']);
  for (const name of ['Calorie', 'Macro', 'Challenge'])
    assert.ok(receivers.some((r) => r.endsWith(`${name}WidgetReceiver`)));
  let wear;
  const settings = read('android/settings.gradle');
  if (id.wearEnabled) {
    assert.match(settings, /include ':wear'/);
    const wearGradle = read('android/wear/build.gradle');
    assert.ok(wearGradle.includes(`applicationId '${id.androidPackage}'`));
    assert.ok(wearGradle.includes(`versionCode ${id.wearBuildNumber}`));
    assert.ok(wearGradle.includes('phone.buildTypes.debug.signingConfig'));
    assert.ok(wearGradle.includes('phone.buildTypes.release.signingConfig'));
    assert.ok(wearGradle.includes('!signing.storePassword'));
    assert.ok(
      wearGradle.includes('phone.defaultConfig.versionCode >= 1000000000')
    );
    assert.ok(wearGradle.includes('play-services-wearable:20.0.1'));
    for (const dependency of [
      'androidx.wear.tiles:tiles:1.5.0',
      'androidx.wear.protolayout:protolayout:1.3.0',
      'watchface-complications-data-source:1.2.1',
    ])
      assert.ok(wearGradle.includes(dependency));
    assert.ok(gradle.includes('play-services-wearable:20.0.1'));
    assert.ok(gradle.includes('androidx.work:work-runtime:2.10.1'));
    assert.equal((settings.match(/include ':wear'/g) || []).length, 1);
    const phoneModuleRoot =
      'android/app/src/main/java/com/sparkyrivals/wearbridge';
    for (const source of readdirSync(
      join(
        root,
        'modules/wear-connectivity/android/com/sparkyrivals/wearbridge'
      )
    )) {
      assert.equal(
        read(`${phoneModuleRoot}/${source}`),
        read(
          `modules/wear-connectivity/android/com/sparkyrivals/wearbridge/${source}`
        )
      );
    }
    const protocol = 'com/sparkyrivals/companion/ChallengeProtocol.kt';
    assert.equal(
      read(`android/wear/protocol/${protocol}`),
      read(`targets/wear/protocol/${protocol}`)
    );
    assert.equal(
      read(`android/app/src/main/java/${protocol}`),
      read(`targets/wear/protocol/${protocol}`)
    );
    assert.ok(
      read('android/app/src/main/res/values/wear.xml').includes(
        'sparkyrivals_challenge_phone_v1'
      )
    );
    const application = read(
      `android/app/src/main/java/${id.androidPackage.replaceAll('.', '/')}/MainApplication.kt`
    );
    assert.equal(
      (application.match(/add\(WearConnectivityPackage\(\)\)/g) || []).length,
      1
    );
    assert.ok(!wearGradle.includes('com.facebook.react'));
    assert.ok(!wearGradle.includes('{{'));
    const wearManifest = await parseStringPromise(
      read('android/wear/src/main/AndroidManifest.xml')
    );
    assert.deepEqual(wearManifest.manifest['uses-feature'][0].$, {
      'android:name': 'android.hardware.type.watch',
      'android:required': 'true',
    });
    assert.equal(wearManifest.manifest['uses-permission'], undefined);
    assert.equal(
      wearManifest.manifest.application[0]['meta-data'][0].$['android:value'],
      'false'
    );
    assert.equal(
      wearManifest.manifest.application[0]['meta-data'][0].$['android:name'],
      'com.google.android.wearable.standalone'
    );
    const services = wearManifest.manifest.application[0].service;
    for (const [name, permission] of [
      [
        'ChallengeTileService',
        'com.google.android.wearable.permission.BIND_TILE_PROVIDER',
      ],
      [
        'ChallengeComplicationService',
        'com.google.android.wearable.permission.BIND_COMPLICATION_PROVIDER',
      ],
    ]) {
      const service = services.find((s) => s.$['android:name'].endsWith(name));
      assert.ok(service, `Missing ${name}`);
      assert.equal(service.$['android:permission'], permission);
    }
    for (const file of [
      'ChallengeTileService.kt',
      'ChallengeComplicationService.kt',
      'ChallengeSurfaces.kt',
    ])
      assert.equal(
        read(`android/wear/src/main/kotlin/com/sparkyrivals/wear/${file}`),
        read(`targets/wear/src/main/kotlin/com/sparkyrivals/wear/${file}`)
      );
    const files = {};
    const visit = (dir) => {
      for (const entry of readdirSync(join(root, dir), {
        withFileTypes: true,
      })) {
        const file = join(dir, entry.name);
        if (entry.isDirectory()) visit(file);
        else
          files[file] = createHash('sha256').update(read(file)).digest('hex');
      }
    };
    visit('android/wear');
    wear = { gradle: wearGradle, manifest: wearManifest, files };
  } else {
    assert.ok(!settings.includes("include ':wear'"));
    assert.ok(!existsSync(join(root, 'android/wear')));
    assert.ok(!gradle.includes('play-services-wearable'));
    assert.ok(
      !existsSync(
        join(root, 'android/app/src/main/java/com/sparkyrivals/wearbridge')
      )
    );
  }
  snapshot.platforms.android = { gradle, manifest, sources, wear };
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
