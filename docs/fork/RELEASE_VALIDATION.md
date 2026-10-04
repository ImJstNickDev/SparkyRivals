# Milestone 8A release acceptance

Milestone 8A release-engineering acceptance completed on the development laptop
on 2026-10-04. This record distinguishes source, configuration, real binary and
physical-device evidence. Broader functional QA remains explicitly listed below;
Milestone 8B is deferred and has not run. PR #10 merged normally as `0bd2420d3deebbc11c84afe76676799b8d87e3dc`.

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

### Apple Watch installation diagnosis and profile recovery (2026-10-04)

The maintainer reported “This app could not be installed at this time” on an
Apple Watch Series 7 (GPS), watchOS 26.1 (23S37). IPA inspection confirms both
Watch targets have `MinimumOSVersion=10.0`, WatchOS platform/device-family metadata,
and arm64_32/arm64 executable slices. The OS minimum is not the blocker found here.

Both original embedded Watch provisioning profiles contained exactly one allowed
device: the registered **iPhone**, not the Watch. The EAS device listing for the
owned team also contained only that enabled iPhone. Earlier profile checks established
team, capabilities, certificate and nonempty device lists, but did not establish
the presence of the physical Watch's UDID. Successful Xcode export does not
establish install eligibility for that Watch.

The maintainer installed the missing Arch `usbmuxd` daemon and approved USB pairing.
A read-only companion-registry query through the installed libimobiledevice library
retrieved the paired Watch UDID privately and confirmed the omission. The maintainer
registered that device with EAS, completed Apple authentication and interactively
selected both devices for all five profiles, retaining the existing certificate.
Push notification setup was declined without saving a new preference.

EAS re-signed the existing build 1005 successfully:
[3be0adb6-2aa2-4ae1-b57d-415ef7a88965](https://expo.dev/accounts/imjstnickdev/projects/sparkyrivals/builds/3be0adb6-2aa2-4ae1-b57d-415ef7a88965).
Direct inspection of the new IPA confirms **both physical device IDs in all five
profiles**, the same Distribution Certificate, team and App Groups, unchanged
Info.plists and build 1005 throughout. This was a re-sign, not a new compilation.
Correcting profile membership required no certificate rotation, OS update or
deployment-target change.

The artifact and non-secret verification JSON are private under
`~/.local/share/sparkyrivals/artifacts/milestone-8a/ios-1005-watch-resigned/`.
IPA SHA-256: `2feac1d5a5a956b61f8ac96940f7962613277628baa0524ac8399d859900b6e3`.
The maintainer retried installation: the earlier error dialog disappeared, but
the Watch install spinner eventually stopped without installing the app. A fresh
USB log capture reproduced the failure on iPhone iOS **26.5 (23F77)**. At 00:27:44
Europe/Rome the phone prepared the embedded Watch app and requested its transfer
socket; at 00:28:48 that connection timed out. `appconduitd` reports
`ACXErrorDomain Code=8` / `Failed to create socket`, with underlying
`com.apple.identityservices.error Code=20` / `Socket open timed out`.
This attempt fails in the phone-to-Watch transport before transferring the app;
it does not establish a Watch-side signature rejection. Installed iPhone metadata
confirms build 1005 and a validated profile.

The error matches an [Apple Developer Forums report](https://developer.apple.com/forums/thread/827053)
in which Apple DTS identifies a likely known regression. Participants report
recovery after OS updates and mixed results from toggling Bluetooth on both
devices. That is supporting evidence, not proof of a fix on this device pair.
After requesting Bluetooth reconnection on both devices, the capture shows a
connection reunion and a second install attempt from 00:30:48 to 00:31:52. It fails
with the same two error codes and timeout before transfer. At that point, no OS
update had been performed. No app data, pairing, certificate or provisioning
resources were reset. Raw logs
remain private under `/tmp/sparkyrivals-8a/`. At that point physical Watch installation
and launch remained outstanding; corrected profiles alone were not a device-test result.

The maintainer also successfully installed Flightradar on the same Watch. This
rules out a blanket inability to install apps, but is not a controlled comparison
with this ad-hoc package: App Store and ad-hoc distribution differ. The forum
report also describes other apps installing successfully. The captured timeout is
confirmed; attributing its root cause to an OS regression remains a hypothesis,
and a SparkyRivals-specific problem has not been conclusively excluded.

An additional offline audit of the re-signed IPA checked both arm64_32/arm64 slices
of the Watch app and complication: **four slices, 179 code-page hashes**, signed
Info.plist/resource-directory/requirements/XML and DER entitlement slot hashes,
resource seal entries, and the CMS signatures over their code directories all
passed. Each executable signer belongs to its embedded profile's allowed
certificates, every signed entitlement is permitted by that profile, and the
Watch UDID is present. No mismatch was found in these checks. OpenSSL CMS checks
used `-noverify`: they verify cryptographic signatures, not Apple's certificate
trust/revocation policy or watchOS installation acceptance. This is a targeted
Linux artifact inspection, not a replacement for macOS `codesign --verify` or a
successful physical installation. The private report is
`ios-1005-watch-resigned/watch-signature-audit.json` alongside the IPA above.

#### Retry after the iPhone update

The maintainer updated the iPhone to **iOS 26.7.1 (23H30)**; USB metadata confirmed
the version and pairing remained valid. With the Watch still on the reported
watchOS 26.1, the next installation attempt made further progress:

- At 01:22:17 Europe/Rome the phone requested the installation socket.
- At 01:22:22 the log recorded `Opened socket` with `Success: YES`,
  `Socket setup successful`, and `Sending Hello` for the owned Watch bundle.
- At 01:23:06 the connection closed during the initial exchange:
  `ACXErrorDomain Code=4` / `Socket closed with 5 bytes remaining to read`.
- The phone reported installation failure and an empty installation queue.

The previous socket-opening timeout did not recur in this attempt, but physical
installation still failed. The logs do not explain why the established connection
closed and do not prove Watch-side signature acceptance. No replacement build or
credential change was made for this retry. A watchOS 26.6 update was proposed,
but the following attempts took place without that update. The private capture is
`/tmp/sparkyrivals-8a/watch-install-ios-26.7.1-5LcITr.log`.

#### Subsequent storage-labelled refusal

Without updating watchOS, the maintainer reported an insufficient-storage alert
despite Settings showing approximately **13 GB available** on the Watch. A fresh
capture reproduced it twice, at 01:29:40 and 01:30:16 Europe/Rome: the socket opens,
the phone sends `Hello`, and the Watch immediately returns
`ACXErrorDomain Code=12` / `Got error 12 in hello response from remote side`.
The same capture shows that the phone maps this to
`ACXUserPresentableErrorDomain Code=2` and the insufficient-storage alert.

The exported Watch app including its complication totals **3,132,465 bytes
uncompressed**; the complete phone IPA is 34,056,081 bytes. The captured logs do
not expose required/available-byte values from the Watch's installer. Consequently
neither genuinely exhausted Watch storage nor a faulty capacity check is proven.
No user data was deleted. The maintainer restarted the Watch normally and retried
without updating watchOS or replacing the build. At 01:34:10 the phone transferred
a **37,632-byte placeholder**; at 01:34:15 it received `Got install done`, explicitly
followed by `Finished placeholder install ... enqueueing actual install`. This is
not a completed app installation. The actual app phase (`p = N`) returned the same
remote error 12 at 01:34:44. Another attempt at 01:35:15 was also refused with the
same error. That captured restart/retry did not resolve full-app installation;
the underlying installer capacity check remains unexplained. Private capture:
`/tmp/sparkyrivals-8a/watch-install-storage-jDO0IT.log`.

#### Physical installation and first launch confirmed

After another normal Watch restart, the maintainer reported that the app was
installed and opened to **First check-in**, with weight and optional body-fat
fields. This establishes user-observed installation and launch on the Series 7,
beyond the placeholder seen in the earlier capture. The successful attempt was
not captured in USB logs. No subsequent watchOS update, replacement build,
certificate rotation or data deletion was reported. The earlier failure's root
cause remains unproven.

Source/history inspection confirms this first-run screen and its explanatory copy
come from upstream commit `43e2d43338`. `ContentView` puts this screen before every
page whenever `CheckInStore.needsFirstRunEntry` detects missing/stale weight context;
it does not test server authentication or phone reachability. Saving captures a
real local check-in and queues delivery, so entering invented health values is not
an acceptance workaround. The Challenge page's **Challenges not synced yet** state
exists, but is behind this inherited gate. Initial navigation without a weight
record is therefore an identified UX limitation, not evidence of authentication
or successful Challenge synchronization.

Screenshot seeding is guarded by `#if DEBUG` and an explicit launch variable.
The distributed build 1005 Watch executable contains the first-run copy and does
not contain the screenshot-seed launch key. No demo data was enabled during this
acceptance. Authenticated context, Challenge rendering and complication behavior
remain unverified on the physical Apple Watch; no UI/source change was made during
this diagnosis.

#### Review fix: first check-in stays inside the page deck

Review designated the first-run navigation gate as the remaining M8A blocker.
`ContentView` now always mounts its normal `TabView`. First check-in renders only
inside the existing Entry page; missing/stale weight selects that page initially
when visible. Explicit swipes/deep links remain usable, saved order/hiding is
unchanged and an active workout retains priority. Returning to Entry still shows
the form until a real check-in is saved. Its capture, persistence, queue and ack
paths are unchanged; no synthetic weight or bypass check-in is created. The hint
now explicitly tells the wearer they may swipe to other pages.

Validation of this source fix:

- Focused Watch/settings/context contracts: **5 suites / 40 tests passed**.
- Full mobile validate passed; CI: **507 suites / 7,802 tests passed**.
- Clean owned iOS prebuild and all five target identity checks passed.
- Ten first-run/empty-context assertions were added to the existing Swift model
  harness. Its local run stops because `swiftc` is unavailable on this Linux host;
  Jest source contracts do not replace native model execution or physical gestures.

New **full EAS iOS build 1006** completed successfully from signed source commit
`d9a481cc534e1abbe99fd8e71d56d87741c4220d`:
[e8530efb-f4fd-4c3a-a690-da5a7a84b66a](https://expo.dev/accounts/imjstnickdev/projects/sparkyrivals/builds/e8530efb-f4fd-4c3a-a690-da5a7a84b66a).
This compiled the changed native source; it was not a re-sign of build 1005.
The non-interactive command used `--freeze-credentials`, reusing existing managed
credentials without another Apple login or device/profile modification.

Exported IPA inspection passed: all five bundle versions are **1006**, production
bundle IDs/team/App Group/schemes match, every profile includes both registered
devices, and all profiles use the same Distribution Certificate as build 1005.
The Watch executable contains the new swipe instruction, omits the old first-run
copy and does not contain the DEBUG screenshot-seed launch key. Private artifact
and verification report:
`~/.local/share/sparkyrivals/artifacts/milestone-8a/ios-1006/`.
IPA SHA-256: `55b72829668b3dd66fc724edd20a2c400f8bb4400454126f94f7b421d4960b3c`.

Physical installation/navigation acceptance of **1006 passed on 2026-10-04**.
After the maintainer reported installation appearing stuck, a new private USB log
capture recorded successful placeholder installation followed by the actual app
phase (`p = N`). At 03:08:59 Europe/Rome, 1,195,281 compressed bytes had transferred;
at **03:09:01** the actual app received `Got install done`. A read-only lookup also
confirmed iPhone bundle version **1006**, version 1.7.3 and a validated profile.
The private capture is `/tmp/sparkyrivals-8a/watch-install-1006-NvWGYW.log`.
It was stopped after completion. This successful attempt does not establish the
cause of earlier installation delays or storage-labelled failures.

The maintainer then confirmed on the physical Series 7, without entering or saving
weight:

1. First check-in appears with the new swipe instruction.
2. Horizontal navigation away from it works.
3. Challenges is reachable.
4. **Challenges not synced yet** renders.
5. Returning to First check-in leaves its fields usable.

No fake measurement or screenshot seed was used. An actual real-weight Save/server
ack was not performed in this acceptance; the original capture/send/persist paths
remain unchanged and covered by source contracts. The reviewer-designated M8A
blocker is closed. M8A is complete; PR #10 subsequently merged normally at the maintainer's request.
Broader authenticated cross-device sync, account clearing, health dedupe, every
native surface, notifications and accessibility remain explicit
post-M8A/pre-production QA unless a concrete regression is found.

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

## Residual post-M8A/pre-production QA and human boundaries

- Apple EAS credential/provisioning authentication, if requested, must be completed
  by the maintainer locally. Never paste Apple passwords/2FA into chat.
- Internal iPhone onboarding and physical Apple Watch 1006 first-run/unsynced
  navigation are confirmed. Check real check-in Save/server acknowledgment, auth,
  HealthKit/Health Connect duplicate protection, authenticated Challenge transport,
  account/server switch/logout and stale/offline clearing on every native surface.
- Verify iOS/Android widgets, Apple complications, Wear Tile/complication visuals
  and interactions, actual local notification delivery/deep links and VoiceOver/
  TalkBack. Initial launch and service registration do not establish these results.
- Run the extended Swift model harness on a Mac; this host has no `swiftc`.
  Full EAS Xcode compilation passed, but did not execute that standalone harness.
- Release APK fingerprints, physical phone/Watch installation and initial paired
  Data Layer transfer are verified. Authenticated Challenge results, account-change
  clearing/offline states, Tile/complication visuals, Health Connect continuity,
  notifications and TalkBack remain separate checks.
- Confirm the real production hostname and runtime integration secrets during 8B;
  provision no real server or NPM resources during 8A.
- Follow [deployment handoff](DEPLOYMENT.md) for separate server bootstrap,
  NPM/TLS, backups/restores and production E2E. No production deployment occurred.

## M8A.5 remote push acceptance — complete with recorded QA follow-ups

Source work and mocked/disposable integration validation passed on
`milestone/remote-push`, based on fork main after upstream sync PR #11.
[REMOTE_PUSH.md](REMOTE_PUSH.md) records architecture and required real acceptance.
Physical iPhone and Android background delivery, guarded notification taps and
absence of duplicate local invitations have been demonstrated. Enhanced Push
Security rejected an unauthenticated send and accepted the authenticated backend
send. Both phones passed opt-out, re-enable and account-removal/stale-tap checks.
Galaxy Watch invitation sync and account clearing passed. Physical iOS evidence
is explicitly tied to build 1009; build 1010's install/launch check is deferred to
pre-production QA because the shared setup extraction preserves the iOS behavior.
M8A's previous native acceptance does not prove remote delivery. M8B remains deferred.

### M8A.5 source/config checks (2026-10-04)

- Server `pnpm run validate`: passed. No-DB CI: 452 suites passed, 12 skipped;
  5,596 tests passed, 467 skipped (26 existing TODO cases).
- Disposable PostgreSQL 18.3 clean startup through the normal server initializer:
  passed. Serial Challenge/RLS/push integration: six suites, 400 tests passed.
- Upgrade from the pre-push synchronized main schema through the normal migration
  runner: passed. Existing Steps Challenge and accepted/pending membership rows
  remained unchanged; no historical invitation events were backfilled. Repeated
  startup also passed.
- Mobile `pnpm run validate`: passed. Full CI: 509 suites, 7,853 tests passed.
  Existing translation completeness reports remain; no unrelated translations changed.
- Frontend consumer `pnpm run validate`: passed, with existing Knip hints.
- Wear pinned Kotlin/JVM harness: 34 tests passed. APK verifier unit tests: six passed.
- Clean iOS/Android prebuild and native identity validation: owned development,
  preview, production and upstream/default passed. Production repeat metadata was
  identical. Firebase config/plugin is production phone only; Wear omits it. Apple
  main has APNs entitlement; all four child targets omit remote push entitlement.
- Bootstrap tests: 11 passed, including external-token import, private permissions,
  no generation/overwrite and push-enabled missing-secret rejection.
- Final root Compose built from this checkout and passed disposable local startup,
  healthy DB/server/frontend, Docker DNS, external-network frontend routing,
  no backend/database external DNS, zero host ports, bind-only state, logical
  backup/restore and repeat startup. Containers/test-created networks shut down;
  private disposable test files were retained, without deleting user data.
- Docs build/link validation and diff checks passed; existing bundle-size warning
  remains. Changed-file secret-pattern scan passed before each signed commit.

### M8A.5 native release artifacts

Both platforms compiled source commit
`0bd4ca4dc1877ed0b1aa0236a3a8a5261cad4169`.

- Android `:app:assembleRelease`, `:wear:assembleRelease` and
  `:wear:testReleaseUnitTest`: passed with JDK 17; 34 Wear Gradle tests passed.
  Existing native API/Gradle deprecation warnings remain. Phone version code
  **1003** and Wear **1000001003** both use `com.imjstnick.sparkyrivals`.
- `apksigner` verified exactly one signer on both APKs, matching the permanent
  certificate `3E:B2:F9:50:8D:15:9C:C1:50:14:1A:9A:57:0D:37:71:24:4F:59:10:59:D0:AE:09:E9:61:28:1E:B6:42:D5:2A`.
  Bundled phone Expo identity also passed. Generated Firebase resources identify
  `sparkyrivals-fb`; the phone manifest includes Firebase messaging and the Wear
  manifest does not.
- Both APKs were installed as updates on the connected Galaxy A25 and Galaxy Watch
  without clearing application data. Installed package version codes were read
  back through ADB. This alone does not prove remote delivery or Data Layer behavior.
- [EAS full iOS build 1008](https://expo.dev/accounts/imjstnickdev/projects/sparkyrivals/builds/fa2f34bd-2b27-46e0-a54a-1561ea0c737b)
  finished successfully using the existing production-internal profile and
  credentials. Build 1007 was reserved by a prior attempt that failed with an EAS
  service error before upload; its number was not reused.
- Exported IPA inspection verified all five production bundle identifiers, build
  1008, team `U5K88Y67DL`, the shared App Group, and matching signed Mach-O
  entitlements. Only the main phone app has `aps-environment=production`; the four
  child targets do not. All embedded ad-hoc profiles cover both registered devices.
  The maintainer confirmed installation and launch on the physical iPhone. No local
  Xcode compilation occurred on Linux; this was an EAS compilation.
- Artifacts and non-secret verification manifests are stored privately under
  `~/.local/share/sparkyrivals/artifacts/milestone-8a5/1003-1000001003/` and
  `~/.local/share/sparkyrivals/artifacts/milestone-8a5/ios-1008/`.

At this initial-build stage, physical remote delivery remained pending. The
approved temporary HTTPS tunnel targets only a separate synthetic test database. Its local acceptance proxy blocks
health/diary mutations; public signup is disabled. No production infrastructure or
NPM configuration is involved. Native compilation, installation and token
registration are separate acceptance boundaries from actual APNs/FCM delivery.

### Physical registration finding and correction

The first iPhone registration exposed a native callback loop in build 1008:
acquiring an APNs token emitted the same callback used for rotation, which started
another acquisition and repeatedly renewed the backend binding. No invitation
push was sent during this attempt. Testing was paused and the temporary public
tunnel and test services were stopped without deleting data.

The correction exchanges the callback's supplied native token directly with Expo,
ignores duplicate callbacks and preserves an unchanged Expo token's valid lease.
Focused regression tests: three suites, 32 tests passed. Mobile validation and
full CI passed: **509 suites, 7,856 tests**. These checks include the callback loop,
real token rotation and the existing consent/account guards. New full native
builds and physical re-verification followed; the preceding artifacts remain
compilation evidence, not accepted remote-push releases.

### Callback correction builds and physical push verification

Source `6ad4859a2a6b23bc46f65ddc51c6ae837bdeb4b4` compiled as Android phone
**1004**, Wear **1000001004**, and
[EAS full iOS build 1009](https://expo.dev/accounts/imjstnickdev/projects/sparkyrivals/builds/2751e06e-a08d-46f6-a0f2-5680b454c6ee).

- Android clean prebuild/native identity validation, phone/Wear release compilation,
  and 34 Wear Gradle tests passed. Both APKs have the production package and the
  same permanent certificate documented above. Both were installed as updates
  without clearing data; installed version codes were verified through ADB.
- EAS compiled all five Apple targets with the existing credentials. Exported IPA
  inspection verified build 1009 on every target, production identities, team,
  App Group, registered devices and signed entitlements. APNs remains phone-only.
  The maintainer confirmed iPhone installation and launch. No local Xcode build ran.
- The physical iPhone registration remained stable across foreground observations;
  the repeated-registration loop no longer occurred.
- On 2026-10-04, Expo rejected a private request without Bearer authentication
  with HTTP **403 / UNAUTHORIZED**. The normal authenticated backend invitation
  mutation then returned HTTP 201 and the scheduled sender obtained an Expo ticket.
  The normal delayed receipt worker subsequently marked that delivery successful.
  No routing token or access token was printed or placed in this record.
- With the iPhone app backgrounded, the maintainer confirmed one generic invitation
  notification, a tap opening the correct invitation, and no subsequent local
  duplicate. The invitation remained pending; the notification did not accept it.
- Disabling only New invitations revoked the server binding and removed its token
  ciphertext. A second invitation created no delivery and the maintainer confirmed
  no notification. Re-enabling registered a new guard and a third invitation
  produced one remote notification. Removing the temporary server connection
  revoked the binding again; tapping that previously received notification opened
  the neutral Server screen without navigating into the old account's invitation.
- Android's visible Challenge/invitation switches and OS notification permission
  were enabled, but registration failed before reaching the server. The subsequent
  Android category correction and physical evidence are recorded below.

Commit `d02e502361f02d993d5fd9da9fe6a7d08cd12545` adds only fixed registration
stage/allowlisted error-code diagnostics, never provider messages or response bodies.
Focused tests passed (two suites, 27 tests), mobile validation passed, and full
mobile CI passed (**509 suites, 7,860 tests**). Further physical Android diagnosis,
Android opt-out/re-enable and account-transition acceptance were still pending.

### Android category incompatibility

Production Android build **1005** from `d02e502361f02d993d5fd9da9fe6a7d08cd12545`
was compiled, signature-verified and installed without clearing app data. It located
the failure inside token setup. Inspection of the installed Expo Android module
confirmed that `setNotificationCategoryAsync('challenge', [])` throws because
Android requires at least one category action. The same call also blocked the
existing local Challenge scheduling path; iOS permits action-free categories.

Commit `a19089cd6871b517a61a63673f917e9e370a1fc2` shares platform setup between
the two paths: Android uses its existing `challenges` channel; iOS retains the
`challenge` category. No dummy actions, credential changes or dependency upgrades
were added. Tests now reproduce the native Android rejection and check both
local/remote invitation selection paths. Focused tests: four suites, 50 tests
passed. Mobile validation and full CI passed: **509 suites, 7,863 tests**. The full
run emitted an open-worker teardown warning despite its successful exit; native
delivery remains a separate acceptance check.

Android phone/Wear **1006 / 1000001006** compiled from this source and passed
clean production prebuild/native identity checks, 34 Wear Gradle tests and APK
identity/signature verification. Firebase messaging and project `sparkyrivals-fb`
are present only in the phone APK; Wear has Watch hardware targeting and no FCM
messaging service. Both APKs were installed as updates and their version codes
read back through ADB. Artifacts are privately archived under
`~/.local/share/sparkyrivals/artifacts/milestone-8a5/1006-1000001006/`.
After the maintainer opened build 1006, the Android installation registered
successfully with an enabled, encrypted server binding and no registration errors.
With the app backgrounded, the maintainer confirmed one generic notification for
a new invitation, a tap opening the correct invitation and no duplicate local
alert. The invitation was left pending. This used Expo with the existing EAS FCM
V1 credential, without Firebase Console or credential changes.

[Full EAS iOS build 1010](https://expo.dev/accounts/imjstnickdev/projects/sparkyrivals/builds/ec0a6cf7-c2f4-429b-ba78-e5b1427c692c)
finished from the same source with existing credentials. Exported IPA inspection
verified all five bundle IDs at build 1010, team, App Group, two provisioned devices
and signed Mach-O entitlements; APNs is still main-phone only. The artifact is
privately archived under `~/.local/share/sparkyrivals/artifacts/milestone-8a5/ios-1010/`.
The maintainer requested avoiding a duplicate full iPhone acceptance cycle. The
shared helper preserves the existing iOS category call; there are no iOS protocol,
credential or native-target changes from the physically tested build 1009.
Build 1010's installation/launch remains explicit pre-production QA debt, not a
claimed physical pass.

Disabling Android New invitations revoked the registry binding and removed token
ciphertext. A subsequent pending invitation created no delivery; the maintainer
confirmed no notification. Re-enabling established an eligible encrypted binding.
The maintainer confirmed one new notification after re-enabling. Removing the
temporary test server connection then disabled the registration and removed token
ciphertext. Tapping that retained notification did not open the old invitation.

The Galaxy Watch on **1000001006** opened successfully and received all three
pending test invitations through the existing Data Layer snapshot after a phone
refresh. Selecting an invitation showed its metadata and **Accept on phone**,
without scores or a Watch mutation. Removing the phone test-server connection
cleared all three invitations from the Watch, as confirmed by the maintainer. This
confirms the invitation snapshot and account-clear paths; it does not establish
exhaustive Tile/complication or health/workout acceptance.

### Final acceptance boundaries and pre-production QA

Milestone 8A.5 implementation and physical remote-invitation acceptance are complete
for review. The actual tested phone versions are **Android 1006** and **iOS 1009**;
latest-source iOS **1010** passed EAS compilation and signed-artifact inspection.
The latest full mobile CI result is **509 suites / 7,863 tests passed**. Server,
DB, migration, identity/prebuild and Compose results above remain applicable:
subsequent fixes affected mobile registration/setup and documentation only.
No dependency upgrades were needed.

The following remain explicit pre-production QA, not claimed results:

- Install/launch iOS 1010 and its Apple Watch app. Do not repeat the complete iOS
  push cycle solely because the Android channel helper was extracted; its iOS call
  and payload/credential contracts are unchanged and covered by regression tests.
- Broader authenticated Challenge scores, HealthKit/Health Connect duplicate
  protection, every widget/Tile/complication, VoiceOver/TalkBack and exhaustive
  native visual QA from M8A remain outstanding. Wear invitation sync/clear is
  verified; that does not establish workout or health acceptance.
- The real delivery tests used backgrounded apps. OS force-stop, long offline
  expiry, direct account-to-account/server switching, OS-permission revocation and
  native token rotation have automated coverage where applicable, but were not
  separately reproduced on physical devices. Account removal, consent toggles,
  guarded taps and local invitation deduplication were physically verified.
- Local start/end/ending/lead and unrelated notification regressions passed the
  mobile suite; their full real-time device schedules were not replayed here.
- Provider transient failures and DeviceNotRegistered are covered by injected
  transports; no real routing token was deliberately invalidated. Helm rendering
  was not run because Helm is unavailable on this host.

Both test-phone registrations are now disabled and their encrypted routing tokens
removed from the active registry. No real health data, participant scores or names
were included in pushes. No production deployment, NPM mutation, store submission,
credential rotation or upstream write occurred. M8B remains deferred.

The normal delayed worker obtained successful Expo receipts for **all four actual
pushes: two iOS and two Android**, without accelerating its 15-minute receipt wait
or resending a test notification. The two opt-out invitations created no delivery.
Provider receipts and the maintainer's on-device confirmations are separate evidence.
At 17:36 UTC on 2026-10-04, the owned temporary tunnel, acceptance proxy, server and
PostgreSQL container were stopped; both local test listeners were verified closed.
Disposable bind data and private evidence were retained. No user-owned data or
unrelated containers were removed. Final docs build and 27 local link-target checks
passed; the branch-wide scan of 71 changed files found no secret material.
