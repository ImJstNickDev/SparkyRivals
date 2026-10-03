# Workout Time Challenges — Milestone 6

Workout time is the second immutable Challenge metric, alongside Steps. Both use
`sum`; no calories, intensity weighting, points, combined score, or count tie-breaker
is involved. Duration is easier to compare across wearable ecosystems than energy
estimates. This is competition over recorded activity, not a verified anti-cheat system.

## Canonical sessions and qualification

The source remains `exercise_entries`, `exercise_preset_entries` and
`exercise_entry_sets`. No workout history or score is copied into Challenge tables.
The narrow `challenge_workout_points(challenge_id)` database function projects only
accepted participants' daily aggregates. It follows the existing history service's
`individualSessionResponseSchema` / `presetSessionResponseSchema` distinction:

- A preset parent and all its child exercise entries are **one session**. Its
  duration is the sum of child `duration_minutes`, matching
  `exerciseEntryHistoryService.total_duration_minutes`.
- An entry without a preset parent is one individual session. Its duration is
  `duration_minutes`.
- Measured `watch_duration_minutes`, `elapsed_time_seconds` and
  `moving_time_seconds` do not override canonical duration in Challenges. Upstream
  telemetry/ingestion may already update that canonical duration. Calories never
  enter the projection.
- Grouped sessions use the parent's `entry_date`; individual sessions use their
  own `entry_date`. A missing or wrong-owner parent cannot produce a session.

There is **no universal persisted finished-session flag** in the current schema.
Rows and positive template durations alone cannot prove completion. The conservative
qualification rule evaluates every child of a group (or the individual row):

1. Exclude the existing synthetic `Active Calories` marker, matched against either
   the entry's snapshot name or its linked exercise name, even with positive time.
2. A `workout_plan_assignment_id`, or session source `Workout Plan` /
   `Workout Preset`, requires at least one stored set and **all** sets to have
   non-null `completed_at` no later than the database transaction time.
3. Known completed import sources (`HealthKit`, `Health Connect`, `garmin`,
   `garmin_fit`, `Hevy`, `Liftosaur`, `coros_mcp`, case-insensitive) require a
   nonblank provider `source_id`. Importers do not all preserve completed-set
   timestamps. The group parent's source takes precedence over child source.
4. Other local/manual records require either all nonempty stored sets completed,
   or no sets and positive explicitly recorded duration.
5. Every child must satisfy qualification. Partially completed groups do not
   receive time from just their completed children.

This admits fully logged manual/live Watch sessions, standalone manual activity and
normalized imports. A qualifying provider/completed-set session can have zero
canonical duration and still count as recorded. A zero-duration local scaffold
without completed sets is absent.

**Known limitation:** legacy manual set-bearing logs without completion timestamps,
workouts finished with skipped/unmarked sets, and ambiguous pre-created sessions
are conservatively omitted. There is no reliable way to distinguish these from
unfinished scaffolding using current persisted fields. A future upstream-compatible
explicit session completion/provenance contract can broaden qualification; do not
infer completion from calories, notes, elapsed telemetry or mere row existence.
Live sessions can qualify once all their stored sets are marked complete; there is
no separate immutable “finish” event to wait for. Provider identity is provenance,
not cryptographic proof of exercise.

## Duration and rounding

Canonical numeric minutes are summed per participant/calendar day, then multiplied
by 60 and rounded **once per day** with PostgreSQL numeric `round`. Daily and total
scores are integer seconds. This avoids per-session rounding loss. Session counts
are independent of this rounding and never break a duration tie.

Negative, non-finite and over-10,080-minute values are excluded. A group with any
invalid child, or a sum over 10,080 minutes (seven days), is excluded as a whole.
This generous corruption boundary is not an exercise intensity or daily target.
There is no daily cap and no overlap heuristic: separate canonical sessions remain
separate. Existing ingestion owns deduplication. The Apple Watch
`SparkyFitnessSessionId` exclusion remains intact; Challenges do not re-import or
maintain a second deduplication store.

## Calendar, reconciliation and missing data

Challenge timezone controls lifecycle, current day and scored-through date. Stored
`entry_date` buckets are used inclusively without fabricated timezone rebucketing.
Future dates are not scored. All accepted members use the same calendar bounds.

Every read evaluates current canonical rows in the existing repeatable-read
snapshot. Edits, deletes, late imports and upstream deduplication change the next
result, including completed Challenges. There is no score maximum/cache or permanent
winner. Steps' automated `GREATEST` ingestion limitation is unchanged and separate
from this projection.

- No qualifying session: value 0, `present=false`, `workout_count=0`; show **No
  workout recorded**.
- Qualifying zero-duration session: value 0, `present=true`, positive count; show
  **0m** and the count.
- Presence is not a claim that all devices have finished syncing.
- Coverage counts days with a qualifying session, eligible days, and latest surviving
  canonical update/completion time. That timestamp is not a complete deletion audit;
  response/cache verification time still governs companion freshness.

## Schema, API and security

Migration `20261003050000_add_workout_time_challenges.sql` extends only the existing
metric CHECK constraint to `steps | workout_time`. It does not rewrite the original
migration or existing Challenge/participant rows. No new table/index is needed.
`db_schema_backup.sql` remains CI-owned.

Existing `/api/v2/challenges` endpoints, invitation consent, actor isolation,
immutable rules and lifecycle actions are reused. Creation accepts either metric;
omission still defaults to Steps. Rename cannot change metric. No extra diary
permission is granted by accepting a Workout Time Challenge.

The fixed-search-path security-definer projection checks the authenticated actor's
own accepted membership, Challenge metric/cancellation and accepted peers. Its only
input is Challenge ID; immutable rules supply date/user bounds. Direct exercise
RLS is unchanged. Returned columns are user ID, authorized display name, date,
seconds, session count and update timestamp. No routine/exercise names, notes,
GPS, HR, reps, weights or calories leave the database through this projection.
The Steps projection explicitly requires the Steps metric too, preventing workout
consent from granting a parallel steps read. Delegated caregiver context cannot
borrow Challenge consent.

The repository uses the same **three SELECTs** for 1–100 participants: visible
Challenge, database time, and one metric projection. Generic ranking handles totals,
competition ranks (1,1,3), ties, leaders and gaps; adapters supply daily values only.
No new index on existing health storage was introduced.

### Result evolution

| Contract                       | Steps                                          | Workout time                                                          |
| ------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------- |
| `contract_version`             | 1                                              | 2                                                                     |
| `score_unit`                   | `steps` (additive; optional in old responses)  | `seconds` (required)                                                  |
| `total_score`, `daily[].value` | integer steps                                  | integer seconds                                                       |
| coverage                       | `days_with_data` plus legacy `days_with_steps` | `days_with_data`                                                      |
| secondary count                | absent                                         | `total_workout_count`, `daily[].workout_count`, `today.workout_count` |

New shared parsers accept legacy Steps v1 without additive fields, and validate the
workout metric/unit/version/count combination. Existing Steps responses retain their
old fields and semantics. Older pre-release clients do not understand Workout Time
list items; update clients together before creating the new metric. This is not a
promise that old clients can consume unknown metrics.

## Web and mobile

Existing routes/screens/components now select Steps or Workout time at creation
(Steps remains default), and format cards, invitations, versus/group scores, gaps,
history, coverage and completed results by metric. Session counts are secondary.
The shared `formatChallengeDuration` is presentation-only and locale-aware, retaining
nonzero seconds so unequal server scores do not look tied after minute truncation.
No ranking logic moved to clients. English is the source locale; other catalogs
retain normal fallback behavior.

Exercise/diary mutation invalidation includes Challenge caches, including deletes
with history and live telemetry updates through the existing mobile helper.
Health-sync invalidation and foreground refresh remain in place. Corrections from
other participants become visible on the next normal refresh, without new polling.

## Apple Watch and Wear OS

Both reuse the bounded companion projection: at most eight Challenges, two recent
completed, top three plus self (original ranks), no daily history or workout details.
Workout rows add `workoutCount` / `daysWithData`; optional today's count travels with
presence. Items add `metric=workout_time`, `scoreUnit=seconds`.

Steps-only snapshots stay v1 and preserve the existing golden fixture. A snapshot
containing a workout item uses v2; new native mappers accept 1/2. Old native mappers
reject v2 safely instead of labelling seconds as steps. Stored old Steps models
remain readable. Upgrade phone and companions together for mixed-metric use.

Apple uses the **same composed WatchConnectivity context**, typed Swift models,
native duration formatting and DEBUG workout seeds (versus/group/completed/no-data).
Wear keeps the **same** `/sparkyrivals/challenges/v1` DataItem and v1 transport
envelope; only its nested snapshot evolves. Durable publisher sequences, tombstones,
account guards, source timestamp and 15-minute stale policy are unchanged. Kotlin
models and Wear Material 3 render durations/counts; DEBUG previews add workout states.

No companion mutations, server credentials, sensors, ingestion, workout logging,
Tile or Challenge complication were added.

## Validation and acceptance boundaries

See [WORKOUT_VALIDATION.md](WORKOUT_VALIDATION.md) for executed commands, counts,
upgrade evidence and visual checks. Apple Swift/Xcode and Wear Android/Compose
compilation/device acceptance must be stated separately from TypeScript/source
contracts and JVM protocol tests. Previous native acceptance debt is retained.
No paid build, credentials, store submission, Actions enablement or deployment is
part of this milestone. Production bind-mounted `dockerdata/` remains unchanged.
