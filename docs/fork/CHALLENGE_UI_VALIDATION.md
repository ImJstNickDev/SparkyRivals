# Milestone 3 validation — 2026-10-03

## Base and upstream safety

- PR #2 head verified as `f2e87034750b25297346634ca13fb99e7bea83ed`; normal fork
  merge produced `eff06b7b6e522145e037f4ce08a7e5d732a4fbb1`.
- Frozen upstream snapshot: `3c031663763fb5c6aedef7952b0163ef7cb5ef28`.
- Sync branch: `maintenance/upstream-sync-3c0316637`; merge commit
  `9f3f91cb9945749a86d240e239b6a8132fdf6890`.
- Fork [sync PR #3](https://github.com/ImJstNickDev/SparkyRivals/pull/3) merged
  normally; resulting main `747280650d58fcfde1617a12eab04b829eb3bff2` is the
  feature branch's base. It is 23 commits ahead / 0 behind the frozen snapshot.
- No merge conflicts. Upstream native tab, reminder, theme and health-sync fixes
  were retained. See [sync evidence](UPSTREAM_SYNC_2026-10-03.md) for package,
  native generation and database boot checks performed before merging PR #3.
- No later upstream snapshot was chased. Origin is the fork; upstream fetch is
  `CodeWithCJ/SparkyFitness` and push is
  `disabled://read-only/CodeWithCJ/SparkyFitness`. Zero upstream writes occurred.
- Fork Actions remains disabled; no workflow dispatch, deployment or remote build.

## Final package checks

Commands run from their package unless otherwise stated.

| Check                                               | Result                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Frontend `pnpm run validate`                        | Pass: TypeScript, lint, formatting, Knip                                                                                  |
| Frontend `pnpm run test:ci`                         | 185 suites / 1,757 tests passed                                                                                           |
| Frontend focused Challenge suites                   | 3 suites / 62 tests passed                                                                                                |
| Frontend `pnpm run build`                           | Pass, including validation and PWA generation                                                                             |
| Mobile `pnpm run validate`                          | Pass: locale generation, muscle figure generation, TypeScript, lint, localization audit, Knip, native locales, formatting |
| Mobile `pnpm run test:ci`                           | 490 suites / 7,589 tests passed                                                                                           |
| Mobile Challenge screen suite                       | 36 tests passed; transport/query coverage is also in full CI                                                              |
| Server `pnpm run validate`                          | Pass                                                                                                                      |
| Server full no-database CI                          | 446 files passed / 10 skipped; 5,538 tests passed / 424 skipped                                                           |
| Challenge suites with disposable PostgreSQL, serial | 9 files / 126 tests passed                                                                                                |
| Workflow safety and validation routing              | 14 tests passed                                                                                                           |
| Documentation build                                 | Pass                                                                                                                      |
| Changed-document formatting and relative file links | Pass                                                                                                                      |
| `git diff --check`                                  | Pass                                                                                                                      |

The full mobile suite includes the existing identity, Apple child target, deep-link,
release-signing, own-workout dedupe and native header/navigation contracts. Shared
changes compile in all three consumers. No dependencies were added or upgraded.

Server commands:

```sh
# No test database credentials in this shell.
SKIP_RLS_MATRIX=1 SKIP_SCHEMA_PARITY=1 SKIP_AUTH_RATE_LIMIT_DB=1 \
SKIP_BETTER_AUTH_SCHEMA_CHECK=1 pnpm run test:ci --maxWorkers=2

# With explicitly disposable database credentials only:
RUN_CHALLENGE_DB_TESTS=1 pnpm exec vitest run tests/challenge \
  --maxWorkers=1 --no-file-parallelism
```

The database suite used the fresh Milestone 3 test database initialized through the
normal server startup/migration path during synchronization, PostgreSQL 18.3 with
tmpfs storage on loopback, synthetic fixtures only. The container and temporary
credentials were removed after validation. No personal/production database or
Docker named volume was used. No schema/migration changed during UI development.

The no-database skips deliberately reserve live PostgreSQL checks for the database
run; they do not hide failing unit tests. Challenge coverage rechecks direct RLS,
consent, timezone boundaries, reconciliation and canonical step privacy. This task
also adds four strict native cache-metadata route cases.

A new mobile offline-mutation test initially asserted React Query's error state
before its scheduled observer update under the full suite. It now waits for that
state with `waitFor`, preserving the rejected-promise and exactly-one-request
assertions. The complete suite was rerun successfully. Locale validation also
caught and fixed singular interpolation names and mobile plural-key collisions.

## Visual checks

Used the installed Chromium via local DevTools protocol, with a temporary Vite
harness outside the repository. It renders the actual Challenge pages, hooks,
English catalog and production styles; API/auth/preferences are fixture-backed.
The fixtures remain exclusively in test files. This is component visual validation,
not an authenticated real-server end-to-end run or a complete app-frame screenshot.

Captured and inspected:

- Hub / featured active card at 1200px.
- Active 1v1 detail at 1200px.
- Five-person leaderboard at 1100px.
- Pending invitation at 390px, with no score disclosure.
- Creation at 390px.
- Completed results at 1100px, including current-winner wording.
- Dark detail at 390px and Whoop theme at 768px.

All eight checks reported no horizontal document overflow. Screenshots are local
review artifacts under `/tmp/sparkyrivals-ui/web-*.png`; no binary assets or mock
mode are included in production source. Test/log artifacts use the same temporary
root. They may be removed by the host and are not durable public PR attachments.

Mobile light/dark/AMOLED compatibility is checked by semantic-token usage, absence
of hardcoded feature colors, and component/type tests. **Native visual acceptance is
not claimed:** this Linux task ran no iOS/Android simulator or physical device, no
Xcode/Gradle compile and no new native prebuild during feature development. The
sync phase separately validated clean Android/iOS metadata for all identity variants
and production repeatability. Device follow-up should cover native headers,
calendar/keyboard interaction, large text, VoiceOver/TalkBack, themes, connection
loss and real account acceptance/refresh. Web score transitions respect reduced
motion; mobile adds no new animation.

## Existing warnings and scope boundaries

- Existing frontend/docs chunk-size warnings and frontend Knip configuration hints.
- Existing React test `act` warnings/log output in unrelated mobile suites.
- Missing non-English translations fall back to canonical English; no generated
  locale translations were edited. Existing Expo patch-alignment warnings remain
  outside this feature scope.
- Existing Vitest and node-postgres deprecation warnings remain. Database tests ran
  serially to avoid the documented shared-fixture parallel issue.
- The inherited schema snapshot remains CI-owned and untouched.
- No device/build signing, EAS/Apple credentials, App Store/Play submission, Watch
  Challenge UI/transport, Wear OS code, production deployment or Docker redesign.
- The temporary test container is development-only. The permanent production rule
  remains a separate server checkout with bind mounts under `dockerdata/` only.

The feature PR is for review and must remain unmerged at the end of this milestone.
