import fs from 'fs';
import path from 'path';
import * as hk from '../../src/services/healthkit/dataTransformation';
import * as hc from '../../src/services/healthconnect/dataTransformation';

afterEach(() => {
  hk.setOwnBundleId(null);
  hc.setOwnPackageName(null);
});

it.each(['', '.dev', '.preview'])(
  'preserves own-write exclusion for %s identities',
  (suffix) => {
    const phone = `com.imjstnick.sparkyrivals${suffix}`;
    hk.setOwnBundleId(phone);
    hc.setOwnPackageName(phone);
    const workout = {
      startTime: '2026-10-01T08:00:00Z',
      endTime: '2026-10-01T09:00:00Z',
      activityType: 37,
      duration: 3600,
    };
    const metric = { recordType: 'Workout', unit: '', type: 'workout' };
    expect(
      hk.transformHealthRecords(
        [
          {
            ...workout,
            sourceBundleId: `${phone}.watchkitapp`,
            metadata: { SparkyFitnessSessionId: 'existing-session' },
          },
        ],
        metric
      )
    ).toEqual([]);
    expect(
      hk.transformHealthRecords(
        [
          {
            ...workout,
            sourceBundleId: phone,
            metadata: { SparkyFitnessSessionId: 'phone-session' },
          },
        ],
        metric
      )
    ).toEqual([]);
    expect(
      hk.transformHealthRecords(
        [{ ...workout, sourceBundleId: 'com.other.workout' }],
        metric
      )
    ).toHaveLength(1);
    const hydration = { recordType: 'Hydration', unit: 'ml', type: 'water' };
    const water = { startTime: workout.startTime, volume: { inLiters: 0.5 } };
    expect(
      hk.transformHealthRecords(
        [{ ...water, sourceBundleId: phone }],
        hydration
      )
    ).toEqual([]);
    expect(
      hc.transformHealthRecords(
        [{ ...water, metadata: { dataOrigin: phone } }],
        hydration
      )
    ).toEqual([]);
    expect(
      hc.transformHealthRecords(
        [{ ...water, metadata: { dataOrigin: 'com.samsung.shealth' } }],
        hydration
      )
    ).toHaveLength(1);
  }
);

it('retains the native Watch metadata marker and runtime source discovery', () => {
  const root = path.resolve(__dirname, '../..');
  expect(
    fs.readFileSync(
      path.join(
        root,
        'targets/watch/Infrastructure/WorkoutHealthKitController.swift'
      ),
      'utf8'
    )
  ).toContain(`"${hk.WATCH_SESSION_METADATA_KEY}"`);
  expect(hk.WATCH_SESSION_METADATA_KEY).toBe('SparkyFitnessSessionId');
  expect(
    fs.readFileSync(
      path.join(root, 'src/services/healthConnectService.ios.ts'),
      'utf8'
    )
  ).toContain('currentAppSource().bundleIdentifier');
  expect(
    fs.readFileSync(
      path.join(root, 'src/services/healthConnectService.ts'),
      'utf8'
    )
  ).toContain('Application.applicationId');
});
