# Controlled upstream sync — 2026-10-03

PR #2 was merged with a normal merge commit into our fork at
`eff06b7b6e522145e037f4ce08a7e5d732a4fbb1`. The exact validated backend head was
`f2e87034750b25297346634ca13fb99e7bea83ed`.

The upstream snapshot is frozen at
`3c031663763fb5c6aedef7952b0163ef7cb5ef28`; this task does not chase later commits.
Branch: `maintenance/upstream-sync-3c0316637`, based on that merged fork main.
Before synchronization main was 21 ahead / 12 behind the frozen upstream.
The normal merge had **no conflicts**. No histories were rebased or rewritten.

## Preserved changes

The merge takes upstream's detached native Add tab fix and associated native
bottom-tabs patch, consolidated medication reminders, symptom theme corrections,
and whole-local-day workout sync window. The latter preserves morning workouts
when an afternoon sync replaces source/day entries on the server.

Fork identity/signing/auth protections, Challenges, read-only upstream guidance,
workflow guards and `dockerdata/` policy remain intact. No workflow changed in the
upstream diff; repository-wide Actions remains disabled. Nix dependency hashes
are inherited unchanged; Nix builds are not claimed validated on this host.

## Validation

- Frozen pnpm installation passes, including the new native patch. The existing
  ignored `react-native-enriched-markdown` install-script warning remains.
- Server, frontend and mobile `pnpm run validate` pass.
- Full mobile CI suite: **487 suites / 7,532 tests passed**, including identity,
  release signing, health deduplication and native navigation contracts.
- Full server no-database CI suite: **446 files / 5,534 tests passed**;
  10 files / 424 database-gated tests skipped (run separately for Challenges).
- Challenge unit and real-database/RLS suites: **9 files / 122 tests passed**.
  Normal server startup applied migrations/RLS to a fresh disposable localhost
  PostgreSQL 18.3 test database on tmpfs, then was deliberately stopped.
- Clean Android/iOS prebuild and native identity checks pass for all three
  derivative variants. A repeated production clean prebuild produces identical
  normalized native metadata. No signing credentials or remote build were used.
- Workflow safety: **3 tests passed**. `git diff --check` passes.

The server/frontend/shared sources are unchanged by upstream. Frontend validation
retains the existing Knip configuration hints. Native checks retain the expected
missing-owned-Apple-Team warning in account-free `APP_CONFIG_ONLY` mode. These
checks do not compile Swift, run Xcode or exercise a physical phone/watch.

All writes target `ImJstNickDev/SparkyRivals`. Upstream's fetch URL stays readable
and its push URL stays `disabled://read-only/CodeWithCJ/SparkyFitness`.
