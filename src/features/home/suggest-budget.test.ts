import { describe, expect, it } from 'vitest';
import { SETUP_ENVELOPE_IDS } from '@/data/categories';
import { CITIES, type City, type CityRange } from '@/data/cities';
import type { Entry, Plan } from '@/db/types';
import { FLEXIBLE_CATEGORIES } from '@/features/entries/categories';
import { fitTo, startingRows, suggestBudget, suggestionIsProminent } from './suggest-budget';

const range = (categoryId: string, minMinor: number, maxMinor: number): CityRange => ({
  categoryId,
  minMinor,
  maxMinor,
  source: 'A source',
  url: 'https://example.com',
  checked: '2026-10-16',
});

/** Two ranges only, so the sums below are easy to follow: food €180–340 (middle €260), going out €30–120 (middle €75). */
const food = range('food', 18000, 34000);
const goingOut = range('going-out', 3000, 12000);
const city: City = { id: 'regensburg', name: 'Regensburg', ranges: [food, goingOut], prices: [] };

/** A plan with `availableMinor` left each month: income minus a €400 rent, no set-asides. */
function planWithAvailable(availableMinor: number): Plan {
  return {
    id: 'current',
    cityId: 'regensburg',
    incomes: [{ categoryId: 'income-parents', monthlyMinor: availableMinor + 40000 }],
    fixed: [{ categoryId: 'rent', monthlyMinor: 40000 }],
    oneOffs: [],
    envelopes: [],
    createdOn: '2026-10-01',
  };
}

function expense(categoryId: string, date: string, eurMinor: number): Extract<Entry, { categoryId: string }> {
  return {
    id: `${categoryId}-${date}-${eurMinor}`,
    type: 'expense',
    categoryId,
    date,
    accountId: 'bank',
    amountMinor: eurMinor,
    eurMinor,
    note: '',
    createdAt: '2026-10-01T10:00:00.000Z',
  };
}

const amounts = (rows: { categoryId: string; amountMinor: number }[]) =>
  Object.fromEntries(rows.map((r) => [r.categoryId, r.amountMinor]));

describe('suggestBudget', () => {
  it('gives one row per flexible category, in category order', () => {
    const { rows } = suggestBudget(planWithAvailable(100000), city, [], '2026-11');
    expect(rows.map((r) => r.categoryId)).toEqual(FLEXIBLE_CATEGORIES.map((c) => c.id));
    expect(rows).toHaveLength(12);
  });

  it('starts every ranged category at the middle of its range when the plan fits', () => {
    const result = suggestBudget(planWithAvailable(100000), city, [], '2026-11');

    expect(result.availableMinor).toBe(100000);
    const byId = Object.fromEntries(result.rows.map((r) => [r.categoryId, r]));
    expect(byId.food).toEqual({ categoryId: 'food', amountMinor: 26000, basis: 'city', range: food });
    expect(byId['going-out']).toEqual({ categoryId: 'going-out', amountMinor: 7500, basis: 'city', range: goingOut });
    // €260 + €75 of €1,000: the rest is left for savings.
    expect(result.unallocatedMinor).toBe(100000 - 33500);
  });

  it('rounds the middle of a range to the nearest €5, and exactly halfway goes up', () => {
    const odd: City = {
      ...city,
      // Middles: €183.50 (nearer €185 than €180), €82.50 (exactly halfway, up to €85) and €77 (nearer €75).
      ranges: [range('food', 18000, 18700), range('eating-out', 3000, 13500), range('going-out', 3000, 12400)],
    };
    const byId = amounts(suggestBudget(planWithAvailable(100000), odd, [], '2026-11').rows);
    expect(byId.food).toBe(18500);
    expect(byId['eating-out']).toBe(8500);
    expect(byId['going-out']).toBe(7500);
  });

  it('uses last month for a category without a range, rounded to €5', () => {
    const entries = [
      expense('health', '2026-10-03', 4800),
      expense('health', '2026-10-20', 100),
      expense('study', '2026-10-09', 4600),
      expense('household', '2026-10-09', 7500),
    ];
    const { rows } = suggestBudget(planWithAvailable(100000), city, entries, '2026-11');
    const byId = Object.fromEntries(rows.map((r) => [r.categoryId, r]));

    // €49 rounds to €50, €46 to €45, and €75 stays.
    expect(byId.health).toEqual({ categoryId: 'health', amountMinor: 5000, basis: 'last-month' });
    expect(byId.study).toEqual({ categoryId: 'study', amountMinor: 4500, basis: 'last-month' });
    expect(byId.household).toEqual({ categoryId: 'household', amountMinor: 7500, basis: 'last-month' });
  });

  it('counts only expenses of the month before, and leaves a ranged category on its range', () => {
    const entries = [
      expense('health', '2026-09-30', 9900), // two months back
      expense('health', '2026-11-02', 9900), // the month itself
      { ...expense('health', '2026-10-10', 9900), type: 'income' as const },
      expense('food', '2026-10-10', 99900), // has a range: the city wins
    ];
    const { rows } = suggestBudget(planWithAvailable(100000), city, entries, '2026-11');
    const byId = Object.fromEntries(rows.map((r) => [r.categoryId, r]));

    expect(byId.health).toEqual({ categoryId: 'health', amountMinor: 0, basis: 'none' });
    expect(byId.food.amountMinor).toBe(26000);
    expect(byId.food.basis).toBe('city');
  });

  it('looks at December when the month is January', () => {
    const { rows } = suggestBudget(planWithAvailable(100000), city, [expense('health', '2026-12-15', 2000)], '2027-01');
    expect(rows.find((r) => r.categoryId === 'health')).toEqual({
      categoryId: 'health',
      amountMinor: 2000,
      basis: 'last-month',
    });
  });

  it('keeps last month as the basis when the spending rounds to €0', () => {
    const entries = [
      expense('health', '2026-10-05', 200), // €2: under half of €5
      expense('study', '2026-10-05', 249),
      expense('household', '2026-10-05', 250), // exactly halfway, up to €5
    ];
    const { rows } = suggestBudget(planWithAvailable(100000), city, entries, '2026-11');
    const byId = Object.fromEntries(rows.map((r) => [r.categoryId, r]));

    expect(byId.health).toEqual({ categoryId: 'health', amountMinor: 0, basis: 'last-month' });
    expect(byId.study).toEqual({ categoryId: 'study', amountMinor: 0, basis: 'last-month' });
    expect(byId.household).toEqual({ categoryId: 'household', amountMinor: 500, basis: 'last-month' });
  });

  it('has no basis for a category with neither a range nor spending last month', () => {
    const { rows } = suggestBudget(planWithAvailable(100000), city, [], '2026-11');
    const gifts = rows.find((r) => r.categoryId === 'gifts');
    expect(gifts).toEqual({ categoryId: 'gifts', amountMinor: 0, basis: 'none' });
  });

  it('takes the ranged categories down to their minimum when the middles are too much', () => {
    // €260 + €75 = €335 is above €300, and €180 + €30 = €210 is not.
    const result = suggestBudget(planWithAvailable(30000), city, [], '2026-11');
    const byId = amounts(result.rows);

    expect(byId.food).toBe(18000);
    expect(byId['going-out']).toBe(3000);
    expect(result.unallocatedMinor).toBe(30000 - 21000);
    // The range stays on the row, so the amount can still be compared with it.
    expect(result.rows.find((r) => r.categoryId === 'food')?.range).toEqual(food);
  });

  it('keeps a last-month amount while only the ranged categories drop to their minimum', () => {
    // Middles €335 + €50 = €385 is above €350; minimums €210 + €50 = €260 is not.
    const result = suggestBudget(planWithAvailable(35000), city, [expense('health', '2026-10-05', 5000)], '2026-11');
    expect(amounts(result.rows)).toMatchObject({ food: 18000, 'going-out': 3000, health: 5000 });
    expect(result.unallocatedMinor).toBe(35000 - 26000);
  });

  it('scales every row down, rounded down to €5, when even the minimums are too much', () => {
    // Minimums €180 + €30 + last month's €50 = €260, against €150.
    const result = suggestBudget(planWithAvailable(15000), city, [expense('health', '2026-10-05', 5000)], '2026-11');
    const byId = amounts(result.rows);

    // 18000 * 15000 / 26000 = 10384, 3000 * ... = 1730, 5000 * ... = 2884, each down to a €5 step.
    expect(byId.food).toBe(10000);
    expect(byId['going-out']).toBe(1500);
    expect(byId.health).toBe(2500);
    const total = result.rows.reduce((sum, r) => sum + r.amountMinor, 0);
    expect(total).toBe(14000);
    expect(total).toBeLessThanOrEqual(15000);
    expect(result.unallocatedMinor).toBe(15000 - total);
    // Every amount is a whole €5.
    for (const row of result.rows) expect(row.amountMinor % 500).toBe(0);
  });

  it('never suggests more than is available, however little there is', () => {
    const entries = [expense('health', '2026-10-05', 5000), expense('travel', '2026-10-06', 12345)];
    for (let available = 0; available <= 40000; available += 700) {
      const result = suggestBudget(planWithAvailable(available), city, entries, '2026-11');
      const total = result.rows.reduce((sum, r) => sum + r.amountMinor, 0);
      expect(total).toBeLessThanOrEqual(available);
      expect(result.unallocatedMinor).toBe(available - total);
    }
  });

  it('suggests €0 everywhere when nothing is available', () => {
    const none = suggestBudget(planWithAvailable(0), city, [expense('health', '2026-10-05', 5000)], '2026-11');
    expect(none.availableMinor).toBe(0);
    expect(none.rows.every((r) => r.amountMinor === 0)).toBe(true);
    expect(none.unallocatedMinor).toBe(0);

    // Fixed costs above the income: available is negative, the suggestion is still €0 and nothing is left over.
    const below = suggestBudget(planWithAvailable(-20000), city, [], '2026-11');
    expect(below.availableMinor).toBe(-20000);
    expect(below.rows.every((r) => r.amountMinor === 0)).toBe(true);
    expect(below.unallocatedMinor).toBe(0);
  });

  it('takes the set-asides and paused lines into account through the plan summary', () => {
    const plan: Plan = {
      ...planWithAvailable(100000),
      oneOffs: [{ id: 'fee', name: 'Fee', amountMinor: 30000, createdMonth: '2026-10', dueMonth: '2027-03' }],
      fixed: [
        { categoryId: 'rent', monthlyMinor: 40000 },
        {
          categoryId: 'subscriptions',
          monthlyMinor: 5000,
          schedule: {
            id: 's',
            frequency: 'monthly',
            day: 1,
            accountId: 'bank',
            amountMinor: 5000,
            startOn: '2026-10-01',
            postedThrough: '2026-10-01',
            paused: true,
          },
        },
      ],
    };
    // €1,000 available, less the fee spread over five months (€60); the paused subscription is not counted.
    expect(suggestBudget(plan, city, [], '2026-11').availableMinor).toBe(100000 - 6000);
  });
});

/** The six envelopes a new setup suggests for, each with a range: the middles add up to €635 and the minimums to €390. */
const setupCity: City = {
  ...city,
  ranges: [
    range('food', 18000, 34000),
    range('eating-out', 4000, 12000),
    range('going-out', 3000, 12000),
    range('transport', 1000, 6000),
    range('shopping', 3500, 6500),
    range('other', 9500, 17500),
  ],
};
const NO_SPENDING = new Map<string, number>();
const setupRows = () => startingRows(setupCity, NO_SPENDING, SETUP_ENVELOPE_IDS);
const total = (rows: { amountMinor: number }[]) => rows.reduce((sum, row) => sum + row.amountMinor, 0);

describe('startingRows', () => {
  it('gives one row per id asked for, in that order', () => {
    const rows = setupRows();
    expect(rows.map((r) => r.categoryId)).toEqual(['food', 'eating-out', 'going-out', 'transport', 'shopping', 'other']);
    expect(startingRows(setupCity, NO_SPENDING, ['other', 'food']).map((r) => r.categoryId)).toEqual(['other', 'food']);
    expect(startingRows(setupCity, NO_SPENDING, [])).toEqual([]);
  });

  it('starts a ranged category at the middle of its range, to the nearest €5', () => {
    expect(amounts(setupRows())).toEqual({
      food: 26000,
      'eating-out': 8000,
      'going-out': 7500,
      transport: 3500,
      shopping: 5000,
      other: 13500,
    });
    expect(total(setupRows())).toBe(63500);
    expect(setupRows().every((r) => r.basis === 'city' && r.range !== undefined)).toBe(true);
  });

  it('starts one without a range at last month, to the nearest €5, or at €0 with a basis of none', () => {
    const spent = new Map([['health', 4800]]);
    expect(startingRows(city, spent, ['health', 'gifts'])).toEqual([
      { categoryId: 'health', amountMinor: 5000, basis: 'last-month' },
      { categoryId: 'gifts', amountMinor: 0, basis: 'none' },
    ]);
    // A ranged category keeps its range, whatever was spent.
    expect(startingRows(city, new Map([['food', 99900]]), ['food'])[0].amountMinor).toBe(26000);
  });
});

describe('fitTo', () => {
  it('leaves rows as they are when they fit, down to a total that is exactly the budget', () => {
    expect(fitTo(setupRows(), 100000)).toEqual(setupRows());
    expect(fitTo(setupRows(), 63500)).toEqual(setupRows());
  });

  it('takes the ranged rows down to their minimums when the middles are too much', () => {
    // €635 is above €600, and the minimums (€390) are not.
    const rows = fitTo(setupRows(), 60000);
    expect(amounts(rows)).toEqual({
      food: 18000,
      'eating-out': 4000,
      'going-out': 3000,
      transport: 1000,
      shopping: 3500,
      other: 9500,
    });
    expect(total(rows)).toBe(39000);
    // The range stays on the row, so the amount can still be compared with it.
    expect(rows[0].range).toEqual(setupCity.ranges[0]);
  });

  it('scales every row down in proportion, rounded down to €5, when even the minimums are too much', () => {
    const rows = fitTo(setupRows(), 30000);
    expect(amounts(rows)).toEqual({
      food: 13500,
      'eating-out': 3000,
      'going-out': 2000,
      transport: 500,
      shopping: 2500,
      other: 7000,
    });
    expect(total(rows)).toBe(28500);
  });

  it('never passes the budget, in whole €5, however small the budget is', () => {
    for (let budget = 1; budget <= 70000; budget += 1300) {
      const rows = fitTo(setupRows(), budget);
      expect(total(rows)).toBeLessThanOrEqual(budget);
      for (const row of rows) expect(row.amountMinor % 500).toBe(0);
    }
  });

  it('suggests €0 everywhere for a budget of €0 or less, and keeps each row otherwise as it was', () => {
    for (const budget of [0, -100]) {
      const rows = fitTo(setupRows(), budget);
      expect(total(rows)).toBe(0);
      expect(rows.map((r) => r.categoryId)).toEqual(SETUP_ENVELOPE_IDS);
      expect(rows[0].range).toEqual(setupCity.ranges[0]);
    }
  });

  it('does not change the rows it is given', () => {
    const rows = setupRows();
    const copy = structuredClone(rows);
    fitTo(rows, 30000);
    fitTo(rows, 0);
    expect(rows).toEqual(copy);
  });

  it('gives the setup envelopes of Regensburg the amounts a €600 budget shows', () => {
    const rows = fitTo(startingRows(CITIES.regensburg, NO_SPENDING, SETUP_ENVELOPE_IDS), 60000);
    // The middles come to €640, so €600 takes the six down to the bottom of their ranges.
    expect(amounts(rows)).toEqual({
      food: 18000,
      'eating-out': 3000,
      'going-out': 3000,
      transport: 1000,
      shopping: 3500,
      other: 9500,
    });
  });
});

describe('suggestionIsProminent', () => {
  // Available is €440 a month.
  const base = planWithAvailable(44000);
  const within: Plan = { ...base, envelopes: [{ categoryId: 'food', monthlyMinor: 31000 }] };
  const over: Plan = { ...base, envelopes: [{ categoryId: 'food', monthlyMinor: 46000 }] };

  it('is prominent through the 7th of the month', () => {
    expect(suggestionIsProminent(within, '2026-11-01')).toBe(true);
    expect(suggestionIsProminent(within, '2026-11-07')).toBe(true);
  });

  it('steps back from the 8th on', () => {
    expect(suggestionIsProminent(within, '2026-11-08')).toBe(false);
    expect(suggestionIsProminent(within, '2026-11-30')).toBe(false);
  });

  it('is prominent whatever the day when the envelopes are more than what is available', () => {
    expect(suggestionIsProminent(over, '2026-11-08')).toBe(true);
    expect(suggestionIsProminent(over, '2026-11-30')).toBe(true);
  });

  it('is not prominent when the envelopes use up exactly what is available', () => {
    const exact: Plan = { ...base, envelopes: [{ categoryId: 'food', monthlyMinor: 44000 }] };
    expect(suggestionIsProminent(exact, '2026-11-08')).toBe(false);
  });
});
