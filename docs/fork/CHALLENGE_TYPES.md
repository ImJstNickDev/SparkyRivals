# Challenge types, personal goals and Ready lobbies

Milestone 8A.6 extends the existing Challenge domain. Server calculations remain
authoritative, completed results reconcile, and watches remain read-only. This
page describes implementation; build/device evidence belongs in
[RELEASE_VALIDATION.md](RELEASE_VALIDATION.md).

## Metrics and scoring

A user-facing type maps to a metric and a scoring mode. The API and database both
enforce this matrix; hiding an option in a selector is not authorization.

| Metric | Canonical unit | Sum | Goal progress | Goal days |
| --- | --- | --- | --- | --- |
| `steps` | steps | yes | yes | yes |
| `distance` | meters | yes | yes | yes |
| `active_calories` | kcal | yes | yes | yes |
| `workout_time` | integer seconds | yes | yes | yes |
| `workout_calories` | kcal | yes | yes | yes |
| `workout_distance` | meters | yes | no | no |
| `hydration` | milliliters | no | yes | yes |

Examples in the create flow are Step Race, Step Goal, Step Streak, Move Goal,
Workout Minutes and Hydration Goal. “Streak” means the count of successful days in
this Challenge; successful days need not be consecutive. There is no separate
streak scheduler or historical streak record. The selectors use existing phone
and web components; visual redesign is reserved for M8A.7.

`sum` accumulates the canonical metric. `goal_progress` sums
`actual / locked daily target × 100` for eligible days, without a 100% cap.
50%, 100%, 140% and 200% yield 50, 100, 140 and 200 points. `goal_days` awards one
successful day when present canonical data meets or exceeds the target; 200%
still earns only one day. Neither goal mode uses raw activity to break a tie.
Competition ranking remains 1, 1, 3 for a tie at first place.

### Precision and technical bounds

Targets are positive canonical decimals with at most six decimal places and at
most 1,000,000,000 canonical units. The smallest representable target is 0.000001.
These are representation bounds, not fitness recommendations or fairness rules.
There is no target normalization, performance cap or target-quality judgment.

New daily canonical decimals are rounded to six places at the SQL projection
boundary. The server parses decimal strings into `BigInt` millionths. Daily goal
points round half up to one millionth of a point, then accumulate as integers.
Ranking, ties and gap subtraction use those integers. API `*_scaled` decimal
strings preserve exact scores; numeric values are convenient client display
values and may lose sub-unit precision at extremely large totals. Old Steps and
Workout Time sum values/units retain their existing calculations. Workout Time
still rounds the day's summed canonical minutes × 60 once to integer seconds.

## Canonical sources

No new health ingestion or health history store exists.

- **Steps:** existing `check_in_measurements.steps` projection, unchanged.
- **Distance:** daily numeric Distance custom measurements. Stored m/km/mi are
  normalized to meters. Provider rows represent overlapping daily totals, so the
  latest updated daily reading wins (timestamp and UUID make ties deterministic),
  rather than adding provider totals. Corrections may reduce the score. This
  selection is explicit because the existing custom measurement model can retain
  more than one provider's daily total. HealthKit supplies walking/running distance;
  Health Connect's Distance record is a more general platform distance source.
- **Active calories:** the same standalone synthetic `Active Calories` daily
  entries summed by the existing daily exercise calorie split. Resting energy,
  BMR, eating targets and total burned calories are excluded.
- **Workout metrics:** the M6 qualified session projection. A preset parent with
  several exercises is one session. Duration and calories sum canonical child
  fields; distance sums canonical child kilometers then converts to meters.
  Synthetic Active Calories are excluded. Plan/template scaffolds require all
  stored sets completed; provider and manual qualification rules are preserved.
  See [WORKOUT_CHALLENGES.md](WORKOUT_CHALLENGES.md). Missing workout distance is
  absent metric data, not invented distance. Session count is secondary only.
- **Hydration:** existing daily water ledger totals plus food-derived water only
  when the user's normal preference enables it. Food entries already linked to a
  water log are excluded from the food contribution. The SQL aggregate is tested
  against `hydrationTotalsService.resolveWaterTotalsForDate`; raw HealthKit/Health
  Connect records are never added a second time.

Invalid source values are excluded at projection boundaries. Existing M6 duration
sanity bounds remain unchanged. New distance/calorie source fields use generous
1,000,000,000-unit numeric bounds. Missing data remains `present=false`, even
though its effective score is zero. Explicit canonical zero retains presence.
Only eligible days score. Stored `entry_date` determines contributions; Challenge
timezone determines lifecycle and the current day, without rebucketing history.

## Personal goals and snapshots

`user_goals` and `goal_presets` gain `steps_goal`, `distance_goal_meters` and
`active_calories_goal`. Existing `target_exercise_duration_minutes`,
`target_exercise_calories_burned` and `water_goal_ml` are reused. Nutrition
`calories` retains its eating-target meaning. Normal dated goals, weekly presets
and nutrition fields are preserved; older goal editors omitting the new fields
do not erase them.

Phone Settings offers Personal activity goals on the normal goal timeline. Web
uses its existing goals editor. In a lobby, the user's current personal goal is
suggested in editable units (minutes/km where appropriate). Saving explicitly
copies the chosen target into their own participant row. An absent personal goal
requires manual target entry before Ready. Editing a saved target clears Ready
and advances its revision. Later personal-goal edits never change a locked target.

### Apple Move import

The installed HealthKit library lacks an Activity Summary query. The local Expo
module `modules/move-goal` reads today's `HKActivitySummary.activeEnergyBurnedGoal`
only on an explicit button press, requesting Activity Summary read authorization
through HealthKit. It accepts active-energy Move mode, not Move minutes. Missing
summary, denied/unavailable data or invalid goals leave manual entry available.
“Use” fills the form; “Save” persists the normal personal goal. Nothing silently
overwrites a manually chosen goal, and no background observer is added.

Apple Exercise/Stand goals are not imported. Health Connect has no generic daily
step/distance/active-energy goal record. Android uses SparkyRivals goals and does
not repurpose planned exercise completion goals or Samsung-specific APIs.
See Apple's [Activity Summary](https://developer.apple.com/documentation/healthkit/hkactivitysummary)
and Android's [data types](https://developer.android.com/health-and-fitness/health-connect/data-types).

## Asynchronous Ready lobby

Goal modes start as explicit `lobby` records with null dates and a duration of
1–366 inclusive calendar days. Sum Challenges keep their existing fixed dates and
need no Ready stage.

1. Creator and invitees accept normal consent and save their own targets.
2. Each accepted participant presses Ready, including the creator.
3. Pending invitations block activation. The creator can withdraw a pending
   invitation; declined/withdrawn/left members do not block activation.
4. At least two accepted participants, each with a valid target and Ready, are
   required. One transaction locks the parent Challenge and checks the roster.
5. The server locks targets once and derives dates in the Challenge timezone.

The creator cannot set someone else's target or remove an accepted participant
through withdrawal. Accepted members can leave under the existing rules. After
lock, targets/readiness cannot be changed and new invitations are refused.

**Start on next full day defaults OFF.** All-ready starts today immediately and
counts the entire current Challenge-local day's canonical activity, including
activity from before activation. When ON, all-ready locks now and schedules
tomorrow's calendar date. `end_date = start_date + duration_days - 1`. No one must
be online at midnight; there are no intraday offsets or client coordination.
Calendar arithmetic handles timezone/DST boundaries without adding 24 hours to
an arbitrary device-local instant.

Parent row locks serialize target, Ready, invitation, response and withdrawal
operations across replicas. Expected target revisions reject obsolete edits.
Repeated Ready is idempotent, including a retry after that Ready activated the
Challenge. Database guards enforce self-only writes and immutable configuration;
the activation trigger is authoritative even if the caller is not the creator.

## API evolution and privacy

New clients send `X-Challenge-Contract-Version: 3`. Without it, list endpoints
return only legacy Steps/Workout Time sum Challenges; opening a new type returns
409 `CHALLENGE_CLIENT_UPDATE_REQUIRED`. Legacy sum result contracts remain v1/v2.
New types use result v3 with explicit `canonical_unit`, `score_unit`,
`score_scale=1000000`, `total_score_scaled`, daily `score_scaled`, canonical actuals,
participant target, progress points and reached-day flags. Coverage stays
metric-neutral. Lobby results have no ranking, scored-through date or health days.

New self-context endpoints reuse `/api/v2/challenges`:

- `PUT /:id/target`: `target_value`, `expected_revision`.
- `PUT /:id/ready`: `ready`, `expected_revision`.
- `DELETE /:id/invitations/:userId`: creator-only pending withdrawal.

No client supplies scores. Existing creation/invitation endpoints and durable push
outbox remain authoritative. Target snapshots are configuration visible to accepted
members; pending invitees get safe metadata, never health results. Narrow consent
SQL projections return aggregates for the selected metric and accepted roster.
No diary permission, raw samples, workout details, unrelated goals or credentials
are granted by Challenge membership. Projection queries are bounded set operations
for at most 100 participants and 366 days, not per-user/day query loops.

## Watch, widget and notification compatibility

The existing composed WatchConnectivity context and Wear Data Layer path
`/sparkyrivals/challenges/v1` remain. Nested companion snapshot v3 carries explicit
metric/mode/unit and lobby state; v1/v2 Steps/Workout Time remain readable. Old
receivers safely reject unsupported snapshots. Lobby dates are absent, scores
suppressed, and actions direct the user to the phone. Watches cannot accept,
set targets, Ready or change membership.

Phone widgets receive formatted compact presentation. Watch complications and
Wear app/Tile/complication format points, goal days, meters, kcal and milliliters
explicitly, keeping original account guards and authoritative source timestamps.
Bounds remain eight Challenges, at most two completed, top three plus self.

Remote push still sends only generic new invitations. Local invitation fallback
and dedupe remain. Accepted lobbies do not schedule start/ending/end/lead alerts;
those resume from actual dates after lock. No Ready notification is introduced.

## Migration and validation

Additive migration `20261004193000_challenge_types_and_goals.sql` extends existing
rows/tables and guard functions. No health history table or winner cache is added.
RLS remains centrally restored by `rls_policies.sql`, including all three deny-all
push tables. Existing sum dates, participant states, values and rules survive the
upgrade. Do not edit historical migrations or the CI-owned schema snapshot.

Focused tests exercise canonical sources, exact points, ties, self-only target
writes, concurrent activation, immutable snapshots, legacy contracts, goal timeline
preservation, fresh/upgrade migration and startup RLS recovery. Native builds and
physical evidence must be recorded separately; source tests do not demonstrate
HealthKit authorization or a device's actual health data availability.
