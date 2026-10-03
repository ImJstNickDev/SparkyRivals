# Milestone 1: Own the Build

Implementation completed for review on `milestone/own-the-build` (2026-10-03).
Owned build configuration, security guards and Linux validation are implemented.
Actual account registration, permanent signing keys, native compilation and device
acceptance remain open; no signed/distributed binary is claimed.

The maintainer's milestone 1 definition allows local/configuration completion when
accounts or native toolchains are unavailable. This refines the bootstrap plan's
stronger “installable device build” exit: [ROADMAP.md](ROADMAP.md) tracks that
remaining release acceptance separately. No Challenges, Wear OS, broad rebrand,
store submission or production Docker redesign was performed.

## Implemented behavior

1. **Central identity:** extended the existing CommonJS `app.identifiers.js`;
   preserved upstream defaults/legacy exports. Validated variant names and generic
   custom production roots; derived isolated dev/preview identities. Owned
   owner/project configuration is required and upstream EAS destinations rejected.
2. **Apple relationships:** all child target bundles/groups derive from the host;
   generated Info.plist metadata supplies runtime links. Native target names and
   upstream module/protocol identifiers remain unchanged.
3. **Secure callbacks:** one operator-owned native scheme allowlist controls
   Better Auth origins and fixed browser return destinations. Unknown/malformed
   selectors fail; login tokens and one-use registration tickets remain fragments.
   API-key/session/web-origin behavior is retained and regression-tested.
4. **Native links and health:** widgets, Live Activities, Android notifications,
   Watch pages/complications consume resolved schemes. Existing runtime health
   source detection and `SparkyFitnessSessionId` remain intact; variant regression
   tests prove marked Watch workouts are excluded from re-import.
5. **Release signing:** durable Gradle generation consumes `MYAPP_RELEASE_*` or
   EAS-injected credentials. Release tasks reject missing/debug credentials and
   configuration-only generation. Debug keeps its normal local signing behavior.
6. **Profiles and validation:** three owned EAS profiles, local profile wrapper,
   monotonic local build numbers / remote EAS incrementing versions, semantic
   native metadata assertions and repeat-prebuild comparisons. The Watch launch
   helper discovers generated workspace and built bundle identity.
7. **Automation:** publishing/mutation/notification jobs are guarded off in forks.
   Android codegen/debug failures propagate; Apple simulator builds resolve their
   generated identities. Actions remain disabled. New native configuration CI is
   read-only and requires no cloud account or signing material.
8. **Operations:** build-only variables remain outside server containers. Runtime
   callback config reaches env templates, EnvGenerator, Compose and Helm. The
   required root `dockerdata/` bind-mount policy is documented and git-ignored.

## Configuration and account boundaries

See [BUILDING.md](BUILDING.md) for exact variables, profiles, identities, commands,
registration/provisioning and key recovery. See [IDENTIFIERS.md](IDENTIFIERS.md)
for current resolution versus historical bootstrap findings.

- EAS CLI reports **Not logged in**. No owned owner/project UUID has been created
  or invented. Set actual values after deliberately creating/linking our project.
- No Apple account/team/membership is verified; team variables were unset. Five
  explicit App IDs and one App Group per variant need owned provisioning.
- No permanent Android release key exists from this work. Supply and securely back
  up an owned key before distributing; signed native execution remains untested.
- The upstream App Store Connect submission destination was removed from
  `eas.json`, including the inherited profile. There is no automatic submission
  configuration. A future submission needs an explicitly reviewed owned store ID.
- `APP_CONFIG_ONLY=1` is an explicit unsigned inspection mode, not a production
  fallback. It omits absent EAS metadata, is rejected by EAS builders, and blocks
  Android release tasks. Apple use in this mode is limited to unsigned simulators.

## Validation and remaining release acceptance

[BUILD_VALIDATION.md](BUILD_VALIDATION.md) records exact checks and limitations.
The full mobile/server/frontend suites and package validation pass; repeated clean
prebuilds agree across all three owned variants, with upstream defaults checked.
The eight existing Expo patch warnings did not block this work and remain for a
separate dependency change. No dependency or lockfile alignment was mixed in.

Before the first distributed build, verify Android compilation/signing, Xcode
compilation, signed entitlements/profile/build-number agreement, physical phone and
paired Watch behavior, HealthKit/Health Connect grants/dedupe, and auth browser
returns. Account/credential setup and those checks do not authorize store submission.

## Differences from the bootstrap proposal

- Production-root inputs derive variant suffixes centrally instead of repeating
  independent app/extension IDs in each profile.
- Added explicit account-free configuration mode so prebuild tests never invent
  a project UUID or contact upstream destinations.
- Reused `MYAPP_RELEASE_*` and EAS's existing signing injection rather than adding
  another secret interface.
- Used a validated scheme selector with server-built callback URLs. No client
  return URL is added to trusted origins.
- Isolated workflow safety/tool-runtime fixes in a CI commit. Deprecated action
  runners found by actionlint were updated; compatible Node 20 mobile workflows
  were not changed merely for alignment. New owned profiles/validation use Node 24.
- Added a small follow-up for local dotenv loading so profile commands and native
  validation use the same ignored build settings as Expo.
- Kept dependency alignment deferred because prebuild/validation succeeded.
- Recorded deployment policy without replacing upstream Compose defaults.

The implementation follows the planned semantic commit boundaries. No upstream
history was rewritten. Use [UPSTREAM.md](UPSTREAM.md) when merging future changes,
and rerun the native identity matrix after changes to Expo plugins or templates.
