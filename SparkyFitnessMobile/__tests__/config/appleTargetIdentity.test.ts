import fs from 'fs';
import widgetConfig from '../../targets/widget/expo-target.config';
import watchConfig from '../../targets/watch/expo-target.config';
import watchWidgetConfig from '../../targets/watch-widget/expo-target.config';
import { resolveAppIdentity } from '../../app.identifiers';

describe('Apple target identity relationships', () => {
  const originalEnv = process.env;
  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it.each([
    ['upstream', 'development'],
    ['upstream', 'production'],
    ['custom', 'development'],
    ['custom', 'preview'],
    ['custom', 'production'],
  ])('derives %s/%s targets and runtime metadata', (mode, variant) => {
    process.env = {
      APP_IDENTITY: mode,
      APP_VARIANT: variant,
      APP_CONFIG_ONLY: '1',
      EXPO_APP_NAME: 'SparkyRivals',
      EXPO_APP_SLUG: 'sparkyrivals',
      EXPO_ANDROID_PACKAGE: 'com.imjstnick.sparkyrivals',
      EXPO_IOS_BUNDLE_IDENTIFIER: 'com.imjstnick.sparkyrivals',
      EXPO_APP_SCHEME: 'sparkyrivals',
    };
    const writes = new Map<string, string>();
    jest.spyOn(fs, 'writeFileSync').mockImplementation((file, content) => {
      writes.set(String(file), String(content));
    });
    const identity = resolveAppIdentity();
    const input = { name: identity.name, slug: identity.slug };
    const targets = [
      widgetConfig(input),
      watchConfig(input),
      watchWidgetConfig(input),
    ];
    expect(targets.map((target) => target.bundleIdentifier)).toEqual([
      identity.widgetBundleIdentifier,
      identity.watchBundleIdentifier,
      identity.watchWidgetBundleIdentifier,
    ]);
    for (const target of targets) {
      expect(
        target.entitlements['com.apple.security.application-groups']
      ).toEqual([identity.appGroup]);
    }
    expect(targets.map((target) => target.name)).toEqual([
      'CalorieTracker',
      'SparkyFitnessWatch',
      'SparkyFitnessWatchWidget',
    ]);
    expect(writes.size).toBe(3);
    for (const [file, contents] of writes) {
      expect(contents).toContain(`<string>${identity.appGroup}</string>`);
      const scheme = file.includes('/widget/')
        ? identity.scheme
        : identity.watchScheme;
      expect(contents).toContain(`<string>${scheme}</string>`);
    }
    expect(
      watchConfig(input).entitlements['com.apple.developer.healthkit']
    ).toBe(true);
    expect(watchConfig(input).deploymentTarget).toBe(
      watchWidgetConfig(input).deploymentTarget
    );
    const first = [...writes];
    widgetConfig(input);
    watchConfig(input);
    watchWidgetConfig(input);
    expect([...writes]).toEqual(first);
  });
});
