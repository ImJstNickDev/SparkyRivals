# Milestone 8A release acceptance

Work in progress on the development laptop. This record distinguishes source,
configuration, real binary and physical-device evidence. Milestone 8B is not run.

## Repository baseline

- PR #8 merged normally into the fork: `02d6ab39a98e912c8c60052575fa95950da1d7be`.
- Frozen upstream: `e132d4b0192cf474728920e17cbcdbc9f5058d1c`.
- Fork sync PR #9 merged normally: `5891bf15d134744117d90505bbe3029fb104d08c`.
- See [sync evidence](UPSTREAM_SYNC_e132d4b01.md) for full server/frontend/mobile,
  disposable DB and migration validation. Main was 60 ahead / 0 behind that snapshot.
- Upstream push URL remains disabled. No upstream GitHub/git writes occurred.
- Branch: `milestone/productionization-release-engineering`. Actions remain disabled.

## Owned identity and Apple metadata

EAS CLI 24.10.0 authenticated as `imjstnick`, owner of organization `imjstnickdev`.
`project:info` verified `@imjstnickdev/sparkyrivals`, project UUID
`63f08cec-3f87-4cee-89be-bebf970b6262`. Device listing verified one enabled iPhone
under team `U5K88Y67DL`; device identifiers are not committed. Paid membership was
confirmed by the maintainer. No enrollment or new EAS project is needed.

Owned clean production-internal prebuild generated both platforms; native metadata
validation passed. Public config exposes the owned project/owner/team. All five
Apple bundles/groups and four EAS extension declarations are coherent.
Phone build number 1001 and Wear code 1000001001 are the local acceptance allocation;
future distributions must advance/reconcile their respective counters.

No Xcode compilation occurred locally on Linux. EAS provisioning/build and iPhone /
paired Apple Watch installation remain pending until explicitly recorded below.

## Android compilation

Actual toolchain: JDK 17.0.20.1 explicitly selected, SDK 36, Build Tools 36.0.0,
AGP 8.12.0, Gradle 9.3.1, Kotlin 2.1.20, NDK 27.1.12297006. Existing dependencies
also require Build Tools 35.0.0 and CMake 3.22.1. Missing components were installed
with the current Android CLI; default Java and unrelated dependencies were unchanged.

Wear debug APK compiled, including Kotlin/Compose/Tile/complication services.
`:wear:testDebugUnitTest`: **34 tests passed** (23 protocol + 11 native surface).
Phone/Wear release build and permanent signer acceptance remain in progress.

Real compilation exposed a runtime-identity hazard: Gradle evaluates Expo Constants
again, so running bare Gradle after an owned prebuild embeds upstream defaults.
The owned release helper now carries the profile through compilation, the Gradle
guard compares resolver/native package identity, and final APK verification checks
bundled `assets/app.config` as well as Android metadata/signature.

No emulator, physical Android phone or Galaxy Watch acceptance has been performed.

## Local production stack — passed

Docker Compose 5.5.1, local Unix socket. Unique project
`sparkyrivals-acceptance-544e5f0e3a2f`; private evidence retained beneath that
repository-root `dockerdata/` subdirectory, ignored by git and build context.

- Both application Dockerfiles built from the current fork checkout. Frontend
  image build included validate and production bundle; only existing chunk-size
  warnings were reported.
- Postgres 18.3, server and frontend became healthy. Normal server initialization
  applied all migrations and RLS, including Steps/Workout Time Challenge schema.
- Container metadata showed **zero host port bindings**, only bind mounts, DB and
  server solely on the internal bridge, frontend also on `prod-frontend`.
- A curl container on **only `prod-frontend`** reached frontend `/`, `/api/health`
  and `/api/auth/get-session` (200); unauthenticated `/api/v2/challenges` returned
  401. Backend/database DNS names did not resolve from that network.
- Plain logical dump restored into a second disposable database; a persisted probe
  row survived. This is not a claim of cross-host/off-site disaster recovery.
- A second `docker compose up -d --wait` rebuilt via `pull_policy: build` and
  retained healthy existing data. No custom migration mechanism was used.
- Test containers and internal network were removed without `down -v`. The
  temporary `prod-frontend` created by the test was removed after checking it was
  empty. The unrelated pre-existing container was left running.
- First run caught Postgres mount-root traversal permissions; bootstrap now gives
  a **new** mount root 0755 while enclosing `dockerdata` and actual PGDATA stay
  private. Existing directories are never recursively chmod/chowned.
- Bootstrap unit tests: **7 passed**. APK verification unit tests: **6 passed**.

## Remaining human/native boundaries

- Apple EAS credential/provisioning authentication, if requested, must be completed
  by the maintainer locally. Never paste Apple passwords/2FA into chat.
- Install and launch the internal iPhone build; check auth, HealthKit, widgets,
  notifications, Watch app/complications, paired transport and VoiceOver.
- Verify release APK fingerprints, then user-assisted Android/Galaxy Watch install,
  matching-package Data Layer, account-clear/offline states, Tile/complication,
  Health Connect continuity, notifications and TalkBack.
- Confirm the real production hostname and runtime integration secrets during 8B;
  provision no real server or NPM resources during 8A.
- Follow [deployment handoff](DEPLOYMENT.md) for separate server bootstrap,
  NPM/TLS, backups/restores and production E2E. No production deployment occurred.
