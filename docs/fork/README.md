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
manual setup. No Challenges, Wear OS app or broad rebrand has been implemented.

GitHub Actions remain **disabled**. Inherited publishing/mutation jobs are now
guarded off in forks; validation enablement is documented, not performed. No store
submission, deployment, paid/cloud build, or upstream account operation occurred.

Production will use a separate server checkout. Persistent state belongs in
repository-root `dockerdata/` through host bind mounts; see the mandatory
[deployment/storage policy](DEPLOYMENT.md). The laptop path is not a production
storage contract.

## Product direction

Start with steps, two participants, and daily/weekly competitions. The server owns
scores and winners, including recalculation after late data or corrections. Build
on existing health ingestion and storage. Leave room for multiple participants,
distance, active time, energy, scoring strategies, recurrence, personal goals,
streaks, and history. Display workouts early; defer workout scoring.

Targets are web, iPhone, Android, the existing native Apple Watch app, and a future
Kotlin/Compose Wear OS companion for Galaxy Watch and other Wear OS devices.

The future experience should be a polished fitness/social app: clear competitors,
lead and gap, today's and total progress, recent activity, remaining time, and
useful history. Use visual progress, restrained motion, native interactions, and
mobile-first layouts. Dense admin tables and Grafana-style dashboards are not the
product direction. See [ARCHITECTURE.md](ARCHITECTURE.md#future-client-experience).

## Working documents

- [Architecture and canonical health data](ARCHITECTURE.md)
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
Upstream instructions remain authoritative for their package conventions. Upstream
contribution approval rules apply when proposing work to upstream; this fork's
milestones are authorized by its maintainer.

Architecture and bootstrap baseline documents describe the pinned audit commit;
owned build documents describe milestone 1. Recheck source and update the assumptions after meaningful merges.
They are repository documentation: `docs/.vitepress/config.mts` builds `docs/src`,
so `docs/fork` is deliberately outside the upstream documentation website.
