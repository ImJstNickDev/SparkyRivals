# Building SparkyRivals

Owned build implementation, updated during Milestone 8A on 2026-10-03. Start in
`SparkyFitnessMobile/` after a root `pnpm install --frozen-lockfile`. Use the pinned
pnpm version and Node 24 (validated: 24.20.0). Native projects are generated and
ignored; never make durable edits inside `ios/` or `android/`.

See [validation evidence](BUILD_VALIDATION.md), [current identifiers](IDENTIFIERS.md),
and upstream [mobile development guide](../../SparkyFitnessMobile/README.md).
No store submission or publication is configured. Native build and device acceptance
results are recorded separately; configuration validation alone is not acceptance.

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

EAS archives this monorepo from its Git root. Root `.easignore` mirrors the root
and package Git exclusions, including `/dockerdata`, generated mobile native
projects and local signing credentials. EAS replaces **all** `.gitignore` rules
when that file exists, so keep the exclusions synchronized. It also avoids EAS
scanning protected PostgreSQL data for nested ignore files. Never loosen database
permissions to prepare a mobile archive. Verify locally with `eas build:inspect
--platform ios --profile sparkyrivals-production-internal --stage archive
--output <private-temporary-directory>` through `pnpm build:profile`.

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

Owned profiles pin the iOS worker to `medium`, the smallest supported iOS
resource class. Keep Android/Wear builds local. Rebuild only the affected
platform when a binary is needed for a validated runtime/native change; batch
related fixes before submitting. Documentation-only changes do not require a
new binary. Do not upgrade the worker class without a demonstrated need and
maintainer approval.

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

Prefer a credential manager or mode-0600 `~/.gradle/gradle.properties` over
command-line passwords. The maintainer has already generated the permanent PKCS12
key at `~/.local/share/sparkyrivals/signing/sparkyrivals-release.p12`, alias
`sparkyrivals-release`. Do not recreate/rotate it or create a second Wear key.
Expected SHA-256 certificate fingerprint:
`3E:B2:F9:50:8D:15:9C:C1:50:14:1A:9A:57:0D:37:71:24:4F:59:10:59:D0:AE:09:E9:61:28:1E:B6:42:D5:2A`.
Back up the key, alias, passwords and fingerprint in secure off-host custody.
Never put passwords in chat, command arguments, tracked files or Expo config.
The same application ID requires signing continuity for future upgrades.

The guard inspects the **final selected signing config** when release tasks are
scheduled, after EAS has had the opportunity to inject its credentials. It rejects
missing files/passwords/alias, `signingConfigs.debug`, the debug keystore and the
standard debug alias. An unexpected upstream Gradle layout fails prebuild clearly.
EAS can supply remote credentials or its local `credentials.json` workflow; both
use its normal signing injection. Credentials files/directories are ignored.
See [EAS Android signing injection](https://docs.expo.dev/build-reference/android-builds/#configuring-gradle).
The native acceptance record must distinguish generated signing wiring from
actual APK verification using this permanent key.

For local/CI distribution, allocate a monotonically increasing `EXPO_BUILD_NUMBER`
(2–999999999 when Wear is enabled) for each phone binary, then prebuild with it. It sets Android `versionCode`
and iOS `buildNumber`; Apple child versions follow the host config. Owned local
Android release tasks reject the default 1. Example allocation for testing is 100;
do not repeatedly distribute that number. EAS uses `appVersionSource=remote` and
`autoIncrement=true` on all three owned profiles. Reconcile its counter with any
local releases before changing build systems. The application marketing version
continues following the existing upstream version tooling.

On owned EAS iOS builds, the resolver consumes the worker-provided
`EAS_BUILD_IOS_BUILD_NUMBER` before prebuild. That remote allocation takes
precedence over a local `EXPO_BUILD_NUMBER` and sets every Apple child target's
version as well as the host. Do not configure that worker variable manually or
pass it to server containers. Local and Android builds retain their existing
number allocation. Inspect the finished IPA: all five `CFBundleVersion` values
must match; a successful archive alone does not prove extension version parity.

Use the production pair helper, with newly allocated numbers:

```sh
EXPO_BUILD_NUMBER=<allocated-phone-code> EXPO_WEAR_BUILD_NUMBER=<allocated-wear-code> \
  bash scripts/build-owned-android.sh
```

It cleans/regenerates Android, validates native metadata, compiles phone and Wear
release APKs, runs Wear JVM tests and verifies both package/version/certificate
identities. The phone APK's bundled Expo config must also match owned production
EAS identity. **Keep `build:profile` active during Gradle, not only prebuild**:
Expo Constants and Metro reevaluate dynamic config during compilation. The release
guard rejects a runtime/generated package mismatch before building.

For incremental native builds after a correct prebuild:

```sh
EXPO_BUILD_NUMBER=<allocated-phone-code> EXPO_WEAR_BUILD_NUMBER=<allocated-wear-code> \
JAVA_HOME=/usr/lib/jvm/java-17-openjdk ANDROID_HOME=/opt/android-sdk NODE_ENV=production \
  pnpm build:profile sparkyrivals-production-internal bash -c \
  'cd android && ./gradlew :app:assembleRelease :wear:assembleRelease :wear:testDebugUnitTest --max-workers=4 -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=1g -Djava.util.concurrent.ForkJoinPool.common.parallelism=4"'
```

The Arch laptop now has JDK 17.0.20.1 at the path above; do not change default Java.
SDK 36, Build Tools 36.0.0, NDK 27.1.12297006, AGP 8.12.0, Kotlin 2.1.20 and
Gradle 9.3.1 are used. The local helper bounds workers/common-pool packaging
parallelism and selects a 4 GB heap / 1 GB metaspace per command; the default
2 GB heap exhausted memory while packaging the multi-ABI phone APK. No global
Java/Gradle setting is changed. Existing third-party modules also require Build Tools 35.0.0
and CMake 3.22.1. Install missing components with the current `android sdk` CLI,
not new scripts built around deprecated sdkmanager. `/opt/android-sdk` group access
requires a login/session with the `android-sdk` supplemental group.

Final APKs are generated at `android/app/build/outputs/apk/release/app-release.apk`
and `android/wear/build/outputs/apk/release/wear-release.apk`. Prebuild clean deletes
these outputs; archive approved artifacts privately outside generated folders.
Use Python 3.11+ with `scripts/verify-android-release.py --phone <apk> --wear <apk> --phone-code <n>
--wear-code <n>` to run `apksigner verify --print-certs`, aapt metadata checks and
bundled config checks without loading signing passwords. Actual device testing
still requires explicit user interaction.

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

For ad-hoc Watch installation, verify the **Watch's own UDID** is registered and
included in both embedded Watch app/widget profiles. Registering only the paired
iPhone is insufficient. The original build 1005 compiled/exported successfully
but its Watch profiles contained only the iPhone UDID. An interactive EAS re-sign
corrected that omission; see [release evidence](RELEASE_VALIDATION.md).
Inspect profile device membership privately before requesting another install;
never commit device IDs. A non-interactive build that merely reuses the same
profiles does not add the missing device. Follow Apple's
[registered-device distribution guidance](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)
and stop for device registration or Apple authentication before refreshing profiles.

EAS CLI 24.10.0's manual **Input** registration has no Watch device class; choose
**Unknown** for the Watch. Its non-interactive ad-hoc refresh filters iOS devices
to iPhone/iPad and excludes this entry, so use interactive provisioning and select
both devices explicitly for the targets. Reuse the existing Distribution Certificate.
If EAS reports that Apple could not provision a selected device, stop rather than
export another artifact without it.

After registration, an existing successful internal build can be re-signed without
recompiling. Run the following locally, completing any Apple authentication yourself:

```sh
pnpm build:profile sparkyrivals-production-internal pnpm dlx eas-cli@24.10.0 build:resign \
  --platform ios --id YOUR_SUCCESSFUL_INTERNAL_BUILD_ID \
  --target-profile sparkyrivals-production-internal --no-wait
```

Choose devices again when the old profile lacks the Watch, and select iPhone plus
Watch at each target prompt. Decline optional push setup for this milestone.
Inspect the exported profiles before installation, then install the re-signed IPA
over the existing iPhone app before retrying its embedded Watch app. A successful
cloud re-sign does not itself prove Watch installation or launch.

If the Watch install spinner stops without installing, capture the paired iPhone's
`appconduitd`/`installd` logs during one retry before changing credentials again.
`ACXErrorDomain Code=8` with underlying `Socket open timed out` identifies a failed
transfer connection; it does not identify a signing failure. See the current
[device evidence](RELEASE_VALIDATION.md#apple-watch-installation-diagnosis-and-profile-recovery-2026-10-04)
and [related Apple report](https://developer.apple.com/forums/thread/827053).
Keep raw logs private. Request user interaction for Bluetooth reconnection or OS
updates, and record the actual result; do not reset pairing/data or rotate keys
as speculative fixes.

The inherited manual `ios-build.yml` now selects a profile and discovers generated
workspace/launch IDs. It compiles unsigned simulators, not device provisioning.
See [release acceptance](RELEASE_VALIDATION.md) for the current EAS build result
and remaining device checks. No local Xcode compilation occurs on Linux.

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
Wear build number. Owned EAS identity and permanent key custody are now configured;
actual signed artifacts/device transport require the acceptance checks above.

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
host has now compiled the Wear debug APK and run 34 Gradle JVM tests.
Compose instrumentation, emulator and physical-watch acceptance remain separate.

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

## Remote invitation builds (M8A.5)

Owned production phone config includes the checked-in ordinary Firebase client
file for `sparkyrivals-fb`; dev/preview/upstream omit it. Wear remains free of FCM.
Reuse existing EAS APNs/FCM V1 credentials and internal production identity profile.
Allocate Android phone/Wear versions above 1002/1000001002; keep the same permanent
certificate. EAS remote iOS versions advance beyond 1006. Native and physical push
acceptance is pending; see [REMOTE_PUSH.md](REMOTE_PUSH.md).

## M8A.6 native acceptance

`modules/move-goal` is a local iOS Expo module using existing HealthKit entitlement and Activity Summary authorization on demand. A full new iOS build is required, not a re-sign. Wear protocol/UI source changes also require native compilation. Preserve owned identities, shared phone/Wear signing, monotonic build numbers and existing push credentials. See [CHALLENGE_TYPES.md](CHALLENGE_TYPES.md) and [release evidence](RELEASE_VALIDATION.md).

The acceptance artifacts are Android phone **1007**, Wear **1000001007** and full
EAS iOS **1011**. Both APKs were signed with the permanent certificate and installed
on the Galaxy A25/Watch; the iPhone/Apple Watch build compiled through EAS. Artifact
paths, exact source revisions and physical checks are recorded in the release
evidence. New distributed builds must advance those numbers. Phone/watch layout,
accessibility and unavailable physical health-source checks remain explicit QA
debt; the disposable acceptance server and tunnel are now stopped.

## M8A.7 localization and visual validation

Fork-owned translations are versioned under `localization/fork/`. From the root,
run `pnpm i18n:fork:export` after owned English changes, edit the approved source
translations, then run `pnpm i18n:fork:import`, `pnpm i18n:fork:check` and
`pnpm i18n:fork:test`. Imports preserve unrelated upstream keys and feed existing
catalogs; no new runtime overlay, external service or upstream workflow is needed.

Mobile `native-locales:check` now also validates Watch/watch-widget string catalogs
and Wear string/plural resources. These native resources use OS language, not the
phone's in-app selection. Clean prebuild copies/includes sources through existing
plugins and synchronized groups. A prebuild or source validator does not execute
Swift, compile an IPA or show an extension on device.

Use the capture manifest in [CHALLENGE_UX.md](CHALLENGE_UX.md). Debug emulator
artifacts are not distributed releases. Before physical acceptance, allocate new
production version codes, reuse permanent phone/Wear signing and build a full EAS
iOS internal artifact from the recorded source commit. No re-sign-only shortcut
can incorporate changed Swift/resources. Preserve synthetic test provenance and
keep raw private diagnostics outside Git. Device installation, Apple interaction,
new public tunnels and actual push sends remain explicit maintainer gates.

Latest M8A.7 allocations are Android phone 1010, Wear 1000001010 and EAS iOS
1014, from `d66d8fa8352470956915a7c9b099624977a034a8`. The Android release
pair passed build/signature checks, and phone 1010 passed the Dashboard/hub/Back
journey on the dedicated emulator. Samsung is updated with data preserved, and
the maintainer confirmed the same navigation journey on the physical phone.
EAS iOS 1014 and all-five-target IPA inspection passed; iPhone installation and
navigation confirmation remain pending. The 1009/1013 Dashboard
entry failed physical acceptance and is superseded by this correction. The
physical Watch remains on 1000001009; its runtime source is unchanged.
Future artifacts must advance these allocations. Do not reuse a number simply
because its device acceptance has not finished. See the release validation ledger.

### Retained laptop development workspace

Store milestone helpers, logs, captures and private acceptance artifacts under
repository-root `.local/<milestone>/` (M8A.7 uses `.local/m8a7/`). This directory is
explicitly excluded from Git, EAS archives and Docker contexts. Do not retain
these development files in `/tmp`. M8A.7 files previously under
`/tmp/sparkyrivals-8a7/` and `~/.local/share/sparkyrivals/artifacts/milestone-8a7/`
were moved to `.local/m8a7/` and `.local/m8a7/artifacts/` respectively on 7 October.
Earlier evidence may retain its original capture path. Signing and service
credentials retain their existing private locations outside the repository.
The two dedicated M8A.7 AVDs are retained under `.local/m8a7/avd/`; use that
directory as `ANDROID_AVD_HOME`. Their former location is a compatibility symlink
so existing disk-image paths remain valid. No emulator data was cleared.

EAS CLI 24.10.0 needs its disposable archive staging outside the source tree:
setting `TMPDIR` to `.local/` makes its repository copy fail with “cannot copy to
a subdirectory of self”. For that command, use a private transient cache such as
`~/.cache/sparkyrivals/eas-staging` (directory mode 0700). Keep the command's logs,
downloaded artifacts and source manifests in repository-root `.local/`.

The 7 October session hit a kernel global out-of-memory event while several
heavy jobs overlapped. Run native builds, the full mobile suite and Android
emulators sequentially on this laptop. Use a bounded Gradle worker count/heap
and a single Jest worker when running acceptance; interrupted logs are not passes.
User systemd scopes with `MemoryMax` also contain a failing build so it cannot
exhaust the desktop's memory. Do not run an emulator alongside native compilation.
