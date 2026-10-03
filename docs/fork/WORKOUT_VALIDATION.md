# Workout Time validation — 2026-10-03

## Base and safety

PR #6 merged with a normal merge commit into the fork at
`a132e3f8ca6fd8a449cf17b8c5b7ee3d9b66713d`. Frozen upstream remains
`3c031663763fb5c6aedef7952b0163ef7cb5ef28` (merged main: 43 ahead / 0 behind).
No sync PR was necessary. `milestone/workout-challenges` starts from that main.
Upstream push remains `disabled://read-only/CodeWithCJ/SparkyFitness`.
All writes target the fork; no upstream write or Actions enablement occurred.

## Checks

Executed package commands and their results are recorded below. No personal database or
production state was used. Test-only credentials/logs remain outside git.

| Check                                                             | Result                                                                                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Server `pnpm run validate`                                        | Passed                                                                                                               |
| Frontend `pnpm run validate`                                      | Passed                                                                                                               |
| Mobile `pnpm run validate`                                        | Passed                                                                                                               |
| Server full no-DB CI with coverage                                | 447 files / 5,555 tests passed; 446 DB-gated/skipped                                                                 |
| Challenge unit + real DB tests                                    | 11 files / 165 tests passed                                                                                          |
| Serial disposable DB integration plus Challenge tests             | 22 files / 598 tests passed; initialization separately enabled                                                       |
| Initialization lock/migration test                                | 1 passed                                                                                                             |
| Full frontend CI                                                  | 186 suites / 1,765 tests passed                                                                                      |
| Full mobile CI                                                    | 498 suites / 7,690 tests passed                                                                                      |
| Kotlin actual protocol compile/JUnit                              | 23 tests passed                                                                                                      |
| Frontend production build                                         | Passed                                                                                                               |
| Clean Android+iOS development prebuild, native identity validator | Passed                                                                                                               |
| Upgrade from merged Milestone 5                                   | Exact Steps Challenge, accepted creator membership and canonical 4,321-step row preserved; workout creation succeeds |
| Documentation build, links and diff checks                        | Passed; workflow safety 3/3 passed                                                                                   |

Database: existing PostgreSQL 18.3 Alpine image, localhost port 15466, tmpfs storage,
no named volumes. `sparkyrivals_workout_test` starts empty; actual `pnpm start`
applies migrations and RLS and opens port 3016 before deliberate SIGTERM shutdown.
Supervising timeout exit 124 is expected. Initial connection raced PostgreSQL's
first initialization; after readiness was confirmed, startup completed normally.
Serial suites avoid the inherited shared-fixture concurrency/deadlock problem.

Upgrade: isolated detached worktree at merged main, normal `test:migrations` into
`sparkyrivals_workout_upgrade_test`, synthetic Steps fixture, then the feature
branch's normal runner. JSON row comparisons preserve all existing Challenge and
membership fields, including timestamps. No migration-ledger editing or schema
snapshot regeneration was used. No new permanent service/storage exists.

## Coverage

- Existing Steps fixtures/ranks/calendar behavior and legacy v1 parser compatibility.
- Real grouped sessions with multiple children count once; summed canonical duration;
  multiple sessions/day; imported HealthKit, Health Connect, Garmin/FIT, COROS, Hevy,
  Liftosaur shapes; manual standalone duration; completed-set zero vs ambiguous zero.
- Active Calories exclusion even with positive duration; plans/preset scaffolds,
  incomplete sets/children, invalid/non-finite/extreme durations; daily rounding.
- N-person duration ties independent of counts/calories; edits/deletes/late records
  after completion; date cutoff; immutable metric; restricted aggregate columns.
- Pending/outsider/delegated isolation, ordinary exercise RLS, metric-specific consent,
  cancellation/leaving, bounded repository query count for up to 100 participants.
- Both metrics through create/detail routes; explicit result units and coverage.
- Web/mobile selector, default Steps, duration/margin/count display, versus/groups,
  completed/invitation/no-workout/explicit-zero history; exercise cache invalidation.
- Companion v1 golden fixture, v2 workout projection, no pending scores, obsolete
  metric cache suppression, lifecycle, original ranks and bounded payload size.
- Existing account/logout/tombstone/source-time/transport/build-identity tests remain
  in the full mobile suite. Kotlin covers real serialization, version rejection,
  count/presence and duration parts. The maximum-size eight-item/four-row fixture
  measured 28,482 UTF-8 bytes (28,593 with the Wear envelope), below the tested
  32 KB budget and Data Layer 100 KB ceiling. Native Swift model checks are prepared,
  not run.

## Visual inspection

Installed Chromium, local DevTools protocol and a temporary Vite fixture harness
rendered actual Challenge detail components with the **production built CSS**.
Inspected Steps active, Workout Time active, Workout Time dark desktop and dark
390px narrow viewport. All four report no horizontal overflow. Durations/counts,
no-record vs zero and existing semantic theme tokens are visible. This is component
visual validation, not authenticated end-to-end testing. Local PNGs/logs live under
`/tmp/sparkyrivals-workout/`; no fixture mode or screenshots enter production code.

## Native acceptance debt and warnings

This Linux host has OpenJDK 27 and 8; no configured Android SDK/JDK 17, adb, Xcode or
watch simulator. Kotlin protocol/JVM execution is real; **`:app:assembleDebug`,
`:wear:assembleDebug`, Compose instrumentation, Xcode/Swift native compilation and
physical Galaxy Watch/Apple Watch delivery were not run**. Existing DEBUG seeds,
Compose previews and prior physical acceptance checklists remain the follow-up.
No EAS/cloud build, signing credentials, store submission or deployment was used.

Prebuild reports the deliberately unset Apple Team ID in configuration-only mode.
Existing Expo patch alignment, partial native locale coverage, Knip configuration
hints, chunk sizes, test act/log and toolchain deprecation warnings remain. No
unrelated dependency upgrades were made. Generated native projects remain ignored.

All migration-checklist surfaces are covered: new timestamped migration, central
consent projection, normal boot, untouched CI schema snapshot, shared mirrors,
database/security/sharing docs, consumers and tests. No new environment variable,
endpoint or table was needed. Production still uses a separate checkout and bind
mounts under `dockerdata/` only. The final feature PR must remain unmerged.
