import { describe, expect, it } from 'vitest';
import { SWAPS, type Swap } from '@/data/swaps';
import { amountText, createSuggestionProvider, localSuggestions, swapLineText, type SuggestionRow } from './suggest';

const swap = (id: string, categoryId: string, fromMinor: number, toMinor: number, per = 'meal'): Swap => ({
  id,
  categoryId,
  title: `Swap ${id}`,
  body: `Body ${id}`,
  fromMinor,
  toMinor,
  per,
  source: 'Test source',
  url: 'https://example.com/source',
  checked: '2026-10-20',
});

// A saving of 400 in eating-out and 1000 in transport; nothing for food.
const provider = createSuggestionProvider([
  swap('eat-small', 'eating-out', 900, 500),
  swap('ride', 'transport', 3000, 2000, 'month'),
]);

const row = (categoryId: string, plannedMinor: number, spentMinor: number): SuggestionRow => ({
  categoryId,
  plannedMinor,
  spentMinor,
});

describe('suggestions: when a row qualifies', () => {
  it('over plan gives one suggestion', () => {
    const result = provider.suggest({ rows: [row('eating-out', 10000, 10100)], today: '2026-10-10' });
    expect(result).toEqual([{ categoryId: 'eating-out', swap: expect.objectContaining({ id: 'eat-small' }), savingPerUseMinor: 400 }]);
  });

  it('92% on day 10 gives one suggestion', () => {
    const result = provider.suggest({ rows: [row('eating-out', 10000, 9200)], today: '2026-10-10' });
    expect(result.map((s) => s.swap.id)).toEqual(['eat-small']);
  });

  it('92% on day 26 gives none: the last 7 days of the month are too late to change course', () => {
    expect(provider.suggest({ rows: [row('eating-out', 10000, 9200)], today: '2026-10-26' })).toEqual([]);
  });

  it('over plan still counts in the last 7 days', () => {
    const result = provider.suggest({ rows: [row('eating-out', 10000, 12000)], today: '2026-10-28' });
    expect(result.map((s) => s.swap.id)).toEqual(['eat-small']);
  });

  it('the 90% rule runs up to the 24th of a 31-day month, and the last 7 days start on the 25th', () => {
    const rows = [row('eating-out', 10000, 9200)];
    expect(provider.suggest({ rows, today: '2026-10-24' })).toHaveLength(1);
    expect(provider.suggest({ rows, today: '2026-10-25' })).toEqual([]);
  });

  it('the last 7 days follow the length of the month: they start on the 24th of a 30-day month', () => {
    const rows = [row('eating-out', 10000, 9200)];
    expect(provider.suggest({ rows, today: '2026-11-23' })).toHaveLength(1);
    expect(provider.suggest({ rows, today: '2026-11-24' })).toEqual([]);
  });

  it('the last 7 days of February start on the 22nd in 2027 (28 days) and on the 23rd in 2028 (29 days)', () => {
    const rows = [row('eating-out', 10000, 9200)];
    expect(provider.suggest({ rows, today: '2027-02-21' })).toHaveLength(1);
    expect(provider.suggest({ rows, today: '2027-02-22' })).toEqual([]);
    expect(provider.suggest({ rows, today: '2028-02-22' })).toHaveLength(1);
    expect(provider.suggest({ rows, today: '2028-02-23' })).toEqual([]);
  });

  it('exactly 90% has not passed 90%', () => {
    expect(provider.suggest({ rows: [row('eating-out', 10000, 9000)], today: '2026-10-10' })).toEqual([]);
    expect(provider.suggest({ rows: [row('eating-out', 10000, 9001)], today: '2026-10-10' })).toHaveLength(1);
  });

  it('on plan exactly is past 90%, so it counts early in the month but is not over', () => {
    expect(provider.suggest({ rows: [row('eating-out', 10000, 10000)], today: '2026-10-10' })).toHaveLength(1);
    expect(provider.suggest({ rows: [row('eating-out', 10000, 10000)], today: '2026-10-30' })).toEqual([]);
  });

  it('under plan gives none', () => {
    expect(provider.suggest({ rows: [row('eating-out', 10000, 5000)], today: '2026-10-10' })).toEqual([]);
  });

  it('a row planned at €0 with nothing spent gets nothing, and one planned at €0 with spending is over', () => {
    expect(provider.suggest({ rows: [row('eating-out', 0, 0)], today: '2026-10-10' })).toEqual([]);
    expect(provider.suggest({ rows: [row('eating-out', 0, 1)], today: '2026-10-10' })).toHaveLength(1);
  });
});

describe('suggestions: which swap', () => {
  it('a category without a swap gets none', () => {
    expect(provider.suggest({ rows: [row('food', 10000, 15000)], today: '2026-10-10' })).toEqual([]);
  });

  it('the swap that saves the most per use wins, wherever it sits in the list', () => {
    const many = createSuggestionProvider([
      swap('small', 'eating-out', 900, 700),
      swap('big', 'eating-out', 1450, 380),
      swap('medium', 'eating-out', 1000, 500),
    ]);
    const [only, ...rest] = many.suggest({ rows: [row('eating-out', 10000, 12000)], today: '2026-10-10' });
    expect(rest).toEqual([]);
    expect(only.swap.id).toBe('big');
    expect(only.savingPerUseMinor).toBe(1070);
  });

  it('a tie goes to the swap written first', () => {
    const tied = createSuggestionProvider([swap('first', 'eating-out', 900, 500), swap('second', 'eating-out', 800, 400)]);
    const result = tied.suggest({ rows: [row('eating-out', 10000, 12000)], today: '2026-10-10' });
    expect(result.map((s) => s.swap.id)).toEqual(['first']);
  });

  it('each qualifying row gets its own suggestion, in the order of the rows', () => {
    const result = provider.suggest({
      rows: [row('transport', 1000, 5000), row('food', 1000, 5000), row('eating-out', 10000, 12000), row('shopping', 100, 50)],
      today: '2026-10-10',
    });
    expect(result.map((s) => [s.categoryId, s.swap.id, s.savingPerUseMinor])).toEqual([
      ['transport', 'ride', 1000],
      ['eating-out', 'eat-small', 400],
    ]);
  });

  it('no rows, no suggestions', () => {
    expect(provider.suggest({ rows: [], today: '2026-10-10' })).toEqual([]);
  });
});

describe('localSuggestions', () => {
  it('suggests a seeded swap for every category that has one, once it runs over', () => {
    const categoryIds = [...new Set(SWAPS.map((s) => s.categoryId))];
    expect(categoryIds.length).toBeGreaterThan(0);
    const result = localSuggestions.suggest({
      rows: categoryIds.map((id) => row(id, 5000, 6000)),
      today: '2026-10-10',
    });
    expect(result.map((s) => s.categoryId)).toEqual(categoryIds);
    for (const s of result) {
      const best = Math.max(...SWAPS.filter((w) => w.categoryId === s.categoryId).map((w) => w.fromMinor - w.toMinor));
      expect(s.savingPerUseMinor, s.categoryId).toBe(best);
    }
  });

  it('has nothing for a category with no seeded swap', () => {
    expect(localSuggestions.suggest({ rows: [row('health', 1000, 5000)], today: '2026-10-10' })).toEqual([]);
  });
});

describe('swapLineText', () => {
  const line = (fromMinor: number, toMinor: number, per: string, title = 'Do it') =>
    swapLineText({ categoryId: 'eating-out', swap: { ...swap('x', 'eating-out', fromMinor, toMinor, per), title }, savingPerUseMinor: fromMinor - toMinor });

  it('says the title and the saving per use, in whole euros rounded down', () => {
    expect(line(1450, 380, 'meal', 'Eat at the Mensa')).toBe('Try this: Eat at the Mensa · save about €10 per meal');
    expect(line(1000, 350, 'meal')).toBe('Try this: Do it · save about €6 per meal');
  });

  it('says a whole-euro saving as it is', () => {
    expect(line(3400, 2200, 'month', 'Book the ticket')).toBe('Try this: Book the ticket · save about €12 per month');
    expect(line(900, 800, 'ticket', 'See a film')).toBe('Try this: See a film · save about €1 per ticket');
  });

  it('keeps the cents of a saving under €1', () => {
    expect(line(900, 850, 'ticket', 'See a film')).toBe('Try this: See a film · save about €0.50 per ticket');
  });
});

describe('amountText', () => {
  it('keeps the cents of an amount that has them and drops them from a whole-euro one', () => {
    expect(amountText(1450)).toBe('€14.50');
    expect(amountText(380)).toBe('€3.80');
    expect(amountText(3400)).toBe('€34');
    expect(amountText(2200)).toBe('€22');
  });
});
