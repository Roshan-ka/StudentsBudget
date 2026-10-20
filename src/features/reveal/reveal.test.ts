import { describe, expect, it } from 'vitest';
import type { Entry, Guess, Plan } from '@/db/types';
import { REVEAL_MIN_DAYS, completedMonths, guessVsReality, monthRecap, unlockOn } from './reveal';

let nextId = 0;
function entry(categoryId: string, date: string, eurMinor: number, type: 'expense' | 'income' = 'expense'): Entry {
  nextId += 1;
  return {
    id: `e${nextId}`,
    type,
    categoryId,
    date,
    accountId: 'cash',
    amountMinor: eurMinor,
    eurMinor,
    note: '',
    createdAt: `${date}T12:00:00.000Z`,
  };
}

function transfer(date: string, eurMinor: number): Entry {
  nextId += 1;
  return {
    id: `e${nextId}`,
    type: 'transfer',
    date,
    accountId: 'bank',
    toAccountId: 'cash',
    amountMinor: eurMinor,
    toAmountMinor: eurMinor,
    eurMinor,
    note: '',
    createdAt: `${date}T12:00:00.000Z`,
  };
}

const guess = (categoryId: string, monthlyMinor: number): Guess => ({
  categoryId,
  monthlyMinor,
  guessedOn: '2026-10-01',
});

function planOf(createdOn: string, envelopes: { categoryId: string; monthlyMinor: number }[]): Plan {
  return {
    id: 'current',
    cityId: 'regensburg',
    incomes: [],
    fixed: [],
    oneOffs: [],
    envelopes,
    createdOn,
  };
}

describe('unlockOn', () => {
  it('is 21 days after the setup day', () => {
    expect(REVEAL_MIN_DAYS).toBe(21);
    expect(unlockOn('2026-10-01')).toBe('2026-10-22');
    expect(unlockOn('2026-10-16')).toBe('2026-11-06');
  });
});

describe('guessVsReality', () => {
  const eatingOut = [guess('eating-out', 8000)];

  it('stays locked until 21 days after the setup day, and unlocks on that day', () => {
    const before = guessVsReality(eatingOut, [], '2026-10-01', '2026-10-21');
    expect(before.unlocked).toBe(false);
    expect(before.unlockOn).toBe('2026-10-22');

    const onTheDay = guessVsReality(eatingOut, [], '2026-10-01', '2026-10-22');
    expect(onTheDay.unlocked).toBe(true);
    expect(onTheDay.unlockOn).toBe('2026-10-22');

    expect(guessVsReality(eatingOut, [], '2026-10-01', '2026-12-01').unlocked).toBe(true);
  });

  it('compares the guess with what was spent, per 30 days', () => {
    // 30 days in the window (1 to 30 Oct), so €190 spent is €190 a month.
    const entries = [entry('eating-out', '2026-10-05', 12000), entry('eating-out', '2026-10-20', 7000)];
    const result = guessVsReality(eatingOut, entries, '2026-10-01', '2026-10-30');
    expect(result.rows).toEqual([
      { categoryId: 'eating-out', guessMinor: 8000, actualMonthlyMinor: 19000, diffMinor: 11000 },
    ]);
  });

  it('scales to 30 days and rounds to whole minor units', () => {
    // 16 Oct to 6 Nov is 22 days: 6000 × 30 / 22 = 8181.8…
    const result = guessVsReality(eatingOut, [entry('eating-out', '2026-10-20', 6000)], '2026-10-16', '2026-11-06');
    expect(result.rows[0].actualMonthlyMinor).toBe(8182);
    expect(result.rows[0].diffMinor).toBe(182);
  });

  it('counts the setup day and today, and nothing before or after them', () => {
    const entries = [
      entry('eating-out', '2026-10-15', 100000),
      entry('eating-out', '2026-10-16', 1000),
      entry('eating-out', '2026-11-06', 2000),
      entry('eating-out', '2026-11-07', 100000),
    ];
    const result = guessVsReality(eatingOut, entries, '2026-10-16', '2026-11-06');
    // 3000 over 22 days = 4090.9…
    expect(result.rows[0].actualMonthlyMinor).toBe(4091);
  });

  it('counts only expenses of that category', () => {
    const entries = [
      entry('eating-out', '2026-10-20', 5000),
      entry('eating-out', '2026-10-21', 90000, 'income'),
      entry('food', '2026-10-22', 90000),
      transfer('2026-10-23', 90000),
    ];
    const result = guessVsReality(eatingOut, entries, '2026-10-01', '2026-10-30');
    expect(result.rows[0].actualMonthlyMinor).toBe(5000);
  });

  it('shows €0 for a category with no spending, and a negative difference when less was spent', () => {
    const result = guessVsReality(
      [guess('shopping', 4000), guess('transport', 2000)],
      [entry('transport', '2026-10-10', 500)],
      '2026-10-01',
      '2026-10-30',
    );
    expect(result.rows).toEqual([
      { categoryId: 'shopping', guessMinor: 4000, actualMonthlyMinor: 0, diffMinor: -4000 },
      { categoryId: 'transport', guessMinor: 2000, actualMonthlyMinor: 500, diffMinor: -1500 },
    ]);
  });

  it('orders rows by the size of the difference, biggest first, and ties in category order', () => {
    const guesses = [
      guess('other', 2000),
      guess('eating-out', 8000),
      guess('transport', 2000),
      guess('food', 20000),
      guess('shopping', 4000),
    ];
    const entries = [
      // eating-out 8000 → 8000: difference 0; food 20000 → 5000: −15000; shopping 4000 → 6000: +2000
      entry('eating-out', '2026-10-05', 8000),
      entry('food', '2026-10-06', 5000),
      entry('shopping', '2026-10-07', 6000),
    ];
    const result = guessVsReality(guesses, entries, '2026-10-01', '2026-10-30');
    // Transport, shopping and other each miss by 2000 (one by +2000, two by −2000), so category order decides.
    expect(result.rows.map((r) => [r.categoryId, r.diffMinor])).toEqual([
      ['food', -15000],
      ['transport', -2000],
      ['shopping', 2000],
      ['other', -2000],
      ['eating-out', 0],
    ]);
  });

  it('gives no rows when no guess was saved', () => {
    const result = guessVsReality([], [entry('food', '2026-10-05', 5000)], '2026-10-01', '2026-10-30');
    expect(result.rows).toEqual([]);
  });

  it('does not divide by zero or go negative if the clock is behind the setup day', () => {
    const result = guessVsReality(eatingOut, [entry('eating-out', '2026-10-05', 5000)], '2026-10-10', '2026-10-09');
    expect(result.unlocked).toBe(false);
    expect(result.rows[0].actualMonthlyMinor).toBe(0);
  });
});

describe('monthRecap', () => {
  const guesses = [guess('food', 20000), guess('eating-out', 8000)];
  // `monthStatus` adds a €0 row for each flexible category the plan has no envelope for; these tests look at the others.
  const used = <T extends { plannedMinor: number; spentMinor: number }>(rows: T[]): T[] =>
    rows.filter((r) => r.plannedMinor > 0 || r.spentMinor > 0);

  it('adds up planned minus spent over the envelopes, with each guess alongside', () => {
    // The plan was made in September, so October is a whole month.
    const plan = planOf('2026-09-01', [
      { categoryId: 'food', monthlyMinor: 31000 },
      { categoryId: 'eating-out', monthlyMinor: 15500 },
    ]);
    const entries = [
      entry('food', '2026-10-03', 15000),
      entry('food', '2026-10-28', 10000),
      entry('eating-out', '2026-10-12', 20000),
    ];
    const recap = monthRecap(guesses, plan, entries, '2026-10');
    expect(used(recap.rows)).toEqual([
      { categoryId: 'food', guessMinor: 20000, plannedMinor: 31000, spentMinor: 25000 },
      { categoryId: 'eating-out', guessMinor: 8000, plannedMinor: 15500, spentMinor: 20000 },
    ]);
    expect(recap.leftoverMinor).toBe(1500);
  });

  it('in the setup month plans and counts only from the setup day on', () => {
    const plan = planOf('2026-10-16', [{ categoryId: 'food', monthlyMinor: 31000 }]);
    // 16 of October's 31 days: 31000 × 16 / 31 = 16000. The food bought on the 10th is from before the plan.
    const before = monthRecap(guesses, plan, [entry('food', '2026-10-10', 9000)], '2026-10');
    expect(used(before.rows)).toEqual([{ categoryId: 'food', guessMinor: 20000, plannedMinor: 16000, spentMinor: 0 }]);
    expect(before.leftoverMinor).toBe(16000);

    const logged = [entry('food', '2026-10-10', 9000), entry('food', '2026-10-20', 5000)];
    const after = monthRecap(guesses, plan, logged, '2026-10');
    expect(after.rows[0].spentMinor).toBe(5000);
    expect(after.leftoverMinor).toBe(11000);
  });

  it('is negative when more was spent than planned', () => {
    const plan = planOf('2026-09-01', [{ categoryId: 'food', monthlyMinor: 31000 }]);
    const recap = monthRecap(guesses, plan, [entry('food', '2026-10-05', 32200)], '2026-10');
    expect(recap.leftoverMinor).toBe(-1200);
  });

  it('uses a guess of 0 for an envelope that was not guessed', () => {
    const plan = planOf('2026-09-01', [{ categoryId: 'transport', monthlyMinor: 5000 }]);
    const rows = monthRecap(guesses, plan, [], '2026-10').rows;
    expect(rows.find((r) => r.categoryId === 'transport')?.guessMinor).toBe(0);
  });

  it('counts spending in a category the plan has no envelope for, against nothing', () => {
    const plan = planOf('2026-09-01', [{ categoryId: 'food', monthlyMinor: 31000 }]);
    const recap = monthRecap(guesses, plan, [entry('health', '2026-10-05', 1800)], '2026-10');
    expect(recap.rows.find((r) => r.categoryId === 'health')).toEqual({
      categoryId: 'health',
      guessMinor: 0,
      plannedMinor: 0,
      spentMinor: 1800,
    });
    expect(recap.leftoverMinor).toBe(31000 - 1800);
  });

  it('ignores other months, income and transfers', () => {
    const plan = planOf('2026-09-01', [{ categoryId: 'food', monthlyMinor: 31000 }]);
    const entries = [
      entry('food', '2026-09-30', 4000),
      entry('food', '2026-11-01', 4000),
      entry('food', '2026-10-10', 4000, 'income'),
      transfer('2026-10-11', 4000),
      entry('food', '2026-10-12', 1000),
    ];
    const recap = monthRecap(guesses, plan, entries, '2026-10');
    expect(recap.rows[0].spentMinor).toBe(1000);
    expect(recap.leftoverMinor).toBe(30000);
  });
});

describe('completedMonths', () => {
  it('lists the months from the setup month up to the one before today, newest first', () => {
    expect(completedMonths('2026-10-16', '2026-12-02')).toEqual(['2026-11', '2026-10']);
    expect(completedMonths('2026-10-16', '2027-01-05')).toEqual(['2026-12', '2026-11', '2026-10']);
  });

  it('is empty while the setup month is still running, and when the clock is behind the setup day', () => {
    expect(completedMonths('2026-10-16', '2026-10-16')).toEqual([]);
    expect(completedMonths('2026-10-16', '2026-10-31')).toEqual([]);
    expect(completedMonths('2026-10-16', '2026-09-20')).toEqual([]);
  });

  it('counts a month as completed on its last day plus one', () => {
    expect(completedMonths('2026-10-16', '2026-11-01')).toEqual(['2026-10']);
  });
});
