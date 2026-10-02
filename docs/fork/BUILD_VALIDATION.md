# Milestone 1 validation

Validated 2026-10-03, branch `milestone/own-the-build`, starting fork main
`62b9f2f9ce4eeaae48b9a1c446105f6e665246d2`; upstream audit baseline remains
`f8df11ac3b019d022d3fa4a1b39c1b2f8576d361`. See [BASELINE.md](BASELINE.md) for
historical bootstrap results. No dependency lockfile changes were needed.

## Checks completed

| Check                                                                | Result                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile `pnpm run validate`                                           | Pass: generated resources, TypeScript, ESLint, localization, Knip, native locale and formatting checks                                                                                                     |
| Mobile `pnpm run test:ci`                                            | **487 suites / 7,521 tests passed**; includes identity/config, runtime deep links, auth callbacks, source identity and Watch workout dedupe                                                                |
| Server `pnpm run validate`                                           | Pass: TypeScript, ESLint, Prettier                                                                                                                                                                         |
| Server `SKIP_RLS_MATRIX=1 pnpm run test:ci --maxWorkers=2`           | **440 files / 5,439 tests passed**; 7 files / 395 tests skipped, matching the no-database baseline invocation                                                                                              |
| Auth targeted checks                                                 | Pass: upstream/configured/untrusted/malformed callbacks, repeated query rejection, trusted origins, session requirements, token fragments, registration tickets, SSO and existing API-key/session behavior |
| Frontend `pnpm run validate` and `pnpm run test:ci --watchman=false` | Pass; **182 suites / 1,695 tests**. Web/shared source contracts were not changed                                                                                                                           |
| Docs `pnpm run build`                                                | Pass; existing bundle-size warnings remain                                                                                                                                                                 |
| Clean prebuild, Android + iOS                                        | Pass for owned development, preview and production; all repeated and compared                                                                                                                              |
| Native metadata assertions                                           | All five Apple target IDs, App Groups, companion relationship, runtime schemes, effective versions, Android package/schemes/Kotlin links and release signing selection pass                                |
| Upstream/default prebuild                                            | Android + iOS development and production pass with retained upstream identities                                                                                                                            |
| EAS configuration                                                    | `eas.json` passes installed `@expo/eas-json` 24.9.0 schema (EAS CLI 24.10.0); profiles contain no submission destination                                                                                   |
| Workflow logic                                                       | 14 Node tests pass (existing PR validation plus new workflow safety tests)                                                                                                                                 |
| Workflow static validation                                           | actionlint 1.7.12 passes for all workflows with external shell/Python lint disabled; native Android/iOS/config workflows also pass ShellCheck through actionlint                                           |
| Compose                                                              | Dev/prod `docker compose config --no-interpolate --no-env-resolution --quiet` pass                                                                                                                         |
| Helm                                                                 | Temporary Helm 3.16.3: dependency build, lint and rendering pass; rendered ConfigMap contains the three explicitly configured schemes                                                                      |
| Patch/repository checks                                              | `git diff --check`, focused documentation formatting/link checks, ignored storage check; upstream license and package lockfile retained                                                                    |

The native comparator checks generated plist/entitlements/build settings and
Android metadata/source semantics. Xcode object UUIDs are random, so byte identity
of `project.pbxproj` is not asserted. Determinism is measured with identical
inputs and the existing frozen dependency lockfile.

Local diagnostic logs and native snapshots were written to
`/tmp/sparkyrivals-own-build/`; they are disposable, not a durable artifact contract.
Reproduce using [BUILDING.md](BUILDING.md) and the tracked tests/scripts. No new
migrations were introduced. Database-backed RLS/upgrade suites were not rerun in
this auth/config milestone; bootstrap's separate database evidence is historical.

## Account and toolchain observations

- EAS CLI 24.10.0 `whoami`: **Not logged in**. `EXPO_TOKEN`, `EXPO_OWNER` and
  `EXPO_EAS_PROJECT_ID` unset. No remote project/credential changes or builds.
- Apple team variables unset; no Apple account/membership/provisioning verified.
- JDK 27 and 8 present; no JDK 17/Android SDK, `adb`, `sdkmanager`, `ANDROID_HOME`
  or `ANDROID_SDK_ROOT`. No global toolchain installation was attempted.
- Linux cannot run Xcode. iOS/watchOS prebuild used `--no-install`; no CocoaPods,
  simulator/device compile, signed archive or paired hardware test was run.
- GitHub Actions API still reports `enabled: false`. No workflow was dispatched.
- Temporary Helm/actionlint tools stayed under `/tmp`, with normal download caches.
  No production data, permanent signing key or disposable keystore was created.

## Remaining limitations and known baseline issues

The eight Expo patch alignment warnings in [BASELINE.md](BASELINE.md) remain;
they did not prevent this milestone's JS tests or native generation. Dependency
alignment is deferred to a separate change. Existing large-bundle warnings and
test-console warnings remain; unrelated source was not reformatted or refactored.

Generated Gradle/config assertions prove release selects the explicit release
config and contains fail-closed guards. **They do not prove a signed Gradle build
has run.** Verify actual missing-key failure, successful owned-key signing and
certificate fingerprints once the native toolchain/key is available. EAS injection
compatibility was inspected against its documented build process, not executed
on a cloud builder.

Likewise, generated Apple entitlements do not prove valid provisioning or runtime
capability support. Before distribution, verify all five signed targets, App Groups,
versions, HealthKit, background sync, auth browser returns, WatchConnectivity,
widgets, complications and Live Activities on actual devices. New app IDs need
new permission grants and do not migrate upstream app-local storage automatically.

The implementation is ready for code review with these explicit release boundaries.
No store submission, paid build, application deployment, Challenge feature, or
Wear OS implementation is included.
