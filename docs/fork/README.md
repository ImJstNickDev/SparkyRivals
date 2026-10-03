# SparkyRivals

SparkyRivals is a long-lived personal, non-commercial derivative of
[CodeWithCJ/SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness). It will add
fitness challenges and social competition while preserving upstream capabilities
and making frequent upstream merges practical.

## Repository identity

| Item                   | Value                                          |
| ---------------------- | ---------------------------------------------- |
| Public GitHub fork     | <https://github.com/ImJstNickDev/SparkyRivals> |
| Local checkout         | `/home/nico/code/forks/sparkyrivals`           |
| Default branch         | `main`, tracking `origin/main`                 |
| `origin`               | `git@github.com:ImJstNickDev/SparkyRivals.git` |
| `upstream`             | `git@github.com:CodeWithCJ/SparkyFitness.git`  |
| Bootstrap upstream SHA | `f8df11ac3b019d022d3fa4a1b39c1b2f8576d361`     |
| Audit dates            | 2026-10-02 to 2026-10-03 (Europe/Rome)         |

The checkout contains full upstream history. Local `remote.pushDefault=origin`
and the `gh` default repository both point at the fork. These settings are local;
repeat them in a new clone using [UPSTREAM.md](UPSTREAM.md).

The upstream [LICENSE](../../LICENSE), copyright notice, and attribution remain
intact. Its custom non-commercial terms apply to this derivative and must travel
with distributed copies. A public fork is not a commercial-use permission.
Upstream product names, package paths, credits, and release history remain in place.

## Current phase

Milestone 0 is complete. [Own the Build](OWN_THE_BUILD.md) implements generic owned
identities, secure callback configuration, release signing guards and reproducible
native generation. See [BUILDING.md](BUILDING.md) for actual configuration and
[BUILD_VALIDATION.md](BUILD_VALIDATION.md) for evidence and untested boundaries.
Accounts, permanent signing credentials and signed/device build acceptance remain
manual setup. Milestone 1 merged as PR #1 (`14ff6ea3096138fd9f6ef12daf0188007dd09e3c`).
Milestone 2 merged as PR #2 (`eff06b7b6e522145e037f4ce08a7e5d732a4fbb1`).
The controlled upstream [sync PR #3](https://github.com/ImJstNickDev/SparkyRivals/pull/3)
merged at `747280650d58fcfde1617a12eab04b829eb3bff2`. Milestone 3
[web and mobile Challenges](CHALLENGE_UI.md) merged as PR #4 at
`b333a116724e8c0899a8a036ae1a1ad29e4d2d42`. Milestone 4 implements the
[read-only Apple Watch Challenge page](APPLE_WATCH_CHALLENGES.md), merged as PR #5
at `e52c89b1314927309d42a351da8f509f44970ec5`. Native Apple compile/device/visual
acceptance is still pending. Milestone 5 implements the
[Wear OS/Galaxy Watch companion](WEAR_OS_CHALLENGES.md), with durable Data Layer
state and prebuild-safe native sources. PR #6 merged at
`a132e3f8ca6fd8a449cf17b8c5b7ee3d9b66713d`; Android/Compose compilation and paired
hardware acceptance remain outstanding. Milestone 6 adds
[Workout Time Challenges](WORKOUT_CHALLENGES.md) across server and clients, merged
as PR #7 at `e2fee2726ebae4a751da7c992da694efaeb0713e`. See [validation evidence](WORKOUT_VALIDATION.md).

GitHub Actions remain **disabled**. Inherited publishing/mutation jobs are now
guarded off in forks; validation enablement is documented, not performed. No store
submission, deployment, paid/cloud build, or upstream account operation occurred.

Production will use a separate server checkout. Persistent state belongs in
repository-root `dockerdata/` through host bind mounts; see the mandatory
[deployment/storage policy](DEPLOYMENT.md). The laptop path is not a production
storage contract.

## Product direction

Start with steps and daily/weekly competitions, usually 1v1; the backend supports
up to 100 consented participants. The server owns
scores and winners, including recalculation after late data or corrections. Build
on existing health ingestion and storage. Leave room for multiple participants,
distance, active time, energy, scoring strategies, recurrence, personal goals,
streaks, and history. Workout Time now ranks canonical qualifying duration; calories
and blended scoring remain outside the product scope.

Targets are web, iPhone, Android, the existing native Apple Watch app, and the
Kotlin/Compose Wear OS companion for Galaxy Watch and other Wear OS devices.

The future experience should be a polished fitness/social app: clear competitors,
lead and gap, today's and total progress, recent activity, remaining time, and
useful history. Use visual progress, restrained motion, native interactions, and
mobile-first layouts. Dense admin tables and Grafana-style dashboards are not the
product direction. See [ARCHITECTURE.md](ARCHITECTURE.md#future-client-experience).

## Working documents

- [Architecture and canonical health data](ARCHITECTURE.md)
- [Challenge backend contracts and semantics](CHALLENGES.md)
- [Milestone 2 validation](CHALLENGE_VALIDATION.md)
- [Challenge UI architecture](CHALLENGE_UI.md)
- [Apple Watch Challenge architecture and validation](APPLE_WATCH_CHALLENGES.md)
- [Wear OS/Galaxy Watch architecture and validation](WEAR_OS_CHALLENGES.md)
- [Milestone 3 validation](CHALLENGE_UI_VALIDATION.md)
- [Controlled upstream synchronization](UPSTREAM_SYNC_2026-10-03.md)
- [Upstream integration workflow](UPSTREAM.md)
- [Identifier and signing inventory](IDENTIFIERS.md)
- [Baseline validation and limitations](BASELINE.md)
- [Milestone roadmap](ROADMAP.md)
- [Own the Build implementation status](OWN_THE_BUILD.md)
- [Owned build guide and credential recovery](BUILDING.md)
- [Milestone 1 validation](BUILD_VALIDATION.md)
- [Production deployment/storage policy](DEPLOYMENT.md)

Read the root and applicable package `AGENTS.md` before editing. The root guide has
a small delimited fork section so agents working anywhere discover this area.
Upstream instructions remain authoritative for their package conventions. Upstream is strictly read-only: no pushes, PRs, issues, comments, reviews or other
writes. All GitHub writes target `ImJstNickDev/SparkyRivals` explicitly. The local
upstream push URL is disabled; repeat that guard in every clone (see UPSTREAM.md).

Architecture and bootstrap baseline documents describe the pinned audit commit;
owned build documents describe milestone 1. Recheck source and update the assumptions after meaningful merges.
They are repository documentation: `docs/.vitepress/config.mts` builds `docs/src`,
so `docs/fork` is deliberately outside the upstream documentation website.

### Milestone 7

[Challenge polish](CHALLENGE_POLISH.md) adds editable Rematch, local notifications,
phone widgets and read-only watch surfaces. [Validation](POLISH_VALIDATION.md)
separates Linux evidence from outstanding native/device acceptance. PR #7 is merged;
Milestone 7 remains on its review branch until explicitly approved for merge.
