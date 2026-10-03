import fs from 'fs';
import path from 'path';
import { resolveAppIdentity } from '../../app.identifiers';
import {
  configureWearSettings,
  renderWearGradle,
} from '../../plugins/withWearOsCompanion';
const root = path.resolve(__dirname, '../..');
const template = fs.readFileSync(
  path.join(root, 'targets/wear/build.gradle.template'),
  'utf8'
);
const env = {
  APP_IDENTITY: 'custom',
  APP_CONFIG_ONLY: '1',
  EXPO_WEAR_ENABLED: '1',
  EXPO_APP_NAME: 'SparkyRivals',
  EXPO_APP_SLUG: 'sparkyrivals',
  EXPO_ANDROID_PACKAGE: 'com.imjstnick.sparkyrivals',
  EXPO_IOS_BUNDLE_IDENTIFIER: 'com.imjstnick.sparkyrivals',
  EXPO_APP_SCHEME: 'sparkyrivals',
};
describe('Wear build identity', () => {
  it.each(['development', 'preview', 'production'])(
    'shares phone applicationId for %s',
    (variant) => {
      const id = resolveAppIdentity({ ...env, APP_VARIANT: variant });
      const gradle = renderWearGradle(template, id, '1.7.3');
      expect(id.wearApplicationId).toBe(id.androidPackage);
      expect(gradle).toContain(`applicationId '${id.androidPackage}'`);
      expect(gradle).not.toContain('{{');
      expect(gradle).toContain('versionCode 1000000001');
      expect(gradle).toContain('phone.buildTypes.debug.signingConfig');
      expect(gradle).toContain('phone.buildTypes.release.signingConfig');
      expect(gradle).not.toContain('signingConfigs.debug');
      expect(gradle).not.toContain('MYAPP_WEAR');
      expect(gradle).toContain('!signing.storePassword');
    }
  );
  it('does not create an upstream Wear identity', () => {
    expect(resolveAppIdentity({}).wearEnabled).toBe(false);
    expect(() => resolveAppIdentity({ EXPO_WEAR_ENABLED: '1' })).toThrow(
      'owned custom'
    );
    expect(() =>
      resolveAppIdentity({ ...env, EXPO_WEAR_ENABLED: 'yes' })
    ).toThrow();
  });
  it.each(['0', '-1', '1.5', '100', '999999999', '2100000001', 'NaN'])(
    'rejects Wear version %s',
    (version) => {
      expect(() =>
        resolveAppIdentity({ ...env, EXPO_WEAR_BUILD_NUMBER: version })
      ).toThrow('EXPO_WEAR_BUILD_NUMBER');
    }
  );
  it('allows an allocated Wear code and rejects a phone range collision', () => {
    expect(
      resolveAppIdentity({ ...env, EXPO_WEAR_BUILD_NUMBER: '1000000101' })
        .wearBuildNumberExplicit
    ).toBe(true);
    expect(() =>
      resolveAppIdentity({ ...env, EXPO_BUILD_NUMBER: '1000000101' })
    ).toThrow('below');
    expect(template).toContain('phone.defaultConfig.versionCode >= 1000000000');
  });
  it('fails release without an allocated code and owned configuration', () => {
    const output = renderWearGradle(template, resolveAppIdentity(env), '1.0.0');
    expect(output).toContain('if (true || !false)');
    expect(output).toContain(
      'signing != phone.buildTypes.release.signingConfig'
    );
  });
  it('wires a separate module idempotently without making phone builds assemble it', () => {
    const once = configureWearSettings("include ':app'\n");
    expect(configureWearSettings(once)).toBe(once);
    expect(once.match(/include ':wear'/g)).toHaveLength(1);
    expect(template).not.toContain('com.facebook.react');
    expect(template).not.toContain('assembleDebug.dependsOn');
    expect(template).toContain(
      'buildToolsVersion rootProject.ext.buildToolsVersion'
    );
  });
  it('declares watch-only non-standalone without health or network permissions', () => {
    const manifest = fs.readFileSync(
      path.join(root, 'targets/wear/src/main/AndroidManifest.xml'),
      'utf8'
    );
    expect(manifest).toContain('android.hardware.type.watch');
    expect(manifest).toContain('android:required="true"');
    expect(manifest).toContain(
      'android:name="com.google.android.wearable.standalone" android:value="false"'
    );
    expect(manifest).not.toContain('uses-permission');
    expect(template).toContain('compose-material3:1.5.0');
  });
});
