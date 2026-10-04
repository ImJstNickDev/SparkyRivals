import fs from 'fs';
import path from 'path';
const source = fs.readFileSync(
  path.resolve(__dirname, '../../modules/move-goal/ios/MoveGoalModule.swift'),
  'utf8'
);
it('uses Activity Summary and active-energy Move only, on explicit request', () => {
  expect(source).toContain('HKActivitySummaryQuery');
  expect(source).toContain('HKObjectType.activitySummaryType()');
  expect(source).toContain('summary.activityMoveMode == .activeEnergy');
  expect(source).toContain(
    'activeEnergyBurnedGoal.doubleValue(for: .kilocalorie())'
  );
  expect(source).toContain('toShare: []');
  expect(source).not.toMatch(
    /appleExerciseTimeGoal|appleStandHoursGoal|HKObserverQuery|save\(/
  );
});
it('registers only an iOS phone module without changing Watch transport', () => {
  const config = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../modules/move-goal/expo-module.config.json'
      ),
      'utf8'
    )
  );
  expect(config.platforms).toEqual(['ios']);
  expect(config.ios.modules).toEqual(['MoveGoalModule']);
  expect(source).not.toMatch(
    /WCSession|updateApplicationContext|HealthConnect/
  );
});
