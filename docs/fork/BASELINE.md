# Upstream baseline validation

Audited upstream commit: `f8df11ac3b019d022d3fa4a1b39c1b2f8576d361`.
Baseline checks ran on 2026-10-02 (Europe/Rome); documentation checks and repeated
server/frontend validation completed on 2026-10-03.
Application code, dependency manifests, lockfile, migrations, native configuration,
license, and attribution were unchanged. Bootstrap changes are documentation only.

## Environment and result

Arch Linux x86_64, Node 24.20.0, repository-pinned pnpm 10.33.4, Python 3.14,
Docker 29.8.1, and a disposable PostgreSQL 18.3 Alpine container. Database storage
was temporary, exposed only on a dynamically assigned loopback port. No existing
application database or health account was used.

The source baseline passes the installed package validations, JS/TS test suites,
web/docs builds, fresh database migrations, and serial database integration checks.
It is **not an entirely green native/distribution baseline**: Expo dependency
alignment fails, concurrent database suites can deadlock, native compilation was
not available on this host, and generated Android release signing is incomplete.

| Check                         | Command / scope                                                                                                                          | Result                                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen workspace install      | Root: `pnpm install --frozen-lockfile`                                                                                                   | Pass, 18.3 s; no tracked dependency changes. Warnings below.                                                                                       |
| Server validation             | Server: `pnpm run validate`                                                                                                              | Pass: TypeScript, ESLint, Prettier.                                                                                                                |
| Frontend validation           | Frontend: `pnpm run validate`                                                                                                            | Pass: TypeScript, ESLint, Prettier, Knip.                                                                                                          |
| Mobile validation             | Mobile: `pnpm run validate`                                                                                                              | Pass: generated i18n/assets, TypeScript, ESLint, translation checks, Knip, native locales, Prettier.                                               |
| Server CI suite               | Server: `SKIP_RLS_MATRIX=1 pnpm run test:ci --maxWorkers=2`                                                                              | Pass: 439 test files; 5,417 tests passed. Runner also reports 7 skipped files and 395 skipped tests. 133.41 s. DB tests were run separately below. |
| Frontend CI suite             | Frontend: `pnpm run test:ci --watchman=false`                                                                                            | Pass: 182 suites, 1,695 tests; 56.667 s.                                                                                                           |
| Mobile CI suite               | Mobile: `pnpm run test:ci --watchman=false`                                                                                              | Pass: 479 suites, 7,442 tests; 131.761 s.                                                                                                          |
| Web production build          | Frontend: `pnpm exec vite build`                                                                                                         | Pass, including PWA generation. Large-chunk warning remains.                                                                                       |
| Documentation site            | Docs: `pnpm run build`                                                                                                                   | Pass, VitePress 1.6.4. Large-chunk warning remains. This builds `docs/src`, not `docs/fork`.                                                       |
| Expo dependency alignment     | Mobile: `pnpm exec expo install --check`                                                                                                 | **Fail (exit 1)**: eight expected patch-version updates, listed below. No upgrades made.                                                           |
| Android production generation | Disposable baseline worktree: `CI=1 APP_VARIANT=production pnpm exec expo prebuild --platform android --no-install`                      | Pass; inspected generated manifest, Gradle and signing configuration. No Gradle compile.                                                           |
| iOS production generation     | Same worktree: `CI=1 APP_VARIANT=production pnpm exec expo prebuild --platform ios --no-install`                                         | Pass; inspected target IDs, App Groups, capabilities and entitlements. No CocoaPods/Xcode build.                                                   |
| iOS development generation    | Same worktree: `CI=1 APP_VARIANT=development pnpm exec expo prebuild --platform ios --clean --no-install`                                | Pass; confirmed development identity and removal of APNs entitlement. Missing Apple team warning is expected.                                      |
| Fresh database migrations     | Server: `pnpm run test:migrations` with disposable DB environment                                                                        | Pass: all migrations, application-role grants and RLS application. Repeated on a second fresh database.                                            |
| Database integration suites   | Five suites below, fresh migrated DB, `--maxWorkers=1 --no-file-parallelism`                                                             | Pass: 5 files, 372 tests; 3.82 s.                                                                                                                  |
| Database initialization lock  | `RUN_DATABASE_INITIALIZATION_TEST=1 pnpm exec vitest run tests/initializeDatabase.integration.test.ts` with disposable DB environment    | Pass: 1 test. Verifies lock wait/release and migration ledger against the directory.                                                               |
| Garmin helper                 | External temporary Python venv; install `SparkyFitnessGarmin/requirements.txt`, then `python -m unittest discover tests` in that package | Pass: 6 tests. No Garmin network/account integration exercised.                                                                                    |

## Database reproduction and concurrency finding

Use a new disposable database whose name contains a separate `test` component,
such as `sparky_serial_test`. Some destructive integration suites skip when that
condition is not met. Never point these tests at personal or production data.

Set the existing environment variables for that container:

- `SPARKY_FITNESS_DB_HOST`, `SPARKY_FITNESS_DB_PORT`, `SPARKY_FITNESS_DB_NAME`;
- `SPARKY_FITNESS_DB_USER`, `SPARKY_FITNESS_DB_PASSWORD` for migration/owner access;
- `SPARKY_FITNESS_APP_DB_USER`, `SPARKY_FITNESS_APP_DB_PASSWORD` for the application role;
- `SPARKY_FITNESS_FRONTEND_URL` (the audit used `http://localhost:3004`).

From `SparkyFitnessServer/`, after configuring those values:

```sh
pnpm run test:migrations
pnpm exec vitest run \
  tests/rlsPermissionMatrix.integration.test.ts \
  tests/stravaActivityDetailCleanup.integration.test.ts \
  tests/betterAuthSchemaCheck.integration.test.ts \
  tests/oidcProviderRepository.integration.test.ts \
  tests/authRateLimitDatabase.integration.test.ts \
  --maxWorkers=1 --no-file-parallelism
RUN_DATABASE_INITIALIZATION_TEST=1 pnpm exec vitest run \
  tests/initializeDatabase.integration.test.ts
```

The first database was called `sparky_audit`, which caused two guarded suites to
skip (304 passed, 68 skipped). That was not accepted as complete DB coverage.
After using a test-qualified name, running the five suites with two workers
produced a PostgreSQL deadlock in the historical active-calorie cleanup test while
the Strava cleanup suite also ran. The report contained 10 failed / 362 passed;
later failures included the resulting aborted transaction.

A serial retry against that same database encountered leftover fixture state
from the failed run. Recreating a fresh database, migrating it, and running the
five suites serially passed all 372 tests. This supports a shared-database test
isolation/concurrency issue; it does not establish that production requests have
the same deadlock. No test or application code was altered to hide the failure.
Use fresh databases and serial execution until the fixture isolation is fixed in
a separate focused change.

The initialization test exercised an already migrated test database and an explicit
lock holder. This audit did not test upgrading a previous released deployment or
starting two server processes simultaneously against a fresh database.
The clean final database's migration ledger contained 244 applied SQL files.

## Warnings and unresolved checks

### Expo package alignment

The installed Expo validator requested these patch updates:

| Package                | Installed | Expected |
| ---------------------- | --------- | -------- |
| `@expo/ui`             | 57.0.20   | ~57.0.21 |
| `expo`                 | 57.0.25   | ~57.0.26 |
| `expo-background-task` | 57.0.20   | ~57.0.21 |
| `expo-camera`          | 57.0.5    | ~57.0.6  |
| `expo-constants`       | 57.0.19   | ~57.0.20 |
| `expo-navigation-bar`  | 57.0.2    | ~57.0.3  |
| `expo-task-manager`    | 57.0.20   | ~57.0.21 |
| `expo-widgets`         | 57.0.21   | ~57.0.22 |

Treat alignment as a separate dependency commit if still needed at milestone 1.
Passing JS tests/prebuild does not prove those version mismatches are harmless on
devices.

### Install and build warnings

- Optional `sharp@0.34.5` installation detected global libvips and attempted a
  source build without `node-gyp`; that optional build failed while the workspace
  install and tested builds completed. Image-processing runtime paths were not
  separately validated.
- pnpm skipped the `react-native-enriched-markdown@1.0.2` build script under the
  upstream script-approval policy. That policy was left unchanged.
- Vite/VitePress emitted bundle-size warnings; Vitest warned about `__dirname`
  under its future native config loader. No unrelated optimization or refactor
  was attempted.
- Apple target prebuild warns that `ios.appleTeamId` is missing without the
  configured team environment variables. No Apple account was used.

### Native build and signing boundaries

Generated Android `app/build.gradle` contains only `signingConfigs.debug` and uses
it for `buildTypes.release`. The inherited release workflow supplies
`MYAPP_RELEASE_*` Gradle properties, but no tracked configuration consumes them.
That is a concrete release-signing gap. See [IDENTIFIERS.md](IDENTIFIERS.md).

This host has JDK 27 and 8, with no detected JDK 17, `ANDROID_HOME`/
`ANDROID_SDK_ROOT`, Android SDK directory, `sdkmanager`, or `adb`. A local Android
debug build is realistic after installing JDK 17 and the SDK/NDK required by the
generated project (compile/target SDK 36), but was **not run** during bootstrap.
The inherited Android workflow is the existing Linux/JDK 17 build path; it needs
the identity/signing review before enabling it in this fork.

iOS/watchOS compile and signing need macOS/Xcode or configured EAS builders. The
existing `ios-build.yml` covers unsigned iOS/Watch simulator builds; it does not
validate distribution profiles. Device builds require our Apple team, registered
host/extension App IDs and App Groups, provisioning, and paired hardware testing.
No remote EAS project, signing credentials, store submission, or hardware pairing
was accessed in this audit.

Other unrun checks: end-to-end application/browser smoke tests, physical HealthKit
and Health Connect sync, background scheduling, WatchConnectivity delivery,
widget/Live Activity rendering, full Docker application deployment, previous-release
database upgrades, and live third-party provider integrations.

## Bootstrap-specific verification

The dedicated fork documents passed Prettier, all 18 relative Markdown link/fragment
checks, and `git diff --check`, separately from the VitePress build. Only these new
documents are formatted; upstream guides receive narrowly scoped edits. The final
Git review checks documentation-only changes, unchanged license/lockfile/application
code, full upstream ancestry, matching pushed/local heads, and a clean worktree.

Temporary native generation ran in a detached worktree at the baseline SHA, with
dependencies shared from the frozen install. The disposable worktree and PostgreSQL
container are removed after collecting results. Ignored local dependencies and
build/test outputs remain available in the main checkout; none are committed.
GitHub Actions remain disabled pending the milestone 1 workflow review.
