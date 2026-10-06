import i18n from '../../src/localization/i18n';
import en from '../../src/localization/locales/en/translation.json';
beforeAll(() => i18n.addResourceBundle('en', 'translation', en, true, true));
const t = i18n.getFixedT('en');
import {
  challengePointPrecision,
  formatChallengePoints,
  challengeDateRange,
  challengeUpdateAge,
} from '@workspace/shared';
import { goalResults } from '../helpers/challenges';
const entries = (values: string[]) =>
  values.map((v, i) => ({
    ...goalResults.entries[0]!,
    user_id: String(i),
    total_score: Number(v) / 1_000_000,
    total_score_scaled: v,
    rank: i + 1,
    is_tied: false,
  }));
describe('Challenge presentation, never ranking', () => {
  it.each([50, 100, 140, 200])('%s percent stays uncapped', (n) => {
    const e = entries([String(n * 1_000_000)])[0]!;
    expect(formatChallengePoints(e, 0, 'en')).toBe(String(n));
  });
  it('truncates instead of rounding and expands only colliding different scores', () => {
    const e = entries([
      '141900000',
      '140990000',
      '140980000',
      '140400000',
      '50500000',
    ]);
    expect([...challengePointPrecision(e).values()]).toEqual([0, 2, 2, 1, 0]);
    expect(
      e.map((x) =>
        formatChallengePoints(
          x,
          challengePointPrecision(e).get(x.user_id)!,
          'en'
        )
      )
    ).toEqual(['141', '140.99', '140.98', '140.4', '50']);
    expect(e.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5]);
  });
  it('true ties do not force decimals; unresolved tiny gaps do not invent ties', () => {
    expect([
      ...challengePointPrecision(entries(['140120000', '140120000'])).values(),
    ]).toEqual([0, 0]);
    const e = entries(['140000002', '140000001']);
    expect([...challengePointPrecision(e).values()]).toEqual([2, 2]);
    expect(e.map((x) => formatChallengePoints(x, 2, 'en'))).toEqual([
      '140',
      '140',
    ]);
    expect(e.map((x) => x.rank)).toEqual([1, 2]);
  });
  it('uses exact scaled values beyond binary-safe integers and locale decimal separators', () => {
    expect(
      formatChallengePoints(entries(['9007199254740993123456'])[0]!, 2, 'en')
    ).toBe('9,007,199,254,740,993.12');
    expect(formatChallengePoints(entries(['13020833'])[0]!, 2, 'it')).toBe(
      '13,02'
    );
  });
  it('keeps inclusive calendar duration over DST and locale ordering', () => {
    expect(challengeDateRange('2026-10-24', '2026-10-26', 'it')).toEqual({
      start: '24 ott',
      end: '26 ott',
      days: 3,
    });
    expect(challengeDateRange('2026-10-06', '2026-10-12', 'en-US')).toEqual({
      start: 'Oct 6',
      end: 'Oct 12',
      days: 7,
    });
    expect(challengeDateRange('2026-12-30', '2027-01-02', 'it')).toEqual({
      start: '30/12/2026',
      end: '02/01/2027',
      days: 4,
    });
    expect(challengeDateRange('2026-12-30', '2027-01-02', 'en-US').start).toBe(
      '12/30/2026'
    );
  });
  it('updates seconds/minutes/hours/days/weeks then uses a date, without changing source time', () => {
    const source = '2026-10-01T12:00:00Z',
      now = Date.parse(source);
    for (const [seconds, text] of [
      [14, '14s ago'],
      [39 * 60, '39m ago'],
      [4 * 3600, '4h ago'],
      [86400, 'Yesterday'],
      [2 * 86400, '2 days ago'],
      [7 * 86400, '1w ago'],
    ] as const)
      expect(challengeUpdateAge(source, now + seconds * 1000, 'en', t)).toBe(
        text
      );
    expect(
      challengeUpdateAge(source, now + 7 * 86400 * 1000 + 1000, 'en', t)
    ).toContain('2026');
    expect(challengeUpdateAge(source, now - 2000, 'en', t)).toBe('0s ago');
  });
});
