import { ConfigPlugin, withAppBuildGradle } from 'expo/config-plugins';
import { resolveAppIdentity } from '../app.identifiers';

/** Durable wiring for local/CI MYAPP_RELEASE_* properties and EAS injection. */
export function configureReleaseSigning(
  source: string,
  configOnly: boolean
): string {
  // Remove only our generated sections when prebuild runs without --clean.
  let result = source.replace(
    /\s*\/\/ @owned-release-(config|guard)-begin\n[\s\S]*?\/\/ @owned-release-\1-end\n/g,
    '\n'
  );
  const release =
    /(\brelease\s*\{[\s\S]*?\bsigningConfig\s+)signingConfigs\.(debug|release)\b/;
  if (!release.test(result) || !/\bsigningConfigs\s*\{/.test(result)) {
    throw new Error(
      '[withReleaseSigning] Unsupported app/build.gradle signing layout; refusing an unsafe release fallback.'
    );
  }
  result = result.replace(release, '$1signingConfigs.release');
  result = result.replace(
    /\bsigningConfigs\s*\{\s*\n/,
    `signingConfigs {
        // @owned-release-config-begin
        release {
            // Secrets are read by Gradle only, never by Expo public config.
            def signingValue = { key -> project.findProperty(key) ?: System.getenv(key) }
            def releaseStore = signingValue('MYAPP_RELEASE_STORE_FILE')
            if (releaseStore) storeFile file(releaseStore)
            storePassword signingValue('MYAPP_RELEASE_STORE_PASSWORD')
            keyAlias signingValue('MYAPP_RELEASE_KEY_ALIAS')
            keyPassword signingValue('MYAPP_RELEASE_KEY_PASSWORD')
        }
        // @owned-release-config-end
`
  );
  return (
    result.trimEnd() +
    `

// @owned-release-guard-begin
// EAS may populate signingConfigs.release after evaluating this file. Inspect
// the final selected config when the task graph is ready, not at prebuild time.
gradle.taskGraph.whenReady { graph ->
    if (graph.allTasks.any { it.project == project && it.name.toLowerCase().contains('release') }) {
        if (${configOnly}) {
            throw new GradleException('APP_CONFIG_ONLY is for unsigned configuration checks. Configure the owned EAS identity and regenerate before a release build.')
        }
        def signing = android.buildTypes.release.signingConfig
        if (signing == null || signing.name == 'debug' ||
            signing.storeFile == android.signingConfigs.debug.storeFile ||
            signing.keyAlias == 'androiddebugkey') {
            throw new GradleException('Release builds must use an explicit release keystore, never debug signing.')
        }
        if (signing.storeFile == null || !signing.storeFile.isFile() ||
            !signing.storePassword || !signing.keyAlias || !signing.keyPassword) {
            throw new GradleException('Release signing is incomplete. Supply MYAPP_RELEASE_STORE_FILE, MYAPP_RELEASE_STORE_PASSWORD, MYAPP_RELEASE_KEY_ALIAS and MYAPP_RELEASE_KEY_PASSWORD as Gradle properties or environment variables, or configure owned EAS credentials.')
        }
    }
}
// @owned-release-guard-end
`
  );
}

const withReleaseSigning: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error(
        '[withReleaseSigning] Only Groovy app/build.gradle is supported.'
      );
    }
    mod.modResults.contents = configureReleaseSigning(
      mod.modResults.contents,
      resolveAppIdentity().configOnly
    );
    return mod;
  });

export default withReleaseSigning;
