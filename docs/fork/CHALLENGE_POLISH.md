# Challenge polish and native surfaces — Milestone 7

## Scope and boundaries

Implemented: editable Rematch on web/mobile, device-local notifications, phone
home-screen widgets, an Apple Watch complication, and a Wear Tile/complication.
Both Steps and Workout Time use existing authoritative results. No API, RLS,
scoring, migration, health ingestion, or persistent server service changed.

Remote push/APNs/FCM, automatic recurrence, personal goals, streak rules, social
feeds and new scoring formulas remain deferred. Watch surfaces remain read-only.
This is source implementation with Linux validation; native/device acceptance
below is required before release. Milestone 8 is not started by this work.

## Rematch

Accepted members see **Rematch** on completed/cancelled details. It opens the
ordinary editable creation form; it never submits automatically. Web uses
`/challenges/new?rematch=<id>`; mobile uses `CreateChallenge({ rematchId })`.
`shared/src/challenges/rematch.ts` prepares the draft:

- Preserve name, metric, IANA timezone and inclusive calendar-day duration.
- Start tomorrow in that timezone, using shared day helpers, including across DST.
- Intersect previous **accepted** participants with current eligible Family &
  Friends connections; exclude self. Explain omitted former participants.
- Create through the existing endpoint. Previous consent never transfers: the
  new creator participates and everyone else receives an ordinary invitation.

The user can edit the draft. A relationship change after opening is still checked
by the server. Active/upcoming/declined/left Challenges do not expose Rematch.

## Shared phone orchestration

`useChallengeSurfaces` observes `useCompanionChallenges`, whose list/results
options and actor-scoped cache are shared with mobile, Apple Watch and Wear.
TanStack deduplicates the requests; simultaneous surface refreshes use
`cancelRefetch: false` so they share in-flight work. There is no surface-specific
polling or API.
Foreground, mutations and health/workout invalidation refresh the same query
family. Results are consent-gated. The observer exposes fresh-fetch metadata for
notifications without altering scores or extending API contracts.

`CompanionChallengePublisher` is the extracted serial publication barrier already
used by Wear. Widgets reuse it: active configuration and synchronous auth-session
revision are checked before native writes; queued obsolete writes become clears.
Logout/account/server/auth changes clear local surfaces even without network.
A clear follows any already dispatched asynchronous write. Locale changes also
republish presentation. Native errors are logged and retried on the next refresh.

The existing composed WatchConnectivity context and versioned Wear DataItem remain
the only watch transports. No new direct widget/complication server access exists.

## Local notifications

### Preferences and permission

Settings → Notifications includes **Challenge notifications**. Preferences are
persisted with existing device-local app preferences, subordinate to the global
notification master. Challenge master defaults **off** for deliberate opt-in.
When enabled, invitation/start/ending-soon/end categories default on; lead changes
default off. Permission is requested only when the user enables a toggle, through
the existing permission helper. A denial leaves it disabled. No exact-alarm
special-access request is made. Android uses the separate `challenges` channel;
iOS uses the `challenge` category, without mutation actions.

### Plan and reconciliation

`challengeNotificationPlan.ts` is the pure plan. `challengeNotifications.ts`
serializes persistence/native reconciliation, checks OS permission, cancels
obsolete scheduled requests and dismisses delivered alerts from another account.
It touches only identifiers beginning `sparky-challenge:`; upstream medication,
fasting, water and rest-timer notifications retain their own behavior.

| Event       | Behavior                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Invitation  | Once for a newly observed pending invitation after the fresh opt-in baseline; no scores               |
| Start       | `start_date` at midnight in the Challenge IANA timezone                                               |
| Ending soon | Exactly 24 elapsed hours before exclusive end, only if strictly after start                           |
| End         | Midnight immediately after `end_date` in the Challenge timezone; generic open-for-current-result copy |
| Lead        | Optional fresh observed transition involving self: sole lead, tied lead, behind                       |

Shared `dayRangeToUtcRange` converts calendar boundaries to instants. Tests cover
UTC, Rome spring/fall DST and device-independent timezone semantics. One-day
reminders at/before start are omitted. Dates are immutable; cancellation,
leave/decline, missing membership and account changes remove obsolete schedules.
An ended notification never contains a predicted winner.

The ledger is keyed by local server configuration + actor, never credentials.
It stores seen invitations and authoritative leader baselines, persists across
process restarts and keeps at most five accounts, 500 invitation observations
(90-day retention) and 100 leader observations per account. First opt-in waits
for a fresh list and silently baselines old invitations. Disabled categories
still observe fresh state to avoid later floods.

Lead alerts require a successful fresh query after mount, an authoritative
`calculatedAt` newer than the previous observation, age at most 15 minutes and no
clock skew over five minutes into the future. Initial observation, reloaded
cache, unchanged lead state, upcoming/cancelled/completed and unaccepted state
cannot alert. A five-minute cooldown absorbs rapid partial-source transitions;
the baseline advances during suppression. Rank/gap changes within the same lead
state do not alert. Lead observation is limited to the bounded companion result
selection already fetched; reminders use the loaded Challenge list. Session counts never decide leaders.

At most three immediate alerts are emitted per reconciliation and the nearest
24 future reminders are retained to leave OS capacity for upstream features.
Immediate observations are persisted before delivery: this avoids duplicate
alerts after a crash but can miss an alert if native delivery then fails. Future
schedules reconcile against the OS request list and retry after failure.

**Local-only limit:** alerts depend on what this phone has synchronized. Lead
changes and invitations are not guaranteed realtime while the app is closed or
offline. A locally scheduled reminder can become obsolete while offline until
the next reconciliation. OS delivery time is approximate and permission/battery
policy can suppress it. No push tokens or remote delivery infrastructure exist.

## Primary native presentation

`selectPrimaryChallengeSurface` chooses from the existing bounded companion set:
active accepted, invitation, upcoming accepted, then recent completed. Equal
priority uses earliest upcoming start, otherwise latest end, then stable ID.
The companion projection still caps eight Challenges, two completed, and top
three plus self. Selection never changes authoritative lifecycle/ranks/ties.
Equivalent narrow Swift/Kotlin selection is covered by native model/contracts.

Widgets store only version/account guard/source time, Challenge ID/name,
metric/status, formatted own score/rank/gap and optional peer, plus guarded URL.
No full history, profiles, credentials, workout details, GPS or HR is stored.
Steps use locale numbers and units; Workout Time uses human-readable duration.
Missing presence means **No step data** / **No workout recorded**, while explicit
zero remains `0 steps` / `0m`. Invitations/upcoming never show scores.

### iPhone WidgetKit

`targets/widget/ChallengeWidget.swift` joins the existing `CalorieTracker` bundle
as kind `challengeWidget`, with `systemSmall` and `systemMedium`. Small prioritizes
own score/rank and lead/tie; medium adds the opponent/leader. Invitation, upcoming,
completed, empty and unsynced states use the same projection. The existing
`ExtensionStorage` App Group stores `challengeWidgetSnapshot` and reloads only
this kind. No additional extension or identity is introduced.

### Android Glance

`ChallengeWidgetReceiver` is a third receiver alongside Calorie and Macro, copied
by `withCalorieWidget` from durable `targets/android-widget/` templates. It uses
`SparkyChallengeWidget` preferences and Glance state, responsive compact/medium
sizes, semantic Glance theme colors, existing app language context and ordinary
activity deep links. The existing bridge adds only `setChallengeSnapshot`.
Calorie/macro keys and behavior are unchanged. A 30-minute OS widget update request
provides eventual stale rendering; platform scheduling may delay it.

### Apple Watch complication

The Watch app projects adopted Challenge context through
`Domain/ChallengeSurfaceSnapshot.swift`. The existing sole `ComplicationPublisher`
writes `challengeComplicationSnapshot` into the Watch App Group and reloads kind
`challengeComplication` when changed, including clears. Existing calorie/water
publishers remain intact. The existing watch-widget bundle adds inline, circular
and rectangular families, with rank/score/status and stale accessibility text.
Tapping opens the normal Challenge page (respecting the existing page visibility
rules), not a new transport. Specific-detail routing remains optional later work.

### Wear Tile and complication

Both read the existing typed `ChallengeStore` receipt; neither requests Data Layer
or network data. The shared pure Kotlin `ChallengeSurface` model selects and
validates destinations. `ChallengeTileService` renders a padded round-screen
ProtoLayout glance with title, own score, rank and status. The complication
supports short text (rank) and long text (score/status), with accessible units.
Both are protected by their platform bind permissions and launch the existing
activity with account + Challenge extras. The app validates these against its
current receipt before opening detail.

Changed receipts request Tile/complication updates; ordinary requests are
coalesced to at most once per five minutes per process. Account changes and clear
states bypass that throttle. A 15-minute local platform refresh updates stale
presentation. No network job, new DataItem path, sensor permission or watch
mutation was added. Tiles use ProtoLayout; the full app retains Wear Material 3.

Native dependencies, isolated to Wear:

- `androidx.wear.tiles:tiles:1.5.0`
- `androidx.wear.protolayout:protolayout:1.3.0`
- `androidx.wear.watchface:watchface-complications-data-source:1.2.1`
- `com.google.guava:guava:33.4.8-android` for Tile futures

These pin the stable Tile/ProtoLayout generation and existing AndroidX
complication API without changing Expo/React Native. See the official
[Tile API](https://developer.android.com/training/wearables/tiles) and
[complication data-source guide](https://developer.android.com/training/wearables/complications/exposing-data).

## Deep links, privacy and freshness

| Surface                                   | Destination and guard                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| Phone notification / iOS / Android widget | `<configured scheme>://challenges/<UUID>?account=<config:actor>`                          |
| Apple complication                        | `<configured watch scheme>://challenge` via existing WatchDeepLink                        |
| Wear Tile / complication                  | Explicit MainActivity with Challenge ID + account extras, checked against current receipt |

Phone linking verifies active config/profile and session revision before navigation,
rejects malformed or stale-account destinations and preserves existing auth/workout
links. Server detail authorization remains the final authority for an inaccessible
Challenge ID. No stale notification can silently change active account.

Source verification time is preserved. Rendering, sending, timeline reloads and
Tile requests never refresh it. Fifteen minutes marks stale state (also future
clock skew over five minutes). Widgets/complications can remain visibly cached
until the OS honors a reload; clears overwrite storage immediately and request
refresh. A disconnected watch receives its account clear when transport reconnects,
consistent with the existing companion privacy boundary. A temporary disconnect
otherwise retains useful last-verified state.

## Accessibility and motion

Rematch enters a labelled, editable review form with omitted-participant guidance.
Notification switches have explicit labels and explain refresh-based delivery.
Widgets expose text rank/tie/unit information; SwiftUI combines accessible content
and marks it privacy-sensitive; Wear supplies Tile semantics and complication
content descriptions. Neither color nor a progress graphic is the sole result cue.
The mobile hub also fixes the days-left label to interpolate its localized value.
Existing phone/web reduced-motion behavior is preserved. No background-refresh
animation or haptic, new animation dependency or celebratory effect is added.
Large-text, VoiceOver/TalkBack and native layout acceptance remain below.

## Source map and validation

- Shared Rematch: `shared/src/challenges/rematch.ts`; existing web/mobile create/detail.
- Phone: `useChallengeSurfaces`, `challengeNotificationPlan`, `challengeNotifications`,
  `challengeSurfaceLinking`, `challengeWidgetPublisher`, `utils/challengeSurface`.
- Settings: `ChallengeNotificationSettings`, existing app preferences and notification screen.
- Native: existing widget/watch-widget targets; Wear `ChallengeSurface`,
  `ChallengeSurfaces`, `ChallengeTileService`, `ChallengeComplicationService`.
- Tests: Rematch helpers/screens, notification plan/runtime/settings, links, native
  publishers, source contracts, and actual pinned Kotlin JVM surface tests.
- `scripts/validate-native-identity.mjs` checks generated receivers, protected Wear
  services, dependencies, source parity and existing package/signature identities.
- `scripts/test-watch-models.sh` includes the complication projection checks for
  execution with Xcode on macOS; Linux source checks are not Swift compilation.

See [POLISH_VALIDATION.md](POLISH_VALIDATION.md) for exact runs and limitations.

## Milestone 8 native acceptance checklist (not executed here)

- Xcode compile iPhone, WidgetKit, watchOS and watch-widget; run model harness.
- Android `:app:assembleDebug` / `:wear:assembleDebug`; same package/certificate.
- iOS small/medium and Android compact/medium widgets: Steps, Workout Time, group,
  invitation, upcoming, completed, missing/zero, stale and clear; light/dark/large text.
- Watch simulator/device complication families and existing energy/water regression.
- Paired Galaxy Watch Data Layer, Tile, short/long complication, tap destination,
  offline cache, reinstall/restart, tombstone and rapid account switches.
- Real notification grant/denial, delivered foreground/background, timezone/DST
  schedules, category toggles, cancellation, tapped cold launch, old-account refusal.
- VoiceOver/TalkBack, circular clipping, truncation, large text and contrast.
- Confirm OS refresh budgets, approximate reminder timing and local-only wording.

No credentials, store submission, deployment or Docker persistence work is part
of this milestone. The separate production checkout and repository-root
`dockerdata/` bind-mount policy remain unchanged.
