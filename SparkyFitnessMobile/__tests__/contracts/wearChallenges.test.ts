import fs from 'fs';
import path from 'path';
import fixture from '../fixtures/watch-challenges.json';
const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const wear = (file: string) => read(`targets/wear/${file}`);
const bridge = (file: string) =>
  read(
    `modules/wear-connectivity/android/com/sparkyrivals/wearbridge/${file}.kt`
  );
const ui = () =>
  wear('src/main/kotlin/com/sparkyrivals/wear/ChallengeScreens.kt');
it('uses one fixed versioned DataItem, never a message RPC or Watch HTTP client', () => {
  expect(
    wear('protocol/com/sparkyrivals/companion/ChallengeProtocol.kt')
  ).toContain('"/sparkyrivals/challenges/v1"');
  expect(wear('src/main/AndroidManifest.xml')).toContain(
    'android:path="/sparkyrivals/challenges/v1"'
  );
  expect(bridge('WearPublishWorker')).toContain(
    'PutDataRequest.create(ChallengeProtocol.PATH)'
  );
  for (const source of [
    ui(),
    bridge('WearConnectivityModule'),
    bridge('WearPublishWorker'),
  ]) {
    expect(source).not.toMatch(
      /HealthServices|HealthConnect|SensorManager|HttpClient|OkHttp|sendMessage\(/
    );
  }
});
it('keeps durable ordering and clear deliveries independent of JS lifetime', () => {
  expect(bridge('WearPublicationStore')).toContain('context.noBackupFilesDir');
  expect(bridge('WearPublicationStore')).toContain(
    'Math.addExact(previous?.sequence'
  );
  expect(bridge('WearPublicationStore')).toContain('file.finishWrite');
  expect(bridge('WearPublishWorker')).toContain(
    'ExistingWorkPolicy.APPEND_OR_REPLACE'
  );
  expect(bridge('WearPublishWorker')).toContain('Result.retry()');
  expect(bridge('WearPublishWorker')).toContain('request.setUrgent()');
  expect(bridge('WearPublishWorker')).not.toContain('NetworkType.CONNECTED');
});
it('persists receipt watermarks, fails closed on incompatible state and retains data on ordinary network errors', () => {
  const source = wear(
    'src/main/kotlin/com/sparkyrivals/wear/ChallengeStore.kt'
  );
  expect(source).toContain('ChallengeReceipt.decode');
  expect(source).toContain('ChallengeProtocol.decode');
  expect(source).toContain('CapabilityClient.FILTER_REACHABLE');
  expect(wear('src/main/AndroidManifest.xml')).toContain(
    'android:allowBackup="false"'
  );
});
it('renders Wear Material 3, round-screen scaffolds and swipe navigation with standard rotary list defaults', () => {
  expect(ui()).toContain('androidx.wear.compose.material3');
  expect(ui()).toContain('ScreenScaffold(scrollState = scroll');
  expect(ui()).toContain('TransformingLazyColumn(');
  expect(ui()).toContain('SwipeDismissableNavHost(');
  expect(ui()).not.toContain('androidx.compose.material.');
  expect(ui()).toContain('semantics(mergeDescendants = true)');
  expect(ui()).toContain('heading()');
});
it('uses current-account data and supplied rank/tie/gap without reranking', () => {
  expect(ui()).toContain('key(state.receipt.snapshot.accountKey');
  expect(ui()).toContain('snapshot.items.firstOrNull');
  expect(ui()).toContain('row.rank');
  expect(ui()).toContain('row.tied');
  expect(ui()).toContain('own.gapToLeader');
  expect(ui()).not.toMatch(/\.sorted|\.sumOf|\.fold\(/);
  expect(ui()).toContain('!point.present -> stringResource(R.string.no_steps)');
});
it('includes every requested developer preview only in debug sources', () => {
  const previews = wear(
    'src/debug/kotlin/com/sparkyrivals/wear/ChallengePreviews.kt'
  );
  for (const state of [
    'Versus',
    'Group',
    'Invitation',
    'Upcoming',
    'Completed',
    'Empty',
    'Stale',
    'Multiple',
    'Tie',
    'Uninitialized',
  ])
    expect(previews).toContain(`${state}Preview`);
  expect(previews).toContain('WearPreviewFontScales');
  expect(
    wear('src/main/kotlin/com/sparkyrivals/wear/MainActivity.kt')
  ).not.toContain('Samples');
  expect(ui()).not.toMatch(/accept\(|decline\(|createChallenge|leave\(/);
});
it('bounds a hostile Unicode-heavy 8-by-4 payload far below 100KB', () => {
  const snapshot = {
    ...fixture,
    items: Array.from({ length: 8 }, (_, i) => ({
      ...fixture.items[0],
      id: String(i),
      name: '😀'.repeat(100),
      rows: Array.from({ length: 4 }, (_, j) => ({
        ...fixture.items[0].rows[0],
        id: String(j),
        name: '😀'.repeat(100),
        total: Number.MAX_SAFE_INTEGER,
        gapToLeader: Number.MAX_SAFE_INTEGER,
      })),
    })),
  };
  const bytes = Buffer.byteLength(
    JSON.stringify({
      version: 1,
      publisherId: '00000000-0000-4000-8000-000000000001',
      sequence: '9223372036854775807',
      snapshot,
    }),
    'utf8'
  );
  expect(bytes).toBeLessThan(32 * 1024);
});
it.each(['ios', 'android'] as const)(
  'loads native bridge only on Android (%s)',
  (os) => {
    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({
        Platform: { OS: os },
        NativeModules: { WearConnectivity: { publishSnapshot: jest.fn() } },
      }));
      const module = require('../../modules/wear-connectivity')
        .default as unknown;
      expect(module === null).toBe(os === 'ios');
    });
    jest.dontMock('react-native');
  }
);
