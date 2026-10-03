import Constants from 'expo-constants';

/** Read the primary scheme resolved at build time; never read build env in JS. */
export function getAppScheme(): string {
  const configured = Constants.expoConfig?.scheme;
  const scheme = Array.isArray(configured) ? configured[0] : configured;
  // Older upstream manifests and Expo test environments can omit this field.
  return scheme || 'sparkyfitnessmobile';
}

export function getAppUrl(path = ''): string {
  return `${getAppScheme()}://${path}`;
}
