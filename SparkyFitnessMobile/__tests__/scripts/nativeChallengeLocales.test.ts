import fs from 'node:fs';
import path from 'node:path';
import {
  parseWearResources,
  validateAppleCatalog,
  validateWearResources,
  validateNativeChallengeLocales,
} from '../../scripts/validate-native-challenge-locales.mjs';

const unit = (value: string) => ({
  stringUnit: { state: 'translated', value },
});
const apple = () => ({
  sourceLanguage: 'en',
  version: '1.0',
  strings: {
    '%lld goal days': {
      localizations: {
        en: {
          variations: {
            plural: {
              one: unit('%lld goal day'),
              other: unit('%lld goal days'),
            },
          },
        },
        it: {
          variations: {
            plural: {
              one: unit('%lld giorno a obiettivo'),
              other: unit('%lld giorni a obiettivo'),
            },
          },
        },
      },
    },
  },
});
const wear = (text: string) =>
  parseWearResources(`<resources>${text}</resources>`);
it('validates shipped Watch, extension and Wear resources separately from phone widgets', () => {
  const report = validateNativeChallengeLocales(
    path.resolve(__dirname, '../..')
  );
  expect(report.watch.it).toBe(report.watch.en);
  expect(report['watch-widget'].it).toBe(report['watch-widget'].en);
  expect(report.wear['values-it'].translated).toBe(report.wear.values.total);
});
it('accepts typed Apple plurals and rejects a string count substitution', () => {
  expect(validateAppleCatalog(apple(), 'watch')).toEqual({ en: 1, it: 1 });
  const broken = apple();
  broken.strings['%lld goal days'].localizations.it.variations.plural.one =
    unit('%@ giorno');
  expect(() => validateAppleCatalog(broken, 'watch')).toThrow(
    'placeholder mismatch'
  );
});
it('rejects a missing mandatory native plural fallback', () => {
  const broken = JSON.parse(JSON.stringify(apple())) as ReturnType<
    typeof apple
  >;
  Reflect.deleteProperty(
    broken.strings['%lld goal days'].localizations.it.variations.plural,
    'other'
  );
  expect(() => validateAppleCatalog(broken, 'watch')).toThrow(
    'missing plural form'
  );
});
it('rejects malformed/duplicate Wear plural declarations', () => {
  expect(() =>
    wear('<plurals name="days"><item quantity="one">one</item></plurals>')
  ).toThrow();
  expect(() =>
    wear(
      '<plurals name="days"><item quantity="other">one</item><item quantity="other">two</item></plurals>'
    )
  ).toThrow();
});
it('preserves numeric Wear plural arguments and validates positional placeholders', () => {
  const source = wear(
    '<plurals name="goal_days"><item quantity="one">%d day</item><item quantity="other">%d days</item></plurals>'
  );
  const target = wear(
    '<plurals name="goal_days"><item quantity="one">%d giorno</item><item quantity="other">%d giorni</item></plurals>'
  );
  expect(validateWearResources(source, target, 'it').translated).toBe(1);
  const broken = wear(
    '<plurals name="goal_days"><item quantity="other">%s giorni</item></plurals>'
  );
  expect(() => validateWearResources(source, broken, 'it')).toThrow();
});
it('rejects React interpolation in native resources', () => {
  const source = wear('<string name="updated">Updated %1$s</string>');
  expect(() =>
    validateWearResources(
      source,
      wear('<string name="updated">Aggiornato {{time}}</string>'),
      'it'
    )
  ).toThrow();
});
it('keeps resource inputs in target sources rather than generated projects', () => {
  const root = path.resolve(__dirname, '../..');
  for (const target of ['watch', 'watch-widget']) {
    const data = JSON.parse(
      fs.readFileSync(
        path.join(root, 'targets', target, 'Localizable.xcstrings'),
        'utf8'
      )
    );
    expect(data.sourceLanguage).toBe('en');
  }
  expect(
    fs.readFileSync(path.join(root, 'plugins/withWearOsCompanion.ts'), 'utf8')
  ).toContain('res');
});
