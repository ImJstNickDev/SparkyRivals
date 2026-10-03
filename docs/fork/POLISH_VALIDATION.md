# Milestone 7 validation

## Repository state

- PR #7 merged with a normal merge commit: `e2fee2726ebae4a751da7c992da694efaeb0713e`.
- Frozen fetched upstream: `3c031663763fb5c6aedef7952b0163ef7cb5ef28`, unchanged.
  No sync PR was necessary; merged main was 49 ahead / 0 behind upstream.
- Feature branch: `milestone/challenge-polish`, fork-only origin.
- Upstream push remains `disabled://read-only/CodeWithCJ/SparkyFitness`.
- No upstream write, workflow enablement, store operation or deployment occurred.

## Linux checks

| Check                                                 | Result                                                                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Frontend `pnpm run validate` / production build       | Pass; PWA output generated                                                                                        |
| Frontend full `pnpm run test:ci`                      | **187 suites / 1,775 tests passed**                                                                               |
| Mobile `pnpm run validate`                            | Pass: generation, TypeScript, lint, i18n, Knip, native locales, formatting                                        |
| Mobile full `pnpm run test:ci --watchman=false`       | **505 suites / 7,752 tests passed**                                                                               |
| Final native surface source contracts                 | **5 tests passed** after the small unscored-state clarification                                                   |
| Actual pinned Kotlin/JVM protocol and surface harness | **34 tests passed**, including 11 new surface tests                                                               |
| Focused native configuration regressions              | **14 suites / 183 tests passed**                                                                                  |
| Server `pnpm run validate`                            | Pass, validating the source-first shared helper consumer                                                          |
| Workflow safety                                       | **3 tests passed**; Actions still disabled                                                                        |
| Docs VitePress production build                       | Pass                                                                                                              |
| Local documentation links / whitespace                | **80 links checked**, `git diff --check` passes                                                                   |
| Owned development iOS + Android clean prebuild        | Pass; missing Apple Team warning is expected in `APP_CONFIG_ONLY=1`                                               |
| Repeated owned clean prebuild metadata                | Identical; five Apple targets, third Android widget, protected Wear services and signing/identity assertions pass |
| Upstream/default development iOS + Android prebuild   | Pass; **no Wear target**, existing default identities preserved                                                   |
| Commit signatures                                     | SSH signatures verified with the configured public key                                                            |

No server runtime/API/schema contract changed, so no new DB migration or database
integration run was required. Existing backend consent/scoring is reused. Mobile's
full suite includes existing HealthKit dedupe, Watch transport, Wear protocol,
identity/signing/configuration, notification and calorie/macro regressions.

Commands ran from their corresponding packages. Native validation used
`APP_CONFIG_ONLY=1 EXPO_BUILD_NUMBER=101 pnpm build:profile sparkyrivals-development`
with `expo prebuild --clean --platform all --no-install`, followed by
`validate:native --snapshot ...` / `--compare ...`. The default matrix used
`APP_CONFIG_ONLY=1 APP_VARIANT=development`. Configuration-only values are not
production signing, EAS registration, provisioning or a remote build.

Evidence logs remain in `/tmp/sparkyrivals-polish/`: `web-full-final.log`,
`web-build-final.log`, `mobile-ci-final-head.log`, `mobile-validate-push.log`,
`wear-jvm-last.log`, `native-final-repeat.log`, `native-default.log` and
`docs-build.log`. Temporary files are not committed.

## Visual evidence

Chromium rendered the real frontend components against deterministic test
fixtures using a temporary Vite harness outside the repository. Captured and
inspected completed Steps with Rematch, Workout Time Rematch in light/dark,
and the narrow 390px dark flow. No horizontal overflow was observed. The flow
shows editable dates/metric/name, eligible preselection and renewed-consent copy.
Screenshots and harness are temporary (`/tmp/sparkyrivals-polish/`), not production
fixtures or committed binary artifacts. This does not verify backend delivery.

## Native boundary

The host has Java 27/8, no configured Android SDK/adb, and no Xcode/swiftc.
No iOS/watchOS application, Android phone/Wear APK, emulator, physical watch,
actual notification delivery or native widget rendering was tested. The pinned
Kotlin JVM harness compiles real domain/protocol models; it does not compile
Android service/Compose/Glance classes. Swift source contracts do not replace
Swift compilation. See the full acceptance checklist in
[CHALLENGE_POLISH.md](CHALLENGE_POLISH.md#milestone-8-native-acceptance-checklist-not-executed-here).

## Warnings and corrected checks

- Existing locale coverage gaps, Knip configuration hints, React test renderer/act
  warnings and web bundle-size warnings remain visible. Only canonical English
  translations changed; generated translations remain for their usual workflow.
- Initial validation exposed incomplete Rematch query mocks, a shared export
  missing its source `.ts` extension, and notification tests tied to row indices.
  These were corrected and all affected checks rerun.
- Apple targets use filesystem-synchronized Xcode groups, so generated-source
  validation checks those groups rather than requiring individual PBXFileReference
  records. No generated source was made authoritative.
- One initial test command incorrectly passed an extra `--` and found no tests;
  the actual full CI command was rerun without it.
