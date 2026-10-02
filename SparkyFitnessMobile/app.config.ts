import 'tsx/cjs';
import { ExpoConfig, ConfigContext } from 'expo/config';
import { nativeLanguageTags } from './src/localization/localeRegistry';
import { resolveAppIdentity } from './app.identifiers';
// Optional. With it, Android draws cardio routes over Google Maps; without
// it, Android keeps the plain route line and nothing else changes. iOS uses
// Apple Maps and needs no key. Supply it from the build environment (an EAS
// secret, for instance), never from the repo.
const GOOGLE_MAPS_ANDROID_API_KEY =
  process.env.GOOGLE_MAPS_ANDROID_API_KEY || '';

const androidPermissions = [
  'android.permission.INTERNET',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.POST_PROMOTED_NOTIFICATIONS',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  'android.permission.health.READ_BASAL_BODY_TEMPERATURE',
  'android.permission.health.READ_BASAL_METABOLIC_RATE',
  'android.permission.health.READ_BLOOD_GLUCOSE',
  'android.permission.health.READ_BLOOD_PRESSURE',
  'android.permission.health.READ_BODY_FAT',
  'android.permission.health.READ_BODY_TEMPERATURE',
  'android.permission.health.READ_BODY_WATER_MASS',
  'android.permission.health.READ_BONE_MASS',
  'android.permission.health.READ_CERVICAL_MUCUS',
  'android.permission.health.READ_CYCLING_PEDALING_CADENCE',
  'android.permission.health.READ_EXERCISE',
  // Route data is gated separately from READ_EXERCISE and is granted per
  // session through requestExerciseRoute's system dialog; the blanket
  // READ_EXERCISE_ROUTES_ALL is a restricted permission Google grants only to
  // allowlisted apps. READ_HEALTH_DATA_IN_BACKGROUND does not cover routes.
  'android.permission.health.READ_EXERCISE_ROUTES',
  'android.permission.health.READ_DISTANCE',
  'android.permission.health.READ_ELEVATION_GAINED',
  'android.permission.health.READ_FLOORS_CLIMBED',
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_HEART_RATE_VARIABILITY',
  'android.permission.health.READ_HEIGHT',
  'android.permission.health.READ_HYDRATION',
  'android.permission.health.READ_NUTRITION',
  'android.permission.health.READ_LEAN_BODY_MASS',
  'android.permission.health.READ_INTERMENSTRUAL_BLEEDING',
  'android.permission.health.READ_MENSTRUATION',
  'android.permission.health.READ_OVULATION_TEST',
  'android.permission.health.READ_OXYGEN_SATURATION',
  'android.permission.health.READ_POWER',
  'android.permission.health.READ_RESPIRATORY_RATE',
  'android.permission.health.READ_RESTING_HEART_RATE',
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_SPEED',
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_STEPS_CADENCE',
  'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  'android.permission.health.READ_VO2_MAX',
  'android.permission.health.READ_WEIGHT',
  'android.permission.health.READ_WHEELCHAIR_PUSHES',
  'android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND',
  'android.permission.health.READ_HEALTH_DATA_HISTORY',
  // Writeback (Sparky → Health Connect): nutrition + water. Production feature,
  // so these live in the base list (not the dev-only writes below).
  'android.permission.health.WRITE_NUTRITION',
  'android.permission.health.WRITE_HYDRATION',
  // Exact rest-complete alerts: without this special access (user-granted via
  // "Alarms & reminders" on Android 13+), expo-notifications falls back to
  // inexact alarms that the OS batches ~15s late.
  'android.permission.SCHEDULE_EXACT_ALARM',
];

const devAndroidPermissions = [
  'android.permission.health.WRITE_ACTIVE_CALORIES_BURNED',
  'android.permission.health.WRITE_BASAL_BODY_TEMPERATURE',
  'android.permission.health.WRITE_BASAL_METABOLIC_RATE',
  'android.permission.health.WRITE_BLOOD_GLUCOSE',
  'android.permission.health.WRITE_BLOOD_PRESSURE',
  'android.permission.health.WRITE_BODY_FAT',
  'android.permission.health.WRITE_BODY_TEMPERATURE',
  'android.permission.health.WRITE_BODY_WATER_MASS',
  'android.permission.health.WRITE_BONE_MASS',
  'android.permission.health.WRITE_CERVICAL_MUCUS',
  'android.permission.health.WRITE_CYCLING_PEDALING_CADENCE',
  'android.permission.health.WRITE_EXERCISE',
  'android.permission.health.WRITE_EXERCISE_ROUTE',
  'android.permission.health.WRITE_DISTANCE',
  'android.permission.health.WRITE_ELEVATION_GAINED',
  'android.permission.health.WRITE_FLOORS_CLIMBED',
  'android.permission.health.WRITE_HEART_RATE',
  'android.permission.health.WRITE_HEIGHT',
  // WRITE_HYDRATION moved to the base androidPermissions list (writeback feature).
  'android.permission.health.WRITE_LEAN_BODY_MASS',
  'android.permission.health.WRITE_INTERMENSTRUAL_BLEEDING',
  'android.permission.health.WRITE_MENSTRUATION',
  'android.permission.health.WRITE_OVULATION_TEST',
  'android.permission.health.WRITE_OXYGEN_SATURATION',
  'android.permission.health.WRITE_POWER',
  'android.permission.health.WRITE_RESPIRATORY_RATE',
  'android.permission.health.WRITE_RESTING_HEART_RATE',
  'android.permission.health.WRITE_SLEEP',
  'android.permission.health.WRITE_SPEED',
  'android.permission.health.WRITE_STEPS',
  'android.permission.health.WRITE_STEPS_CADENCE',
  'android.permission.health.WRITE_TOTAL_CALORIES_BURNED',
  'android.permission.health.WRITE_VO2_MAX',
  'android.permission.health.WRITE_WEIGHT',
  'android.permission.health.WRITE_WHEELCHAIR_PUSHES',
];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('./package.json');

export default ({ config }: ConfigContext): Partial<ExpoConfig> => {
  const identity = resolveAppIdentity();
  const { isDev } = identity;

  // Plugins only included in production builds
  const prodPlugins = ['./plugins/withNetworkSecurityConfig'];

  // Plugins only included in dev builds. The push-notification entitlement is
  // stripped because free Apple "Personal Team" accounts cannot sign a build
  // that declares the Push Notifications capability, and only local
  // notifications are used. See plugins/withoutPushNotificationEntitlement.ts.
  //
  // MUST be spread FIRST in the `plugins` array below, not last. For a given
  // mod type (e.g. "entitlements"), @expo/config-plugins wraps each newly
  // registered mod around the previously registered one and runs the NEW
  // one's function first, then delegates to the previous one — so execution
  // order is the REVERSE of registration order. Registering last (as this
  // used to) made our delete run FIRST, before expo-notifications/
  // expo-widgets had added `aps-environment` back, so it never actually
  // stripped anything. Registering first makes our delete run last, after
  // every other plugin has had its say — which is what "must come last"
  // actually requires.
  const devPlugins = ['./plugins/withoutPushNotificationEntitlement'];

  return {
    ...config,
    name: identity.name,
    slug: identity.slug,
    scheme: identity.scheme,
    owner: identity.owner,
    version: packageJson.version,
    locales: Object.fromEntries(
      nativeLanguageTags().map((language) => [
        language,
        `./locales/${language}.json`,
      ])
    ),
    ios: {
      bundleIdentifier: identity.iosBundleIdentifier,
      appleTeamId: identity.appleTeamId,
      supportsTablet: false,
      infoPlist: {
        NSLocalNetworkUsageDescription:
          'SparkyFitness connects to self-hosted servers on your local network.',
        // Required by the food/meal photo picker and the label/barcode
        // scanner. iOS terminates the app on first use without these, and App
        // Review rejects a binary that requests either without a purpose
        // string.
        NSCameraUsageDescription:
          'SparkyFitness uses the camera to photograph foods and meals, and to scan barcodes and nutrition labels.',
        NSPhotoLibraryUsageDescription:
          'SparkyFitness lets you choose photos from your library for your foods, meals, and diary entries.',
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
        },
        ITSAppUsesNonExemptEncryption: false,
        // Keep the native per-app Language entry visible in iOS Settings even
        // when the device has only one preferred system language.
        UIPrefersShowingLanguageSettings: true,
        // The localized InfoPlist permission strings come from `locales`; this
        // allows the generated app metadata to use the selected localization.
        CFBundleAllowMixedLocalizations: true,
        // Lets the opt-in "Play through silent mode" rest chime (#2506) keep a
        // silent track playing during a rest, so the chime still sounds with
        // the app in the background. Nothing plays in the background unless
        // that setting is on and a rest is running.
        UIBackgroundModes: ['audio'],
      },
      entitlements: {
        'com.apple.security.application-groups': [identity.appGroup],
        // Lets iOS honour the `timeSensitive` rest alert (see
        // `scheduleRestNotification`); without it a Focus mode silences it.
        'com.apple.developer.usernotifications.time-sensitive': true,
      },
      icon: './assets/icons/appicon.icon',
    },
    android: {
      package: identity.androidPackage,
      permissions: [
        ...androidPermissions,
        ...(isDev ? devAndroidPermissions : []),
      ],
      adaptiveIcon: {
        foregroundImage: './assets/icons/adaptiveicon.png',
        backgroundColor: '#FFFFFF',
      },
    },
    plugins: [
      // Must be first — see the comment on `devPlugins` above for why.
      ...(isDev ? devPlugins : []),
      ...(config.plugins ?? []),
      ...(identity.mode === 'custom'
        ? [
            ['expo-dev-client', { addGeneratedScheme: isDev }] as [
              string,
              { addGeneratedScheme: boolean },
            ],
          ]
        : []),
      'expo-image',
      [
        // No mic permission and no Android record/foreground-service perms.
        // iOS background audio for the rest chime comes from `UIBackgroundModes`
        // above; the plugin flag would also add Android's media-playback
        // foreground service, which the chime doesn't use.
        'expo-audio',
        {
          microphonePermission: false,
          recordAudioAndroid: false,
          enableBackgroundPlayback: false,
        },
      ],
      './plugins/withGlanceAndroidSupport',
      './plugins/withReleaseSigning',
      './plugins/withAppLanguage',
      './plugins/withCalorieWidget',
      './plugins/withExactAlarmModule',
      './plugins/withWorkoutNotification',
      './plugins/withEnrichedMarkdownNoMath',
      './plugins/withSceneLifecycle',
      [
        'react-native-maps',
        {
          // Writes the key into the Android manifest when set and removes it
          // when not. No iOS key: iOS stays on Apple Maps.
          androidGoogleMapsApiKey: GOOGLE_MAPS_ANDROID_API_KEY || undefined,
        },
      ],
      [
        'expo-localization',
        {
          supportedLocales: {
            ios: nativeLanguageTags(),
            android: nativeLanguageTags(),
          },
        },
      ],
      [
        'expo-widgets',
        {
          groupIdentifier: identity.appGroup,
          bundleIdentifier: identity.expoWidgetBundleIdentifier,
          // Live Activities register at runtime via createLiveActivity and must
          // NOT be listed here — widgets[] is only for home/Lock Screen widgets
          // (an entry without supportedFamilies breaks the generated target).
          widgets: [],
        },
      ],
      ...(!isDev ? prodPlugins : []),
    ],
    extra: {
      ...config.extra,
      APP_VARIANT: identity.variant,
      iosAppGroup: identity.appGroup,
      // Whether the Android build has a Maps key. The key itself stays out
      // of the JS bundle; the route screen only needs to know it is there.
      androidGoogleMapsEnabled: GOOGLE_MAPS_ANDROID_API_KEY !== '',
      // Explicitly replace app.json's upstream destination, even when unlinked.
      eas: identity.easProjectId
        ? { projectId: identity.easProjectId }
        : undefined,
    },
  };
};
