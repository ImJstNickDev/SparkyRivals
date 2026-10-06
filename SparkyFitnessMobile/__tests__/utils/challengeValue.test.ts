import { createInstance } from 'i18next';
import {
  challengeDisplayQuantity,
  formatChallengeValue,
  formatChallengeDisplay,
} from '@workspace/shared';
import en from '../../src/localization/locales/en/translation.json';
import italian from '../../src/localization/locales/it/translation.json';
const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en }, it: { translation: italian } },
    interpolation: { escapeValue: false },
  });
});
it.each([
  'steps',
  'meters',
  'kcal',
  'seconds',
  'milliliters',
  'points',
  'goal_days',
] as const)('withUnit=false omits every unit, including %s', (unit) => {
  expect(formatChallengeValue(1234, unit, 'it', false)).not.toMatch(/[a-z]/i);
  expect(
    formatChallengeDisplay(1234, unit, 'it', i18n.getFixedT('it'), {}, false)
  ).not.toMatch(/[a-z]/i);
});
it('formats numeric count plurals and Italian numbers', () => {
  const t = i18n.getFixedT('it');
  expect(formatChallengeDisplay(1, 'goal_days', 'it', t)).toBe(
    '1 giorno a obiettivo'
  );
  expect(formatChallengeDisplay(2, 'goal_days', 'it', t)).toBe(
    '2 giorni a obiettivo'
  );
  expect(formatChallengeDisplay(13.020833, 'points', 'it', t)).toBe(
    '13,02 punti'
  );
  expect(formatChallengeDisplay(1, 'steps', 'it', t)).toBe('1 passo');
  expect(formatChallengeDisplay(140, 'points', 'it', t)).toBe('140 punti');
});
it('respects chosen display units without changing canonical inputs', () => {
  const t = i18n.getFixedT('en');
  expect(
    formatChallengeDisplay(1609.34, 'meters', 'en', t, { distance: 'miles' })
  ).toBe('1 mi');
  expect(formatChallengeDisplay(100, 'kcal', 'en', t, { energy: 'kJ' })).toBe(
    '418.4 kJ'
  );
  expect(
    formatChallengeDisplay(2500, 'milliliters', 'en', t, { water: 'liter' })
  ).toBe('2.5 L');
  expect(
    formatChallengeDisplay(29.5735, 'milliliters', 'en', t, { water: 'oz' })
  ).toBe('1 fl oz');
  expect(formatChallengeDisplay(2700, 'seconds', 'en', t)).toBe('45 min');
});
it('does not make a tiny positive gap look like equality, or crash on valid large scores', () => {
  expect(
    formatChallengeDisplay(0.000001, 'points', 'en', i18n.getFixedT('en'))
  ).toBe('<0.01 points');
  expect(
    formatChallengeDisplay(1e16, 'points', 'en', i18n.getFixedT('en'))
  ).toBe('10,000,000,000,000,000 points');
});
it('keeps the converted number and unit in agreement for long durations', () => {
  expect(challengeDisplayQuantity(13320, 'seconds')).toEqual({
    value: 3.7,
    unit: 'hours',
    decimals: 2,
  });
});
