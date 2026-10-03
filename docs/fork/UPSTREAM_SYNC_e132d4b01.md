# Controlled upstream sync before Milestone 8A

PR #8 was verified at `283de382fe77aa5994bd3abe85d11e766e9c108b` and merged
normally into the fork at `02d6ab39a98e912c8c60052575fa95950da1d7be`.
The frozen upstream snapshot is `e132d4b0192cf474728920e17cbcdbc9f5058d1c`.
Before synchronization, fork main was 58 commits ahead and 35 behind upstream.
Branch: `maintenance/upstream-sync-e132d4b01`.

## Merge scope

The normal merge preserves upstream bodyweight exercise support, signed added or
assisted loads, Watch crown handling, synced-workout diary navigation, caffeine
calendar fixes, Perplexity tool calls, and provider activity-detail reconciliation.
Only frontend/server `AGENTS.md` update dates conflicted; both retain the newer
fork date and all upstream and fork guidance. No application conflict required a
behavior change. The upstream CI-generated schema snapshot is included unchanged;
it was not edited or regenerated locally.

No dependencies, workflows, native build identity or signing configuration changed.
Challenge scoring/privacy, the composed Watch context, Wear transport, local
notifications, native surfaces and the `dockerdata/` policy remain intact.

## Validation

Test evidence is local under `/tmp/sparkyrivals-8a/sync-*`.

- Server `pnpm run validate`: passed.
- Frontend `pnpm run validate`, full CI (187 suites / 1,778 tests), and production
  build: passed.
- Mobile `pnpm run validate` and full CI: 506 suites / 7,780 tests passed,
  including fork identity, signing, native surface, transport and Challenge tests.
- Full server no-database CI: 450 files / 5,571 tests passed; 11 files / 446
  database-gated tests skipped, with database coverage run separately below.
- Fresh PostgreSQL 18.3 startup through normal `pnpm start`: migrations and RLS
  applied, both new modality constraints validated, server listened on port 3018.
  The supervising timeout deliberately stopped this test server.
- Serial Challenge, RLS, exercise and schema/auth integration: 16 files / 520
  tests passed. Database initialization/advisory-lock test: 1 passed. Repeating
  the normal migration runner passed.
- Workflow safety: 3 tests passed. GitHub Actions remains disabled.
- Documentation build passed. `git diff --check` passed.

The database was a new explicitly named local test database, on a task-owned
PostgreSQL container with tmpfs storage and localhost-only port 15468. It was
stopped and removed after testing; no persistent user database was used.
Known locale coverage, Knip hints, test-renderer, PostgreSQL query deprecation and
bundle-size warnings remain. Native compilation and physical acceptance belong
to Milestone 8A; this sync does not claim them.

## Safety

Upstream fetches are read-only; its push URL remains
`disabled://read-only/CodeWithCJ/SparkyFitness`. All GitHub writes target
`ImJstNickDev/SparkyRivals`. No production server, deployment, credentials or device
interaction was performed by the sync. The pre-existing formatting-only mobile
`app.json` change is preserved in the local stash named
`Preserve pre-milestone-8A app.json formatting`.
