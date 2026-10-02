import { configureReleaseSigning } from '../../plugins/withReleaseSigning';

const template = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            keyAlias 'androiddebugkey'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Expo's default is intentionally replaced.
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}
`;

it('keeps debug signing and selects an explicit release config', () => {
  const result = configureReleaseSigning(template, false);
  expect(result).toMatch(/debug\s*\{\s*signingConfig signingConfigs.debug/);
  expect(result).toMatch(
    /release\s*\{\s*\/\/ Expo[^\n]*\n\s*signingConfig signingConfigs.release/
  );
  expect(result.match(/signingConfig signingConfigs.debug/g)).toHaveLength(1);
  for (const property of [
    'STORE_FILE',
    'STORE_PASSWORD',
    'KEY_ALIAS',
    'KEY_PASSWORD',
  ]) {
    expect(result).toContain(`MYAPP_RELEASE_${property}`);
  }
  expect(result).toContain('project.findProperty(key) ?: System.getenv(key)');
  expect(result).toContain('gradle.taskGraph.whenReady');
  expect(result).toContain(
    'def signing = android.buildTypes.release.signingConfig'
  );
  expect(result).toContain("signing.keyAlias == 'androiddebugkey'");
  expect(result).toContain('!signing.storeFile.isFile()');
  expect(result).not.toContain('if (true)');
});

it('is idempotent and can regenerate the configuration-only guard', () => {
  const first = configureReleaseSigning(template, false);
  expect(configureReleaseSigning(first, false)).toBe(first);
  const configOnly = configureReleaseSigning(first, true);
  expect(configOnly).toContain('if (true)');
  expect(configureReleaseSigning(configOnly, false)).toBe(first);
});

it('fails closed if an upstream template no longer matches', () => {
  expect(() => configureReleaseSigning('android {}', false)).toThrow(
    'Unsupported'
  );
  expect(() =>
    configureReleaseSigning(
      template.replaceAll('signingConfig ', 'unexpected '),
      false
    )
  ).toThrow('Unsupported');
});
