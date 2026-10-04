# Controlled upstream sync before remote push

Frozen upstream snapshot: `9bae67beb0c909e225dc60c6a336c78269c130c9`.
Fork base: `0bd2420d3deebbc11c84afe76676799b8d87e3dc` (Milestone 8A merged).
Before synchronization the fork was 86 commits ahead and 22 behind this snapshot.

The normal merge preserves upstream timed-set synchronization, Now Playing and
source-aware exercise matching. Three conflicts were resolved narrowly:

- Mobile agent guidance retains both the fork source maps and upstream timer notes.
- `WatchPage` retains Challenge and the M8A initial-page helper; upstream Now
  Playing remains a transient page following Workout during an active session.
- `ContentView` routes both Challenge and Now Playing through the existing page
  deck. Missing weight still selects Entry initially without blocking navigation.

## Validation

- Server validate: passed.
- Server no-database CI: 450 suites passed, 11 skipped; 5,576 tests passed,
  446 skipped. Database suites remain separate; no migration/RLS changed here.
- Mobile validate: passed, with existing missing-translation coverage reports.
- Mobile full CI: 507 suites / 7,816 tests passed.
- Additional merge regression plus Watch contracts: 2 suites / 22 tests passed.
- Workflow safety: 3 tests passed; no workflow or dependency changes.
- `git diff --check`: passed.

No local Swift compiler/Xcode is available. The subsequent remote-push milestone
requires a new full EAS Apple build and native/device acceptance; this sync does
not claim new binary or physical Watch validation.

Only the fork receives the sync branch and PR. Upstream stays read-only with its
push URL disabled. No production action or credential change is part of this sync.
