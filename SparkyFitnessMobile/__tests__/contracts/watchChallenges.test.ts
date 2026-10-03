import fs from 'fs';
import path from 'path';
import {
  WATCH_PAGE_KEYS,
  WATCH_PAGE_LABELS,
} from '../../src/constants/watchPages';
import { resolveKeyOrder } from '../../src/utils/reorderUtils';
import wire from '../fixtures/watch-challenges.json';
const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const watch = (file: string) => read(`targets/watch/${file}`);

it('registers the same page keys on phone and Swift', () => {
  const cases = watch('Domain/WatchPage.swift')
    .match(/case (goals[^\n]+)/)![1]
    .split(',')
    .map((value) => value.trim());
  expect(cases).toEqual(WATCH_PAGE_KEYS);
  expect(
    WATCH_PAGE_LABELS.challenge((_key, options) => options.defaultValue)
  ).toBe('Challenges');
});
it('reconciles old saved order by appending Challenge and ignores unknown/repeated keys', () => {
  expect(
    resolveKeyOrder(['workout', 'water', 'water', 'unknown'], WATCH_PAGE_KEYS)
  ).toEqual(['workout', 'water', 'goals', 'entry', 'trend', 'challenge']);
});
it('routes Challenge through the existing visible page system without changing workout override', () => {
  expect(watch('Presentation/ContentView.swift')).toMatch(
    /case \.challenge:\s+ChallengeView\(\)/
  );
  expect(watch('Domain/WatchPage.swift')).toContain(
    'page == .workout && workoutActive'
  );
  expect(watch('Presentation/ContentView.swift')).toContain('.id(pages)');
});
it('adds an optional persisted field and clears it through the adapter on absent/malformed input', () => {
  expect(watch('Domain/CheckInModels.swift')).toContain(
    'var challengeSnapshot: ChallengeSnapshot? = nil'
  );
  expect(watch('Adapters/ContextPayloadMapper.swift')).toContain(
    'challengeSnapshot: ChallengePayloadMapper.snapshot(from: payload["challengeSnapshot"])'
  );
  expect(watch('Adapters/ContextPayloadMapper.swift')).not.toContain(
    'previous.challengeSnapshot'
  );
  const mapper = watch('Adapters/ChallengePayloadMapper.swift');
  expect(mapper).toContain('integer(payload["version"]) == 1');
  expect(mapper).toContain('payload["state"] as? String == "ready"');
  expect(mapper).toContain('else { return nil }');
});
it('maps the actual phone wire keys in the Swift adapter', () => {
  const mapper = watch('Adapters/ChallengePayloadMapper.swift');
  for (const key of Object.keys(wire)) expect(mapper).toContain(`["${key}"]`);
  for (const key of Object.keys(wire.items[0]))
    expect(mapper).toContain(`["${key}"]`);
  for (const key of Object.keys(wire.items[0].rows[0]))
    expect(mapper).toContain(`["${key}"]`);
});
it('defensively bounds and deduplicates incoming items/rows and refuses invalid numbers', () => {
  const mapper = watch('Adapters/ChallengePayloadMapper.swift');
  expect(mapper).toContain('items.prefix(8)');
  expect(mapper).toContain('.prefix(4)');
  expect(mapper).toContain('seen.insert(row.id).inserted');
  expect(mapper).toContain(
    'membership == "accepted" && lifecycle != .upcoming'
  );
  expect(mapper).toContain('value.doubleValue.isFinite');
  expect(mapper).toContain('CFBooleanGetTypeID');
});
it('has a single application-context writer and no Challenge mutation messages', () => {
  const composer = read('src/hooks/useWatchCheckInBridge.ts');
  const native = read(
    'modules/watch-connectivity/ios/WatchConnectivityModule.swift'
  );
  expect(composer.match(/WatchConnectivity\.updateContext\(/g)).toHaveLength(1);
  expect(native.match(/\.updateApplicationContext\(/g)).toHaveLength(1);
  expect(read('src/hooks/useWatchChallenges.ts')).not.toMatch(
    /updateContext|sendMessage|transferUserInfo|challengesApi/
  );
  expect(watch('Adapters/OutboundPayloads.swift')).not.toMatch(/challenge/i);
  expect(native).not.toMatch(
    /challengeAccept|challengeDecline|challengeCreate/
  );
});
it('resolves detail from the current account snapshot instead of a captured navigation item', () => {
  const detail = watch('Presentation/ChallengeDetailView.swift');
  expect(detail).toContain(
    'store.context.challengeSnapshot?.accountKey == accountKey'
  );
  expect(detail).toContain('items.first { $0.id == challengeId }');
  expect(watch('Presentation/ChallengeView.swift')).toContain(
    '.id(store.context.challengeSnapshot?.accountKey)'
  );
});
it('renders supplied scores/ranks without HealthKit, HTTP or local ranking code', () => {
  for (const file of [
    'Presentation/ChallengeView.swift',
    'Presentation/ChallengeDetailView.swift',
    'Presentation/ChallengeScoresView.swift',
    'Domain/ChallengeModels.swift',
  ]) {
    expect(watch(file)).not.toMatch(
      /import HealthKit|HKHealthStore|URLSession|fetch\(|\.sorted\(|\.reduce\(/
    );
  }
  const scores = watch('Presentation/ChallengeScoresView.swift');
  expect(scores).toContain('own.gapToLeader');
  expect(scores).toContain('item.leadMargin');
  expect(scores).toContain('point.eligible && point.present');
  expect(scores).toContain('No step data');
  expect(scores).toContain(
    'ChallengeFormat.dayLabel(point.date, timezone: item.timezone)'
  );
});
it('keeps native model checks and the property-list fixture outside release targets', () => {
  expect(read('scripts/test-watch-models.sh')).toContain(
    '__tests__/watch/ChallengeModelChecks.swift'
  );
  expect(read('__tests__/watch/ChallengeModelChecks.swift')).toContain(
    'absent context clears previous account'
  );
  expect(read('__tests__/watch/ChallengeModelChecks.swift')).toContain(
    'malformed boolean score dropped'
  );
});
it('retains the workout own-write marker and queue protocols', () => {
  expect(watch('Infrastructure/WorkoutHealthKitController.swift')).toContain(
    'SparkyFitnessSessionId'
  );
  expect(watch('Infrastructure/WatchSessionManager.swift')).toContain(
    'transferUserInfo'
  );
  expect(read('src/hooks/useWatchCheckInBridge.ts')).toContain(
    'ensureAckStateHydrated'
  );
});

it('keeps all screenshot states DEBUG-only and wired to the existing manual capture job', () => {
  const seed = watch('Application/ScreenshotChallengeSeed.swift');
  expect(seed.trim().startsWith('#if DEBUG')).toBe(true);
  expect(seed.trim().endsWith('#endif')).toBe(true);
  for (const state of [
    'versus',
    'group',
    'invitation',
    'upcoming',
    'completed',
    'empty',
    'multiple',
    'stale',
    'tied',
  ])
    expect(seed).toContain(state);
  expect(watch('Application/ScreenshotSeed.swift')).toContain(
    'SPARKY_SCREENSHOT_CHALLENGE'
  );
  const workflow = fs.readFileSync(
    path.join(root, '../.github/workflows/ios-build.yml'),
    'utf8'
  );
  expect(workflow).toContain(
    'SIMCTL_CHILD_SPARKY_SCREENSHOT_CHALLENGE="${5:-}"'
  );
  expect(workflow).toContain('shoot "challenge-$state" none challenge');
  expect(workflow).toContain('bash scripts/test-watch-models.sh');
  expect(workflow).toContain('workflow_dispatch:');
});
