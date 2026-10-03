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

## 5. Wear OS companion — implemented; native/device acceptance remains

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
The Wear PR is intentionally unmerged; no credentials or deployment were created.

## 6. Workout integration

Improve read-only recent-workout presentation first. Normalize session grouping,
provider identity, corrected/deleted imports, distance/time units, and duplicate
daily-energy/workout totals. Only then define an optional, versioned workout scoring
strategy with explicit eligibility and tests. Distance, active minutes, and active
energy each need a separately specified canonical metric adapter.

Exit: data semantics and scoring policy are explicit, auditable, and server-owned;
step competitions retain their original rules.

## 7. Polish and expansion

Prioritize based on actual use: reliable notifications/rematches, streak/history,
recurring challenges and personal goals, larger groups, accessible motion,
phone widgets, Apple complications, and Wear tiles/complications. Use existing
notification/widget infrastructure and server projections.

Exit each small increment with focused tests, device/visual checks where relevant,
documented reconciliation semantics, and no unrelated upstream refactoring.
