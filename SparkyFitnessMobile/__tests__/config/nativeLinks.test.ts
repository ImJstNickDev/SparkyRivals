import fs from 'fs';
import os from 'os';
import path from 'path';
import { withDangerousMod } from 'expo/config-plugins';
import withCalorieWidget from '../../plugins/withCalorieWidget';
import withWorkoutNotification from '../../plugins/withWorkoutNotification';

jest.mock('expo/config-plugins', () => ({
  withDangerousMod: jest.fn((config) => config),
  withAndroidManifest: jest.fn((config) => config),
  withMainApplication: jest.fn((config) => config),
}));

const root = path.resolve(__dirname, '../..');
const originalEnv = process.env;
let output: string;
beforeEach(() => {
  output = fs.mkdtempSync(path.join(os.tmpdir(), 'native-links-'));
  jest.clearAllMocks();
});
afterEach(() => {
  process.env = originalEnv;
  fs.rmSync(output, { recursive: true, force: true });
});

it.each(['development', 'preview', 'production'])(
  'generates Android widget and notification links for %s deterministically',
  async (variant) => {
    process.env = {
      APP_IDENTITY: 'custom',
      APP_VARIANT: variant,
      APP_CONFIG_ONLY: '1',
      EXPO_APP_NAME: 'SparkyRivals',
      EXPO_APP_SLUG: 'sparkyrivals',
      EXPO_ANDROID_PACKAGE: 'com.imjstnick.sparkyrivals',
      EXPO_IOS_BUNDLE_IDENTIFIER: 'com.imjstnick.sparkyrivals',
      EXPO_APP_SCHEME: 'sparkyrivals',
    };
    const suffix =
      variant === 'production'
        ? ''
        : variant === 'development'
          ? '-dev'
          : '-preview';
    const config = {
      name: 'SparkyRivals',
      slug: 'sparkyrivals',
      android: { package: 'com.imjstnick.sparkyrivals' },
    };
    withCalorieWidget(config);
    withWorkoutNotification(config);
    const mods = jest
      .mocked(withDangerousMod)
      .mock.calls.map((call) => call[1][1]);
    const modConfig = {
      ...config,
      modRequest: { projectRoot: root, platformProjectRoot: output },
    };
    const files = [
      'widget/CalorieWidget.kt',
      'widget/MacroWidget.kt',
      'workoutnotification/WorkoutNotificationModule.kt',
    ];
    const read = () =>
      files.map((file) =>
        fs.readFileSync(
          path.join(
            output,
            'app/src/main/java/com/sparkyapps/sparkyfitness',
            file
          ),
          'utf8'
        )
      );
    for (const mod of mods) await mod(modConfig as Parameters<typeof mod>[0]);
    const first = read();
    for (const source of first) {
      expect(source).toContain(`sparkyrivals${suffix}://`);
      expect(source).not.toContain('sparkyfitnessmobile://');
      expect(source).not.toContain('{{APP_URL_SCHEME}}');
    }
    for (const mod of mods) await mod(modConfig as Parameters<typeof mod>[0]);
    expect(read()).toEqual(first);
  }
);

it('reads Apple widget and Watch schemes from generated metadata', () => {
  for (const file of [
    'widget/SharedHelpers.swift',
    'watch/Domain/WatchDeepLink.swift',
    'watch-widget/ComplicationLinks.swift',
  ]) {
    const source = fs.readFileSync(path.join(root, 'targets', file), 'utf8');
    expect(source).toContain(
      file.startsWith('widget/') ? 'APP_URL_SCHEME' : 'WATCH_URL_SCHEME'
    );
    expect(source).not.toMatch(/sparkyfitness(?:mobile|-watch):?\/\//);
  }
});
