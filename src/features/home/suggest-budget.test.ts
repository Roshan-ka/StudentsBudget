import { describe, expect, it } from 'vitest';
import { SETUP_ENVELOPE_IDS } from '@/data/categories';
import { CITIES, type City, type CityRange } from '@/data/cities';
import type { Amount, Entry, Plan } from '@/db/types';
import { FLEXIBLE_CATEGORIES } from '@/features/entries/categories';
import {
  fitTo,
  liveSuggestions,
  splitBudget,
  startingRows,
  suggestBudget,
  suggestionIsProminent,
  type Suggestion,
} from './suggest-budget';

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
    expect(rows.map((r) => r.categoryId)).toEqual([
      'food',
      'eating-out',
      'going-out',
      'transport',
      'shopping',
      'other',
    ]);
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

describe('splitBudget', () => {
  const regensburgRows = () => startingRows(CITIES.regensburg, NO_SPENDING, SETUP_ENVELOPE_IDS);
  /** Where each row starts from at the bottom: its range minimum, or its own amount without a range. */
  const lows = (rows: Suggestion) => rows.map((r) => r.range?.minMinor ?? r.amountMinor);
  const sumOf = (minors: number[]) => minors.reduce((sum, minor) => sum + minor, 0);
  /** The two sets of rows the properties below are checked on: the real city, and the test city with other numbers. */
  const cases: [string, () => Suggestion][] = [
    ['Regensburg', regensburgRows],
    ['the test city', setupRows],
  ];
  /** Budgets from nothing to a little above the middles, in odd cents so that no multiple of €5 hides a slip. */
  const budgetsFor = (rows: Suggestion): number[] => {
    const budgets: number[] = [];
    for (let budget = 0; budget <= total(rows) + 1000; budget += 137) budgets.push(budget);
    return budgets;
  };

  it('pins the assumption it rests on: every Regensburg range minimum is a multiple of €5', () => {
    for (const r of CITIES.regensburg.ranges) expect(r.minMinor % 500).toBe(0);
    for (const row of regensburgRows()) expect(row.amountMinor % 500).toBe(0);
  });

  it('gives the setup envelopes of Regensburg the amounts a €600 budget shows, and all of it', () => {
    const rows = splitBudget(regensburgRows(), 60000);
    // Food and shopping are tied for the last two €5 steps; the earlier category takes the first.
    expect(amounts(rows)).toEqual({
      food: 25000,
      'eating-out': 7500,
      'going-out': 7000,
      transport: 3000,
      shopping: 4500,
      other: 13000,
    });
    expect(total(rows)).toBe(60000);
  });

  it('is the bottom of every range at the sum of the minimums, and the middles at the sum of the middles', () => {
    const start = regensburgRows();
    expect(total(start)).toBe(64000);
    expect(sumOf(lows(start))).toBe(38000);
    expect(splitBudget(start, 38000).map((r) => r.amountMinor)).toEqual(lows(start));
    expect(splitBudget(start, 64000)).toEqual(start);
    expect(total(splitBudget(start, 45000))).toBe(45000);
    // €639 is under the middles, so €635 of it is handed out.
    expect(total(splitBudget(start, 63900))).toBe(63500);
  });

  it('has no cliff at the minimums or at the middles: a cent either side is at most one €5 step away', () => {
    const start = regensburgRows();
    const middles = start.map((r) => r.amountMinor);
    const lowsOf = lows(start);

    splitBudget(start, 38000 - 1).forEach((row, i) => {
      expect(lowsOf[i] - row.amountMinor).toBeGreaterThanOrEqual(0);
      expect(lowsOf[i] - row.amountMinor).toBeLessThanOrEqual(500);
    });
    splitBudget(start, 64000 - 1).forEach((row, i) => {
      expect(middles[i] - row.amountMinor).toBeGreaterThanOrEqual(0);
      expect(middles[i] - row.amountMinor).toBeLessThanOrEqual(500);
    });
    // And one €5 step above the minimums, no row has moved by more than that.
    splitBudget(start, 38000 + 500).forEach((row, i) => {
      expect(row.amountMinor - lowsOf[i]).toBeGreaterThanOrEqual(0);
      expect(row.amountMinor - lowsOf[i]).toBeLessThanOrEqual(500);
    });
  });

  it('leaves every row inside its range, from the minimum up to the middle', () => {
    for (const [name, makeRows] of cases) {
      const start = makeRows();
      const lowsOf = lows(start);
      for (const budget of budgetsFor(start)) {
        splitBudget(start, budget).forEach((row, i) => {
          const where = `${name}, ${budget}, ${row.categoryId}`;
          // Below the minimums every row is scaled down, so only the top of the range holds there.
          if (budget >= sumOf(lowsOf)) expect(row.amountMinor, where).toBeGreaterThanOrEqual(lowsOf[i]);
          expect(row.amountMinor, where).toBeLessThanOrEqual(start[i].amountMinor);
        });
      }
    }
  });

  it('adds up to the budget rounded down to €5 across the band, and never passes it outside', () => {
    for (const [name, makeRows] of cases) {
      const start = makeRows();
      const lowTotal = sumOf(lows(start));
      for (const budget of budgetsFor(start)) {
        const rows = splitBudget(start, budget);
        if (budget >= lowTotal && budget < total(start)) {
          expect(total(rows), `${name}, ${budget}`).toBe(Math.floor(budget / 500) * 500);
        } else {
          expect(total(rows), `${name}, ${budget}`).toBeLessThanOrEqual(budget);
        }
        for (const row of rows) expect(row.amountMinor % 500).toBe(0);
      }
    }
  });

  it('never lowers the total as the budget rises, and no row drops by more than one €5 step', () => {
    // Handing out the spare €5 steps by largest remainder cannot keep every row non-decreasing: at €595 shopping is
    // €50 and at €600 it is €45, because food's share has caught up with it and wins the tie. A row is its exact
    // share rounded down, which only rises, plus at most one step, so it can fall by one step and by no more.
    for (const [name, makeRows] of cases) {
      const start = makeRows();
      let before = splitBudget(start, 0);
      for (const budget of budgetsFor(start).slice(1)) {
        const rows = splitBudget(start, budget);
        expect(total(rows), `${name}, ${budget}`).toBeGreaterThanOrEqual(total(before));
        rows.forEach((row, i) => {
          expect(row.amountMinor, `${name}, ${budget}, ${row.categoryId}`).toBeGreaterThanOrEqual(
            before[i].amountMinor - 500,
          );
        });
        before = rows;
      }
    }
  });

  it('scales every row down as fitTo does under the minimums, and keeps the middles from there up', () => {
    const start = regensburgRows();
    for (const budget of [-100, 0, 1, 12345, 30000, 37999]) {
      expect(splitBudget(start, budget)).toEqual(fitTo(start, budget));
    }
    expect(total(splitBudget(start, 0))).toBe(0);
    // Above the middles nothing is scaled up: the rest stays unassigned.
    for (const budget of [64000, 64001, 70000, 1_000_000]) expect(splitBudget(start, budget)).toEqual(start);
  });

  it('keeps a row without a range at its amount, and splits only the ranged rows around it', () => {
    // Food €180–340 (middle €260) and going out €30–120 (middle €75), with health at last month's €50 and no range.
    const start = startingRows(city, new Map([['health', 5000]]), ['food', 'going-out', 'health']);
    const rows = splitBudget(start, 30000);
    // The exact shares are €205.60 and €44.40: rounded down to €200 and €40, the spare €5 goes to going out.
    expect(amounts(rows)).toEqual({ food: 20500, 'going-out': 4500, health: 5000 });
    expect(total(rows)).toBe(30000);
    expect(rows[0].range).toEqual(food);
    expect(rows[2]).toEqual({ categoryId: 'health', amountMinor: 5000, basis: 'last-month' });
  });

  it('keeps the basis and range of every row, and does not change the rows it is given', () => {
    const start = regensburgRows();
    const copy = structuredClone(start);
    const rows = splitBudget(start, 60000);
    expect(start).toEqual(copy);
    expect(rows.map((r) => [r.categoryId, r.basis, r.range])).toEqual(
      start.map((r) => [r.categoryId, r.basis, r.range]),
    );
  });

  it('gives these amounts at the budgets setup is checked at', () => {
    const start = regensburgRows();
    const at = (budget: number) => splitBudget(start, budget).map((r) => r.amountMinor / 100);
    // In order: food, eating out, going out, transport, shopping, other.
    expect(at(38000)).toEqual([180, 30, 30, 10, 35, 95]);
    expect(at(45000)).toEqual([200, 45, 45, 15, 40, 105]);
    expect(at(60000)).toEqual([250, 75, 70, 30, 45, 130]);
    expect(at(63900)).toEqual([255, 85, 75, 35, 50, 135]);
    expect(at(64000)).toEqual([260, 85, 75, 35, 50, 135]);
  });
});

describe('liveSuggestions', () => {
  /** Every flexible envelope of a plan, at what `set` gives it in euros and €0 otherwise. */
  const envelopes = (set: Record<string, number> = {}): Amount[] =>
    FLEXIBLE_CATEGORIES.map((c) => ({ categoryId: c.id, monthlyMinor: (set[c.id] ?? 0) * 100 }));
  const live = (set: Record<string, number>, budgetMinor: number) =>
    amounts(
      [...liveSuggestions(envelopes(set), SETUP_ENVELOPE_IDS, budgetMinor, CITIES.regensburg)].map(
        ([categoryId, amountMinor]) => ({ categoryId, amountMinor }),
      ),
    );
  const euros = (set: Record<string, number>, budgetMinor: number) =>
    Object.fromEntries(Object.entries(live(set, budgetMinor)).map(([id, minor]) => [id, minor / 100]));

  it('is the split of the whole budget when no envelope is set', () => {
    const start = startingRows(CITIES.regensburg, NO_SPENDING, SETUP_ENVELOPE_IDS);
    expect(live({}, 60000)).toEqual(amounts(splitBudget(start, 60000)));
    expect(euros({}, 60000)).toEqual({
      food: 250,
      'eating-out': 75,
      'going-out': 70,
      transport: 30,
      shopping: 45,
      other: 130,
    });
  });

  it('suggests nothing without a budget', () => {
    for (const budget of [0, -100]) {
      expect(liveSuggestions(envelopes(), SETUP_ENVELOPE_IDS, budget, CITIES.regensburg).size).toBe(0);
    }
  });

  it('gives one suggestion per envelope asked about, and none for the others', () => {
    const map = liveSuggestions(envelopes({ travel: 40 }), SETUP_ENVELOPE_IDS, 60000, CITIES.regensburg);
    expect([...map.keys()]).toEqual(SETUP_ENVELOPE_IDS);
  });

  it('splits what is left over the envelopes that are not set, when one is', () => {
    // Food is set to €300: the other five share the remaining €300, and food keeps the share it had.
    expect(euros({ food: 300 }, 60000)).toEqual({
      food: 250,
      'eating-out': 60,
      'going-out': 55,
      transport: 25,
      shopping: 45,
      other: 115,
    });
    const rest = live({ food: 300 }, 60000);
    expect(rest['eating-out'] + rest['going-out'] + rest.transport + rest.shopping + rest.other).toBe(30000);
  });

  it('keeps the suggestion of the envelope being typed into, and changes only those of the others', () => {
    for (const typed of [0, 100, 250, 300, 700]) {
      expect(live({ food: typed }, 60000).food).toBe(25000);
    }
    expect(live({ food: 100 }, 60000)['eating-out']).toBeGreaterThan(live({ food: 300 }, 60000)['eating-out']);
  });

  it('suggests, for an envelope that is set, its own share given all the others', () => {
    // All six set, adding up to the budget: each one is what it is.
    expect(euros({ food: 250, 'eating-out': 75, 'going-out': 70, transport: 30, shopping: 45, other: 130 }, 60000)).toEqual({
      food: 250,
      'eating-out': 75,
      'going-out': 70,
      transport: 30,
      shopping: 45,
      other: 130,
    });
    // Set to less: each suggestion is capped at the middle of its range, as the share of what the others leave.
    expect(euros({ food: 200, 'eating-out': 50, 'going-out': 50, transport: 20, shopping: 40, other: 100 }, 60000)).toEqual({
      food: 260,
      'eating-out': 85,
      'going-out': 75,
      transport: 35,
      shopping: 50,
      other: 135,
    });
    // The others leave €5: that is all transport is suggested.
    expect(euros({ food: 300, 'eating-out': 100, 'going-out': 100, shopping: 50, other: 45 }, 60000).transport).toBe(5);
  });

  it('suggests €0 everywhere when what is set already uses the whole budget, or more', () => {
    // An envelope outside the six (asked in edit mode) takes €700 of €600.
    expect(euros({ travel: 700 }, 60000)).toEqual({
      food: 0,
      'eating-out': 0,
      'going-out': 0,
      transport: 0,
      shopping: 0,
      other: 0,
    });
    // Food alone is over: it still shows its own share, and the others have nothing left.
    expect(euros({ food: 700 }, 60000)).toEqual({
      food: 250,
      'eating-out': 0,
      'going-out': 0,
      transport: 0,
      shopping: 0,
      other: 0,
    });
  });

  it('takes an envelope outside the six, set in edit mode, off the budget', () => {
    const start = startingRows(CITIES.regensburg, NO_SPENDING, SETUP_ENVELOPE_IDS);
    expect(live({ travel: 40 }, 60000)).toEqual(amounts(splitBudget(start, 56000)));
    expect(euros({ travel: 40 }, 60000)).toEqual({
      food: 235,
      'eating-out': 70,
      'going-out': 60,
      transport: 25,
      shopping: 45,
      other: 125,
    });
  });

  it('gives every envelope that is not set the same split, so filling them all adds up to what is left', () => {
    const set = { food: 300, travel: 40 };
    const suggested = live(set, 60000);
    const unset = SETUP_ENVELOPE_IDS.filter((id) => id !== 'food');
    expect(unset.reduce((sum, id) => sum + suggested[id], 0)).toBe(26000);
    // And once they are filled with those amounts, each suggestion is that amount (food: what is left, to its middle).
    const filled = { ...set, ...Object.fromEntries(unset.map((id) => [id, suggested[id] / 100])) };
    expect(live(filled, 60000)).toEqual({ ...suggested, food: 26000 });
  });

  it('counts an envelope with no amount, or a negative one, as not set', () => {
    const odd: Amount[] = [
      { categoryId: 'food', monthlyMinor: -500 },
      { categoryId: 'travel', monthlyMinor: 0 },
    ];
    const start = startingRows(CITIES.regensburg, NO_SPENDING, SETUP_ENVELOPE_IDS);
    expect(Object.fromEntries(liveSuggestions(odd, SETUP_ENVELOPE_IDS, 60000, CITIES.regensburg))).toEqual(
      amounts(splitBudget(start, 60000)),
    );
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
