import {
  ConfigPlugin,
  withDangerousMod,
  withSettingsGradle,
} from 'expo/config-plugins';
import fs from 'fs';
import path from 'path';
import { resolveAppIdentity } from '../app.identifiers';

type Identity = ReturnType<typeof resolveAppIdentity>;
const xml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", "\\'");
export function renderWearGradle(
  template: string,
  identity: Identity,
  version: string
) {
  if (!identity.wearEnabled || identity.mode !== 'custom')
    throw new Error('Wear requires custom opt-in');
  if (!/^[0-9A-Za-z.+-]+$/.test(version))
    throw new Error('Invalid Wear marketing version');
  const values: Record<string, string> = {
    APPLICATION_ID: identity.wearApplicationId,
    WEAR_VERSION_CODE: String(identity.wearBuildNumber),
    VERSION_NAME: version,
    CONFIG_ONLY: String(identity.configOnly),
    EXPLICIT_WEAR_NUMBER: String(identity.wearBuildNumberExplicit),
  };
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`Unknown Wear template key ${key}`);
    return values[key];
  });
}
export function configureWearSettings(source: string) {
  const clean = source.replace(
    /\n\/\/ @wear-begin\n[\s\S]*?\/\/ @wear-end\n/g,
    '\n'
  );
  return `${clean.trimEnd()}\n// @wear-begin\ninclude ':wear'\n// @wear-end\n`;
}
/** Generated Android is disposable. No signing credential is read by Expo. */
const withWearOsCompanion: ConfigPlugin = (config) => {
  const identity = resolveAppIdentity();
  if (!identity.wearEnabled) return config;
  config = withSettingsGradle(config, (mod) => {
    mod.modResults.contents = configureWearSettings(mod.modResults.contents);
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const source = path.join(mod.modRequest.projectRoot, 'targets/wear');
      const dest = path.join(mod.modRequest.platformProjectRoot, 'wear');
      await fs.promises.rm(dest, { recursive: true, force: true });
      await fs.promises.cp(source, dest, { recursive: true });
      const template = await fs.promises.readFile(
        path.join(source, 'build.gradle.template'),
        'utf8'
      );
      await fs.promises.writeFile(
        path.join(dest, 'build.gradle'),
        renderWearGradle(template, identity, config.version || '1.0.0')
      );
      await fs.promises.rm(path.join(dest, 'build.gradle.template'));
      await fs.promises.writeFile(
        path.join(dest, 'src/main/res/values/identity.xml'),
        `<resources><string name="app_name">${xml(identity.name)}</string></resources>\n`
      );
      return mod;
    },
  ]);
};
export default withWearOsCompanion;
