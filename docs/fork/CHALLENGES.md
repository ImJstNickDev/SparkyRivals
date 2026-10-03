# SparkyRivals Challenge backend

Milestone 2 adds a private, consent-based competition domain. The server owns
Challenge state and scoring. Existing SparkyFitness check-ins remain the only
canonical daily step store. No UI, separate ingestion path, health-history copy,
background scoring job, cache or permanent winner is introduced.

## Schema and consent

`challenges` stores creator, name, `metric=steps`, `scoring_mode=sum`, inclusive
start/end DATEs, an IANA timezone, cancellation and audit timestamps.
`challenge_participants` has a composite `(challenge_id, user_id)` primary key,
inviter, status and invitation/acceptance/decline/leave/audit timestamps.

Bounds: 1–100 characters for a trimmed name; 1–366 calendar days; creation starts
today or within the next 366 days; at most 100 total membership rows. The creator
is automatically accepted in the same transaction. Initial invitations are atomic
with creation. A duplicate membership is a conflict, including after decline or
leave. There is no re-invite/reset in v1; create another Challenge instead.

Invitations reference an existing user ID from Family & Friends, never an email
search or directory. The relationship must be active (`is_active`, `status=active`),
already started and unexpired, in either direction. No health permission is needed
on that relationship. Only the creator invites. The target separately consents.
Removing the family relationship blocks new invitations but does not undo existing
Challenge consent; participants can leave to revoke it.

All operations require the actor's own context. Caregiver/delegated access is not
Challenge membership. Pending invitees see the rules and their own invitation,
without peer scores or roster. Accepted participants see accepted peers; the
creator sees all invitation states. Display identity is user ID and profile display
name (fallback `Participant`), without email, credentials or unrelated profile data.

Only the invitee can accept/decline a pending invitation. Acceptance closes after
completion/cancellation; decline remains available. An accepted noncreator can
leave at any time, including after completion, revoking their step sharing and
Challenge access. The creator cancels instead of leaving. Declined/left users
cannot reopen their membership. Account deletion cascades its membership; deleting
the creator deletes the Challenge. No application DELETE endpoint/policy exists.

## Rules and lifecycle

Rules/dates/timezone/creator are immutable so consent cannot be changed afterward.
Only the creator may rename an upcoming Challenge or cancel an upcoming/active one.
Cancellation is irreversible and stops step sharing. Lifecycle is derived:
`cancelled` takes precedence; otherwise before start is `upcoming`, start through
end inclusive is `active`, and after end is `completed` in the Challenge timezone.

RLS uses `challenge_actor`, `challenge_membership` and `owns_challenge`, with fixed
search paths and narrow definer helpers to avoid recursive policies. Triggers
validate state transitions and immutable fields even through direct application
SQL; membership changes lock their parent to serialize invitation capacity and
cancellation races. `challenge_roster` projects only authorized membership rows
and display names. Ordinary profile, check-in and diary RLS remain unchanged.

See [database security tiers](../src/developer/database-security-tiers.md) and
[sharing behavior](../src/features/family-friends-sharing.md).
