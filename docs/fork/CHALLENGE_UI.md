# Challenge clients — Milestone 3

## Challenge polish extension — Milestone 7

[CHALLENGE_POLISH.md](CHALLENGE_POLISH.md) documents the implemented Rematch,
local notification and native widget/Tile/complication additions. These reuse
current score units, account guards and source freshness; watches remain read-only.
Earlier milestone scope statements below describe their original implementation.
Native compile/device acceptance remains open in [POLISH_VALIDATION.md](POLISH_VALIDATION.md).

## Workout Time extension — Milestone 6

[WORKOUT_CHALLENGES.md](WORKOUT_CHALLENGES.md) documents the implemented second
metric, canonical session qualification, contract versions, metric-aware clients
and companion snapshot v1/v2 transition. Steps behavior and privacy/transport
boundaries below remain intact. Native device acceptance remains outstanding.

The web and iOS/Android clients implement the existing steps/sum Challenge API.
They display server results; they never calculate authoritative scores, ranks,
winners, lifecycle, time remaining, or coverage. Read [CHALLENGES.md](CHALLENGES.md)
for consent, RLS, calendar buckets and canonical ingestion limitations.

## Entry points and modules

| Client | Destination                 | Implementation                                 |
| ------ | --------------------------- | ---------------------------------------------- |
| Web    | `/challenges`               | `src/pages/Challenges/ChallengesPage.tsx`      |
| Web    | `/challenges/new`           | `src/pages/Challenges/CreateChallengePage.tsx` |
| Web    | `/challenges/:id`           | `src/pages/Challenges/ChallengeDetailPage.tsx` |
| Mobile | `Challenges`                | `src/screens/ChallengesScreen.tsx`             |
| Mobile | `CreateChallenge`           | `src/screens/CreateChallengeScreen.tsx`        |
| Mobile | `ChallengeDetail`, `{ id }` | `src/screens/ChallengeDetailScreen.tsx`        |

Web adds one Trophy destination to the existing desktop and mobile-browser
navigation. Mobile adds a prominent one-tap Dashboard entry, above the existing
configurable cards. Its three screens use the root stack, safe error boundaries,
`useScreenHeader`, native back labels and existing safe-area/workout-bar spacing.
The current five tabs, detached Add button and native iOS tab stacks are preserved.
Root-stack exclusions are documented in the existing navigation contract test.
Configured native app schemes support `challenges`, `challenges/new` and
`challenges/:id` paths. No new native configuration or watch transport is needed.

Web presentation lives under `pages/Challenges/`; native presentation lives under
`components/challenges/`. Each has cards, scores, daily history, invitation picker,
actions and loading/error chrome. Rendering is deliberately platform-specific.
Shared contracts and the small relationship projection in
`shared/src/challenges/client.ts` are the shared boundary, not a new UI framework.

## Data and cache ownership

- Web: `api/Challenges/challenges.ts`, `api/keys/challenges.ts`,
  `hooks/Challenges/useChallenges.ts`; uses existing authenticated `apiCall`.
- Mobile: `services/api/challengesApi.ts`, `hooks/queryKeys.ts`,
  `hooks/useChallenges.ts`; uses existing `apiFetch`, server selection and auth.
  Milestone 4 extracts `hooks/challengeQueryOptions.ts` for the same list/results
  queries to serve the headless Watch snapshot without a second API client.
- Responses are parsed with shared Zod contracts. Keys include the authenticated
  actor. Mobile server switches retain the upstream query-cache clearing behavior.
- Web blocks the Challenge surface while acting on another account. Family diary
  permissions never imply Challenge identity or acceptance.
- Lists load 20 at a time, deduplicate overlapping pages and allow explicit loading
  of older pages up to the API offset limit. Groups describe the loaded pages,
  not a claim that all historical invitations have already been fetched.
- Results are requested only for accepted members of non-cancelled Challenges.
  Pending and cancelled screens never render a previously cached leaderboard.
- Every mutation invalidates the actor's entire Challenge query family, including
  hub score cards, detail, results and connection options. Leave/decline also remove
  detail/results caches before returning to the hub. Errors invalidate too, since
  membership or relationships may have changed concurrently.
- Actions use no automatic retry, optimistic membership update, or offline queue.
  Inputs survive failure; errors explain refreshing/retrying. Duplicate submission
  guards protect create and membership writes. The server remains the final check.

### Narrow server integration change

The existing native transport adds a numeric `_` cache-buster to GET requests.
The strict Challenge list route now explicitly accepts a 1–20 digit `_` string and
strips it before the domain query. Unknown selectors, malformed values and repeated
values remain rejected. `apiClient` gained PATCH in its method type for rename.
No RLS, database migration, scoring rule or leaderboard response changed.

## Creation, invitations and actions

Both clients offer a name, Today or seven inclusive days from today, custom calendar
range, existing Family & Friends selection, timezone details and a review/create
step. Defaults use the account timezone, falling back to the device/browser IANA
zone. Dates remain `YYYY-MM-DD`; shared day helpers validate 1–366 inclusive days,
start today or within the next 366 days, and the shared 100-member capacity.
Only steps/highest-total is presented. Dates, timezone and scoring cannot be edited
later. The owner joins automatically; invited people explicitly consent.

The picker reads the existing `/api/identity/family-access` endpoint through a
narrow schema. It retains only active, started, unexpired connections involving the
actor, accepts both relationship directions, deduplicates and excludes every
existing membership (including declined/left). Selected accounts are removed if a
refresh makes them ineligible. The server rechecks eligibility on mutation. There
is no account search or second social graph; display names do not fall back to
private email addresses. Connection management remains in web Settings.

Pending invitations have their own hub section and a rules/consent detail view.
The inviter's name is shown only if available through the existing safe relationship
projection. Pending users do not receive the accepted roster or scores. Accept is
available only while upcoming/active; decline can dismiss a closed invitation.

Owners can invite while open and capacity remains, rename before the start, and
cancel while upcoming/active. Other accepted members can leave, including historical
competitions as the backend permits. Leave and cancel require confirmation. The
owner cannot leave. Decline/leave cannot be reversed in v1; no re-invite action is
invented. Native rename/invite use inline editors; web uses existing dialogs.

## Competition presentation

- The first loaded active Challenge gets the strongest card. Other sections cover
  invitations, upcoming, completed and subdued cancelled Challenges.
- Exactly two competitors get prominent versus scores. Web uses two columns when
  space permits; native stacks large cards to accommodate narrow widths and text
  scaling. All values and ranks use the same server contract as larger groups.
- Groups use ordered participant cards. Native expands 20 at a time, up to the
  backend's 100-person limit. Compact cards show the top three and also the current
  user's entry if outside that group. No client ranking or sorting algorithm runs.
- Leader names come from `leader_user_ids`; ties/ranks/gaps come from their explicit
  fields. Completed Challenges say **current winner/current tied winners**, with a
  note that late/corrected data can change results. Cancelled Challenges show no
  winner or leaderboard. Upcoming results retain server null ranks.
- Detail displays server date progress, today's values, total score, elapsed-day
  coverage and the server calculation time. A refresh time is not a sync-complete
  timestamp or evidence that every health source has uploaded.
- Daily history displays seven supplied days per page. Two participants are compared
  together; larger groups select one participant for readable history. Day-ahead/tie
  labels are presentation comparisons only, and appear only when both daily points
  are eligible and present. Future days say “Not started”.
- Explicit zero reads “0 steps”; absent canonical data reads “No step data”. The UI
  explains that missing data contributes zero to the competition without proving
  that no walking occurred. It never reconstructs health history or treats absence
  as a confirmed zero. Automated provider decreases can still be discarded by the
  upstream canonical max-wins ingestion before scoring; clients do not add a cache
  of maximum values or any other irreversible layer.

## Refresh, failures and accessibility

Web uses a 30-second stale window, window-focus/reconnect refetch and explicit
refresh. Mobile uses that stale window, navigation focus, foreground refresh
(throttled to 30 seconds) and pull-to-refresh on hub/detail. Queries are gated by
screen focus. There is no background polling or new offline persistence. Returning
to a screen or refreshing obtains reconciled results after health sync/corrections.

Loading, empty and retryable failure views use existing components. No-success
states remain visible on network/mutation failure. Controls have explicit labels;
web uses headings, ordered lists, labelled forms, dialogs and progress semantics.
Native uses heading/button/checkbox/progress roles, checked/disabled/expanded states,
flexible wrapping and no fixed-height score cards. Rank, tie and state labels avoid
color-only meaning. Destructive confirmations describe sharing/rejoin consequences.

Styles use existing semantic theme tokens. Web's only added score motion uses
`motion-safe`; skeletons disable animation for reduced motion. Native adds no motion
dependency. English is the only edited locale on either platform; canonical mobile
English lives in `src/localization/locales/en/translation.json`, not native permission
strings in `locales/en.json`. Plural forms preserve interpolation names. Number/date
formatting follows the app locale; calendar bucket display does not shift through
local UTC offsets. Other languages retain their existing English fallback.

## Verification and remaining boundaries

See [CHALLENGE_UI_VALIDATION.md](CHALLENGE_UI_VALIDATION.md) for exact runs and
[UPSTREAM_SYNC_2026-10-03.md](UPSTREAM_SYNC_2026-10-03.md) for the frozen base.
Web screenshots use real pages/styles/hooks with deterministic test fixtures and
an isolated temporary API harness. No production mock mode or fake data is shipped.
Native component/navigation/query tests run on Linux; physical iOS/Android visuals,
VoiceOver/TalkBack, large system font sizes, keyboard/calendar interaction and
real-server end-to-end device behavior still need device verification. No native
binary, Xcode, emulator, paid build or store submission is claimed.

There are no Challenge notifications, workout points, offline writes or account
search. Milestone 4 adds a [read-only Apple Watch page](APPLE_WATCH_CHALLENGES.md)
using this mobile query cache and the existing composed application context.
Phone mutations and canonical health refresh invalidate the shared Challenge
family, so refreshed results also reach the Watch. Milestone 5 adds a
[read-only Wear OS companion](WEAR_OS_CHALLENGES.md) through the same compact
projection and a durable Android Data Layer publisher. Watch mutations remain deferred. Milestone 7 adds read-only native surfaces
and Rematch/local notifications; see [CHALLENGE_POLISH.md](CHALLENGE_POLISH.md). No service deployment or Docker persistence change is involved:
production remains a separate checkout with bind-mounted `dockerdata/` only.
