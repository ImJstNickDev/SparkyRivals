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

## 1. Own the Build — implementation ready for review

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

## 2. Challenge backend

Start with daily/weekly steps, two participants, invitation/acceptance, ties,
progress, and history. Model participants as rows for future N-person support.
Resolve period/timezone, missing data, manual edits, and max-wins correction limits
before implementation. Add challenge tables, shared schemas, services/repositories,
typed routes, participant-aware RLS, and server scoring/reconciliation through the
existing scheduler. Keep projections rebuildable and versioned.

Exit: tested owner/invitee/outsider/delegate access; deterministic daily/weekly scores;
late, lowered, and deleted canonical totals trigger correct recalculation; restart
and retry are idempotent. Test fresh migrations and upgrades, and update upstream
table/security/sharing documentation through its migration checklist.

## 3. Web and mobile Challenge UI

Add feature routes/screens and a clear overview using existing design systems,
navigation, query keys, and localization. Show competitors, lead/gap, today/period
progress, recent activity, remaining time, and freshness. Include invitation,
empty/offline/tied/completed states. Display existing workouts read-only if useful;
do not attach workout points yet.

Exit: responsive web, iPhone, and Android agree on server result revisions and
remain usable across themes, text sizes, account switches, and interrupted sync.

## 4. Apple Watch Challenge page

Add a SwiftUI page to `WatchPage` and phone page settings. Extend the composed
WatchConnectivity context with an optional versioned server projection; keep one
application-context publisher. Add freshness/account clearing and compatible
decoding. Preserve workout/session transport and existing page ordering.

Exit: old/missing payloads degrade cleanly, reconnect refreshes, account switches
do not show the previous user's challenge, and paired-device checks pass.

## 5. Wear OS companion

Add tracked Kotlin/Compose source outside generated Android directories, a small
phone bridge, and a compatible server-backed display contract. Verify shared
phone/Watch application ID and signing identity for Data Layer. Evaluate direct
server reads versus constrained phone relay before expanding functionality.
Continue Samsung Health → Health Connect → phone → existing server ingestion.

Exit: glanceable competition state on Galaxy Watch/Wear OS with reconnect, stale
state, logout, and phone-unavailable behavior. No new health collection pipeline.

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
