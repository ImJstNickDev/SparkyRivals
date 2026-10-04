# SparkyRivals production deployment preparation

Milestone 8A prepares and tests this stack **locally**. Real server deployment,
NPM/TLS configuration and production data remain Milestone 8B. Production uses a
**separate server checkout**; the laptop path is never embedded in configuration.

## Final root Compose

`compose.yaml` builds both application images from this checkout with the existing
`docker/Dockerfile.backend` and `docker/Dockerfile.frontend`. `pull_policy: build`
requests a build on every `docker compose up -d`, including when images already
exist; unchanged layers remain cached. Docker Compose 5.5.1 is the local acceptance
version. See [Compose pull policy](https://docs.docker.com/reference/compose-file/services/#pull_policy).
The inherited `docker/docker-compose.prod.yml` remains available for upstream users;
it is **not** the SparkyRivals production entrypoint.

```text
Internet -> NPM -> sparkyrivals-frontend:80 -> sparkyrivals-server:3010 -> sparkyrivals-db:5432
            |              |                       |                        |
       prod-frontend -------                       |                        |
                           +---- sparkyrivals-internal (bridge, NAT) --------+
```

Only frontend joins external `prod-frontend`. No service publishes any host port.
The internal Compose network is an ordinary bridge, not `internal: true`, so
backend integrations retain outbound access. Its project-scoped Docker name avoids
collisions between isolated local validation projects. NPM must already own/join
`prod-frontend` in production; bootstrap verifies that network and never creates it.

The existing frontend nginx keeps `/api` (including auth), `/health-data` rewritten
to `/api/health-data`, `/uploads`, streaming `/mcp`, assets and SPA fallback. Docker
DNS resolves `sparkyrivals-server`; the server resolves `sparkyrivals-db`. The small
`docker/sparkyrivals/frontend-entrypoint.sh` wrapper sets forwarded protocol from
the configured canonical frontend origin before invoking the upstream entrypoint.
This preserves HTTPS behind NPM without trusting a visitor-supplied protocol header.
`SPARKY_FITNESS_TRUSTED_PROXY_HOPS=2` represents NPM + frontend nginx; no custom
real-IP header override is needed. Review again if a CDN/tunnel adds another hop.

## One-time bootstrap (execute on production only in Milestone 8B)

Prerequisites: Docker Engine, Compose with `pull_policy: build`, Python 3.9+,
existing `prod-frontend`, a separate fork checkout and an operator-confirmed HTTPS
origin. The script starts no container and contacts no remote server.

```sh
python3 scripts/bootstrap-production.py --url https://YOUR-CONFIRMED-HOST
# Review dockerdata/config/runtime.env, set the initial admin email and optional integrations.
# Then, in the separately authorized deployment:
docker compose config --quiet
docker compose up -d
```

Bootstrap creates private directories, four random runtime secret files and a
mode-0600 runtime env from `docker/sparkyrivals/runtime.env.example`. A relative
root `.env` symlink points to that runtime file for Compose interpolation. Existing
`.env` files, differing origins and existing secrets are never overwritten. Missing
secrets beside an existing database cause an error: restore them, do not rotate
implicitly. Repeated bootstrap with the same configuration preserves all secrets.
No permanent mobile signing material belongs on the server.

The backend alone reads the runtime env file, so existing optional upstream
SMTP/OIDC/provider/admin/rate-limit settings remain available without being sent
to frontend nginx. Existing `*_FILE` secret loading is used. The database receives
only its database name/user/password file. The frontend receives only its origin
and nginx connection settings. Production callbacks include `sparkyrivals`;
server allowlisting continues constructing fixed `scheme://oauth-callback` URLs.
Add dev/preview schemes only if those clients should use this deployment.

No new application runtime environment variable was introduced: the existing
[environment reference](../src/install/environment-variables.md), EnvGenerator,
upstream Compose and Helm interfaces still apply. Build-only EAS/Apple/Android
signing values are deliberately excluded from runtime templates/containers.

## Initialization and upgrades

Postgres health gates backend startup. The existing server `index.ts` initializes
the schema, applies migrations and RLS before listening; there is no alternate
migration mechanism or init SQL copy. Frontend waits for backend `/api/health`.
On upgrades, back up first, `git pull --ff-only`, then `docker compose up -d`.
Review migration compatibility before rollback: reverting an image does not undo
schema changes. Do not change initialized database/user/password settings casually.
Do not jump PostgreSQL major versions by changing the image tag.

## Local acceptance

```sh
python3 scripts/test-production-bootstrap.py
python3 scripts/validate-production-local.py
```

The acceptance command refuses remote Docker endpoints, creates a unique private
subdirectory under `dockerdata/`, and renders the actual production Compose with
only test bind paths/project network naming changed. It builds/starts the stack,
checks health, network membership, bind mounts and absent published ports, then
uses a disposable curl container attached **only** to `prod-frontend` to exercise
frontend/API/auth routes. Backend/DB DNS names must be inaccessible on that network.
A second `up` checks rebuild behavior. It shuts down only its unique Compose
project (never `down -v`). A temporary `prod-frontend` is removed only if the test
created it and it is empty. Existing networks/containers/data remain intact.
Private logs, evidence and test data are retained in the printed directory for
inspection; they are ignored by git and Docker build context.

## Milestone 8B NPM handoff

After explicit production authorization and bootstrap, create an NPM Proxy Host
for the confirmed domain: scheme **http**, forward hostname
**sparkyrivals-frontend**, port **80**. NPM terminates TLS; enable HTTPS redirect and
preserve Host, X-Forwarded-For and X-Forwarded-Proto. No backend/database proxy or
host mapping is needed. Verify auth cookies/callbacks, uploads, `/api/health`,
Challenge privacy, provider egress and client IP/rate limiting end-to-end. Do not
add a CDN/tunnel without recalculating proxy trust. None of these real NPM actions
are performed during 8A.

## Required layout

All persistent SparkyRivals production state uses **host bind mounts** under the
production checkout's repository-root `dockerdata/`. The entire directory is
ignored by git. Use relative source paths; no `/srv` state, Docker named volumes,
`/var/lib/docker/volumes/...` dependencies, or state stored only in writable
container layers.

```text
SparkyRivals/
├── docker/
├── dockerdata/
│   ├── postgres/
│   ├── uploads/
│   ├── backups/
│   ├── config/
│   └── secrets/
├── SparkyFitnessServer/
└── SparkyFitnessFrontend/
```

Add a documented subdirectory for each future stateful service (for example
provider token storage). Do not assume optional integrations are stateless;
audit their write paths before enabling them. Ephemeral caches can remain ephemeral
only when loss of their contents is safe and intentional.

## Upstream compatibility and mount interfaces

Current `docker/docker-compose.prod.yml` already supports bind-mount paths:

| Service / state                    | Existing variable     | Required host directory | Actual container destination       |
| ---------------------------------- | --------------------- | ----------------------- | ---------------------------------- |
| `sparkyfitness-db` (PostgreSQL 18) | `DB_PATH`             | `dockerdata/postgres/`  | `/var/lib/postgresql`              |
| `sparkyfitness-server` uploads     | `SERVER_UPLOADS_PATH` | `dockerdata/uploads/`   | `/app/SparkyFitnessServer/uploads` |
| `sparkyfitness-server` backups     | `SERVER_BACKUP_PATH`  | `dockerdata/backups/`   | `/app/SparkyFitnessServer/backup`  |

For the existing Compose file **inside `docker/`**, paths relative to its directory
would be:

```dotenv
DB_PATH=../dockerdata/postgres
SERVER_UPLOADS_PATH=../dockerdata/uploads
SERVER_BACKUP_PATH=../dockerdata/backups
```

The root-level SparkyRivals Compose uses `./dockerdata/...` relative to the repository root. Explicitly verify the resolved sources with
`docker compose config` and container mounts after startup; `--project-directory`
and multiple Compose files affect path resolution. Do not paste root-relative
examples into a Compose file under `docker/` without checking the resulting paths.
Do not run `compose up` until image identities, runtime secrets and permissions
have been reviewed for the production host.

Upstream defaults stay unchanged for upstream deployments. These path values remain useful only when inspecting the inherited Compose; the root Compose fixes the production paths directly. Keep the PostgreSQL
18 mount destination above; do not blindly replace it with an older image's
`/var/lib/postgresql/data` example.

## Ownership and permissions

Before first startup, identify the real container UID/GID for each selected image,
including rootless Docker/user-namespace remapping. Create the directories with
restrictive modes and appropriate owners; verify write access from each service.
Do not infer UID/GID from the laptop user or assume the Compose `PUID`/`GUID` fields
change the official PostgreSQL image's ownership behavior. The backend currently runs as image-default root; uploads/backups are mounted explicitly,
and their directories start mode 0700. The new Postgres mount root is 0755 so UID 70
can traverse it after the entrypoint drops privileges; enclosing host dockerdata is
0700 and the actual `18/docker` cluster is 0700. Postgres 18 only changes PGDATA
ownership, not the entire mount root. PostgreSQL performs its own transition to
its image postgres UID (70 in the selected Alpine image) and owns its data directory.
Bootstrap does not recursively change existing ownership. The frontend also retains
its upstream image-default root entrypoint and listens on port 80. A future non-root
transition requires testing backup/secret access and is not implied by PUID/GUID. Avoid world-writable directories and
blanket recursive `chmod`/`chown` on an existing database.

## Backup, restore and portability

Backups operate against `dockerdata/`, with an encrypted off-host copy and a tested
restore procedure. Include uploads and provider state as well as the database.
For PostgreSQL, use a consistent logical dump or a supported database backup;
do not copy a live database directory and assume it is recoverable. A filesystem
copy requires an appropriate stopped/consistent database state and compatible
PostgreSQL major version.

The existing server backup interface writes compressed database/uploads archives
under the mounted `dockerdata/backups/`. Keeping backups beside the database helps
visibility but does not protect against host/disk loss; copy them off-host.
Preserve the separately stored runtime encryption/auth secrets required to read
restored application data. Do not commit those secrets with the checkout.

Recovery on another host: clone the repository, install the required container
runtime, restore `dockerdata/` and private configuration, apply deliberately chosen
UID/GID ownership, verify rendered mounts, then start the compatible stack and
check database/auth/uploads. Test this before trusting the deployment. Never
silently initialize an empty database because the bind source points elsewhere.

### Operator backup procedure (Milestone 8B)

Choose a private timestamped directory beneath `dockerdata/backups/operator/`.
Stop frontend and backend to prevent database/uploads changing during the backup;
leave PostgreSQL running for a consistent logical dump. Do this only during an
operator-approved maintenance window. These commands are documentation, not an
8A production operation:

```sh
umask 077
backup_dir="dockerdata/backups/operator/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
docker compose stop sparkyrivals-frontend sparkyrivals-server
docker compose exec -T sparkyrivals-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$backup_dir/database.sql"
docker compose exec -T sparkyrivals-db sh -c 'pg_dumpall -U "$POSTGRES_USER" --globals-only' > "$backup_dir/roles.sql"
# tar may need operator-approved privilege for files written by container UIDs.
tar -czf "$backup_dir/files.tar.gz" -C dockerdata uploads config secrets
git rev-parse HEAD > "$backup_dir/source-sha.txt"
docker compose start sparkyrivals-server sparkyrivals-frontend
```

Check every command's exit status; never call a partial archive a successful backup.
Existing application-generated backup archives under `dockerdata/backups/` should
also be copied off-host as required; avoid recursively archiving the operator dump
into itself. Protect/encrypt the entire backup before copying off-host: database
roles and runtime secrets are sensitive. Keep at least one tested recovery copy
away from the server/disk. Android/Apple signing backups are held separately by the
app owner and are not server runtime data.

Restore first into an isolated host/checkout with compatible PostgreSQL 18 and the
recorded source SHA. Restore config/secrets/uploads, review ownership, bootstrap
without rotating existing secrets, and start **only the DB**. Restore cluster roles
carefully (the bootstrap role already exists), then restore the database dump to an
empty database with `psql -v ON_ERROR_STOP=1`; do not replay a plain dump onto a
populated schema. Verify restored records/constraints/RLS before starting the
backend's normal initializer. Never overwrite a live production database as a
routine restore test. The local acceptance harness tests logical dump/restore into
a second disposable DB with existing cluster roles; cross-host role/UID recovery,
provider credentials and actual off-host retention still require operator acceptance.

## M8A.5 remote push handoff for M8B

Remote push stays disabled by default. Supply the external Expo access token as a
private `dockerdata/secrets/expo_access_token` file, optionally through bootstrap's
`--expo-access-token-file` import. Bootstrap never generates/overwrites that token.
Set `SPARKY_FITNESS_REMOTE_PUSH_ENABLED=true` and
`EXPO_ACCESS_TOKEN_FILE=/run/secrets/expo_access_token` after importing, then validate
bootstrap before startup. No APNs/FCM/signing credential belongs on the server.
Outbound HTTPS to Expo is required. Topology, bind mounts and zero published ports
are unchanged. See [REMOTE_PUSH.md](REMOTE_PUSH.md) for token rotation, backups,
disabling delivery and the non-production acceptance boundary. No M8B action has run.
