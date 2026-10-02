# Milestone 1: Own the Build

Implementation is in progress on `milestone/own-the-build`. The central identity
resolver and host Expo configuration now support explicit custom identities,
derived development/preview variants, and rejection of upstream EAS destinations.
All three Apple target configs now derive their bundle IDs and App Groups from
the resolver and emit phone/Watch schemes in generated runtime metadata. Their
native target names remain unchanged. Remaining steps below are pending until
their implementation and validation land.
This milestone follows the
[identifier inventory](IDENTIFIERS.md) at upstream
`f8df11ac3b019d022d3fa4a1b39c1b2f8576d361`.

## Outcome and boundaries

Produce reproducible SparkyRivals Android, iOS, and Apple Watch builds under our
own application identities, EAS project, and signing credentials. Development
builds should coexist with upstream. Build validation must not publish or submit
to a store. Preserve upstream defaults, license/credits, features, native module
names, and file layout. Broad visual rebranding and Challenges are later work.

Inputs to settle at implementation time: an owned reverse-DNS identity, our EAS
owner/project UUID, Apple Team ID and registered App IDs/App Group, Android signing
key custody, eventual distribution channel, and store application IDs if submitting.
Do not invent or register these from placeholder values. Configuration and unsigned
validation can proceed before distribution credentials are available.

## Recommended implementation

1. Extend **`app.identifiers.js`** as the existing CommonJS identity resolver.
   Keep its legacy exports/overrides working. Resolve platform package/bundle,
   display name, slug, phone/watch URL schemes, team, group, and EAS identity in one
   place. Have app config and all target configs consume it. Use a generic explicit
   custom-identity mode with required inputs for derivative builds; retain upstream
   behavior when that mode is absent. Fail before cloud builds if custom mode is
   incomplete or resolves known upstream project/store destinations.
2. Use build-environment values rather than hardcoded fork conditionals. Proposed
   names include `APP_IDENTITY=custom`, `EXPO_APP_NAME`, `EXPO_APP_SLUG`,
   `EXPO_ANDROID_PACKAGE`, `EXPO_IOS_BUNDLE_IDENTIFIER`, `EXPO_APP_SCHEME`,
   `EXPO_WATCH_SCHEME`, `EXPO_EAS_PROJECT_ID`, and `EXPO_OWNER`. Keep existing team,
   development bundle, group, widget override, and Maps-key variables compatible.
   Validate `APP_VARIANT`; explicitly decide whether preview is isolated from
   production (recommended) instead of accidentally inheriting production identity.
3. Derive `.widget`, `.ExpoWidgetsTarget`, `.watchkitapp`, and
   `.watchkitapp.watch-widget` from the resolved host relationship. Expose schemes
   and group values through generated Info.plist/template resources and runtime
   config. Swift/Kotlin code should read those values; internal namespaces remain
   stable. Verify Watch companion ID and all host/extension entitlements.
4. Parameterize the **whole deep-link flow**. Update mobile auth/linking, phone
   widgets, Live Activities, Android notifications, and Watch complication links.
   Extend existing server trusted-origin configuration and server-owned callback
   selection with an explicit validated allowlist/default; never trust an arbitrary
   callback URL supplied by a client receiving a session token. Preserve upstream
   callback compatibility. A custom-scheme client may need a configured derivative
   server for web auth; document this, keeping session/API-key paths intact.
5. Fix **Android release signing at its source**. Add a narrowly scoped Expo plugin
   (or an equivalently reproducible build hook) that writes a real release signing
   configuration from build-time properties. No secrets in tracked files or JS.
   Production release must fail when credentials are absent, never fall back to
   debug signing. Use one documented credential authority and sync to other build
   paths deliberately. Reserve phone/Wear certificate and application-ID continuity.
6. Create a separate fork EAS project and development/preview/production profiles.
   Check target discovery and provisioning for all Apple extensions. Inspect the
   entitlements embedded in a signed archive. Use a separate explicit submission
   profile for our App Store Connect ID; no automatic submission in validation.
   Define remote versus local/CI build-number ownership so release versionCodes
   cannot reset to the clean-prebuild value 1.
7. Review inherited automation before enabling Actions. First enable validation
   workflows with fork-safe triggers; keep release, bot, translation-push,
   external-notification, and deployment jobs inactive or explicitly guarded.
   Resolve simulator launch IDs from built/configured metadata. Use a Node version
   verified with the current Expo/React Native baseline (local checks passed on
   Node 24; inherited mobile workflows still select Node 20). Fix the Android
   masked debug-build failure so a failed native check cannot report success.

The [Expo variants guide](https://docs.expo.dev/build-reference/variants/) supports
separate package/bundle identities per build environment. The
[EAS extension guide](https://docs.expo.dev/build-reference/app-extensions/) explains
credential discovery before native generation. Use the installed plugin output as
the source of truth for extension metadata, avoiding duplicate target declarations.

## Proposed small commits

| Order | Suggested commit                                                 | Concrete scope and validation                                                                                                                                                                                                  |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | `chore(build): centralize configurable application identity`     | Extend CommonJS resolver, keep current default-output fixtures, add custom/invalid variant tests, make `app.config.ts` consume it. No native source renames.                                                                   |
| 2     | `chore(build): derive Apple target identities and shared groups` | Update three target config functions plus Live Activity config; contract tests for host/extension IDs, team/group consistency and generated metadata.                                                                          |
| 3     | `feat(auth): support configured mobile callback schemes`         | Shared callback configuration/validation, server trusted origins and both web-return paths, mobile auth and linking. Tests for allowed/rejected callbacks, token fragments, upstream compatibility, session and API-key flows. |
| 4     | `chore(mobile): configure widget and watch deep links`           | Read generated scheme metadata in Swift/Kotlin/TS link producers; update launcher config and tests. Preserve protocol keys and health dedupe markers.                                                                          |
| 5     | `fix(build): require explicit Android release signing`           | Reproducible release Gradle wiring, missing-credential rejection, debug unchanged, certificate inspection. Native config/plugin tests plus generated Gradle assertions.                                                        |
| 6     | `chore(build): add fork EAS profiles and native validation`      | Our project/profile values, no automatic submission, build-number policy, compile workflows and validated toolchains. Configure repository secrets/settings outside git; enable only reviewed automation.                      |
| 7     | `docs(build): document owned builds and signing recovery`        | Exact setup/build commands, non-secret identity matrix, credential custody/rotation and restore procedure, native/device results, docs/fork updates.                                                                           |

Each implementation commit includes tests for its behavior. Keep unrelated Expo
dependency updates and any database-test concurrency fix in separate upstream-friendly
commits if they are required to make the native builds work. Do not fold broad
dependency upgrades into identity parameterization.

## Acceptance checks

- Run mobile `pnpm run validate` and relevant config, auth, link, widget, Watch,
  and health own-record-filter tests; run the full mobile CI suite for the cross-cutting
  native config change. Validate/test server and web when callback auth changes,
  and all consumers if a shared contract changes.
- Check default upstream configuration, custom development, preview, and production;
  inspect Expo public/prebuild output for IDs, schemes, groups, targets, and EAS
  destination. Keep signing secrets out of any emitted public config.
- Clean and repeated Android/iOS prebuilds must be reproducible. Native source
  survives clean prebuild because it is outside generated projects. Keep both
  root native patches applying correctly.
- Android: JDK 17 plus the required SDK/NDK, `assembleDebug`, then a signed release
  build. Use `apksigner verify --print-certs` and AAB signing inspection to prove the
  expected certificate. Missing release credentials must fail. Install our APK
  alongside upstream; exercise auth, Health Connect grants/sync, deep links,
  widget actions, notifications, and account switching.
- Apple: use the existing macOS/Xcode simulator workflow for both app and Watch,
  then EAS/Xcode signed device builds with our team. Inspect embedded provisioning
  and entitlements for every target. Test pairing, pages/order, check-in, workout
  start/finish/telemetry, HealthKit sync, widgets, Live Activities, and auth return
  on an iPhone + Watch. Simulator success cannot prove these hardware paths.
- Preserve `SparkyFitnessSessionId`; verify a locally recorded Watch workout is
  not imported a second time, including when testing side-by-side app identities.
- Record tested OS/toolchain/identifiers without exposing secrets. No production
  signing or store publication is claimed until these checks actually run.

New build variables need updates to the existing env template and environment
documentation; audit EnvGenerator, Compose, and Helm consumers for applicability
under the root guide. Build-only signing credentials must not be passed to running
server containers. Document that separation in the build guide.
