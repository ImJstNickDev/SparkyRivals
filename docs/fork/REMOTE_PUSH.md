# Remote Challenge invitations

Milestone 8A.5 is in implementation and acceptance. M8A is merged; M8B remains
explicitly deferred. No real production server or proxy is changed here.

## Delivery and consent

The authenticated phone registers with its current server. New pending Challenge
invitations enqueue a server event, delivered through **Expo Push Service → APNs
(iOS) / FCM V1 (Android)**. Only invitations use remote delivery. Challenge start,
ending-soon, ended and lead-change reminders continue to run locally. Watches keep
using the existing phone WatchConnectivity/Data Layer snapshots; there is no
custom remote Watch transport or new health ingestion.

Registration requires the existing global notifications switch, Challenge master,
invitation switch and OS permission. Challenge master remains off by default. The
headless integration never prompts for permission. Settings use the existing
permission flow. Foreground, preferences, identity transitions and native token
changes reconcile registration; there is no extra Challenge polling loop.
Native token callbacks pass their supplied token to Expo's exchange API. They do
not request another native registration: iOS also emits this callback for an
ordinary token acquisition. Duplicate callbacks are ignored, and an unchanged
Expo token keeps its acknowledged lease instead of writing another registration.

Only the owned production phone identity is push-enabled. Development, preview
and upstream builds retain local notifications. A server must separately enable
`SPARKY_FITNESS_REMOTE_PUSH_ENABLED=true`; otherwise registration reports disabled.

## Credentials and configuration

| Material                      | Custody                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| APNs key                      | Existing EAS-managed main phone credential; no widget/Watch push keys                                           |
| FCM HTTP V1 service account   | Existing EAS credential, never a server runtime file                                                            |
| Firebase client configuration | `SparkyFitnessMobile/firebase/google-services.production.json`; ordinary client metadata, production phone only |
| Expo access token             | Server secret, Enhanced Push Security Bearer authentication                                                     |
| Android signing keystore      | Private release workstation storage, never the server                                                           |

The central identity resolver emits `android.googleServicesFile` only for
`com.imjstnick.sparkyrivals` and owned project
`63f08cec-3f87-4cee-89be-bebf970b6262`. Google Services is not applied to Wear.
No new native dependency or direct APNs/FCM backend sender is introduced.

The backend uses the [documented Expo HTTPS API](https://docs.expo.dev/push-notifications/sending-notifications/)
at a fixed HTTPS origin. Both sends and receipt lookups include Bearer auth.
Enabled configuration without an access token fails startup. There is no
unauthenticated fallback or configurable service URL. Tests inject a transport in
process and never call Expo.

## Registry and account isolation

`PUT /api/v2/push/installation` accepts a random installation UUID, platform, Expo
routing token, random account-binding guard and durable monotonic revision.
`DELETE` accepts only installation, guard and revision. The authenticated actor is
resolved on the server; request user IDs, delegated context and extra fields are
rejected. Responses contain only enabled/expiry or no content, never routing tokens.

The phone stores installation, revision and binding in SecureStore, not
AsyncStorage. It captures the authenticated destination for revocation. Before
logout/server/account credential changes it clears its local guard and attempts
revocation using the old credentials. Session revisions reject obsolete async
work. A later revocation persists a token-free tombstone even if it arrives before
a slow first registration. Newer registration transfers token/installation
ownership transactionally and disables a duplicate token binding.

Raw tokens use the existing server AES-GCM encryption helper and persistent
`SPARKY_FITNESS_API_ENCRYPTION_KEY`. A separate SHA-256 fingerprint provides unique
routing identity. `push_installations`, `push_events` and `push_deliveries` are
Tier 1 system-private infrastructure: ordinary SQL reads/writes are denied even
to the owner. Narrow self-context SECURITY DEFINER functions manage bindings;
only the background system client reads delivery state. Family membership never
grants access to tokens or another user's delivery history.

Leases expire after seven days and renew on eligible foreground observations
(once a day for an unchanged token). Expired/revoked token ciphertext and hashes
are removed. Token-free revision tombstones remain until account deletion, bounded
to 100 installation identities per user; at most 20 can be active. This preserves
replay barriers across restarts. Repeated reinstalls beyond that bound need an
operator review; no automatic unsafe reset is provided.

Offline logout cannot recall a notification already handed to APNs/FCM. Old
registrations expire even when revocation cannot reach the server. Payloads are
generic, foreground presentation and taps reject the old binding, and taps never
switch accounts. Background OS presentation cannot be intercepted reliably; no
private participant, Challenge name or health content is sent in the first place.

## Durable invitation delivery

Migration `20261004060000_remote_push.sql` adds only delivery infrastructure. A
transactional AFTER INSERT trigger on a newly pending participant creates one
logical event per Challenge/invitee and one delivery per currently eligible
installation. Repeated invitations cannot duplicate that logical event. No old
invitation is backfilled when a device opts in later. Invitation creation never
contacts Expo, so provider outage does not invalidate consent/invitation writes.

The existing scheduled-job mechanism runs every 30 seconds when enabled. An
in-process guard plus PostgreSQL session advisory lock serializes replicas.
Batches contain at most 100 messages and receipt lookups at most 1,000 IDs.
Attempts are durable before network IO. Pending work is suppressed if membership
is no longer pending, the Challenge was cancelled/ended, its event is older than
24 hours, or the registration is disabled, expired or belongs to a newer guard.

HTTP/network failures, 429/5xx and message-rate errors use exponential backoff
(30 seconds through one hour), at most eight sends. Receipts start after 15 minutes;
missing/error lookups are bounded to 24 polls or the provider's 24-hour window.
`DeviceNotRegistered` clears only the matching token/binding. Credential failures
are recorded without deleting a valid device. Failed deliveries retain sanitized
error codes; operators must correct credentials/configuration before new sends.
Events/deliveries expire after 30 days. Diagnostics never include request bodies,
provider error text, routing tokens or bearer tokens.

Expo tickets and receipts confirm provider acceptance, not a human reading a
notification. Network ambiguity/crashes around provider acknowledgement mean
exactly-once physical delivery cannot be guaranteed. Logical event uniqueness and
receipt persistence minimize retries; this is not an instant-delivery guarantee.

## Remote/local selection and navigation

An acknowledged, unexpired registration makes remote invitations authoritative.
The local planner still records invitations as observed but emits no immediate
local alert. Failed/unavailable/unregistered push retains the existing fresh-list
local fallback. An acknowledged lease survives a transient renewal failure until
expiry, preventing duplicate local alerts during an offline refresh. The local
reconciler waits for pending registration and rechecks before an immediate alert.
All other local schedules, ledgers and permission behavior remain intact.

The remote body is always generic: “You have a new Challenge invitation.” Data is
strictly `{ type, challengeId, eventId, accountGuard }`. No supplied URL is trusted.
The phone constructs its variant-aware Challenge link after validating the binding
and checks the active authenticated profile with the existing guarded link path.
Malformed, stale-account or disabled-consent taps fail closed without membership
mutation. Routing IDs and guards are not credentials.

## M8B secret handoff (not executed)

1. Keep the existing repository-root `dockerdata/` bind layout and external
   `prod-frontend` network. Backend/DB remain off the proxy network, with zero
   published ports and normal backend outbound Internet access.
2. Supply the external Expo token privately at `dockerdata/secrets/expo_access_token`
   with mode 0600. Bootstrap optionally imports `--expo-access-token-file /private/path`;
   it never generates, prints or overwrites this external credential.
3. Set `SPARKY_FITNESS_REMOTE_PUSH_ENABLED=true` and
   `EXPO_ACCESS_TOKEN_FILE=/run/secrets/expo_access_token` in the private runtime env.
   Run bootstrap validation before startup. The existing secrets-directory bind
   exposes the file only to the backend. Helm uses an explicitly named existing
   Secret and key; upstream Compose can use its established environment/secret mounts.
4. Keep HTTPS for device registration. Permit outbound HTTPS to Expo Push API.
   Do not copy APNs, Firebase service-account or Android signing keys to the server.
5. Back up PostgreSQL and the encryption key/runtime secrets securely using the
   existing deployment procedure. Registry backups contain encrypted routing data;
   protect retention and restore them only with the matching encryption key.
6. To rotate the Expo token, authorize rotation in Expo separately, replace the
   private file atomically with mode 0600, restart backend, verify a private test
   invitation/receipt, then revoke the previous token. Never rotate the DB encryption
   key as a push-token repair.
7. To stop remote delivery, set the gate false and restart backend. Local clients
   discover disabled registration on the next registration/lease renewal (up to
   one day for an unchanged, locally acknowledged lease). Queued
   deliveries remain bounded by their 24-hour age and eligibility checks. Disabling
   does not recall notifications already accepted by Expo/APNs/FCM.

## Validation and physical acceptance

Unit/integration transports are mocked. Disposable PostgreSQL tests exercise
migration, RLS, encrypted registration, transfer/revoke races, event uniqueness,
multiple devices, ineligibility, retries and receipts. Mobile tests exercise secure
registration, consent, current project identity, local fallback and guarded links.
Production and non-production prebuilds must remain valid.

Native release builds passed; real push acceptance is **pending**. Do not mark 8A.5 complete
until the release evidence is recorded in [RELEASE_VALIDATION.md](RELEASE_VALIDATION.md).
Use only a disposable test server/database. Device installation, test-account
login, permissions and a public tunnel require maintainer interaction. Record
background delivery on iPhone and Android, generic content, tap destination, no
local duplicate, disable/re-enable, logout/account barriers, and a private
unauthenticated Expo rejection followed by authenticated success. Never print
access/routing tokens or include device identifiers in public PR evidence.

Broader M8A authenticated health/watch/surface QA remains explicitly outstanding.
M8B, remote start/end/lead scheduling, direct Watch push, remote scoring and any
new notification category are outside this milestone.
