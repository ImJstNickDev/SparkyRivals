# SparkyRivals production storage policy

This is a constraint for future deployment work, recorded in milestone 1.
No production stack was deployed or redesigned by this milestone. The laptop
checkout `/home/nico/code/forks/sparkyrivals` is for development. Production runs
from a **separate checkout on the server**; never bake the laptop path into it.

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
│   └── backups/
├── SparkyFitnessServer/
└── SparkyFitnessFrontend/
```

Add a documented subdirectory for each future stateful service (for example
provider token storage). Do not assume optional integrations are stateless;
audit their write paths before enabling them. Ephemeral caches can remain ephemeral
only when loss of their contents is safe and intentional.

## Existing upstream mount interfaces

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

A future root-level Compose/override may use `./dockerdata/...` when its project
base is the repository root. Explicitly verify the resolved sources with
`docker compose config` and container mounts after startup; `--project-directory`
and multiple Compose files affect path resolution. Do not paste root-relative
examples into a Compose file under `docker/` without checking the resulting paths.
Do not run `compose up` until image identities, runtime secrets and permissions
have been reviewed for the production host.

Upstream defaults stay unchanged for upstream deployments. These path values are
required in the future SparkyRivals deployment configuration. Keep the PostgreSQL
18 mount destination above; do not blindly replace it with an older image's
`/var/lib/postgresql/data` example.

## Ownership and permissions

Before first startup, identify the real container UID/GID for each selected image,
including rootless Docker/user-namespace remapping. Create the directories with
restrictive modes and appropriate owners; verify write access from each service.
Do not infer UID/GID from the laptop user or assume the Compose `PUID`/`GUID` fields
change the official PostgreSQL image's ownership behavior. The current backend
Dockerfile does not declare a non-root `USER`; decide its production permissions
explicitly when deployment is implemented. Avoid world-writable directories and
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
