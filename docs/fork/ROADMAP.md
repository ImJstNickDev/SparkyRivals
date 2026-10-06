# SparkyRivals roadmap

Milestones are sequential deliverables. This roadmap authorizes no feature work by
itself; implement the milestone the maintainer requests. Preserve upstream merge
compatibility throughout.

## 0. Bootstrap and audit — completed

- Public fork, full-history clone, verified origin/upstream, fork push default.
- Architecture, canonical health storage, identifier/signing audit, and agent guidance.
- Local baseline validation with documented failures/limitations.
- Concrete [Own the Build plan](OWN_THE_BUILD.md).
- Exit evidence: [BASELINE.md](BASELINE.md). No Challenges/Wear implementation.

## 1. Own the Build — merged; account/device setup remains

Implemented: central custom identity with isolated variants, derived Apple targets,
secure native callback allowlisting, widget/Watch links, explicit release signing,
build profiles/versioning, repeatable native metadata checks and guarded workflows.
See [OWN_THE_BUILD.md](OWN_THE_BUILD.md) and [BUILD_VALIDATION.md](BUILD_VALIDATION.md).

The maintainer's milestone 1 scope permits configuration completion before account
setup. Code/configuration acceptance passes locally. **Distribution acceptance is
still open:** obtain owned EAS/Apple accounts, register/provision App IDs/groups,
establish permanent Android key custody, and validate native compiled/signed builds
and physical health/auth/widgets/Watch behavior. No installable binary is claimed.
See [BUILDING.md](BUILDING.md) for those steps. Later milestones require a new
explicit request; this status does not authorize Challenges or Wear OS work.

## 2. Challenge backend — merged as PR #2

Steps/sum competitions support 1–100 participants, relationship-scoped invitations,
explicit acceptance/decline/departure, cancellation, immutable date/zone rules,
server lifecycle and live canonical leaderboards. RLS and narrow projections share
only consented competition data. Results reconcile on every read, including lower,
cleared, deleted and late canonical rows; no cached score/winner or scheduler is
needed for v1. Automated provider downward corrections remain an ingestion limit.

Evidence: [CHALLENGES.md](CHALLENGES.md) and
[CHALLENGE_VALIDATION.md](CHALLENGE_VALIDATION.md). Fresh migrations, populated
Milestone 1 upgrade, direct RLS, lifecycle/consent, 100-participant concurrency,
calendar/DST and full regressions pass. Normal merge main was
`eff06b7b6e522145e037f4ce08a7e5d732a4fbb1`.

## 3. Web and mobile Challenge UI — merged as PR #4

Web routes and native root-stack screens now provide the hub, invitations,
creation, 1v1/group results, daily history, owner/member actions and refresh.
They consume server ranks/scores/lifecycle/coverage, use existing themes and
localization, and preserve missing-data semantics and explicit membership consent.
A mobile Dashboard entry preserves the native tab/Add arrangement. No workouts,
Watch transport, Wear OS or deployment are included.

The feature starts from the validated frozen upstream sync merged through fork
PR #3 (`747280650d58fcfde1617a12eab04b829eb3bff2`). PR #4 merged normally at
`b333a116724e8c0899a8a036ae1a1ad29e4d2d42`.
See [CHALLENGE_UI.md](CHALLENGE_UI.md) and
[CHALLENGE_UI_VALIDATION.md](CHALLENGE_UI_VALIDATION.md). Package tests, web build
and fixture-backed browser visuals pass. Native device accessibility, keyboard,
calendar, theme and real-server flows remain a follow-up acceptance boundary.

## 4. Apple Watch Challenge page — merged as PR #5; native acceptance remains

The native page participates in normal ordering/hiding and displays bounded
server results through the existing composed WatchConnectivity context. It covers
1v1, groups, multiple Challenges, invitations, upcoming/completed and empty states.
Account clearing, stale indicators, tolerant decoding, shared mobile queries,
DEBUG screenshot seeds and compatibility tests are included. No Watch mutations,
Challenge complication, backend change or Wear OS implementation is included.

See [APPLE_WATCH_CHALLENGES.md](APPLE_WATCH_CHALLENGES.md) for implementation and
validation evidence. Linux checks do not replace Xcode compilation, simulator
visual/accessibility acceptance or paired-device checks. Those remain outstanding;
no native binary or screenshot is claimed. PR #5 merged normally at
`e52c89b1314927309d42a351da8f509f44970ec5`.

## 5. Wear OS companion — merged as PR #6; native/device acceptance remains

Tracked Kotlin/Wear Material 3 source is generated into a separate `:wear` module
by clean Expo prebuild. Custom opt-in profiles share phone application ID and
signing authority, with disjoint form-factor version codes. The existing bounded
Challenge projection now feeds Data Layer through a durable Android publisher.
Wear handles 1v1/groups/invitations/lifecycle states, account clears, persisted
revision guards and stale/offline results. Samsung Health → Health Connect → phone
→ canonical server health ingestion is unchanged. Wear collects no health data.

See [WEAR_OS_CHALLENGES.md](WEAR_OS_CHALLENGES.md) for protocol, source maps,
validation and the physical Galaxy Watch checklist. Linux prebuild/mobile tests
and actual protocol JVM compilation pass. Android/Compose APK compilation,
emulator/device visuals, TalkBack and paired Data Layer acceptance remain open.
PR #6 is merged. No credentials or deployment were created.

## 6. Workout integration — merged as PR #7; native acceptance pending

Workout Time (`workout_time`, integer seconds) joins Steps end-to-end. Canonical
session projection, consent-only aggregates, generic ranking, secondary session
counts, web/mobile selectors and watch duration rendering are implemented. No
calories/points/combined score. See [WORKOUT_CHALLENGES.md](WORKOUT_CHALLENGES.md)
and [WORKOUT_VALIDATION.md](WORKOUT_VALIDATION.md). Native compile/device debt from
Milestones 4/5 remains explicit; no workout logging was added to Wear.

## 7. Challenge polish and native surfaces — merged as PR #8; native acceptance pending

Editable web/mobile Rematch, local phone notification reconciliation/preferences,
iOS/Android Challenge widgets, an Apple Watch complication and Wear Tile/complication
reuse existing authoritative data and account-clearing transports. See
[CHALLENGE_POLISH.md](CHALLENGE_POLISH.md) and [POLISH_VALIDATION.md](POLISH_VALIDATION.md).
Recurrence, goals, streak engines and new scoring remain deferred. Remote invitation push is scoped separately in 8A.5.

## 8A. Release engineering and local production preparation — complete; PR #10 merged

PR #8 merged normally at `02d6ab39a98e912c8c60052575fa95950da1d7be`.
Frozen upstream `e132d4b0192cf474728920e17cbcdbc9f5058d1c` was validated and
merged through fork PR #9; milestone base is
`5891bf15d134744117d90505bbe3029fb104d08c`.

Owned EAS identity and Apple team are integrated, including production-identity
internal distribution. Android phone/Wear releases compiled and passed permanent
certificate verification; both installed and launched on physical Samsung devices.
An initial paired Data Layer transfer was observed. EAS compiled/exported the
five-target internal iOS build 1005 with matching versions; the maintainer installed
it on the registered iPhone and confirmed onboarding. After Watch registration,
re-signing and installation retries, the maintainer confirmed physical Series 7
installation and first-run launch. Review then identified and fixed the inherited
weight-entry navigation gate. Authenticated Watch behavior remains unverified. Local final
Compose startup, isolated routing, migration and backup/restore checks passed.

Review identified the Apple Watch first-run navigation gate as the remaining M8A
blocker. The source fix keeps First check-in inside Entry without blocking other
pages. Full EAS build 1006 and exported identity/profile checks passed. On
2026-10-04 the maintainer confirmed physical Series 7 first-run display, swiping to
Challenges, the unsynced state and return to the usable Entry form without entering
or saving weight. M8A release-engineering acceptance is complete; PR #10 merged normally at
`0bd2420d3deebbc11c84afe76676799b8d87e3dc`. An actual check-in Save/ack, broader authenticated
sync, account clearing, health dedupe, native surfaces, notifications and
accessibility acceptance remain explicitly post-M8A/pre-production QA. See
[release evidence](RELEASE_VALIDATION.md), [BUILDING.md](BUILDING.md) and
[DEPLOYMENT.md](DEPLOYMENT.md). Source tests do not waive device acceptance.

## 8A.5. Secure remote invitation push — complete; PR #12 merged

Frozen upstream `9bae67beb0c909e225dc60c6a336c78269c130c9` synchronized through
fork PR #11 (normal merge `6ff1fa32bdc27d6e7fa0144e49c69eb0c0b2e4ba`).
The milestone branch is `milestone/remote-push`. Scope is opt-in phone registration,
private durable invitation delivery through authenticated Expo Push, local fallback
and production-only Firebase client config. Android 1006 and iOS 1009 passed real
background invitation delivery, guarded taps, local deduplication, disable/re-enable
and account removal. Enhanced Push Security rejection/success passed. Galaxy Watch
invitation sync and clearing passed on 1000001006. Latest-source iOS 1010 compiled
and its signed IPA passed inspection; its installation/launch and broader native
QA remain explicitly listed in [RELEASE_VALIDATION.md](RELEASE_VALIDATION.md).
See [REMOTE_PUSH.md](REMOTE_PUSH.md) for architecture. PR #12 merged normally at
`8121e261a8e1a19637f047b9b9e0d139738292e3`, including startup RLS recovery for all three push tables.
No direct Watch push, remote start/end/lead scheduler, scoring or production work.

## 8A.6. Challenge types, personal goals and Ready lobbies — completed; PR #14 merged

See [CHALLENGE_TYPES.md](CHALLENGE_TYPES.md) for the allowed metric/mode matrix,
canonical units, uncapped goal points, goal-day counts, personal target snapshots
and asynchronous Ready activation. Immediate current-calendar-day start is the
default; next-full-day start is optional. No visual redesign is included.

Frozen upstream `78ea8141f160f6b681c8eb45575126b0049a081c` synchronized through fork
PR #13; main `e2e21f8cd141b622152cf6bc837db2cd97c2e238` is the milestone base.
Source validation and Android/Wear/EAS compilation passed. Physical tests verified
personal goals, Apple Move import, Ready/withdrawal/decline, immediate and next-day
activation, locked targets, uncapped Move points, goal-day counts, legacy Step Race
and canonical manual hydration without double counting. Both watches
received the new data; visual defects and remaining physical health-source checks
are explicitly recorded in [RELEASE_VALIDATION.md](RELEASE_VALIDATION.md).
PR #14 merged normally at `0e185e879042a6fec0613e57ebe534c00fd552ab`,
preserving reviewed head `a6f87cd34c78629f398016a18b60ffbdab264118`.
The documented physical health-source gaps remain; automated coverage is not physical evidence. M8A.5 credential, privacy and push boundaries remain intact.

## 8A.7. Challenge UX, localization and companion polish — in progress

The maintainer approved Phase A revision 3 and repository-local fork translation
ownership on 2026-10-06. Phase B implements the three-view hub, ordered Dashboard
summary and independent Library access, state-specific invitation/lobby/results,
compact scores, locale-aware forms and English/Italian sources using the existing
runtime. See [CHALLENGE_UX.md](CHALLENGE_UX.md) for captures, source maps and tests.

Goal-lobby targets autosave on blur/Back; Ready awaits the saved server revision.
Ordinary personal-goal forms retain explicit Save and a dirty-form discard guard;
successful Save returns after server acknowledgment. Projected lobby dates remain
conditional on all-ready. The authorized creator removal is limited to unlocked
goal lobbies and cannot set another participant's target.

Both watches have compact metric-aware presentation and separate native catalogs.
Android/Wear emulator renders and actual Android debug compilation are available.
Apple runtime/screenshots, physical acceptance on both phones/watches and
representative widgets/Tiles/complications remain required. English fallback in
other languages is documented; Italian is an authored draft awaiting linguistic
review. M8A.7 is not complete or ready for final visual acceptance.

## 8B. Real production deployment — deferred

Requires separate authorization for the server checkout, actual hostname/runtime
secrets, existing `prod-frontend`, NPM/TLS, migrations/startup, backups/restores and
production E2E. No production server or NPM changes occur in 8A. Persistent state
remains repository-root `dockerdata/` with bind mounts only.
