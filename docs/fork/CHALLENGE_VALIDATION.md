# Milestone 2 validation

Validated on 2026-10-03 from `milestone/challenge-backend`, based on the normal
PR #1 merge `14ff6ea3096138fd9f6ef12daf0188007dd09e3c` in our fork.
Upstream fetched at task start was `a341ab4844a649435cb1f7c653e21fffa69b7b22`;
merged fork main was 13 ahead / 10 behind. No upstream changes were integrated.

## Results

| Check                                                                     | Result                                                                                                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server `pnpm run validate` (typecheck, ESLint, Prettier)                  | Pass                                                                                                                                                                       |
| Frontend `pnpm run validate` (including Knip)                             | Pass; existing Knip configuration hints                                                                                                                                    |
| Mobile `pnpm run validate`                                                | Pass                                                                                                                                                                       |
| Challenge unit + integration suites, serial                               | **9 files / 122 tests passed**                                                                                                                                             |
| Full server no-database `test:ci --maxWorkers=2`                          | **446 files / 5,534 tests passed**; 10 files / 424 tests skipped by database gates                                                                                         |
| Full frontend `test:ci --watchman=false`                                  | **182 suites / 1,695 tests passed**                                                                                                                                        |
| Full mobile `test:ci`                                                     | **487 suites / 7,521 tests passed**                                                                                                                                        |
| All database integration files, fresh DB, serial                          | **14 files / 460 tests passed**; startup initialization test deliberately gated for separate run                                                                           |
| Database startup lock/ledger test                                         | **1 test passed**, run after database suites                                                                                                                               |
| Fresh database normal `pnpm start`                                        | All **245 migrations**, grants and RLS applied; HTTP listener started; controlled SIGTERM shut down cleanly                                                                |
| Upgrade from merged Milestone 1                                           | Base's **244 migrations**, seeded canonical step value, then new migration/RLS to **245**; original value preserved and readable through new app-role Challenge projection |
| Repeated `test:migrations`                                                | Pass; already-applied migrations retained and RLS reapplied                                                                                                                |
| Workflow safety tests                                                     | **3 passed**                                                                                                                                                               |
| Changed workflow actionlint                                               | Pass (external shell/python lint disabled)                                                                                                                                 |
| Documentation VitePress build                                             | Pass                                                                                                                                                                       |
| Fork Markdown links, touched documentation formatting, `git diff --check` | Pass                                                                                                                                                                       |

The test environment used existing Node 24.20.0 / pnpm 10.33.4 and an existing
PostgreSQL 18.3 Alpine image, in a disposable Docker container bound to localhost.
Its database storage was **tmpfs**, not a named volume. Fresh test databases were
`sparkyrivals_challenge_test`, `sparkyrivals_full_test` and
`sparkyrivals_upgrade_test`. Test-only credentials stayed outside git. No personal
or production database was used. The normal server boot was deliberately stopped
after validation, so the supervising `timeout` exits 124; logs verify a successful
boot and graceful shutdown, not a startup failure.

## Reproduction

Use a fresh disposable local PostgreSQL test database. Configure the existing
`SPARKY_FITNESS_DB_*`, `SPARKY_FITNESS_APP_DB_*`, frontend URL, API encryption key
and Better Auth secret explicitly for it. Disable scheduled jobs during this
check. Never source a production environment for these commands. Test DB names
must contain a separate `test` component; Challenge fixtures additionally require
localhost/loopback and explicit opt-in. Cleanup is gated too if setup is rejected.

From `SparkyFitnessServer/`:

```sh
pnpm start
# After successful migrations/RLS/listener startup, stop the server.
pnpm run test:migrations
RUN_CHALLENGE_DB_TESTS=1 pnpm exec vitest run tests/challenge*.test.ts \
  --maxWorkers=1 --no-file-parallelism
RUN_CHALLENGE_DB_TESTS=1 pnpm exec vitest run tests/*.integration.test.ts \
  --maxWorkers=1 --no-file-parallelism
RUN_DATABASE_INITIALIZATION_TEST=1 pnpm exec vitest run \
  tests/initializeDatabase.integration.test.ts --maxWorkers=1 --no-file-parallelism
```

For the no-database run, use a separate shell without database credentials:

```sh
SKIP_RLS_MATRIX=1 SKIP_SCHEMA_PARITY=1 SKIP_AUTH_RATE_LIMIT_DB=1 \
SKIP_BETTER_AUTH_SCHEMA_CHECK=1 pnpm run test:ci --maxWorkers=2
```

The upgrade check uses an isolated worktree at merged main, the normal migration
runner against an empty test DB, a synthetic user/check-in fixture, then the new
branch's runner against that same DB. It does not swap SQL inside the working
checkout, edit migration ledgers, or manually modify `db_schema_backup.sql`.

## Coverage of the security and data contract

- Strict names/dates/zones/metric/mode; duplicate participants and auto-accepted
  creator; atomic rollback when any initial invitation is unauthorized.
- Active relationship eligibility, missing/unknown target indistinguishability,
  self invitation, noncreator mutation denial and invitee-only acceptance/decline.
- Direct app-role SQL tests: outsider/delegated read isolation, blocked identity
  changes/consent forgery, immutable rules, no DELETE, irreversible cancellation,
  leaving/reaccept denial and ordinary health-row privacy.
- Pending/declined/left exclusion, accepted roster, full lifecycle, 100 consenting
  participants, and two concurrent invitations competing for the last slot.
- Calendar/date contracts in UTC and Europe/Rome, spring/fall DST, midnight,
  inclusive start/end, today's score and progress.
- Zero vs absent/null daily data, multiple dates/people, deterministic ties/ranks,
  gaps, future cutoff, cancellation, and coverage metadata.
- Manual canonical decreases, clear/delete and late arrival after completion;
  separate upstream automated max-wins regression. No score cache is involved.
- Repository query-count tests: three SELECTs for 1/2/10/100 people; consistent
  snapshots, inaccessible reads and rollback/release. Existing canonical unique
  index inspected; no new index on a large health table.
- Route tests pass through existing authentication middleware with mocked identity
  backend for both cookie and API-key modes; switched contexts, arbitrary owner
  fields, discovery/search inputs and malformed IDs are rejected. Database suites
  use real application-role connections. No physical clients are claimed tested.

## Boundaries and known limitations

The inherited shared-fixture parallel database deadlock is documented in
[BASELINE.md](BASELINE.md). This run uses fresh databases and serial execution;
all database integration files passed without suppressing failures. The existing
workflow's DB command now uses serial execution too, and includes opt-in Challenge
integration tests. Shared changes trigger consumer validation. **Repository-wide
Actions remains disabled**; no workflow was dispatched or enabled.

Existing Vitest/Vite configuration and node-postgres concurrent-client deprecation
warnings remain. Documentation builds retain their existing large-chunk warning.
No package upgrades were made. The eight Expo patch alignment warnings remain a
separate Milestone 1 issue; native configuration/signing was not changed or rerun.

The bootstrap cached-projection/scheduler proposal was superseded by bounded live
reads, as requested for v1. Canonical provider downward correction remains an
upstream ingestion limitation because reliable provenance is missing; see
[CHALLENGES.md](CHALLENGES.md). No signed/device build, cloud build, UI, Apple Watch
Challenge page, Wear OS code or production deployment was performed.

The new domain adds PostgreSQL tables only. Production still uses a separate server
checkout with bind-mounted `dockerdata/`; no new persistent volume or Compose
redesign is needed. Upstream is read-only and its local push URL remains disabled.

## Migration checklist completion

All eight sections of `agent-docs/new-migration-checklist.md` are complete:
normal timestamped migration; centralized RLS; actual server restart/boot;
CI-owned schema backup left unchanged; exported database/API Zod mirrors;
database/security/sharing documentation; routes/services/repository/OpenAPI/tests;
and server plus consumer validation. Client feature implementation and new runtime
or build environment configuration are not applicable to this backend-only scope.
No signing/account setup or Docker persistence change is introduced.
