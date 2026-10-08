# Upstream integration before first production

## Frozen sources and review boundary

- M8A.7 PR #15: normal merge `6e7e02f8d0ce90118a01b4011b4e39b77ccd579a`.
- Reviewed head `0a05c421a31a817aaa43be280bd80c3dee314900`: all 33 commits retained.
- Integration branch: `sync/upstream-pre-production-2026-10-08`, from that clean main.
- Previous common upstream: `78ea8141f160f6b681c8eb45575126b0049a081c`.
- Frozen upstream: `1201594ffa9a84df06d00e7fada8aeac6216fb1e`.
- Integration merge: `b0f820f87a290bededf917d4d31cc3782a4b70b3` (two parents).
- Production preparation source: `65bb5d5f6f811fb18f6a0d77658f7f3275455330`.
- Before synchronization: **145 fork-only / 142 upstream-only** commits. The
  pre-merge M8A.7 head had 144 fork-only commits; the normal PR merge adds one.
- After the two implementation commits: **147 fork-only / 0 upstream-only**;
  the final evidence-only commit adds one fork commit.
- Both upstream repositories remain read-only. Upstream push URL is disabled;
  inherited publishing/deployment/translation jobs retain their repository guards.

The synchronization PR must remain open and unmerged for review. Production must
use the reviewed, subsequently merged fork main, pinned to an explicit SHA. No
production host, NPM, DNS, credentials or live push recipient is changed here.

## Semantic conflict resolutions

The merge was simulated with `git merge-tree` before an ordinary merge. Eleven
files conflicted; no blanket ours/theirs resolution was used.

| Files | Resolution |
| --- | --- |
| `.github/workflows/ci-tests.yml` | Keep fork Challenge/RLS cases and bounded DB workers; include upstream provider-sync claim integration test. |
| `.github/workflows/ios-build.yml` | Keep owned profile input, add upstream runner selection and new Watch workout cases alongside Challenge cases; use resolved workspace, not an upstream app name. |
| Root, frontend, mobile and server `AGENTS.md` | Retain both source maps; mobile documents new upstream workout behavior and fork Challenge/context guards together. |
| Frontend English catalog | Retain `challenges` and upstream `trainingConsistency` namespaces. |
| Mobile `WatchSettingsScreen.test.tsx` | Keep Challenge page-order/hiding and upstream double-tap setting coverage. |
| Mobile `useWatchCheckInBridge.ts` | Compose scheduled workout plans and double-tap preference with Challenge snapshot, distance units and existing account clearing. Clear scheduled/startable workouts with other private data. |
| Watch `ContextPayloadMapper.swift` | Decode both upstream double-tap and fork Challenge/distance fields in initializer order; absent Challenge state is not carried forward. |
| Watch `ContentView.swift` | Keep Challenge page and new workout-active environment value. |

An automatically merged upstream goal test needed fixtures for the fork's existing
personal-goal lookup. It now verifies that caffeine/alcohol null-vs-zero behavior
also retains steps, distance and active-energy targets. Runtime scoring, targets,
Ready transitions and consent were not changed.

## Integrated source changes

Upstream changes retained include hardened client IP extraction and Better Auth
rate limiting, provider synchronization claims/renewal and missing-source-ID import
fixes, backup schedule rechecks, workout carry/hold modalities and session updates,
Apple Watch workout/timer/double-tap/scheduled-plan improvements, mobile quick
actions, mindfulness, supplements, fasting, Canadian food data and training
consistency. Dependencies use the upstream lockfile plus existing fork workspace
and patches; installation uses frozen-lockfile validation.

Fork identity variants, EAS/signing configuration, all seven metrics and three
scoring modes, fixed-point ranks, Ready lobbies, target snapshots, M8A.7 navigation,
EN/IT import, configurable widgets, Watch/Wear transport and surfaces, encrypted
push registry/outbox, guarded taps/local fallback, root Compose and bind topology
remain present. Tests distinguish behavior from physical native acceptance.

## Database and security

Five additive upstream migrations are retained byte-for-byte:

- `20261003190000_add_weight_distance_and_duration_modalities.sql`
- `20261004120000_create_user_fasting_preferences.sql`
- `20261004180000_add_canadian_nutrient_file_provider_type.sql`
- `20261005193000_create_mindfulness_sessions.sql`
- `20261005200000_add_sync_started_at_to_external_data_providers.sql`

The fasting preferences are owner-only; mindfulness uses existing check-in consent.
Both are in the central startup RLS-enable list and policy matrix. Challenge and
push policies/projection functions remain intact. None of these new migrations
adds a SECURITY DEFINER access path. The existing fork functions retain their
restricted grants/search paths. The upstream schema backup is merged unchanged;
no local schema dump replaces it.

Fresh initialization and an actual pre-sync main schema upgrade use disposable
PostgreSQL 18. The latter seeds synthetic existing sum/locked-goal Challenges,
participant snapshots, personal goals and push delivery state before running the
normal new initializer twice; every seeded row remains unchanged. A new recovery
assertion disables RLS for every classified domain table, reruns the central
policy script and checks both RLS enablement and installed policies.

## Production preparation

- Frontend image build includes the fork catalog validator's source inputs in the
  builder only. Runtime still contains the compiled web application.
- New runtime files close signup. An operator-only stdin command creates the first
  admin through Better Auth on an empty database while public signup stays closed.
  Concurrent calls serialize; retries never overwrite an existing account.
- Bootstrap validates both HTTPS origin values and preserves existing files.
- Local acceptance covers the actual production images, PostgreSQL 18, bind mounts,
  health, no published ports, external-network isolation, authenticated Challenge
  API, secure cookies, two-hop client IP/rate limiting, RLS and logical restore.
- Enabled push config is exercised using a synthetic secret, with scheduled jobs
  disabled. Production's real Expo token remains private and is copied only after
  review through the approved secure connection. No APNs/FCM credential goes to
  the server; no real notification is sent during these tests.

See [DEPLOYMENT.md](DEPLOYMENT.md) for exact first-admin, NPM and push steps. Real
SSH access, existing server-state inspection, the admin email, membership policy,
off-host backup destination and final live HTTPS/device acceptance belong after
review approval. Existing M8A.6 health-source and M8A.7 visual QA limits are not
converted into passes by this server integration. No new physical app build is
required for the accepted Italian wording changes.

## Validation evidence

Results and remaining platform limits are recorded in
[RELEASE_VALIDATION.md](RELEASE_VALIDATION.md). Private commands/logs and the
pre-sync source fixture are retained under `.local/pre-production-2026-10-08/`;
Docker data/logs are under unique `dockerdata/sparkyrivals-acceptance-*` directories.
These paths are excluded from Git, Docker contexts and EAS uploads. Disposable
services are stopped after testing; retained databases are not deleted.
