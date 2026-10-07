import registry from '../../src/localization/localeRegistry.json';

describe('Native plural support', () => {
  it('initializes the existing i18next instance when the runtime lacks PluralRules', async () => {
    const original = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')!;
    try {
      Object.defineProperty(Intl, 'PluralRules', {
        configurable: true,
        writable: true,
        value: undefined,
      });
      await jest.isolateModulesAsync(async () => {
        const { default: i18n, initializeI18n } =
          require('../../src/localization/i18n') as typeof import('../../src/localization/i18n');
        await initializeI18n('en');
        const locales = Object.values(registry.locales).map(
          (value) => value.intlLocale
        );
        expect(Intl.PluralRules.supportedLocalesOf(locales)).toHaveLength(
          locales.length
        );
        for (const [rank, expected] of [
          [1, '1st'],
          [2, '2nd'],
          [3, '3rd'],
          [11, '11th'],
          [21, '21st'],
        ] as const) {
          expect(
            i18n.t('challenges.ux.place', {
              count: rank,
              ordinal: true,
              number: String(rank),
            })
          ).toBe(`${expected} place`);
        }
        await i18n.changeLanguage('pl');
        i18n.addResourceBundle(
          'pl',
          'translation',
          {
            runtimeTest: {
              value_one: 'one',
              value_few: 'few',
              value_many: 'many',
            },
          },
          true,
          true
        );
        expect(i18n.t('runtimeTest.value', { count: 1 })).toBe('one');
        expect(i18n.t('runtimeTest.value', { count: 2 })).toBe('few');
        expect(i18n.t('runtimeTest.value', { count: 5 })).toBe('many');
        // Retain the app's existing fractional fallback, separate from ordinals.
        expect(i18n.t('runtimeTest.value', { count: 1.5 })).toBe('few');
      });
    } finally {
      Object.defineProperty(Intl, 'PluralRules', original);
    }
  });

  it('preserves a runtime that already provides native PluralRules', () => {
    const original = Intl.PluralRules;
    jest.isolateModules(() => {
      require('../../src/localization/i18n');
      expect(Intl.PluralRules).toBe(original);
    });
  });
});
