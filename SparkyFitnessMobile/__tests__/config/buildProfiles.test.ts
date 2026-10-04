import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import profiles from '../../eas.json';
import { resolveAppIdentity } from '../../app.identifiers';
import { configureReleaseSigning } from '../../plugins/withReleaseSigning';

const root = path.resolve(__dirname, '../..');
it.each(['development', 'preview', 'production'])(
  'loads the %s profile for local commands',
  (variant) => {
    const result = execFileSync(
      process.execPath,
      [
        'scripts/with-build-profile.mjs',
        `sparkyrivals-${variant}`,
        process.execPath,
        '-e',
        'console.log(JSON.stringify(require("./app.identifiers").resolveAppIdentity()))',
      ],
      {
        cwd: root,
        env: {
          PATH: process.env.PATH,
          EXPO_NO_DOTENV: '1',
          APP_CONFIG_ONLY: '1',
          EXPO_BUILD_NUMBER: '100',
        },
        encoding: 'utf8',
      }
    );
    const identity = JSON.parse(result);
    expect(identity.variant).toBe(variant);
    expect(identity.remotePushEnabled).toBe(variant === 'production');
    expect(identity.googleServicesFile).toBe(
      variant === 'production'
        ? './firebase/google-services.production.json'
        : undefined
    );
    expect(identity.androidPackage).toBe(
      `com.imjstnick.sparkyrivals${variant === 'production' ? '' : variant === 'development' ? '.dev' : '.preview'}`
    );
    expect(identity.buildNumber).toBe(100);
    expect(identity.easProjectId).toBe('63f08cec-3f87-4cee-89be-bebf970b6262');
    expect(identity.owner).toBe('imjstnickdev');
    expect(identity.appleTeamId).toBe('U5K88Y67DL');
  }
);
it('resolves owned production identity for internal distribution without inspection mode', () => {
  const result = execFileSync(
    process.execPath,
    [
      'scripts/with-build-profile.mjs',
      'sparkyrivals-production-internal',
      process.execPath,
      '-e',
      'console.log(JSON.stringify(require("./app.identifiers").resolveAppIdentity()))',
    ],
    {
      cwd: root,
      env: { PATH: process.env.PATH, EXPO_NO_DOTENV: '1' },
      encoding: 'utf8',
    }
  );
  expect(JSON.parse(result)).toMatchObject({
    mode: 'custom',
    variant: 'production',
    configOnly: false,
    androidPackage: 'com.imjstnick.sparkyrivals',
    iosBundleIdentifier: 'com.imjstnick.sparkyrivals',
    scheme: 'sparkyrivals',
    watchScheme: 'sparkyrivals-watch',
    appGroup: 'group.com.imjstnick.sparkyrivals.shared',
    easProjectId: '63f08cec-3f87-4cee-89be-bebf970b6262',
    owner: 'imjstnickdev',
    appleTeamId: 'U5K88Y67DL',
  });
  expect(profiles.build['sparkyrivals-production-internal']).toMatchObject({
    extends: 'sparkyrivals-production',
    distribution: 'internal',
    developmentClient: false,
    ios: { credentialsSource: 'remote' },
  });
});

it('keeps owned account configuration out of default upstream profiles', () => {
  for (const profile of ['development', 'preview', 'production'] as const) {
    const identity = resolveAppIdentity(profiles.build[profile].env);
    expect(identity.mode).toBe('upstream');
    expect(identity.remotePushEnabled).toBe(false);
    expect(identity.googleServicesFile).toBeUndefined();
    expect(identity.owner).toBeUndefined();
    expect(identity.appleTeamId).toBe('');
    expect(identity.easProjectId).toBe('498a86c5-344f-4d2c-9033-dfd720e4a383');
  }
});
it('uses remote incrementing versions without any submission destination', () => {
  expect(profiles.cli.appVersionSource).toBe('remote');
  expect(profiles.build['sparkyrivals-base'].autoIncrement).toBe(true);
  expect(profiles).not.toHaveProperty('submit');
  expect(JSON.stringify(profiles)).not.toMatch(
    /6757314392|498a86c5|autoSubmit|withoutCredentials/
  );
});
it.each(['0', '-1', '1.5', 'NaN', '2100000001', ''])(
  'rejects invalid build number %s',
  (number) => {
    expect(() => resolveAppIdentity({ EXPO_BUILD_NUMBER: number })).toThrow(
      'EXPO_BUILD_NUMBER'
    );
  }
);
it('guards local owned releases against the default versionCode', () => {
  const result = configureReleaseSigning(
    'android { signingConfigs {\n debug {} } buildTypes { release { signingConfig signingConfigs.debug } } }',
    false,
    true
  );
  expect(result).toContain(
    "if (true && System.getenv('EAS_BUILD') != 'true' && android.defaultConfig.versionCode <= 1)"
  );
});

it('loads ignored local build settings without overriding explicit process values', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-profile-env-'));
  try {
    fs.mkdirSync(path.join(temp, 'scripts'));
    for (const file of [
      'scripts/with-build-profile.mjs',
      'app.identifiers.js',
      'eas.json',
    ]) {
      fs.copyFileSync(path.join(root, file), path.join(temp, file));
    }
    fs.symlinkSync(
      path.join(root, 'node_modules'),
      path.join(temp, 'node_modules')
    );
    fs.writeFileSync(
      path.join(temp, '.env.local'),
      'EXPO_BUILD_NUMBER=123\nAPP_CONFIG_ONLY=1\n'
    );
    for (const override of [undefined, '456']) {
      const output = execFileSync(
        process.execPath,
        [
          'scripts/with-build-profile.mjs',
          'sparkyrivals-preview',
          process.execPath,
          '-e',
          'console.log(require("./app.identifiers").resolveAppIdentity().buildNumber)',
        ],
        {
          cwd: temp,
          encoding: 'utf8',
          env: {
            PATH: process.env.PATH,
            NODE_ENV: 'development',
            ...(override ? { EXPO_BUILD_NUMBER: override } : {}),
          },
        }
      );
      expect(output.trim()).toBe(override || '123');
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

it('ships only ordinary Firebase client configuration matching the production phone', () => {
  const text = fs.readFileSync(
    path.join(root, 'firebase/google-services.production.json'),
    'utf8'
  );
  const client = JSON.parse(text);
  expect(client.project_info.project_id).toBe('sparkyrivals-fb');
  expect(
    client.client.map(
      (c: { client_info: { android_client_info: { package_name: string } } }) =>
        c.client_info.android_client_info.package_name
    )
  ).toEqual(['com.imjstnick.sparkyrivals']);
  expect(text).not.toMatch(/private_key|service_account|BEGIN.*PRIVATE KEY/);
  const config = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');
  expect(config).toContain('googleServicesFile: identity.googleServicesFile');
  const wear = fs.readFileSync(
    path.join(root, 'targets/wear/build.gradle.template'),
    'utf8'
  );
  expect(wear).not.toMatch(/google-services|firebase-messaging/);
});
