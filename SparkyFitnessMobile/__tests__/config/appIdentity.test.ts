import type { ConfigContext } from 'expo/config';
import { resolveAppIdentity } from '../../app.identifiers';
import appConfig from '../../app.config';

jest.mock('tsx/cjs', () => ({}));

// These are configuration fixtures, not registered Expo/Apple account values.
const custom = {
  APP_IDENTITY: 'custom',
  EXPO_APP_NAME: 'SparkyRivals',
  EXPO_APP_SLUG: 'sparkyrivals',
  EXPO_ANDROID_PACKAGE: 'com.imjstnick.sparkyrivals',
  EXPO_IOS_BUNDLE_IDENTIFIER: 'com.imjstnick.sparkyrivals',
  EXPO_APP_SCHEME: 'sparkyrivals',
  EXPO_EAS_PROJECT_ID: '12345678-1234-1234-1234-123456789abc',
  EXPO_OWNER: 'test-owner',
};

describe('application identity', () => {
  it.each(['development', 'dev', 'preview', 'production'])(
    'preserves upstream %s',
    (variant) => {
      const identity = resolveAppIdentity({ APP_VARIANT: variant });
      const dev = ['development', 'dev'].includes(variant);
      expect(identity.iosBundleIdentifier).toBe(
        dev
          ? 'org.SparkyApps.SparkyFitnessMobile1.dev'
          : 'com.SparkyApps.SparkyFitnessMobile'
      );
      expect(identity.androidPackage).toBe(identity.iosBundleIdentifier);
      expect(identity.name).toBe('SparkyFitness');
      expect(identity.scheme).toBe('sparkyfitnessmobile');
      expect(identity.watchScheme).toBe('sparkyfitness-watch');
      expect(identity.easProjectId).toBe(
        '498a86c5-344f-4d2c-9033-dfd720e4a383'
      );
    }
  );

  it.each([
    ['dev', '.dev', '-dev', ' Dev'],
    ['development', '.dev', '-dev', ' Dev'],
    ['preview', '.preview', '-preview', ' Preview'],
    ['production', '', '', ''],
  ])(
    'derives isolated custom %s identities',
    (variant, bundleSuffix, schemeSuffix, nameSuffix) => {
      const identity = resolveAppIdentity({ ...custom, APP_VARIANT: variant });
      const host = `com.imjstnick.sparkyrivals${bundleSuffix}`;
      expect(identity).toMatchObject({
        name: `SparkyRivals${nameSuffix}`,
        slug: 'sparkyrivals',
        androidPackage: host,
        iosBundleIdentifier: host,
        scheme: `sparkyrivals${schemeSuffix}`,
        watchScheme: `sparkyrivals${schemeSuffix}-watch`,
        appGroup: `group.${host}.shared`,
        widgetBundleIdentifier: `${host}.widget`,
        expoWidgetBundleIdentifier: `${host}.ExpoWidgetsTarget`,
        watchBundleIdentifier: `${host}.watchkitapp`,
        watchWidgetBundleIdentifier: `${host}.watchkitapp.watch-widget`,
      });
    }
  );

  it('preserves legacy overrides only where they apply', () => {
    expect(
      resolveAppIdentity({
        EXPO_DEV_BUNDLE_IDENTIFIER: 'org.example.dev',
        IOS_APP_GROUP_DEV: 'group.example',
        WIDGET_BUNDLE_IDENTIFIER: 'org.example.live',
      })
    ).toMatchObject({
      iosBundleIdentifier: 'org.example.dev',
      appGroup: 'group.example',
      expoWidgetBundleIdentifier: 'org.example.live',
    });
    expect(
      resolveAppIdentity({
        ...custom,
        EXPO_DEV_BUNDLE_IDENTIFIER: 'org.ignored.dev',
      }).iosBundleIdentifier
    ).toBe('com.imjstnick.sparkyrivals.dev');
  });

  it.each(['staging', 'prod', 'DEVELOPMENT'])(
    'rejects unknown variant %s',
    (variant) => {
      expect(() => resolveAppIdentity({ APP_VARIANT: variant })).toThrow(
        'APP_VARIANT'
      );
    }
  );

  it('rejects unknown identity modes', () => {
    expect(() => resolveAppIdentity({ APP_IDENTITY: 'typo' })).toThrow(
      'APP_IDENTITY'
    );
  });

  it.each(Object.keys(custom).filter((key) => key !== 'APP_IDENTITY'))(
    'requires custom field %s',
    (key) => {
      expect(() =>
        resolveAppIdentity({
          ...custom,
          APP_VARIANT: 'production',
          [key]: undefined,
        })
      ).toThrow(key);
    }
  );

  it.each([
    { EXPO_EAS_PROJECT_ID: '498a86c5-344f-4d2c-9033-dfd720e4a383' },
    { EXPO_IOS_BUNDLE_IDENTIFIER: 'com.SparkyApps.SparkyFitnessMobile' },
    { EXPO_APP_SCHEME: 'sparkyfitnessmobile' },
    { EXPO_APP_SCHEME: 'https' },
    { EXPO_WATCH_SCHEME: 'sparkyfitness-watch' },
    { EXPO_EAS_PROJECT_ID: 'not-a-uuid' },
    { IOS_APP_GROUP_DEV: 'group.com.imjstnick.sparkyrivals.shared' },
    { WIDGET_BUNDLE_IDENTIFIER: 'com.other.widget' },
    { EXPO_DEV_APPLE_TEAM_ID: 'invalid' },
    { EXPO_APP_SCHEME: 'bad://scheme' },
    { EXPO_ANDROID_PACKAGE: 'bad/package' },
  ])('rejects unsafe custom configuration %j', (override) => {
    expect(() => resolveAppIdentity({ ...custom, ...override })).toThrow();
  });

  it('allows explicitly unlinked local configuration without an invented project', () => {
    const env = {
      ...custom,
      EXPO_EAS_PROJECT_ID: undefined,
      EXPO_OWNER: undefined,
      APP_CONFIG_ONLY: '1',
    };
    expect(resolveAppIdentity(env)).toMatchObject({
      configOnly: true,
      easProjectId: undefined,
      owner: undefined,
    });
    expect(() => resolveAppIdentity({ ...env, EAS_BUILD: 'true' })).toThrow(
      'APP_CONFIG_ONLY'
    );
    expect(() =>
      resolveAppIdentity({
        ...env,
        EXPO_EAS_PROJECT_ID: '498a86c5-344f-4d2c-9033-dfd720e4a383',
      })
    ).toThrow('upstream EAS');
  });
});

describe('resolved Expo configuration', () => {
  const originalEnv = process.env;
  const context: ConfigContext = {
    projectRoot: process.cwd(),
    staticConfigPath: null,
    dynamicConfigPath: null,
    config: {
      name: 'static',
      slug: 'static',
      scheme: 'sparkyfitnessmobile',
      extra: { eas: { projectId: '498a86c5-344f-4d2c-9033-dfd720e4a383' } },
    },
  };
  afterEach(() => {
    process.env = originalEnv;
  });

  it('replaces static upstream destinations and does not expose build secrets', () => {
    process.env = {
      ...custom,
      APP_CONFIG_ONLY: '1',
      EXPO_EAS_PROJECT_ID: undefined,
      EXPO_OWNER: undefined,
      MYAPP_RELEASE_STORE_PASSWORD: 'test-secret-not-for-config',
    };
    const config = appConfig(context);
    expect(config.android?.package).toBe('com.imjstnick.sparkyrivals.dev');
    expect(config.scheme).toBe('sparkyrivals-dev');
    expect(config.extra?.eas).toBeUndefined();
    expect(JSON.stringify(config)).not.toContain(
      '498a86c5-344f-4d2c-9033-dfd720e4a383'
    );
    expect(JSON.stringify(config)).not.toContain('test-secret-not-for-config');
  });

  it('does not retain development permissions across config evaluations', () => {
    process.env = { APP_VARIANT: 'development' };
    const first = appConfig(context);
    expect(appConfig(context).android?.permissions).toEqual(
      first.android?.permissions
    );
    process.env = { APP_VARIANT: 'production' };
    expect(appConfig(context).android?.permissions).not.toContain(
      'android.permission.health.WRITE_STEPS'
    );
  });
});
