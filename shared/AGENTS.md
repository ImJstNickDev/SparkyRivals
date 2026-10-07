# AGENTS.md

*Last updated: 2026-10-06*

`@workspace/shared` is a source-first TypeScript workspace library package for schemas, constants, and timezone/day helpers consumed by SparkyFitnessServer, SparkyFitnessFrontend, and SparkyFitnessMobile.

## Scope

- This package defines contracts and shared logic, not an app.
- Validate changes from consuming packages (server, frontend, mobile), not in isolation.
- Every schema change here potentially touches three packages.

## Structure

- `src/schemas/database/` - one Zod file per table (`Foods.zod.ts`, `Exercises.zod.ts`, ~60 files). Agent shortcut: to learn a table shape, read the matching file here instead of the SQL dump.
- `src/schemas/api/` - API request/response contracts (`*api.zod.ts`).
- `src/schemas/api/Challenges.api.zod.ts` — server-authoritative SparkyRivals
  competition contracts; `Challenges.zod.ts` and `ChallengeParticipants.zod.ts`
  mirror the database. Clients must consume server scores, never decide winners.
- `src/challenges/client.ts` - narrow existing Family & Friends relationship
  projection and invite-picker eligibility, shared by web/mobile. The server
  remains the invitation authority; this is not a user directory or scoring engine.
- `src/constants/` - shared constants and enums (exercises, nutrients, meal types, fasting protocols, medication schedules, cycle phases, etc.).
- `src/utils/` - timezone helpers (`todayInZone`, `instantToDay`, `dayToUtcRange`, `compareDays`, `addDays`, `isDayString`), cycle/menstruation helpers, and unit/calculation utilities.
- `src/ai/`, `src/cycle/`, `src/medications/`, `src/mood/` - domain-specific helpers.
- `src/symptoms/` - generic symptom tracking: constants and enums (scales, templates, sections, option kinds), template section resolution (`resolveSections`), built-in symptoms and pick-lists, head/body region ids for the location maps, and custom-field validation. The API contract is `src/schemas/api/Symptoms.api.zod.ts`.

## Naming Convention

- `X.api.zod.ts` = API request/response schema
- `X.zod.ts` = database table schema
- Export everything from `src/index.ts`; consuming packages import both types and values via `@workspace/shared`

## Cross-Package Contract Rules

- Changes to `src/schemas/api/` usually affect server routes and both frontend/mobile API clients.
- Changes to `src/schemas/database/` require a matching migration in the server (`SparkyFitnessServer/db/migrations/`) and RLS policies. CI owns the schema backup; never edit it manually.
- Timezone/day-string helpers prevent bugs; prefer them over `toISOString().split('T')[0]`.
- Test any shared change from the consumer packages (`pnpm run validate` in SparkyFitnessServer, SparkyFitnessFrontend, and SparkyFitnessMobile after modifying shared).

## Working Rules

- Keep this package export-focused and schema-focused; logic that scales should live in consuming packages.
- Never export stale or unfinished types; if a consumer is drafting code and needs a type not yet here, add it.

## Workout Time source map

- `src/challenges/duration.ts` formats integer seconds without scoring; Challenge
  result v1 Steps compatibility and v2 workout units/counts are described in
  `../docs/fork/WORKOUT_CHALLENGES.md`. Validate all consumers after edits.
- `src/challenges/rematch.ts` prepares a calendar-safe editable creation draft,
  intersecting former accepted members with current invite eligibility. It never
  creates a Challenge or transfers consent; see `../docs/fork/CHALLENGE_POLISH.md`.

## Remote push contracts

`Push.api.zod.ts` contains strict self-registration/revocation and minimal remote
invitation metadata. `PushInstallations`, `PushEvents` and `PushDeliveries` mirror
system-private infrastructure tables; they are not token read APIs. Never add
scores, health records, participant identity or remote URLs to notification data.

## M8A.6 Challenge domain source map

`src/challenges/types.ts` owns the Challenge combination matrix, target precision and personal-goal suggestion mapping. `format.ts` formats canonical client values; `Challenges.api.zod.ts` validates legacy v1/v2 and negotiated v3 results. Keep metric units separate from score units and preserve null dates for unactivated lobbies. See `docs/fork/CHALLENGE_TYPES.md`.

## M8A.7 presentation source map

`src/challenges/presentation/` owns localized labels, display units, deterministic
point precision, calendar ranges, freshness and daily presence descriptions. It
accepts the caller's translator/locale; never import a second i18next instance or
React state here. Presentation must retain server ranks, ties and exact scores.
`targetDraft.ts` coordinates acknowledged target-save/Ready revisions with actor
guards; it does not change activation rules. `utils/numericInput.ts` separates
locale-aware user input from API numbers. Validate these through all consumers.
