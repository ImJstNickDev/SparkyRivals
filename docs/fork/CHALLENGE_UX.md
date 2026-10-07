# Challenge UX — M8A.7

## Status and baseline

**The maintainer approved the Phase A visual direction on 2026-10-06 after
revision 3.** The representative production-component slice and successive native
captures are recorded below. The maintainer also approved repository-local fork translation sources on
2026-10-06. Visual-direction approval permits the Phase B rollout; it does not
establish full native or physical acceptance. Implementation is split into signed
commits on `milestone/challenge-ui-ux-polish`, based on the merge below. The Phase A
sections below retain their historical evidence and limits; the Phase B section
is the current status.

- PR #14 was verified merged into the owned fork with two-parent merge commit
  `0e185e879042a6fec0613e57ebe534c00fd552ab`.
- Its reviewed feature head is `a6f87cd34c78629f398016a18b60ffbdab264118`.
- After fetching origin, local `main` and `origin/main` matched that merge.
  The worktree was clean before creating `milestone/challenge-ui-ux-polish`.
- Origin fetch/push targets `ImJstNickDev/SparkyRivals`. Upstream fetch targets
  `CodeWithCJ/SparkyFitness`; its push URL remains
  `disabled://read-only/CodeWithCJ/SparkyFitness`.
- No upstream synchronization or external write has been performed in this audit.
  Both upstream repositories, including translations, remain read-only.

[CHALLENGE_TYPES.md](CHALLENGE_TYPES.md) remains the domain authority. M8A.7 changes
presentation and interaction. Canonical data, scoring, ties, target ownership,
consent and invitation delivery stay unchanged. The maintainer explicitly
authorized creator removal of accepted/Ready members before a goal lobby locks;
this narrow roster extension is described below. M8B remains deferred.

## Source audit ledger

Paths below are relative to the named package. This is a focused audit, not a
claim that every file or branch of these modules has been reviewed.

| Area                          | Sources inspected                                                                                                                                                                                   | Findings / reuse                                                                                                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guidance                      | Root and package `AGENTS.md`; `agent-docs/README.md`, permissions, data-flow and planning guides; fork README and Challenge guides                                                                  | Preserve shared contracts, RLS, native identity and upstream compatibility.                                                                                                                                                         |
| Mobile shell                  | Targeted route/header/headless-hook reads in `App.tsx`, `types/navigation.ts`, `navigation/safeScreens.tsx`; `TabsLayout`, `CustomTabBar`, `ActiveWorkoutBar`; `nativeTabBarPreference`             | Keep four destinations plus detached Add. Challenge publication is independent of Dashboard card visibility. Native glass is an existing preference.                                                                                |
| Mobile components             | `useScreenHeader`, native-header contract test references; `Icon`, `Button`, `FormInput`, `SettingsRow`, `SegmentedControl`, `FormScreenChrome`, `FooterActionBar`; picker/calendar/range/menu APIs | Use one header descriptor, existing sheets and footer ownership. Check touch heights and large text in the rendered slice before changing shared components. `FooterSaveBar` is exported by `FormScreenChrome`.                     |
| Surrounding flows             | `CycleHubScreen`, Library loading/header/list sections, Settings navigation; navigation/duplicate-press helpers and existing `beforeRemove` patterns                                                | Use segmented navigation and compact rows. A reusable dirty-form guard covering native swipe still needs implementation-level verification.                                                                                         |
| Theme/preferences             | `global.css`, `nativeTabBarPreference`, preference store defaults, Dashboard key/order helpers; theme/haptic references                                                                             | Reuse semantic active-energy, exercise and hydration colors. Append a new Dashboard key without resetting saved order or visibility.                                                                                                |
| Dashboard                     | `DashboardScreen` render/error paths and `ChallengeDashboardEntry`                                                                                                                                  | Static step-centric entry sits outside ordered cards. Its own horizontal margin duplicates the parent gutter. Early unrelated data errors remove this access path.                                                                  |
| Mobile Challenges             | `ChallengesScreen`, `ChallengeDetailScreen`, `CreateChallengeScreen`; all `components/challenges/*`                                                                                                 | Mixed hub sections filter only loaded pages. Cards fetch results individually. Detail stacks invitation/results/history/lobby/actions. Lobby puts verbose rules and group status before the user's task.                            |
| Goals and numbers             | `PersonalGoalsScreen`, `MoveGoalImport`, `numericInput`, `unitConversions`, `types/preferences`                                                                                                     | Explicit Save stays on the editor. No dirty-back guard. Target/goal inputs use `Number(text)`. Existing `parseDecimalInput` and unit preferences should be reused. Move import is already explicit and on demand.                   |
| Shared Challenge presentation | `shared/src/challenges/types.ts`, `format.ts`, `rematch.ts`; list/detail/result API schema sections                                                                                                 | Labels use “Streak” for nonconsecutive Goal Days. Formatting embeds English units and permits six decimals. `withUnit=false` is inconsistent. Rematch already preserves renewed consent and does not copy locked targets.           |
| Queries and read model        | Mobile `useChallenges`, `challengeQueryOptions`, API client; web Challenge hook; server repository list and service projection                                                                      | Limit/offset list has no collection filters or summary counts. Default 20, maximum 50. Actor-scoped RLS is already used. List rows must not each request a leaderboard.                                                             |
| Privacy and surfaces          | `useChallengeSurfaces`, companion hook/session barriers, `challengeSurfaceLinking`, `challengeSurface`, widget publisher; existing notification settings                                            | Keep headless reconciliation, guarded taps, source timestamps and synchronous account invalidation. Do not couple any of these to a visible Dashboard card.                                                                         |
| Apple Watch                   | Challenge list/detail SwiftUI views, score model and surface snapshot references; watch and watch-widget target config                                                                              | Source uses broad bordered links, long compound rows, step-centric fallback icons and up to six score decimals. Goal-day plural interpolation receives a formatted string. No Watch string catalog/resource was found.              |
| Wear                          | `ChallengeScreens.kt`, `ChallengePresentation.kt`, `ChallengeStore.kt`; surface/resource references; `withWearOsCompanion.ts`                                                                       | Preserve Material 3 scaffolds, transforming list, rotary/swipe-back and atomic account-aware receipt. Formatter uses six decimals and string substitution for goal days. Plugin copies maintained target resources during prebuild. |
| Auxiliary surfaces            | Phone Challenge widget Swift/Glance source references, Watch complication and Wear surface model references; widget language hooks                                                                  | Audit actual surface families separately. Phone-supplied labels and native system-language labels must not be described as one language policy.                                                                                     |
| Web                           | Challenge hub/detail/presentation/lobby, Challenge query hook, Goals `WaterAndExerciseFields`                                                                                                       | Same incomplete list filtering and long hierarchy. Newly added goal fields hardcode units independently of existing water/energy preferences. Reuse current web controls and layout.                                                |
| Localization                  | Locale registry/accessors, generated imports, i18n instance, English Challenge keys, numeric input, audit scripts, native locale validator and translation workflow                                 | Keep reactive app locale, English fallback and existing fractional-plural compatibility. Upstream translation workflow is guarded and provides no fork-only publishing path.                                                        |

Installed mobile dependencies were checked: React Native 0.86.3, Expo 57.0.25,
React 19.2.3, i18next 26.4.2, react-i18next 17.0.13, React Navigation native
7.3.18/native-stack 7.18.10 and apple-targets 4.0.6. No upgrades are proposed.

Before editing each affected area, finish its full control-flow review. Outstanding
deep reads include web create/actions/history, mobile transport cancellation and
notification planner internals, native resource build inclusion and the remaining
widget/Tile/complication families. Existing checks are not substitutes for renders.

### Evidence classification

- **Confirmed from source:** doubled Dashboard gutters, incomplete page-based
  filtering, per-card result requests, six-decimal formatting, unit/locale gaps,
  `Number(text)` inputs, Save remaining on the goal editor and misleading labels.
- **Confirmed in Android baseline renders:** the doubled Dashboard gutter,
  oversized hub cards, duplicated waiting-date text, instructions preceding the
  lobby's own target, and duplicated points units. Light and dark/large-text
  examples are captured. On the small round Wear emulator, the long title and
  lead text push the personal score below the initial viewport.
- **Reported physical defects from M8A.6:** Apple Watch row text/icon overflow,
  poor watch information hierarchy and excessive text on phones. These have not
  yet been reproduced in M8A.7 captures.
- **Unresolved hypothesis:** delayed Wear delivery. Do not change transport until
  publication, receipt and persisted state establish a cause.

## Proposed representative slice

The table describes the intended full hierarchy. The implemented Phase A subset
and remaining work are distinguished below.

| Context              | Lead information                                                           | Primary action / disclosure                                              |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Dashboard            | One current Challenge summary, independent of the nutrition date           | Review invitation, choose target/Ready, or open current result           |
| Hub                  | My Challenges / Invitations / History segments; compact whole rows         | Create in header; preparation as a lightweight section                   |
| Invitation           | Name, type, authorized inviter, duration/dates and visible sharing consent | Join; Decline secondary; no leaderboard before consent                   |
| Lobby                | Own target and readiness first; compact permitted participant statuses     | Ready awaits target autosave; Not ready remains secondary                |
| Upcoming after lock  | Start date, locked target and waiting state                                | Open details; no target or Ready editor                                  |
| Active Goal Progress | Accumulated points; today's percent and actual/target beneath              | Compact server-ranked list; daily data and rules secondary               |
| Completed/cancelled  | State-appropriate reconcilable result or cancellation                      | Rematch with fresh consent; no fake final winner cache                   |
| Personal goals       | Grouped fields with display units and contextual Move import               | Acknowledged Save returns; dirty Back prompts instead of silently saving |
| Watch/Wear           | Name/status, own compact score and rank                                    | Native navigation; lobby/invitation actions stay on phone                |

Proposed stable access: a **Challenges action in the Library header/menu**, using
the existing native/fallback header descriptor and navigation guard. Install it
outside nutrition-data rendering so a hidden Dashboard card or summary failure
cannot remove access. Preserve the existing tabs and Add action. This must be
tested in both header paths; no Library content redesign is intended.

Dashboard priority: pending invitation, lobby needing my action, active Challenge,
ready/waiting lobby, upcoming Challenge, empty state. Within a class use stable
date/ID ordering. No carousel. Obtain at most one selected result; no per-row
leaderboard requests. Keep account-scoped caching and clear protected state first
on identity changes.

The Phase A server list adds a narrow authorized collection filter and bounded
summary selection over the full visible collection. Complete count badges are
not implemented or displayed. Preserve the unfiltered legacy defaults and
v1/v2/v3 parsing; use the same RLS actor and bounded pagination. Unknown counts
stay unknown. Any own-readiness projection must reveal no additional roster or
health data. Focused API and disposable DB/RLS tests cover the additive read model.

“Ready” awaits any in-flight target autosave, then uses the acknowledged server
revision. Edited targets save on blur or before Back navigation. Invalid/failed
saves keep the draft; conflicts require reviewing the returned target. No
optimistic activation, offline queue or guessed revision. This requested lobby
autosave is separate from the Personal Goals form's explicit Save/dirty guard.

Creation uses grouped metric selection followed by supported comparison modes:
Total, Goal points, Goal days. Sum retains calendars. Goals retain duration and
the next-full-day toggle, default off; immediate full-day inclusion stays visible
as one concise explanation. Date previews cannot promise a lobby activation date.

## Presentation and localization policy

- Steps and successful days: integers. Goal points begin at truncated integer
  precision. Different exact scores sharing that display bucket gain one decimal,
  then two if necessary. True server ties do not force extra precision; differences
  beyond two decimals never become a client-declared tie. No Exact values toggle.
  Tapping a standings row switches its score to the canonical accumulated metric
  with a metric icon. Server ranks/order and fixed-point values are untouched.
- Distances honor km/miles; energy kcal/kJ; water ml/oz/liter. Challenge contracts
  remain meters, kcal, milliliters and seconds. Use existing conversions.
- Separate values and units; `withUnit=false` must omit units in every branch.
  Shared code accepts formatting dependencies or returns presentation data,
  without importing a second i18next instance or mobile React state.
- Use numeric `count` for plurals, static semantic keys and full messages with
  placeholders. Preserve server names literally. Use `parseDecimalInput` for
  drafts and the existing separate API-number conversion for responses.
- Distinguish elapsed time, relative ranking and own-target progress. A bounded
  goal indicator includes the 100% reference and an honest over-target label.
  Missing, explicit zero and future days remain distinct.

### Actual coverage at the baseline

Counts below are nonempty matching leaf keys under `challenges.*`, not linguistic
quality assessments. The mobile registry includes English, Italian, German and
Polish, so these are valid runtime test locales.

| Surface | English source keys | Italian |  German |  Polish |
| ------- | ------------------: | ------: | ------: | ------: |
| Mobile  |                 256 | 0 / 256 | 0 / 256 | 0 / 256 |
| Web     |                 247 | 0 / 247 | 0 / 247 | 0 / 247 |

New personal activity-goal labels also have missing translated keys. English
fallback is working; it is not evidence of complete Italian support. The
fractional-plural compatibility behavior in mobile i18n must remain covered.

Apple Watch/watch-widget have no existing `.strings`, `.stringsdict` or
`.xcstrings` resources. Wear has a base `values/strings.xml` only. The current
`native-locales:check` validates phone WidgetKit/Glance resources, not Watch/Wear.
Extend validation to numeric plurals and generated-build inclusion before claiming
native localization works. Existing native formatters use the native locale;
do not claim they follow the phone's in-app choice. Audit phone-preformatted
surface labels separately and retain the established native language policy.

### Approved fork publishing path

The maintainer approved local, versioned fork translation sources on 2026-10-06.
`localization/fork/ownership.json` lists the owned key paths and destination
catalogs. English stays canonical in the app catalogs; `pnpm i18n:fork:export`
exports the selected source keys. Edit Italian in `localization/fork/*/it.json`,
then run `pnpm i18n:fork:import` and the existing package localization checks.
`pnpm i18n:fork:check` rejects stale imports; the importer rejects unknown keys,
namespace collisions and changed placeholders. It preserves upstream-owned text.

These are standard nested i18next JSON files. A future fork-owned Weblate
component can edit the same files without changing the runtime, keys or fallback
policy. No external service, account or translation repository is created now.
The upstream-only `.github/workflows/sync-translations.yml` stays guarded and
unused; both upstream repositories remain read-only.

Italian additions are implementation drafts for maintainer review, not a claim
of independent linguistic QA. Other locales retain existing translations and
English fallback where fork keys are missing. Pseudo-localized text remains test
input, never a shipped locale. Native resources use the platform's resource
formats and are validated separately from React catalogs.

## Guidance applied to decisions

| Primary guidance                                                                                                                                                                                                | Decision                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [Apple layout](https://developer.apple.com/design/human-interface-guidelines/layout)                                                                                                                            | Group with alignment and spacing; adapt horizontal comparisons to vertical layouts for long text and larger type.                   |
| [Apple materials](https://developer.apple.com/design/human-interface-guidelines/materials)                                                                                                                      | Respect existing platform chrome and glass preference; keep scores and content on restrained surfaces.                              |
| [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)                                                                                                              | Preserve scalable text, readable controls and non-color state cues; inspect actual renders.                                         |
| [Android app accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps)                                                                                                                   | At least 48 dp phone targets, meaningful action semantics and measured contrast.                                                    |
| [Wear adaptive quality](https://developer.android.com/design/ui/wear/guides/foundations/quality-tiers/responsive-optimized) and [accessibility](https://developer.android.com/training/wearables/accessibility) | Retain Wear components/rotary behavior and inspect usable round-screen bounds instead of shrinking a phone layout.                  |
| [i18next plurals](https://www.i18next.com/translation-function/plurals) and [formatting](https://www.i18next.com/translation-function/formatting)                                                               | Pass numeric counts and active locales; preserve the app's tested fractional behavior.                                              |
| [Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)                                                                                                                              | Keep own result/task first and move detailed rules/history into secondary sections; sharing consent remains visible before joining. |

## Capture manifest and runtime boundary

Native baseline captures use the retained production artifacts built from
`312ea4d1d9496087c44ccc1668ff1f82598f49d9`. Only package `AGENTS.md` files changed
in Mobile/shared between that source and the verified M8A.6 baseline. APK hashes,
PNG hashes, source/build, viewport, text scale, locale, theme and fixture provenance
are recorded in the manifests. These are executed native apps, not browser
imitations. Before/after pairs must use equivalent data and settings.

| Native capture                                                                             | Environment / state                                                                        |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [Dashboard](assets/challenge-ux/before/android/dashboard-light.png)                        | Android 16/API 36, Pixel 6 AVD, 1080×2400, 420 dpi, English, light, font scale 1.0         |
| [Hub](assets/challenge-ux/before/android/hub-light.png)                                    | Same; synthetic invitation, preparation and active Challenges                              |
| [Invitation](assets/challenge-ux/before/android/invitation-light.png)                      | Same; pending membership, no results disclosed                                             |
| [Lobby](assets/challenge-ux/before/android/lobby-light.png)                                | Same; own target required, another participant Ready, unanswered invitation                |
| [Goal progress](assets/challenge-ux/before/android/goal-progress-light.png)                | Same; synthetic canonical 11,200 / target 8,000, server result 140 points                  |
| [Dark / larger text](assets/challenge-ux/before/android/goal-progress-dark-large-text.png) | Same active Challenge and long title; dark, font scale 1.3                                 |
| [Wear unsynced](assets/challenge-ux/before/wear/unsynced.png)                              | Wear OS 5.1/API 35-ext15, small round AVD, 384×384, 320 dpi, English, dark, font scale 1.0 |
| [Wear list](assets/challenge-ux/before/wear/list.png)                                      | Same; persisted synthetic companion projection                                             |
| [Wear detail](assets/challenge-ux/before/wear/goal-progress.png)                           | Same; initial viewport with long title                                                     |
| [Wear own score](assets/challenge-ux/before/wear/goal-progress-score.png)                  | Same detail after scrolling; 140 points, server rank 1                                     |

Manifests: [Android](assets/challenge-ux/before/android/manifest.json),
[Wear](assets/challenge-ux/before/wear/manifest.json). Screenshots were visually
inspected immediately after capture. The Wear receipt came from the unchanged
phone adapter applied to actual synthetic-server responses and was installed in
the dedicated emulator's private store. This checks rendering, **not Data Layer
transport**. The source observation timestamp was retained.

The first sample must include Dashboard/hub, invitation, own-target/Ready lobby,
active Goal Progress above 100%, and representative Apple Watch/Wear views.
Include light/dark, one long name and a large-text case. Record unavailable Apple
captures explicitly; Linux cannot execute Xcode or Apple simulators.

On 2026-10-06 a dedicated `sparkyrivals_8a7_phone` AVD was created under the
private temporary directory `/tmp/sparkyrivals-8a7`, using the installed Android
36 Google APIs x86_64 image and Pixel 6 profile. The unrelated existing AVD was
left untouched. Android/Wear baseline APKs 1007/1000001007 are retained and include
x86_64 libraries. The iOS 1011 artifact is also retained. No new build was allocated.

The initial restricted environment could not access KVM or create sockets. After
the maintainer enabled full access, both were verified available and the dedicated
phone and Wear emulators booted successfully. The Wear SDK image lives in the
private temporary SDK; global SDK ownership/permissions were not changed. Existing
unrelated AVDs were left untouched. No physical device or public tunnel was needed.

The disposable test stack uses source-built server code with its normal migration
and RLS startup, PostgreSQL 18.3, and a loopback-only HTTPS proxy. Persistent test
binds are beneath repository-root `dockerdata/`. Synthetic accounts and health
fixtures exist only in that isolated database; no HealthKit/Health Connect samples
were written. A test CA was trusted only inside the dedicated phone emulator.
Remote push and scheduled jobs are disabled. Credentials and raw diagnostics stay
in private ignored paths; they are not screenshot assets. Stop owned listeners
after testing and preserve the test data for equivalent after captures.

The maintainer chose emulator/audit work for now. Physical devices, Apple capture,
translation ownership and the mandatory visual-direction checkpoint remain gates.
No public tunnel, live test notification or production service was used.
After baseline capture, all three owned disposable containers and both dedicated
emulators were stopped. Bind-mounted data was preserved. A later laptop restart
removed temporary AVD files; Phase A recreated only the dedicated AVDs beneath
`~/.local/share/sparkyrivals/ux-emulators/`. Existing unrelated AVDs were untouched.

The Phase A development phone build uses the already-supported development-only
HTTP localhost path through ADB reverse and loopback port 49444. This avoided a
local test certificate trust failure without changing production TLS policy.
The private HTTPS proxy remains loopback-only on 49443. No public tunnel exists.
Expo's floating developer control was disabled only in this emulator's developer
preferences for the final captures. The underlying screenshots are unedited. After Phase A captures, Metro, both
dedicated emulators and all three owned disposable services were stopped. Test
data and AVD files were retained; no destructive cleanup occurred.

## Validation and remaining work

Baseline checks run at `0e185e879042a6fec0613e57ebe534c00fd552ab`:

- `pnpm run i18n:generate:check`: passed; generated resources current.
- `pnpm run i18n:audit`: passed; zero structural, static-key, placeholder, plural,
  fallback and source-scan errors. Missing translator content remains reported.
- `pnpm run native-locales:check`: passed for its existing phone-widget scope.

## Phase A implementation and evidence

- Dashboard: ordered/hideable compact live summary, bounded to one selected result.
  An independent Challenges header action in Library was navigated successfully.
- Hub: server-filtered My Challenges, Invitations and History; navigable rows,
  header Create and bounded pagination. No false complete-count badges or per-row
  leaderboard requests. Preparation grouping and per-tab scroll restoration remain
  Phase B work.
- Invitation: authorized inviter and visible sharing consent, Accept/Decline,
  no results before acceptance.
- Lobby: own target first, locale-aware decimal input, confirm-and-ready using the
  acknowledged target revision, separate save-only and Not ready controls.
  Compact participant rows preserve permissions. In the emulator, a real request
  saved the synthetic target 8,000 at revision 1, confirmed Ready, and remained
  in the lobby because one invitation was pending. No optimistic activation.
- Active goal points: own accumulated points, today's uncapped percentage and
  actual/target, bounded geometry with a 100% reference, compact server-ranked
  rows, optional exact values and collapsed daily history/actions. No reranking.
- Wear: native list/detail hierarchy brings own result forward, compact precision,
  numeric goal-day plural resource. Rendered on the small round emulator.
- Apple Watch: a narrow source draft uses native List rows, bounded title and
  metric icons. **Not compiled or rendered.** On the maintainer's instruction,
  Apple visual/device checks follow direction approval; they remain mandatory
  before final acceptance.

### Additive read model

`GET /api/v2/challenges` accepts optional `view=mine|invitations|history|summary`.
Filtering occurs before the existing bounded limit/offset pagination, under the
same actor/RLS context. Unfiltered defaults and v1/v2 legacy metric restrictions
remain unchanged. Optional `my_ready` describes only the requesting participant.
Summary priority is invitation, own-action lobby, active, ready lobby, upcoming,
then stable created-at/ID order. No tables, migrations or RLS grants were added.
No scores, lifecycle transitions or consent rules changed.

### Before / Phase A captures

| Context              | Before                                                                         | Phase A                                                                                 |
| -------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Dashboard            | [Before](assets/challenge-ux/before/android/dashboard-light.png)               | [After](assets/challenge-ux/phase-a/android/dashboard-light.png)                        |
| Hub                  | [Before](assets/challenge-ux/before/android/hub-light.png)                     | [After](assets/challenge-ux/phase-a/android/hub-light.png)                              |
| Invitation           | [Before](assets/challenge-ux/before/android/invitation-light.png)              | [After](assets/challenge-ux/phase-a/android/invitation-light.png)                       |
| Own target           | [Before](assets/challenge-ux/before/android/lobby-light.png)                   | [After](assets/challenge-ux/phase-a/android/lobby-light.png)                            |
| Ready                | No equivalent baseline captured                                                | [After confirmed save/Ready](assets/challenge-ux/phase-a/android/lobby-ready-light.png) |
| Goal progress        | [Before](assets/challenge-ux/before/android/goal-progress-light.png)           | [After](assets/challenge-ux/phase-a/android/goal-progress-light.png)                    |
| Dark, font scale 1.3 | [Before](assets/challenge-ux/before/android/goal-progress-dark-large-text.png) | [After](assets/challenge-ux/phase-a/android/goal-progress-dark-large-text.png)          |
| Wear list            | [Before](assets/challenge-ux/before/wear/list.png)                             | [After](assets/challenge-ux/phase-a/wear/list.png)                                      |
| Wear initial detail  | [Before](assets/challenge-ux/before/wear/goal-progress.png)                    | [After](assets/challenge-ux/phase-a/wear/goal-progress.png)                             |
| Wear scrolled score  | [Before](assets/challenge-ux/before/wear/goal-progress-score.png)              | [After](assets/challenge-ux/phase-a/wear/goal-progress-score.png)                       |

After manifests: [Android](assets/challenge-ux/phase-a/android/manifest.json),
[Wear](assets/challenge-ux/phase-a/wear/manifest.json),
[source file hashes](assets/challenge-ux/phase-a/source-manifest.json).
These identify baseline plus the uncommitted source tree; no released build or
committed feature SHA is implied. Android uses the real component path via Metro,
1080×2400/420 dpi; Wear uses compiled maintained Kotlin source, 384×384/320 dpi.
All captures are English and synthetic. The dark phone case uses font scale 1.3;
others use 1.0. Wear scrolling exposes partially offscreen list items naturally.
Its injected receipt checks presentation only, not phone-to-Wear transport.

### Focused checks at the checkpoint

- Mobile: **114/114 tests, 7 suites** in the final focused run: Challenge screens,
  confirm/save/Ready sequencing, queries, API, Dashboard preference resolution,
  header hook and native-header source contract. The contract now resolves actual
  tab-local native stacks as well as root screens and checks suppression for both;
  there is no new exemption list. Some existing React act warnings remain.
- Server: **89/89 focused unit/API/schema tests**; typecheck and focused lint pass.
- Disposable PostgreSQL: **19/19 integration tests**, comprising six filtered-list
  tests and thirteen existing Challenge DB/RLS tests. Older invitations beyond
  twenty newer rows, stable pagination, summary priority, outsider denial,
  cancellation and legacy contracts are covered. These are not added to the
  mobile totals or counted again from overlapping runs.
- Mobile typecheck, focused lint and i18n audit pass. English keys use the current
  resource system; translator-owned gaps remain. No non-English catalogs changed.
- Clean development Android prebuild and real `:app:assembleDebug` plus
  `:wear:assembleDebug` x86_64 builds passed (758 tasks). Development identity,
  debug artifacts only; no distributed production version number allocated.
- Existing baseline resource-generation/native-widget locale checks passed as
  recorded above. They do not validate newly drafted Apple strings or every Wear
  resource, which still need the planned broader checker.
- No full mobile CI, web production build, EAS/Xcode build, physical-device check,
  widget/Tile/complication capture or VoiceOver/TalkBack acceptance is claimed.

### Work deliberately remaining after direction approval

Complete creation/rematch, personal goals Save/back behavior, all unit preferences,
all state/metric layouts, virtualized lists, scroll restoration, web, localization
publishing/import, approved Italian coverage, native localization and auxiliary
surfaces. Remove remaining inherited English unit formatting and complete plural
and exact-value behavior across every call path. Expand empty/error/offline and
account-switch interaction coverage. Apple row overflow is still unverified here.
No iPhone or Apple Watch image is fabricated or inferred from an Android render.

Carry forward the M8A.6 health-source/writeback acceptance boundaries documented
in [RELEASE_VALIDATION.md](RELEASE_VALIDATION.md). UI fixtures cannot close those
gaps. M8A.7 is incomplete and no final PR is ready. Phase B must wait for visual
approval and the explicit fork translation ownership/source decision above. This
records the original checkpoint; direction approval was subsequently granted
after revision 3, and local translation ownership was subsequently approved on the same day.

## Phase A revision 2 — awaiting visual approval

The maintainer's 2026-10-06 feedback supersedes the earlier sample: fewer labels,
compact consent, automatic target persistence and useful date ranges. Goal lobby
ranges are explicitly **Expected**, recomputed for the Challenge timezone while
waiting. Actual locked dates replace them after readiness activation. Inclusive
calendar duration and locale ordering are retained; crossing a year shows numeric
full dates. Immediate full-day semantics remain explained at creation.

Implemented in the representative phone path:

- Removed redundant Active/Invitation/100% target labels and lobby paragraphs.
- Relative observation age ticks only while focused/foreground, then switches to
  an absolute date beyond one week; no timestamp or score is synthesized.
- Existing i18next handles relative messages and plural counts. Emulator testing
  caught Hermes lacking RelativeTimeFormat and BigInt NumberFormat support;
  the final formatter uses translated messages and exact integer grouping from
  supported locale format parts. No Intl polyfill/dependency was added.
- Small daily-history action retains a 48 dp touch target. Standings switch
  points/actuals per row with appropriate icons. Close-score native case shows
  140.05 versus 140 while retaining the distinct server ranks.
- Participant rows show a Ready member's target or Choosing/Invited, not two
  stacked status/value labels. Swipe reveals removal; full swipe opens native
  confirmation. Long press/accessibility action also exposes confirmation.
- Creator removal is limited to accepted/Ready peers in an unlocked goal lobby;
  pending participants use the existing withdrawal endpoint. No self-removal,
  no removals in sum Challenges or after scheduling/activation/cancellation.
  Migration replaces only the write guard; startup RLS permits the same bounded
  transition. Existing activation logic rechecks remaining participants under
  the parent lock. Targets remain self-only, including compound SQL attacks.

### Revised native evidence

[Capture manifest](assets/challenge-ux/phase-a-revision-2/android/manifest.json)
and [source hashes](assets/challenge-ux/phase-a-revision-2/source-manifest.json)
record eleven unedited emulator screenshots, source state and runtime provenance.
All use Android API 36 / Pixel 6 AVD, 1080×2400, 420 dpi, English; light at 1.0
font scale or dark at 1.3. They use the production component path and synthetic
disposable server data. No physical-device, HealthKit or Health Connect claim.

| Revised view                         | Capture                                                                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hub end dates                        | [Hub](assets/challenge-ux/phase-a-revision-2/android/hub-light.png)                                                                                                   |
| Compact sharing consent              | [Invitation](assets/challenge-ux/phase-a-revision-2/android/invitation-light.png)                                                                                     |
| Expected dates, own target and Ready | [Lobby](assets/challenge-ux/phase-a-revision-2/android/lobby-light.png)                                                                                               |
| Swipe and mandatory confirmation     | [Swipe](assets/challenge-ux/phase-a-revision-2/android/lobby-swipe.png), [confirmation](assets/challenge-ux/phase-a-revision-2/android/lobby-remove-confirmation.png) |
| Goal points and raw-value toggle     | [Points](assets/challenge-ux/phase-a-revision-2/android/goal-progress-light.png), [steps](assets/challenge-ux/phase-a-revision-2/android/goal-progress-actual.png)    |
| Close scores retain server ranks     | [Two decimal case](assets/challenge-ux/phase-a-revision-2/android/goal-progress-close-scores.png)                                                                     |
| Long title and large text            | [Dark 1.3](assets/challenge-ux/phase-a-revision-2/android/goal-progress-dark-large-text.png)                                                                          |

Emulator interaction confirmed target 8000→9000 persisted after Android Back and
reopening, followed by successful Ready. Swipe confirmation was cancelled to
retain the visual roster; actual removal is exercised against the disposable DB.
The first header tap while the text field had focus did not navigate; hardware
Back completed the save/navigation. Retain explicit keyboard/header/swipe-back
acceptance on both physical phones before final review.

### Revision validation and limits

- Mobile focused tests: 128 passed / 8 suites (not added to the earlier totals).
- Server route/service tests: 67 passed / 2 suites.
- Disposable DB/RLS tests: 34 passed / 3 suites, including four new removal cases,
  Ready/removal concurrency, self-only targets, legacy sum denial and old consent.
- Server typecheck/lint passed; package format check passed after formatting the
  new route test. Mobile typecheck, targeted lint and i18n audit/generation checks
  passed. Full milestone CI, web redesign and physical acceptance are Phase B.
- Normal disposable server startup applied the additive migration and startup
  policies. No new table/column: database Zod mirrors and central RLS-enable list
  need no additions. Existing membership enum and detail response remain valid.
  Sharing/security-tier docs updated; schema backup untouched.
- Apple screenshots/gesture behavior remain unverified and deferred for this
  direction checkpoint at maintainer request. Previous Phase A Wear renders are
  unchanged; auxiliary/native localization rollout is still pending approval.
- The existing startup emits an i18next initialization warning in the development
  runtime. The inspected Challenge screens resolve the current English resources;
  trace that warning and test mounted-language changes during Phase B rather than
  treating English screenshots as proof of complete localization.
- Protected non-English catalogs were not edited. Fork-owned translation source
  approval remains pending; the existing i18next runtime is reused unchanged.

Owned emulators, Metro and disposable server/DB listeners are stopped after these
captures. Retained test data and private diagnostics are preserved. No public
network exposure, upstream write, production action or credential change occurred.

## Phase A revision 3 — own-result card and freshness footer

The maintainer requested one restrained card for Your total, points and position.
The existing `bg-surface` and radius tokens group these three items; today's
progress remains outside. Position reads **1st place · 2 players**, with **Joint**
for a server-declared tie. No ranks, scores or tie rules changed. Freshness is the
centered last line of scroll content, after details/actions, and continues using
the authoritative calculation timestamp.

Ordinal positions use the existing i18next instance, numeric counts and English
source keys. The source audit now validates ordinal categories, fallback text,
placeholders and target coverage separately from cardinal plurals. Existing
cardinal checks remain enforced. Native inspection caught **2th** despite passing
Node tests: Hermes lacked `Intl.PluralRules`. Added the pure-JavaScript
`intl-pluralrules` 2.0.1 polyfill before i18next initialization, as recommended by
[i18next's plural documentation](https://www.i18next.com/translation-function/plurals).
No second localization engine, native dependency or protected translation edit.
Tests simulate missing native Intl support across every registered locale and
retain the existing Polish fractional fallback.

[Manifest](assets/challenge-ux/phase-a-revision-3/android/manifest.json) records
the final source hashes and unedited native emulator captures:

- [Light](assets/challenge-ux/phase-a-revision-3/android/goal-progress-light.png)
- [Dark, text scale 1.3](assets/challenge-ux/phase-a-revision-3/android/goal-progress-dark-large-text.png)
- [Second place and close scores](assets/challenge-ux/phase-a-revision-3/android/goal-progress-close-scores.png)

Focused mobile validation: **241 tests / 6 suites** (screens, presentation,
localization, missing-native-Intl runtime, audit and audit hardening). TypeScript,
targeted lint, i18n audit and resource-generation check pass. These overlap earlier
test groups and are not additional milestone totals. Existing test `act` warnings
remain. No backend source changed in this revision; prior DB/RLS evidence stands.

Captures use the same development APK and production component path via Metro,
English and synthetic disposable server data on the Pixel 6/API 36 AVD. They
establish neither iOS rendering nor physical phone/watch acceptance. Visual
approval was subsequently granted by the maintainer on 2026-10-06. Repository-local translation
ownership was subsequently approved; Phase B started on 2026-10-06. Owned
listeners/emulator are stopped afterward and test data retained.

## Phase B — implementation and local acceptance

Source through `ff10ef58265da5e726eeb24f4ead7ad0c5f5de6a` implements the approved
phone, web and companion direction. Native physical acceptance remains open.

### Production paths and behavior

- Mobile Dashboard uses the existing card ordering/hiding preferences. Library
  retains a separate Challenge header action, independent of nutrition queries.
  The 7 October physical session exposed a discoverability defect: tapping the
  whole summary opened its changing priority item, so the maintainer could not
  find the hub. The approved correction opens the hub, except when there is
  exactly one accepted active Challenge. A separate `view=active&limit=1` read
  uses the server's second-row sentinel; preparation pages and pending invites
  cannot be mistaken for an exhaustive active collection. The shortcut keeps a
  real hub route beneath detail, so ordinary Back goes detail → hub → Dashboard.
  Existing route keys/state are retained. No extra “all Challenges” detail action.
  This additive filter changes no schema, RLS policy, consent or scoring rule;
  migration/schema-mirror/security-tier changes are not applicable.
- Hub uses bounded server-side `view` filters. Empty states are collection-aware;
  there is no complete-count badge inferred from a loaded page. Summary fetch is
  bounded and only the selected summary needs results.
- Invitation consent, goal lobby, scheduled, active, completed and cancelled
  contexts use their own primary content. Ready waits for a successful target
  autosave and the returned revision. Conflicts require confirmation; a partial
  target-save/Ready failure preserves the actual saved state.
- The creator's confirmed removal action is restricted to unlocked goal lobbies.
  The migration preserves self-only targets and serializes roster changes with
  Ready activation. No scoring, ingestion, push-category or consent expansion.
- Personal goals use locale decimal parsing and existing display preferences.
  Explicit successful Save returns; a dirty Back asks to discard. Emulator
  interaction retained a synthetic 5.5 km value and discarded a 5.6 km draft.
- Web shares metric/mode terminology, consent and orchestration, using existing
  router/query/Radix primitives. Desktop places daily history beside results;
  mobile web uses one column. Browser captures use real disposable API data with
  a private synthetic session fixture, not evidence of a manual login.
- Shared formatting never reranks. Points truncate to whole numbers unless
  distinct scores collide, then show up to two decimals. Actual-value toggling
  preserves canonical values. The >100% bar has bounded geometry and an accurate
  accessible description; missing/zero/future days remain distinct.
- Watch native rows wrap names and keep the icon/status inside the row. Both
  companions use compact units, numeric native plurals and optional, validated
  display-unit metadata. Account/session guards, payload limits and transport
  architecture remain unchanged. A physical Apple Watch check below covers the
  reported overflow at one viewport; other sizes/text scales remain open.

### Translation ownership and coverage

The maintainer approved `localization/fork/` as the repository-local source for
fork-owned Italian translations. `ownership.json` restricts imports to Challenge
and listed activity-goal keys. The importer updates the normal catalogs; existing
registry, generated resources, i18next runtime and fallback remain in use. Native
Watch/Wear strings have separate maintained resources and checks. See the
[translation workflow](../../localization/fork/README.md).

At this source: mobile English 391 / Italian 407 leaf entries; web English 368 /
Italian 379. Different plural categories mean these totals are not comparable
coverage percentages. Native resources contain 56 Watch, 5 watch-widget and 92
Wear entries. Italian is an authored draft awaiting linguistic review. German,
Polish and other registered locales retain existing translations and English
fallback for missing fork keys. Rendered German/Polish cases verify formatting
and fallback, not complete translation. Native companions follow system language,
not the phone's in-app language preference.

Future fork-owned Weblate components can edit these same source files through
reviewed fork PRs and the same importer. No service, external repository or
credential was created. The guarded upstream translation workflow stays inactive.

### Rendered evidence

[Phase B manifest](assets/challenge-ux/phase-b/manifest.json) records build/source
provenance, theme, locale, text scale, dimensions and synthetic state. Earlier
working-tree captures lack a contemporaneous full source digest; they are labeled
as earlier visual references. They do not establish final-artifact acceptance.

- [Italian hub](assets/challenge-ux/phase-b/android/hub-it-light.png),
  [invitation](assets/challenge-ux/phase-b/android/invitation-it-light.png),
  [Ready lobby](assets/challenge-ux/phase-b/android/lobby-it-light.png).
- [Italian dark, large text](assets/challenge-ux/phase-b/android/goal-progress-it-dark-large.png),
  [German AMOLED, large text](assets/challenge-ux/phase-b/android/goal-progress-de-amoled-large.png),
  [Polish fallback, 320 dp width, large text](assets/challenge-ux/phase-b/android/goal-progress-pl-amoled-small-large.png).
- [Personal-goal dirty Back](assets/challenge-ux/phase-b/android/goals-dirty-it.png).
- [Wear Italian](assets/challenge-ux/phase-b/wear/goal-progress-it.png) and
  [large text](assets/challenge-ux/phase-b/wear/goal-progress-it-large.png).
  These use a persisted synthetic snapshot, not evidence of live Data Layer sync.
- Web [hub](assets/challenge-ux/phase-b/web/hub-it-desktop.png),
  [desktop results](assets/challenge-ux/phase-b/web/goal-progress-it-desktop.png),
  [mobile-web results](assets/challenge-ux/phase-b/web/goal-progress-it-mobile-web.png).
  A browser viewport is not an iPhone capture. Full-page browser captures retain
  the fixed navigation at its viewport position; scrolling is checked separately in the [viewport capture](assets/challenge-ux/phase-b/web/standings-it-mobile-web.png). Keyboard Enter toggled points/actual and expanded/collapsed daily history.

A paired no-interaction capture showed Android CLI returning an older frame with
an absent header while direct ADB showed the current complete header. Later
phone captures use `adb exec-out screencap -p`; speculative header workarounds
were removed. This is recorded as a capture limitation, not an application fix.

The [physical Galaxy Watch manifest](assets/challenge-ux/physical/wear-1000001009/manifest.json)
records release **1000001009**, paired with phone **1010**, on a 432×432 SM-R930,
Italian system locale, native dark theme and font scale 1.0. Inspected captures:
[list](assets/challenge-ux/physical/wear-1000001009/list.png),
[centered long row](assets/challenge-ux/physical/wear-1000001009/long-row.png),
[full long-title detail](assets/challenge-ux/physical/wear-1000001009/long-detail.png),
[points/rank](assets/challenge-ux/physical/wear-1000001009/goal-points.png) and
[lobby](assets/challenge-ux/physical/wear-1000001009/lobby.png).
The centered long row wraps then truncates; its detail shows the full title and
emoji without visible overflow at this size. Own **140 pt / position 2** stays
distinct from missing data today. The lobby gives generic phone-readiness
guidance, participant count and source age; it does not expose an individual
Ready state or editing controls. These are synthetic test-server data received
through the existing companion path, not provider-ingestion evidence. App
screenshots do not validate the physical Tile or complication.

The maintainer supplied two physical Apple Watch screenshots at **396×484**:
[long row](assets/challenge-ux/physical/apple-watch/long-row.png) and
[upper detail](assets/challenge-ux/physical/apple-watch/long-detail.png).
The long name, emoji and metric icon stay inside the centered row; the detail
shows the full title, **50 pt** and server **position 2** without the reported
overflow. This verifies those visible elements at one viewport, not the complete
Watch matrix. [Provenance](assets/challenge-ux/physical/apple-watch/manifest.json)
explicitly leaves build confirmation and text scale unknown until supplied.
Public copies omit text/EXIF metadata; image/color chunks and decompressed image
data match the private originals. The screenshots do not validate gestures, the
full standings, VoiceOver or complications.

### Validation and remaining gates

Full mobile CI passed **521 suites / 8,011 tests** at the initial release source;
the latest nested-container navigation correction passed **523 suites / 8,028
tests**. Full web CI
passed **188 suites / 1,805 tests**, with the final focused web group **33 tests**
and production build also passing. Full bounded server CI passed **454 files /
5,649 tests**, with **18 files / 514 tests skipped**. Disposable DB/RLS suites
passed **376 tests / 4 files**, including filters/pagination, roster/Ready races,
legacy contracts and remote-push deny-all/startup recovery. These groups overlap;
they must not be added into a single total.

Additional overlapping checks: companion Jest **89 tests / 6 suites**, shared
presentation **38 tests / 4 suites**, fork importer **5 tests**, native locale
validator **7 tests**, Wear JVM **44 tests**. Package validation and upstream
workflow-safety checks passed. Existing React `act` warnings are not suppressed.
A mistaken `pnpm test:ci -- --watchman=false` invocation treated the argument as a
file pattern; the successful full run passed `--watchman=false` directly.

Two clean prebuilds for each of production, preview, development and upstream
production produced matching native metadata. Development phone/Wear Gradle
compilation and Wear unit tests passed. Release Android and full EAS iOS builds
are recorded separately in [RELEASE_VALIDATION.md](RELEASE_VALIDATION.md).
Linux did not execute Xcode or the Swift model harness. EAS compiled all five
Apple targets in builds 1012 and 1013; production Android phone/Wear
1008/1000001008 and 1009/1000001009 compiled and passed permanent-signer
verification. Physical testing then found the 1009/1013 Dashboard entry did
nothing because its reset targeted the focused child navigator. A real-container
test reproduced the failure. The root-state fix passed those tests and the
production Android **1010** emulator Dashboard → hub → detail → hub → Dashboard
journey. The maintainer also confirmed that journey on physical Samsung **1010**.
EAS iOS **1014** compilation and exported-IPA inspection passed; iPhone update
and navigation confirmation remain pending. See the source-specific release ledger.

Required outstanding acceptance: remaining physical phone and Apple Watch flows;
Galaxy Watch larger text, rotary/swipe gestures and accessibility; iOS native
headers with glass on/off, swipe/keyboard/accessibility; Apple Watch sizes/text
scales beyond the captured viewport; representative phone widgets, Tile and
complication renders; VoiceOver/TalkBack, reduced motion and broader offline/error/long-value visual
cases. The release Wear Tile was separately rendered in its CLI host for empty and
sum/stale synthetic states; see the manifest. This does not establish physical
Tile behavior or complication/widget acceptance. Carry forward
M8A.6 health-source/writeback gaps. The maintainer authorized the temporary
M8A.7 test tunnel on 7 October; remote push remains disabled. Live remote push
still requires separate consent. M8A.7 remains incomplete; M8B stays deferred.
