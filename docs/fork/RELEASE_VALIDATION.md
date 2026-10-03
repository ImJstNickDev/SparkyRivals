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
Repeated clean prebuild produced identical Android metadata and all five Apple
targets; upstream/default clean prebuild and native metadata checks also passed
without a Wear target. Owned production output was restored afterward.
Local Android acceptance advanced from phone/Wear codes 1001 / 1000001001 to
1002 / 1000001002. EAS allocated iOS build 1005 for the corrected internal build;
future distributions must advance/reconcile their respective counters.

No Xcode compilation occurred locally on Linux. The maintainer completed Apple
provisioning for all five targets with team `U5K88Y67DL` and one shared EAS-managed
Distribution Certificate. The non-interactive retry reused those credentials.
Cloud build and physical iPhone / paired Apple Watch acceptance are recorded
separately; provisioning alone is not a native compile/device result.

The first upload attempt hit protected local PostgreSQL files while EAS searched
for nested `.gitignore` files. Root `.easignore` now preserves the root and package
exclusions and prunes `/dockerdata` before traversal; `.gitignore` is unchanged.
EAS CLI 24.10.0 `build:inspect --stage archive` passed while the PostgreSQL data
was still unreadable. Archive inspection verified 392 required shared/native/
workspace source files present, with runtime state, credentials and generated
native projects excluded. Actual EAS ignore checks passed 18 exclusion and 10
required-source assertions. No database permissions were changed.

The retry uploaded successfully and started EAS internal iOS build **1004** from
`bd47a3b9f2b8374941c52c2b0ddfc3d855e3e80f`:
[build 36d8444f-9c5d-4547-b17a-82c75c5b84bf](https://expo.dev/accounts/imjstnickdev/projects/sparkyrivals/builds/36d8444f-9c5d-4547-b17a-82c75c5b84bf).
EAS completed Xcode compilation and ad-hoc IPA export successfully (Xcode 26.6
on the EAS macOS worker). The IPA contains all five bundles with the owned team,
shared App Group, ad-hoc provisioning and shared Distribution Certificate. No
installation or store submission occurred. Inspection caught a version mismatch:
phone `1004`, four children `1`. The resolver now consumes EAS's allocated iOS
build number before prebuild; config tests and simulated EAS prebuild confirm
all five match. Replacement build **1005** completed successfully using the existing credentials:
[aea3b147-8244-4e6c-8030-b92b11e337e7](https://expo.dev/accounts/imjstnickdev/projects/sparkyrivals/builds/aea3b147-8244-4e6c-8030-b92b11e337e7).
Its exported IPA was inspected: all five `CFBundleVersion` values are **1005**,
all bundle IDs, team, App Groups and phone/Watch schemes match the owned identity,
and all five embedded ad-hoc profiles use the same Distribution Certificate.
The Watch points to the production phone bundle. Phone/Watch profiles include
HealthKit and background delivery, their Info.plists retain health purpose
strings, and the Watch retains `workout-processing`. The phone profile uses
the production APNs entitlement; no remote notification service was introduced.
Profile inspection is not an
independent executable-signature trust-chain check. EAS/Xcode performed the
successful compilation, signing and ad-hoc export; no store submission occurred.

The IPA and a non-secret verification report are privately archived under
`~/.local/share/sparkyrivals/artifacts/milestone-8a/ios-1005/`.
IPA SHA-256: `1556b050b548be57196e0443906fa9ce0d044a9d3f6904b255dd253976c14749`.
The maintainer installed build 1005 on the registered physical iPhone and confirmed
that it opens to onboarding. This is a user-observed installation/launch result,
separate from IPA inspection and cloud compilation. Authentication, HealthKit,
widgets and paired Apple Watch behavior are not established by that confirmation.

### Apple Watch installation blocker (2026-10-04)

The maintainer reported “This app could not be installed at this time” on an
Apple Watch Series 7 (GPS), watchOS 26.1 (23S37). IPA inspection confirms both
Watch targets have `MinimumOSVersion=10.0`, WatchOS platform/device-family metadata,
and arm64_32/arm64 executable slices. The OS minimum is not the blocker found here.

Both embedded Watch provisioning profiles contain exactly one allowed device:
the registered **iPhone**, not the Watch. A fresh EAS device listing for the owned
team also contains only that enabled iPhone. Earlier profile checks established
team, capabilities, certificate and nonempty device lists, but did not establish
the presence of the physical Watch's UDID. Successful Xcode export does not
establish install eligibility for that Watch.

Next: obtain the paired Watch UDID privately with the maintainer's physical-device
assistance, register it through the owned provisioning flow, refresh the Watch
app/widget profiles and verify its inclusion in the next exported artifact before
retrying installation. Reusing the existing profiles unchanged cannot fix this
omission. Device registration/Apple authentication remain human-interaction gates.
No certificate rotation, OS update or deployment-target change was performed.

## Android compilation

Actual toolchain: JDK 17.0.20.1 explicitly selected, SDK 36, Build Tools 36.0.0,
AGP 8.12.0, Gradle 9.3.1, Kotlin 2.1.20, NDK 27.1.12297006. Existing dependencies
also require Build Tools 35.0.0 and CMake 3.22.1. Missing components were installed
with the current Android CLI; default Java and unrelated dependencies were unchanged.

Wear debug APK compiled, including Kotlin/Compose/Tile/complication services.
`:wear:testDebugUnitTest`: **34 tests passed** (23 protocol + 11 native surface).
The owned release helper then completed **`:app:assembleRelease`,
`:wear:assembleRelease`, `:wear:testDebugUnitTest`** in 6m 58s (1,350 tasks).
A first phone packaging attempt exhausted the default 2 GB heap; the successful
command uses 4 GB heap, 1 GB metaspace and bounded common-pool parallelism.
No product source changes were needed to compile the native targets.

Both APKs were verified with apksigner and aapt:

| Artifact | Package                      | Version code | APK SHA-256                                                        |
| -------- | ---------------------------- | ------------ | ------------------------------------------------------------------ |
| Phone    | `com.imjstnick.sparkyrivals` | 1001         | `468cb572b9db0c7f61c59457b8e8baea57f51a5fad87ddfe89a7892e0732ce7b` |
| Wear     | `com.imjstnick.sparkyrivals` | 1000001001   | `0ae2e27ee3bfe833fb4b24c3cbd5b2d661d2d6bc16d936d1960889d6cc42fd84` |

Both signer SHA-256 digests exactly equal
`3E:B2:F9:50:8D:15:9C:C1:50:14:1A:9A:57:0D:37:71:24:4F:59:10:59:D0:AE:09:E9:61:28:1E:B6:42:D5:2A`.
The phone's bundled Expo config also passed owned project/package/scheme checks.
Private archived artifacts and verification JSON are at
`~/.local/share/sparkyrivals/artifacts/milestone-8a/1001-1000001001/`.
Neither APK was published. Subsequent physical acceptance is recorded below.
Wear declares no health/sensor permission.
A negative bare-Gradle release dry-run fails with the expected identity guard.

Mobile validate passed; full Jest CI: **506 suites / 7,782 tests passed**.
Focused signing/Wear config checks: **19 passed**. Workflow safety: **3 passed**.
Docs build and local Markdown link/diff checks passed. Existing translation
coverage, deprecated native API and bundle-size warnings remain visible.

Real compilation exposed a runtime-identity hazard: Gradle evaluates Expo Constants
again, so running bare Gradle after an owned prebuild embeds upstream defaults.
The owned release helper now carries the profile through compilation, the Gradle
guard compares resolver/native package identity, and final APK verification checks
bundled `assets/app.config` as well as Android metadata/signature.

Physical Samsung Galaxy A25 (Android 14 / API 34): release 1001 installed
successfully over authorized USB ADB and cold-launched to localized onboarding
in 1.49 seconds. No process crash was observed; Challenge/calorie/macro widget
receivers are registered. No server URL, account credentials or health access
was configured. The first-launch log exposed notification channel creation before
i18n initialization; native startup now waits for the existing language/route
bootstrap. Focused startup tests: **83 passed**. Full mobile validate passed;
full CI: **506 suites / 7,794 tests passed**. Config tests: **195 passed**.
Corrected phone/Wear release builds **1002 / 1000001002** passed in 4m 50s
(1,350 tasks), including **34 Wear JVM tests**. Both retain the exact permanent
certificate and production package. APK SHA-256:

- Phone: `261f0f7b75afd96f9ac5469c56a188e01dae66f6912d80519e2478836577d0a1`.
- Wear: `491550697a4627c64c88c2070f7783cc1a60a426a7245ff0746a2c43f76a840c`.

Artifacts and verification JSON are privately archived in
`~/.local/share/sparkyrivals/artifacts/milestone-8a/1002-1000001002/`.
Phone 1002 updated the connected device without clearing app data. Cold launch
completed in **1.237 seconds**; the app remained foreground on localized onboarding
and its new process log contained no crash or notification-channel initialization
failure. Screenshots/logs remain private. Authentication, actual notification
delivery, health synchronization, widget interaction and Challenge server flows
are not established by this launch check. No emulator was used.

Physical Samsung Galaxy Watch6 (SM-R930, Android 13 / API 33): release
**1000001002** installed successfully over user-paired wireless ADB. The production
package was previously absent; no existing watch app data was deleted. Native
launch completed successfully (3.081-second ADB wait), the process remained alive,
and its log had no fatal exception. Android registers the Data Layer listener,
Challenge Tile and Challenge complication services with their expected binding
permissions. Registration does not prove those surfaces render correctly.

Google Play Services diagnostics on the paired phone and watch show one
SparkyRivals DataItem transfer: **371 bytes written by the phone and read by the
watch**. This establishes real paired transport under the matching package and
certificate. The phone remains unauthenticated; these transfer counters do not
establish payload contents, authenticated Challenge results or account-switch acceptance.
The maintainer confirmed the Watch app works and displays **“Challenges not synced
yet”**, as expected without a phone account. Full scores, offline state, account
transitions, explicit Tile interaction and complication visuals still need acceptance.

## Local production stack — passed

Docker Compose 5.5.1, local Unix socket. Unique project
`sparkyrivals-acceptance-544e5f0e3a2f`, originally retained under repository-root
`dockerdata/`. At the maintainer's request, this exact disposable directory was
removed after matching its acceptance manifest, generated Compose and run log,
and checking all local containers for any remaining mounts. Non-secret acceptance
evidence was preserved privately under `/tmp/sparkyrivals-8a/cleaned-acceptance-evidence/`.
Only this proven test directory was deleted, without chmod/chown; sibling state
and unrelated containers were untouched.

- Both application Dockerfiles built from the current fork checkout. Frontend
  image build included validate and production bundle; only existing chunk-size
  warnings were reported.
- Postgres 18.3, server and frontend became healthy. Normal server initialization
  applied all migrations and RLS, including Steps/Workout Time Challenge schema.
- Container metadata showed **zero host port bindings**, only bind mounts, DB and
  server solely on the internal bridge, frontend also on `prod-frontend`.
- A curl container on **only `prod-frontend`** reached frontend `/`, `/api/health`
  and `/api/auth/get-session` (200); unauthenticated `/api/v2/challenges` returned 401. Backend/database DNS names did not resolve from that network.
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
- Release APK fingerprints, physical phone/Watch installation and initial paired
  Data Layer transfer are verified. Authenticated Challenge results, account-change
  clearing/offline states, Tile/complication visuals, Health Connect continuity,
  notifications and TalkBack remain separate checks.
- Confirm the real production hostname and runtime integration secrets during 8B;
  provision no real server or NPM resources during 8A.
- Follow [deployment handoff](DEPLOYMENT.md) for separate server bootstrap,
  NPM/TLS, backups/restores and production E2E. No production deployment occurred.
