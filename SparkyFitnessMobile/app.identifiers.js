// Shared build identity. Plain CommonJS is required by Apple target configs.
// Custom inputs describe the production identity; non-production variants are
// derived here so a preview cannot silently become the production application.
const UPSTREAM_PROJECT_ID = '498a86c5-344f-4d2c-9033-dfd720e4a383';
const UPSTREAM_BUNDLE = 'com.SparkyApps.SparkyFitnessMobile';
const DEFAULT_DEV_BUNDLE = 'org.SparkyApps.SparkyFitnessMobile1.dev';
const DEFAULT_DEV_GROUP = `group.${DEFAULT_DEV_BUNDLE}`;
const DEFAULT_PROD_GROUP = `group.${UPSTREAM_BUNDLE}.shared`;

/** @param {Record<string, string | undefined>} env */
function resolveVariant(env = process.env) {
  const variant = env.APP_VARIANT || 'development';
  if (variant === 'dev') return 'development';
  if (!['development', 'preview', 'production'].includes(variant)) {
    throw new Error(`Unknown APP_VARIANT: ${variant}`);
  }
  return variant;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} key
 * @param {RegExp} [pattern]
 */
function required(env, key, pattern) {
  const value = env[key];
  if (!value || value !== value.trim() || (pattern && !pattern.test(value))) {
    throw new Error(`Custom identity requires a valid ${key}`);
  }
  return value;
}

/** @param {Record<string, string | undefined>} env */
function resolveAppIdentity(env = process.env) {
  const variant = resolveVariant(env);
  const mode = env.APP_IDENTITY || 'upstream';
  if (!['upstream', 'custom'].includes(mode)) {
    throw new Error(`Unknown APP_IDENTITY: ${mode}`);
  }
  const isDev = variant === 'development';
  const custom = mode === 'custom';
  const configOnly = custom && env.APP_CONFIG_ONLY === '1';
  if (configOnly && (env.EAS_BUILD === 'true' || env.EAS_BUILD_ID)) {
    throw new Error(
      'APP_CONFIG_ONLY is for local configuration inspection, not EAS builds'
    );
  }
  const suffix = isDev ? 'dev' : variant === 'preview' ? 'preview' : '';
  const bundleSuffix = suffix ? `.${suffix}` : '';
  const schemeSuffix = suffix ? `-${suffix}` : '';
  const upstreamBundle = isDev
    ? env.EXPO_DEV_BUNDLE_IDENTIFIER || DEFAULT_DEV_BUNDLE
    : UPSTREAM_BUNDLE;
  const packagePattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
  const bundlePattern = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
  const schemePattern = /^[a-z][a-z0-9+.-]{1,54}$/;
  const androidPackage = custom
    ? required(env, 'EXPO_ANDROID_PACKAGE', packagePattern) + bundleSuffix
    : upstreamBundle;
  const iosBundleIdentifier = custom
    ? required(env, 'EXPO_IOS_BUNDLE_IDENTIFIER', bundlePattern) + bundleSuffix
    : upstreamBundle;
  const scheme = custom
    ? required(env, 'EXPO_APP_SCHEME', schemePattern) + schemeSuffix
    : 'sparkyfitnessmobile';
  const watchBase = env.EXPO_WATCH_SCHEME;
  const watchScheme = custom
    ? watchBase
      ? required(env, 'EXPO_WATCH_SCHEME', schemePattern).replace(
          /-watch$/,
          ''
        ) +
        schemeSuffix +
        '-watch'
      : `${scheme}-watch`
    : 'sparkyfitness-watch';
  const name = custom
    ? required(env, 'EXPO_APP_NAME') +
      (isDev ? ' Dev' : suffix ? ' Preview' : '')
    : 'SparkyFitness';
  const slug = custom
    ? required(env, 'EXPO_APP_SLUG', /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    : 'sparkyfitnessmobile';
  const groupOverride =
    env[
      `IOS_APP_GROUP_${isDev ? 'DEV' : variant === 'preview' ? 'PREVIEW' : 'PROD'}`
    ];
  const appGroup = custom
    ? groupOverride || `group.${iosBundleIdentifier}.shared`
    : isDev
      ? env.IOS_APP_GROUP_DEV || DEFAULT_DEV_GROUP
      : env.IOS_APP_GROUP_PROD || DEFAULT_PROD_GROUP;
  const appleTeamId = isDev
    ? env.EXPO_DEV_APPLE_TEAM_ID || ''
    : env.EXPO_PROD_APPLE_TEAM_ID || '';
  let easProjectId = custom ? env.EXPO_EAS_PROJECT_ID : UPSTREAM_PROJECT_ID;
  let owner = custom ? env.EXPO_OWNER : undefined;

  if (custom) {
    for (const key of ['EXPO_ANDROID_PACKAGE', 'EXPO_IOS_BUNDLE_IDENTIFIER']) {
      if (/^(?:com|org)\.sparkyapps\./i.test(env[key] || '')) {
        throw new Error(`${key} must use an owned custom identity`);
      }
    }
    if (
      [
        'sparkyfitnessmobile',
        'http',
        'https',
        'exp',
        'exps',
        'javascript',
        'data',
        'file',
        'content',
        'intent',
        'mailto',
        'tel',
      ].includes(env.EXPO_APP_SCHEME || '') ||
      env.EXPO_WATCH_SCHEME === 'sparkyfitness-watch'
    ) {
      throw new Error('Custom identity requires dedicated native URL schemes');
    }
    if (slug === 'sparkyfitnessmobile') {
      throw new Error('Custom identity requires a dedicated EXPO_APP_SLUG');
    }
    if (
      !appGroup.startsWith(`group.${iosBundleIdentifier}.`) ||
      !bundlePattern.test(appGroup)
    ) {
      throw new Error(
        'Custom App Group must belong to the resolved variant bundle'
      );
    }
    if (appleTeamId && !/^[A-Z0-9]{10}$/.test(appleTeamId)) {
      throw new Error(
        'Apple Team ID must contain 10 uppercase letters or digits'
      );
    }
    if (
      env.WIDGET_BUNDLE_IDENTIFIER &&
      env.WIDGET_BUNDLE_IDENTIFIER !==
        `${iosBundleIdentifier}.ExpoWidgetsTarget`
    ) {
      throw new Error(
        'Custom WIDGET_BUNDLE_IDENTIFIER must derive from the host bundle'
      );
    }
    if (!configOnly || easProjectId) {
      easProjectId = required(
        env,
        'EXPO_EAS_PROJECT_ID',
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
      );
    }
    if (easProjectId?.toLowerCase() === UPSTREAM_PROJECT_ID) {
      throw new Error('Custom builds must not use the upstream EAS project');
    }
    if (!configOnly || owner) {
      owner = required(env, 'EXPO_OWNER', /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
    }
  }

  let buildNumber;
  if (env.EXPO_BUILD_NUMBER !== undefined) {
    if (
      !/^[1-9][0-9]*$/.test(env.EXPO_BUILD_NUMBER) ||
      Number(env.EXPO_BUILD_NUMBER) > 2100000000
    ) {
      throw new Error(
        'EXPO_BUILD_NUMBER must be an integer from 1 to 2100000000'
      );
    }
    buildNumber = Number(env.EXPO_BUILD_NUMBER);
  }

  if (env.EXPO_WEAR_ENABLED && !['0', '1'].includes(env.EXPO_WEAR_ENABLED)) {
    throw new Error('EXPO_WEAR_ENABLED must be 0 or 1');
  }
  const wearEnabled = env.EXPO_WEAR_ENABLED === '1';
  if (wearEnabled && !custom) {
    throw new Error('Wear companion requires an owned custom identity');
  }
  // Disjoint form-factor ranges prevent collisions even across release trains.
  // Validate EAS's final phone version again in Gradle after its version injection.
  if (wearEnabled && buildNumber >= 1000000000) {
    throw new Error(
      'Wear-enabled phone EXPO_BUILD_NUMBER must be below 1000000000'
    );
  }
  const wearBuildNumberExplicit = env.EXPO_WEAR_BUILD_NUMBER !== undefined;
  if (
    wearBuildNumberExplicit &&
    (!/^[1-9][0-9]*$/.test(env.EXPO_WEAR_BUILD_NUMBER) ||
      Number(env.EXPO_WEAR_BUILD_NUMBER) < 1000000000 ||
      Number(env.EXPO_WEAR_BUILD_NUMBER) > 2100000000)
  ) {
    throw new Error(
      'EXPO_WEAR_BUILD_NUMBER must be an integer from 1000000000 to 2100000000'
    );
  }
  const wearBuildNumber = Number(env.EXPO_WEAR_BUILD_NUMBER || '1000000001');
  const watchBundleIdentifier = `${iosBundleIdentifier}.watchkitapp`;
  return {
    mode,
    variant,
    isDev,
    configOnly,
    buildNumber,
    name,
    slug,
    scheme,
    watchScheme,
    androidPackage,
    wearEnabled,
    wearApplicationId: androidPackage,
    wearBuildNumber,
    wearBuildNumberExplicit,
    iosBundleIdentifier,
    appleTeamId,
    appGroup,
    easProjectId,
    owner,
    widgetBundleIdentifier: `${iosBundleIdentifier}.widget`,
    expoWidgetBundleIdentifier:
      (!custom && env.WIDGET_BUNDLE_IDENTIFIER) ||
      `${iosBundleIdentifier}.ExpoWidgetsTarget`,
    watchBundleIdentifier,
    watchWidgetBundleIdentifier: `${watchBundleIdentifier}.watch-widget`,
  };
}

// Preserve the original exports for downstream configs using this module.
module.exports = {
  DEV_BUNDLE_IDENTIFIER:
    process.env.EXPO_DEV_BUNDLE_IDENTIFIER || DEFAULT_DEV_BUNDLE,
  IOS_APP_GROUP_DEV: process.env.IOS_APP_GROUP_DEV || DEFAULT_DEV_GROUP,
  IOS_APP_GROUP_PROD: process.env.IOS_APP_GROUP_PROD || DEFAULT_PROD_GROUP,
  isDevVariant: () => resolveVariant() === 'development',
  getIosAppGroup: () => resolveAppIdentity().appGroup,
  resolveAppIdentity,
};
