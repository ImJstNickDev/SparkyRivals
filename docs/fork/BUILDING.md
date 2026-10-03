# Building SparkyRivals

Owned build implementation, updated during Milestone 8A on 2026-10-03. Start in
`SparkyFitnessMobile/` after a root `pnpm install --frozen-lockfile`. Use the pinned
pnpm version and Node 24 (validated: 24.20.0). Native projects are generated and
ignored; never make durable edits inside `ios/` or `android/`.

See [validation evidence](BUILD_VALIDATION.md), [current identifiers](IDENTIFIERS.md),
and upstream [mobile development guide](../../SparkyFitnessMobile/README.md).
No build in this milestone was submitted, published, or run on a cloud builder.

## Identity and profiles

`app.identifiers.js` is the authority. Default `APP_IDENTITY=upstream` preserves
upstream values and legacy exports. `APP_VARIANT` accepts `development`/`dev`,
`preview`, or `production`; unknown values fail. Upstream preview retains its old
production identity. **Custom preview is isolated.**

| Profile                    | Display name         | Android package / iOS phone bundle   | Phone scheme           | Watch scheme                 |
| -------------------------- | -------------------- | ------------------------------------ | ---------------------- | ---------------------------- |
| `sparkyrivals-development` | SparkyRivals Dev     | `com.imjstnick.sparkyrivals.dev`     | `sparkyrivals-dev`     | `sparkyrivals-dev-watch`     |
| `sparkyrivals-preview`     | SparkyRivals Preview | `com.imjstnick.sparkyrivals.preview` | `sparkyrivals-preview` | `sparkyrivals-preview-watch` |
| `sparkyrivals-production`  | SparkyRivals         | `com.imjstnick.sparkyrivals`         | `sparkyrivals`         | `sparkyrivals-watch`         |

All three use slug `sparkyrivals`. `sparkyrivals-base` holds common EAS configuration;
select a child profile for builds. `sparkyrivals-production-internal` extends
production with internal distribution, a bundled release client (no development
client), and EAS-managed iOS credentials. It retains the production package, bundle,
schemes and App Group; it does not submit to a store. `pnpm build:profile <profile>
<command> [args...]` applies inherited profile variables to local commands too.
The ordinary `development`, `preview`, `production` EAS profiles retain upstream
identity defaults. Never select them to distribute SparkyRivals.

Custom inputs describe **production roots**, not already-suffixed variant IDs:

- Required: `APP_IDENTITY=custom`, `EXPO_APP_NAME`, `EXPO_APP_SLUG`,
  `EXPO_ANDROID_PACKAGE`, `EXPO_IOS_BUNDLE_IDENTIFIER`, `EXPO_APP_SCHEME`.
- `EXPO_WATCH_SCHEME` optionally supplies a root Watch scheme; the variant is
  inserted before its `-watch` suffix. Otherwise it derives from the phone scheme.
- The owned profiles supply `EXPO_OWNER=imjstnickdev` and
  `EXPO_EAS_PROJECT_ID=63f08cec-3f87-4cee-89be-bebf970b6262`.
  The known upstream UUID, upstream bundle roots/schemes, malformed inputs and
  incomplete custom configuration are rejected. No replacement UUID is invented.
- Apple team: `EXPO_DEV_APPLE_TEAM_ID` for development;
  `EXPO_PROD_APPLE_TEAM_ID` for preview/production. Both owned-profile values are
  `U5K88Y67DL`. In generic custom mode, empty means unprovisioned,
  never a fallback to another developer's team. Supplied IDs must have 10 letters/digits.
- App Group normally derives as `group.<resolved-phone-bundle>.shared`.
  `IOS_APP_GROUP_DEV`, `IOS_APP_GROUP_PREVIEW`, `IOS_APP_GROUP_PROD` may override it
  within that variant's bundle namespace. Custom `WIDGET_BUNDLE_IDENTIFIER` may
  only equal the derived Expo widget ID; it cannot redirect that target elsewhere.
- `EXPO_BUILD_NUMBER` controls local native version numbers (see below).

### Apple target relationships

For each phone bundle **B** in the table:

| Native target              | Bundle ID                    | Relationship                         |
| -------------------------- | ---------------------------- | ------------------------------------ |
| Phone                      | `B`                          | Host application                     |
| `CalorieTracker`           | `B.widget`                   | Phone WidgetKit target               |
| `ExpoWidgetsTarget`        | `B.ExpoWidgetsTarget`        | Live Activity / Expo widgets         |
| `SparkyFitnessWatch`       | `B.watchkitapp`              | `WKCompanionAppBundleIdentifier = B` |
| `SparkyFitnessWatchWidget` | `B.watchkitapp.watch-widget` | Embedded Watch widget                |

All five targets declare **`group.B.shared`**. This is device-local shared storage;
phone → Watch transfer still uses WatchConnectivity. Native target/module names,
widget kinds, wire messages and storage keys are preserved. New app identities
are new installations; this work does not migrate another app's sandbox.

## Unsigned local configuration validation

This explicit mode is available before account setup:

```sh
APP_CONFIG_ONLY=1 EXPO_BUILD_NUMBER=100 pnpm build:profile sparkyrivals-preview \
  pnpm exec expo prebuild --clean --platform all --no-install
APP_CONFIG_ONLY=1 EXPO_BUILD_NUMBER=100 pnpm build:profile sparkyrivals-preview \
  pnpm validate:native --snapshot /tmp/sparkyrivals-native.json
# Repeat the same clean prebuild, then:
APP_CONFIG_ONLY=1 EXPO_BUILD_NUMBER=100 pnpm build:profile sparkyrivals-preview \
  pnpm validate:native --compare /tmp/sparkyrivals-native.json
```

Repeat for development and production. `--clean` replaces generated native
folders; preserve any diagnostic native edits elsewhere before running it.
Use an isolated checkout when comparing variants. The validator checks semantic
native metadata, not Xcode's randomly allocated object UUIDs. `--platform ios`
or `--platform android` checks only that generated platform.

`APP_CONFIG_ONLY=1` omits missing EAS destinations, rather than inventing one.
It is rejected on EAS builders, and generated Android release tasks fail. It is
for unsigned inspection/simulator checks, not device/distribution signing.
Regenerate without it once real ownership is configured. Local Android Debug can
use the ordinary debug certificate; configuration-only Apple projects must only
be compiled with signing disabled.

## Expo / EAS ownership setup

Verified during Milestone 8A with EAS CLI 24.10.0:

- Authenticated account: `imjstnick`, with owner access to organization `imjstnickdev`.
- Project: `@imjstnickdev/sparkyrivals`.
- Project UUID: `63f08cec-3f87-4cee-89be-bebf970b6262`.
- Apple team: `U5K88Y67DL` (maintainer-provided active paid membership).

The non-secret ownership values live in `eas.json`'s existing `sparkyrivals-base`
profile environment. The generic resolver remains `app.identifiers.js`; the
upstream profiles retain upstream defaults. The local profile wrapper uses the
same inheritance as EAS, so these values need no private local override.
`extra.eas.projectId` and `ios.appleTeamId` resolve through the existing config.

For an internal iPhone/Watch acceptance build, use:

```sh
pnpm build:profile sparkyrivals-production-internal pnpm dlx eas-cli@24.10.0 project:info
pnpm build:profile sparkyrivals-production-internal pnpm dlx eas-cli@24.10.0 build \
  --platform ios --profile sparkyrivals-production-internal
```

This requests an EAS native build and can consume account build resources. It
never submits to App Store Connect. The maintainer has registered an iPhone for
internal distribution. Let EAS manage certificates/profiles for the generated
phone, widget, Live Activity, Watch and Watch-widget targets. Do not pre-create
portal resources. Stop at interactive Apple login/2FA and have the maintainer
complete the command locally; never collect passwords or codes in chat.

Build-only ownership/signing settings do not belong in Docker/Helm server runtime
configuration. Never put signing secrets in `extra`, `EXPO_PUBLIC_*`, tracked env
files or logs. There is still no store submission profile/destination.

## Android signing and build numbers

`plugins/withReleaseSigning.ts` runs at every prebuild. Debug uses its normal
certificate. Release selects `signingConfigs.release` and never falls back to
debug signing. Gradle reads these existing names as properties or environment:

- `MYAPP_RELEASE_STORE_FILE`: absolute path to an owned release keystore.
- `MYAPP_RELEASE_KEY_ALIAS`, `MYAPP_RELEASE_STORE_PASSWORD`,
  `MYAPP_RELEASE_KEY_PASSWORD`: private signing configuration.

Prefer a credential manager or private Gradle properties over command-line
passwords. No permanent keystore was generated in this milestone. Provision it
before distributing an APK/AAB, restrict its permissions, and back up the key,
alias, passwords, certificate fingerprints and recovery procedure securely.
The same application ID requires signing continuity for future upgrades.

The guard inspects the **final selected signing config** when release tasks are
scheduled, after EAS has had the opportunity to inject its credentials. It rejects
missing files/passwords/alias, `signingConfigs.debug`, the debug keystore and the
standard debug alias. An unexpected upstream Gradle layout fails prebuild clearly.
EAS can supply remote credentials or its local `credentials.json` workflow; both
use its normal signing injection. Credentials files/directories are ignored.
See [EAS Android signing injection](https://docs.expo.dev/build-reference/android-builds/#configuring-gradle).
This integration was inspected and generated locally; actual signed Gradle/EAS
execution remains to be tested with the owned key and native toolchain.

For local/CI distribution, allocate a monotonically increasing `EXPO_BUILD_NUMBER`
(1–2100000000) for each binary, then prebuild with it. It sets Android `versionCode`
and iOS `buildNumber`; Apple child versions follow the host config. Owned local
Android release tasks reject the default 1. Example allocation for testing is 100;
do not repeatedly distribute that number. EAS uses `appVersionSource=remote` and
`autoIncrement=true` on all three owned profiles. Reconcile its counter with any
local releases before changing build systems. The application marketing version
continues following the existing upstream version tooling.

After account/key setup, prebuild through the intended profile **without**
`APP_CONFIG_ONLY`, then `cd android && ./gradlew :app:assembleRelease` or
`:app:bundleRelease`. Debug validation uses `:app:assembleDebug`. This host still
lacks the required Android SDK/JDK 17 setup, so these commands were not executed.
Use SDK 36 and the NDK/Gradle versions selected by the generated project.

## Apple registration and provisioning

The maintainer confirmed active paid Apple Developer membership and an iPhone
registered through EAS. The owned profiles supply team `U5K88Y67DL`. Generated
identity/entitlement validation is distinct from issued provisioning profiles and
actual native/device acceptance; record those results separately.

For each variant you intend to install/distribute:

1. Use the owned profile and verify `ios.appleTeamId = U5K88Y67DL`.
2. Let EAS manage **all five explicit App IDs** listed above and the variant App
   Group. Inspect its generated extension metadata before provisioning; assign the
   group to all five targets and keep the Watch companion relationship.
3. Provision phone HealthKit/background delivery, time-sensitive notifications,
   and the notifications entitlement; provision Watch HealthKit with background
   workout processing. Preserve purpose strings and existing background modes.
   Widgets/Live Activities need their own profiles and shared group membership.
4. Development omits the APNs entitlement via the existing plugin; other prebuilds
   may show `aps-environment=development`. Inspect the actual signed archive and
   distribution profile before release; prebuild is not provisioning evidence.
5. On macOS, generate with the profile, install Pods, and build in the generated
   workspace. `pnpm watch` discovers that workspace and reads the built Watch
   bundle ID; `pnpm watch:device` builds the existing Watch scheme for a device.
6. Verify iPhone + paired Watch signing, HealthKit permissions, own-workout dedupe,
   background sync, complications/widget links, Live Activities and browser auth
   on devices. Back up signing recovery material securely or use owned EAS custody.

The inherited manual `ios-build.yml` now selects a profile and discovers generated
workspace/launch IDs. It compiles unsigned simulators, not device provisioning.
EAS/Xcode native or device builds were not started here.

## Deep links and authentication

Phone scheme links retain root, `search`, `scan`, `active-workout`, and
`oauth-callback` destinations. Watch scheme links retain `goals`/`water`.
Only custom development enables the Expo dev-client `exp+sparkyrivals` scheme;
preview/production omit it. Generated bundle-ID schemes follow their resolved
host. Upstream schemes remain `sparkyfitnessmobile` and `sparkyfitness-watch`.

Configure the server explicitly:

```dotenv
SPARKY_FITNESS_MOBILE_AUTH_SCHEMES=sparkyrivals,sparkyrivals-dev,sparkyrivals-preview
```

The upstream native scheme remains supported. Invalid/reserved scheme config
fails server startup. The client sends an `app_scheme` selector to passkey bridge
pages; the server validates the selector and constructs its fixed
`<allowed-scheme>://oauth-callback`. It never trusts a supplied return URL.
Unknown/malformed/repeated selectors are rejected before session lookup.

Passkey login tokens/email/role remain URL **fragments**. Registration uses the
existing one-use ticket in a fragment; its return query contains only status.
The mobile client checks the exact destination before reading login/registration
results. Better Auth receives the same explicit native origin allowlist for its
SSO flow; configured web origins and existing API-key/session behavior remain.
The SSO cookie relay still obtains the raw session through `getSession` and clears
transient cookies. Custom-scheme interception by another installed app remains an
OS-level constraint; this milestone does not introduce universal/app links.

This variable is server runtime configuration and is forwarded by dev/prod Compose,
Helm and EnvGenerator. Mobile identity/version variables and signing material are
**build only**: do not inject them into running server containers.

## GitHub Actions

Actions remain **repository-wide disabled**, rechecked through the GitHub API.
Do not enable them before this branch's guards are on the default branch.

Safe validation candidates after review:

- `ci-tests.yml`: package/unit/integration tests in disposable CI services.
- `docs-test.yml`, `pr-validation-tests.yml`: docs and workflow logic tests.
- `helm-tests.yml`: lint/render and disposable Kind deployment tests.
- `native-config.yml`: Linux clean prebuild identity matrix, no credentials/builds.
- `ios-build.yml`: manual macOS unsigned simulator compile; it consumes runner
  resources and must be started deliberately.

All other inherited jobs are guarded to run only in `CodeWithCJ/SparkyFitness`:
publishing, Docker/Pages/Helm deployment, store/package/release automation,
translation sync, schema/Nix PR creation, labeling, welcome/notification bots and
auto-merge. The fork must design its own release automation in a later task.
`workflow-safety.test.cjs` enforces this classification. The inherited Android
workflow now propagates debug/codegen failures and uses the existing release
secret interface safely; its publishing job remains guarded off in this fork.

Enablement procedure: review the current default-branch workflows and guards;
disable all mutation/publishing workflows individually; keep token permissions
read-only by default; then deliberately enable Actions and the reviewed validation
workflows. Recheck this classification after each upstream workflow merge. No
repository settings were enabled by this milestone.

## Wear OS companion (Milestone 5)

The `sparkyrivals-*` profiles now opt into `EXPO_WEAR_ENABLED=1`. Custom builds
copy tracked `targets/wear/` into generated `android/wear/`; default upstream
builds omit it. Phone and Wear share applicationId and the final selected phone
signing config, including Debug. No separate Wear signing key may be introduced.
Wear Release rejects debug/absent credentials, inspection mode and an implicit
Wear build number. EAS ownership and permanent signing setup above remain open.

With Wear enabled, allocate phone `EXPO_BUILD_NUMBER` below 1000000000 and Wear
`EXPO_WEAR_BUILD_NUMBER` from 1000000000 through 2100000000. Wear release requires
an explicit allocation; increase each form-factor counter independently and keep
a release ledger synchronized with future Play/EAS counters. Debug/config checks
default Wear to 1000000001. A test-only pair is phone 100 / Wear 1000000100.

After clean prebuild and `pnpm validate:native --platform android`, a configured
JDK 17/Android SDK host can independently run `:app:assembleDebug` and
`:wear:assembleDebug` from generated `android/`. `:wear:testDebugUnitTest` runs the
native protocol tests. `python3 scripts/test-wear-models.py --download` runs those
protocol JVM tests without installing an Android SDK, using pinned disposable
compiler dependencies. It does not compile Compose or Android services.

Use the same generated variant/signing configuration for both APKs; compare their
`apksigner verify --print-certs` SHA-256 certificate digests before paired testing
or release. Future phone/Wear distribution uses separate artifacts and distinct
version codes under the same package/listing. No store setup or submission is
configured. The watch feature is required and standalone is false.

[WEAR_OS_CHALLENGES.md](WEAR_OS_CHALLENGES.md) contains exact prebuild/test commands,
source maps, limits, recovery and the physical Galaxy Watch checklist. This Linux
host ran native protocol JVM tests and metadata checks, but no Gradle APK build,
Compose instrumentation, emulator or physical-watch acceptance.

## Milestone 7 native surface validation

No extension target, application identity or signing interface changed. The phone
WidgetKit bundle and watch-widget bundle gain Challenge kinds. Android's existing
widget plugin adds a third receiver. Wear adds protected Tile/complication services
and isolated AndroidX dependencies; `validate:native` checks their generated wiring.

Run two clean owned development prebuilds with the same configuration and compare
native metadata as above. `scripts/test-wear-models.py` now includes surface model
and guarded destination tests. On macOS, `scripts/test-watch-models.sh` includes
Challenge complication projection checks. Neither Linux prebuild nor the Kotlin
protocol harness compiles a Swift/Android application binary. See
[CHALLENGE_POLISH.md](CHALLENGE_POLISH.md#milestone-8-native-acceptance-checklist-not-executed-here)
for widget, complication, Tile, actual notification and accessibility acceptance.
