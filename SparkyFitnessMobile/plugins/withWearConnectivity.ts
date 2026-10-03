import {
  ConfigPlugin,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} from 'expo/config-plugins';
import fs from 'fs';
import path from 'path';

const packageImport =
  'import com.sparkyrivals.wearbridge.WearConnectivityPackage';
const packageAdd = 'add(WearConnectivityPackage())';
/** Registered only by withWearOsCompanion; mirrors existing native module copies. */
const withWearConnectivity: ConfigPlugin = (config) => {
  config = withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('// @wear-dependencies')) {
      mod.modResults.contents += `\n// @wear-dependencies\ndependencies {\n    implementation 'com.google.android.gms:play-services-wearable:20.0.1'\n    implementation 'androidx.work:work-runtime:2.10.1'\n}\n`;
    }
    return mod;
  });
  config = withMainApplication(config, (mod) => {
    let source = mod.modResults.contents;
    if (!source.includes(packageImport)) {
      source = source.replace(/(^import [^\n]+\n)/m, `$1${packageImport}\n`);
      if (!source.includes(packageImport))
        throw new Error('Wear: MainApplication import anchor missing');
    }
    if (!source.includes(packageAdd)) {
      const anchor = /PackageList\(this\)\.packages\.apply\s*\{\s*\n/;
      if (!anchor.test(source))
        throw new Error('Wear: MainApplication packages anchor missing');
      source = source.replace(anchor, `$&              ${packageAdd}\n`);
    }
    mod.modResults.contents = source;
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const project = mod.modRequest.projectRoot;
      const java = path.join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/java'
      );
      await fs.promises.cp(
        path.join(project, 'modules/wear-connectivity/android'),
        java,
        { recursive: true }
      );
      await fs.promises.cp(path.join(project, 'targets/wear/protocol'), java, {
        recursive: true,
      });
      const values = path.join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/res/values'
      );
      await fs.promises.mkdir(values, { recursive: true });
      await fs.promises.writeFile(
        path.join(values, 'wear.xml'),
        '<resources><string-array name="android_wear_capabilities"><item>sparkyrivals_challenge_phone_v1</item></string-array></resources>\n'
      );
      return mod;
    },
  ]);
};
export default withWearConnectivity;
