# SparkyRivals Challenge backend

Milestone 6 adds [Workout Time](WORKOUT_CHALLENGES.md). The Steps-specific
sections below retain their original semantics; metric/unit/coverage evolution and
the narrow workout projection are documented there.

Milestone 2 adds a private, consent-based competition domain. The server owns
Challenge state and scoring. Existing SparkyFitness check-ins remain the only
canonical daily step store. No UI, separate ingestion path, health-history copy,
background scoring job, cache or permanent winner is introduced.

## Schema and consent

`challenges` stores creator, name, `metric=steps|workout_time`, `scoring_mode=sum`, inclusive
start/end DATEs, an IANA timezone, cancellation and audit timestamps.
`challenge_participants` has a composite `(challenge_id, user_id)` primary key,
inviter, status and invitation/acceptance/decline/leave/audit timestamps.

Bounds: 1–100 characters for a trimmed name; 1–366 calendar days; creation starts
today or within the next 366 days; at most 100 total membership rows. The creator
is automatically accepted in the same transaction. Initial invitations are atomic
with creation. A duplicate membership is a conflict, including after decline or
leave. There is no re-invite/reset in v1; create another Challenge instead.

Invitations reference an existing user ID from Family & Friends, never an email
search or directory. The relationship must be active (`is_active`, `status=active`),
already started and unexpired, in either direction. No health permission is needed
on that relationship. Only the creator invites. The target separately consents.
Removing the family relationship blocks new invitations but does not undo existing
Challenge consent; participants can leave to revoke it.

All operations require the actor's own context. Caregiver/delegated access is not
Challenge membership. Pending invitees see the rules and their own invitation,
without peer scores or roster. Accepted participants see accepted peers; the
creator sees all invitation states. Display identity is user ID and profile display
name (fallback `Participant`), without email, credentials or unrelated profile data.

Only the invitee can accept/decline a pending invitation. Acceptance closes after
completion/cancellation; decline remains available. An accepted noncreator can
leave at any time, including after completion, revoking their step sharing and
Challenge access. The creator cancels instead of leaving. Declined/left users
cannot reopen their membership. Account deletion cascades its membership; deleting
the creator deletes the Challenge. No application DELETE endpoint/policy exists.

## Rules and lifecycle

Rules/dates/timezone/creator are immutable so consent cannot be changed afterward.
Only the creator may rename an upcoming Challenge or cancel an upcoming/active one.
Cancellation is irreversible and stops step sharing. Lifecycle is derived:
`cancelled` takes precedence; otherwise before start is `upcoming`, start through
end inclusive is `active`, and after end is `completed` in the Challenge timezone.

RLS uses `challenge_actor`, `challenge_membership` and `owns_challenge`, with fixed
search paths and narrow definer helpers to avoid recursive policies. Triggers
validate state transitions and immutable fields even through direct application
SQL; membership changes lock their parent to serialize invitation capacity and
cancellation races. `challenge_roster` projects only authorized membership rows
and display names. Ordinary profile, check-in and diary RLS remain unchanged.

See [database security tiers](../src/developer/database-security-tiers.md) and
[sharing behavior](../src/features/family-friends-sharing.md).

## API

All endpoints are under `/api/v2/challenges`, use existing session/API-key auth,
require self context and return `Cache-Control: no-store`.

M8A.7 adds optional `view=mine|invitations|history|summary|active` list filters,
applied before pagination under the same caller context and RLS. `active`
includes only accepted membership with active lifecycle. A request with
`view=active&limit=1` reads at most two rows: one response item and the
`has_more` sentinel, allowing the Dashboard to identify exactly one active
Challenge without fetching every page. Omitting `view` preserves the legacy list.

| Method / suffix         | Contract                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `POST /`                | Name, start/end dates, timezone, optional `metric=steps                                                          | workout_time`, `scoring_mode=sum`, `participant_ids`; 201 detail |
| `GET /`                 | `limit` (1–50, default 20), `offset` (0–10000); caller's pending/accepted competitions, newest first; `has_more` |
| `GET /:id`              | Challenge rules, derived lifecycle/progress, authorized roster                                                   |
| `PATCH /:id`            | Strict `{name}` only; upcoming creator rename                                                                    |
| `POST /:id/invitations` | Strict `{user_id}`; creator invites existing active relationship; 201 detail                                     |
| `POST /:id/accept`      | Empty body; invitee accepts; 204                                                                                 |
| `POST /:id/decline`     | Empty body; invitee declines; 204                                                                                |
| `POST /:id/leave`       | Empty body; accepted noncreator leaves; 204                                                                      |
| `POST /:id/cancel`      | Empty body; creator cancels; detail                                                                              |

Unknown body/query fields are rejected where bodies/queries are defined. UUID
validation precedes database access. Absent and inaccessible competitions both
return 404; an unknown account and an unrelated invitation target both return the
same generic 403. Duplicate invitations/invalid transitions are 409. Invalid
contracts are 400. No directory, global search or email-lookup endpoint is added.

`shared/src/schemas/api/Challenges.api.zod.ts` defines requests and responses.
OpenAPI component shapes derive from these schemas; route JSDoc documents the
operations. Timestamps serialize as ISO instants; DATEs remain `YYYY-MM-DD` strings.
Detail/list include `my_membership` and server progress: today in the Challenge
zone, total calendar days, elapsed whole days, inclusive days remaining, and
1-based current day while active. On cancellation, current day is null and days
remaining is zero; dates stay visible. Read transactions use a consistent snapshot.

Future clients can obtain eligible account IDs from their existing Family &
Friends relationship list, then send the selected ID. The API revalidates the
relationship. Never add arbitrary account discovery merely to populate this flow.

## Authoritative results

`GET /api/v2/challenges/:id/leaderboard` requires accepted membership. It returns
`ChallengeLeaderboardResponse`: `contract_version=1`, Challenge metadata/progress,
`calculated_at`, `reconciles=true`, `scored_through`, ranking availability, leader
IDs, lead margin, and accepted participant entries. Entries contain display name,
total score, rank/tie/gaps, daily points, today's point when active, and coverage.

The repository uses a repeatable-read, read-only transaction with three SELECTs
regardless of participant count: visible Challenge, database transaction time,
and `challenge_step_points(id)`. The latter is a narrow SECURITY DEFINER projection
with a fixed search path and no caller-supplied user/date selector. It verifies
accepted self-context membership, selects accepted peers only, and joins canonical
`check_in_measurements` within the immutable date range. It returns only user ID,
display name, calendar date, steps and the row update timestamp. It cannot return
body measurements or arbitrary health records. Cancellation returns no points.

The existing `(user_id, entry_date)` unique index supports these bounded joins.
No index is added to an existing health table. New indexes support creator history
and user membership lookup. Bounds limit a response to 100 people × 366 days;
there are no per-participant queries. Detail uses two SELECTs and list uses one.

### Scoring, missing data and ties

- Score is the sum of current canonical non-null `check_in_measurements.steps`
  for accepted participants from start through `min(end, today)` inclusive.
  Future dates are not read/scored early. Acceptance during an active Challenge
  consents to its entire date range, including earlier days.
- Missing rows and null steps score zero with `present=false`; an explicit stored
  zero has `present=true`. Future daily points have `eligible=false`, zero value
  and no presence claim. This never claims an unsynced day was a measured zero.
- Coverage reports `days_with_steps`, `eligible_days` and
  `latest_data_update_at` (max update/creation timestamp of contributing rows).
  The timestamp belongs to the check-in row, so edits to another column can also
  advance it. It proves neither provider completeness nor the last device sync.
- Ranks use competition ranking: 1, 1, 3. Equal totals share rank and `is_tied=true`;
  UUID order makes response ordering deterministic without creating a winner.
  `gap_to_leader` is the leader's total minus this score; `gap_to_next_rank` compares
  with the next strictly lower score, or is null. A tied lead has margin zero;
  fewer than two entries have a null lead margin.
- Upcoming entries show zero progress with null ranks, no leaders and
  `scored_through=null`. Active and completed Challenges rank current totals.
  Cancelled Challenges return an empty leaderboard and no ranking/step disclosure.
- Scores are recomputed on every request; no durable winner, max-wins layer,
  materialized results or cache exists. Lower values, cleared/deleted rows and
  late arrivals immediately change subsequent results, even after completion.
  Departure removes that person's values from subsequent results. In-flight
  snapshots retain normal database transaction consistency; revoke/accept takes
  effect for later reads. Clients must refresh before presenting current results.

### Calendar and timezone contract

Challenge start/end are inclusive DATE values. Its explicit IANA zone controls
lifecycle, current day and eligible date cutoff using the shared timezone helpers
and the database transaction's clock. Stored canonical dates remain unchanged.
There is no UTC conversion of DATE values, and DST does not add/subtract a calendar
day. Different participant/account/device timezones and travel retain the existing
SparkyFitness date buckets. Historical daily aggregates have no intervals from
which arbitrary timezone rebucketing could be reconstructed. Future sub-day
metrics must define a separately supported canonical adapter and timezone policy.

### Automated downward corrections: deferred, not hidden

`healthDataHandlers.prepareCheckInMeasurement` reduces a step record to its numeric
value; the check-in batch carries day and measurement fields, not reliable source
identity, sample revision, complete-day coverage or aggregation provenance.
`measurementRepository.upsertStepData` and `bulkUpsertCheckInMeasurements` protect
automated totals with `GREATEST`. The canonical row has no provider provenance.
A partial/out-of-order read can therefore be indistinguishable from a legitimate
provider decrease. `daily_health_metrics` has some provider summaries but does not
cover all writers or establish precedence over the canonical check-in total.

This milestone leaves ingestion unchanged. An automated lower total can still be
discarded before Challenges see it. Manual `upsertCheckInMeasurements` overwrites,
including decreases/null, and the leaderboard immediately follows that canonical
row. Regression tests exercise both behaviors separately. The safest future
change is to evolve the existing ingestion contract and canonical storage with
reliable source/aggregation identity, revision/completeness bounds and explicit
cross-source precedence, then atomically replace a prior authoritative total only
when that provenance proves it supersedes it. Do not add a Challenge health store
or replace all sources with last-write-wins.

## Extension boundary

Metrics and scoring modes are explicit constrained enums (`steps|workout_time`, `sum`) mirrored
in SQL and shared schemas. Future metrics add a canonical read adapter, units,
consent scope, constraints and tests; they do not require changing the N-member
model. No arbitrary JSON rule engine or scoring DSL exists. Recurrence, goals,
additional metrics and social extras remain later milestones.

Future web/mobile/watch clients consume these server results. A phone can compose
a compact Watch snapshot using the existing WatchConnectivity architecture. Wear
OS remains future work. No client should duplicate ranking logic or declare an
irreversible winner. There is no anti-cheat guarantee: canonical values can be
manually edited, and coverage cannot prove a complete provider sync.

## Client implementation

Milestone 3 consumes this API on web, iOS and Android. See
[CHALLENGE_UI.md](CHALLENGE_UI.md) for routes/screens, consent-aware caches,
relationship selection, missing-data display and refresh. Only list transport
metadata changed: numeric `_` cache-busters are validated and stripped before the
domain query for the existing mobile transport. Scoring, RLS and response authority
remain unchanged. Watch and Wear clients remain future work.

## Challenge types extension

M8A.6 extends metrics and scoring through additive configuration. See [CHALLENGE_TYPES.md](CHALLENGE_TYPES.md) for Ready lobbies, canonical projections and negotiated v3 results. Historical Steps/Workout Time sum behavior below remains applicable.
