import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import type { Entry, Plan, WeekResult } from '@/db/types';
import { safeToSpend } from '@/lib/budget';
import type { IsoDate } from '@/lib/dates';
import { completedWeeks, recordCompletedWeeks, setAway, weekAwaitingRecord, weekResultOf } from './week-results';

// Food €310 and eating out €124 a month, set up on Friday 16 October 2026. October has 31 days, so a full
// October week plans food 31000 * 7/31 = 7000 and eating out 12400 * 7/31 = 2800.
const PLAN: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [],
  fixed: [],
  oneOffs: [],
  envelopes: [
    { categoryId: 'food', monthlyMinor: 31000 },
    { categoryId: 'eating-out', monthlyMinor: 12400 },
  ],
  createdOn: '2026-10-16',
};

let next = 0;

/** An expense typed in by hand; `createdAt` defaults to noon UTC on its own day. */
function expense(date: IsoDate, categoryId: string, eurMinor: number, overrides: Partial<Entry> = {}): Entry {
  next += 1;
  return {
    id: `e${next}`,
    type: 'expense',
    date,
    accountId: 'cash',
    amountMinor: eurMinor,
    eurMinor,
    categoryId,
    note: '',
    createdAt: `${date}T12:00:00.000Z`,
    ...overrides,
  } as Entry;
}

/** What the check-in shows for the part of a week that ends on `day`: the envelopes' shares and spending summed. */
function checkInPart(plan: Plan, entries: Entry[], day: IsoDate) {
  const week = safeToSpend(plan, entries, day);
  const of = (id: string) => week.envelopes.find((e) => e.categoryId === id)?.spentThisWeekMinor ?? 0;
  return {
    plannedMinor: week.envelopes.reduce((total, e) => total + e.weekShareMinor, 0),
    spentMinor: week.envelopes.reduce((total, e) => total + e.spentThisWeekMinor, 0),
    foodSpentMinor: of('food'),
    eatingOutSpentMinor: of('eating-out'),
  };
}

describe('completedWeeks', () => {
  it('lists the Monday-Sunday weeks from the week of setup that are due, across a month boundary', () => {
    expect(completedWeeks(PLAN, '2026-11-04')).toEqual([
      { start: '2026-10-12', end: '2026-10-18' },
      { start: '2026-10-19', end: '2026-10-25' },
      { start: '2026-10-26', end: '2026-11-01' },
    ]);
  });

  it('records a week from the Wednesday after its Sunday: not on the Sunday, the Monday or the Tuesday', () => {
    const before = [
      { start: '2026-10-12', end: '2026-10-18' },
      { start: '2026-10-19', end: '2026-10-25' },
    ];
    // The week of 26 October ends on Sunday 1 November.
    expect(completedWeeks(PLAN, '2026-11-01')).toEqual(before);
    expect(completedWeeks(PLAN, '2026-11-02')).toEqual(before);
    expect(completedWeeks(PLAN, '2026-11-03')).toEqual(before);
    expect(completedWeeks(PLAN, '2026-11-04')).toEqual([...before, { start: '2026-10-26', end: '2026-11-01' }]);
  });

  it('works across a year end', () => {
    expect(completedWeeks({ ...PLAN, createdOn: '2026-12-23' }, '2027-01-13')).toEqual([
      { start: '2026-12-21', end: '2026-12-27' },
      { start: '2026-12-28', end: '2027-01-03' },
      { start: '2027-01-04', end: '2027-01-10' },
    ]);
  });

  it('is empty until the Wednesday after the week of setup, before it, and for a date that is not one', () => {
    expect(completedWeeks(PLAN, '2026-10-18')).toEqual([]);
    expect(completedWeeks(PLAN, '2026-10-20')).toEqual([]);
    expect(completedWeeks(PLAN, '2026-10-21')).toEqual([{ start: '2026-10-12', end: '2026-10-18' }]);
    expect(completedWeeks(PLAN, '2026-10-01')).toEqual([]);
    expect(completedWeeks(PLAN, 'not a date')).toEqual([]);
    expect(completedWeeks({ ...PLAN, createdOn: '' }, '2026-11-04')).toEqual([]);
  });
});

describe('weekAwaitingRecord', () => {
  const LAST_WEEK = { start: '2026-10-26', end: '2026-11-01' };

  it('is last week on the Monday and the Tuesday after it, while it waits to be recorded', () => {
    expect(weekAwaitingRecord(PLAN, '2026-11-02')).toEqual(LAST_WEEK);
    expect(weekAwaitingRecord(PLAN, '2026-11-03')).toEqual(LAST_WEEK);
  });

  it('is null from the Wednesday on, when the week is recorded, and on the rest of the week', () => {
    for (const day of ['2026-11-04', '2026-11-05', '2026-11-07', '2026-11-08']) {
      expect(weekAwaitingRecord(PLAN, day), day).toBeNull();
    }
    // On Sunday 1 November that week is still running: it is this week, not last week.
    expect(weekAwaitingRecord(PLAN, '2026-11-01')).toBeNull();
  });

  it('is the week of setup the Monday after setup, but nothing when last week ended before setup', () => {
    expect(weekAwaitingRecord(PLAN, '2026-10-19')).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    // Set up on Monday 19 October: the week before had no plan.
    expect(weekAwaitingRecord({ ...PLAN, createdOn: '2026-10-19' }, '2026-10-19')).toBeNull();
    expect(weekAwaitingRecord({ ...PLAN, createdOn: '2026-10-19' }, '2026-10-26')).toEqual({
      start: '2026-10-19',
      end: '2026-10-25',
    });
  });

  it('is null for a plan or a day that is not a date', () => {
    expect(weekAwaitingRecord(PLAN, 'not a date')).toBeNull();
    expect(weekAwaitingRecord({ ...PLAN, createdOn: '' }, '2026-11-02')).toBeNull();
  });
});

describe('weekResultOf', () => {
  const WEEK = { start: '2026-10-19', end: '2026-10-25' };

  it('measures a week inside one month the way the check-in does: envelopes only', () => {
    const entries = [
      expense('2026-10-20', 'food', 1500),
      expense('2026-10-22', 'eating-out', 900),
      // No envelope, but a flexible category: it counts, against nothing, as on the check-in.
      expense('2026-10-24', 'going-out', 600),
      // Rent is a fixed cost and income is not spending: neither is an envelope.
      expense('2026-10-21', 'rent', 40000),
      expense('2026-10-23', 'income-job', 20000, { type: 'income' }),
      // The next week.
      expense('2026-10-26', 'food', 700),
    ];

    const result = weekResultOf(PLAN, entries, WEEK);

    expect(result).toMatchObject({
      weekStart: '2026-10-19',
      weekEnd: '2026-10-25',
      plannedMinor: 9800,
      spentMinor: 3000,
      foodSpentMinor: 1500,
      eatingOutSpentMinor: 900,
    });
    expect(result).toMatchObject(checkInPart(PLAN, entries, '2026-10-25'));
  });

  it('adds up the two parts of a week a month boundary splits', () => {
    const entries = [
      expense('2026-10-27', 'food', 2000),
      expense('2026-10-31', 'eating-out', 1000),
      expense('2026-11-01', 'food', 500),
    ];

    const result = weekResultOf(PLAN, entries, { start: '2026-10-26', end: '2026-11-01' });

    // October's part (26-31, six days): food 6000, eating out 2400. November's (the 1st, of 30 days):
    // food round(31000 / 30) = 1033, eating out round(12400 / 30) = 413.
    expect(result).toEqual({
      weekStart: '2026-10-26',
      weekEnd: '2026-11-01',
      plannedMinor: 6000 + 2400 + 1033 + 413,
      spentMinor: 3500,
      foodSpentMinor: 2500,
      eatingOutSpentMinor: 1000,
      handLoggedCount: 3,
    });
    const october = checkInPart(PLAN, entries, '2026-10-31');
    const november = checkInPart(PLAN, entries, '2026-11-01');
    expect(result.plannedMinor).toBe(october.plannedMinor + november.plannedMinor);
    expect(result.spentMinor).toBe(october.spentMinor + november.spentMinor);
  });

  it('counts the week of setup only from the setup day', () => {
    const entries = [expense('2026-10-14', 'food', 800), expense('2026-10-17', 'food', 1000)];

    // Friday to Sunday: food 3000, eating out 1200. The Wednesday before setup is not counted.
    expect(weekResultOf(PLAN, entries, { start: '2026-10-12', end: '2026-10-18' })).toMatchObject({
      plannedMinor: 4200,
      spentMinor: 1000,
      foodSpentMinor: 1000,
    });
  });

  it('leaves out the part of a split week that ends before setup', () => {
    // Set up on Sunday 1 November: the October days of that week had no budget.
    const plan = { ...PLAN, createdOn: '2026-11-01' };
    const entries = [expense('2026-10-27', 'food', 2000), expense('2026-11-01', 'food', 500)];

    expect(weekResultOf(plan, entries, { start: '2026-10-26', end: '2026-11-01' })).toMatchObject({
      plannedMinor: 1033 + 413,
      spentMinor: 500,
      foodSpentMinor: 500,
    });
  });

  it('counts the logged expenses that are dated in the week, whenever they were typed in', () => {
    const entries: Entry[] = [
      // Monday and Sunday of the week, typed in on the day.
      expense('2026-10-19', 'food', 100),
      expense('2026-10-25', 'eating-out', 7000),
      // Typed in on the Monday after, for the Sunday before: a late entry or a Monday batch counts for its own week.
      expense('2026-10-24', 'food', 100, { createdAt: '2026-10-26T06:00:00.000Z' }),
      // A flexible category the plan has no envelope for is measured too.
      expense('2026-10-21', 'going-out', 600),
      // When it was typed in no longer matters, so a `createdAt` that is not a time changes nothing.
      expense('2026-10-22', 'food', 100, { createdAt: 'not a time' }),
      // Typed in during the week, but for other weeks.
      expense('2026-10-18', 'food', 100, { createdAt: '2026-10-20T12:00:00.000Z' }),
      expense('2026-10-26', 'food', 100, { createdAt: '2026-10-20T12:00:00.000Z' }),
      // Moving money and income say nothing about spending.
      {
        id: 'move',
        type: 'transfer',
        date: '2026-10-20',
        accountId: 'cash',
        toAccountId: 'bank',
        amountMinor: 5000,
        eurMinor: 5000,
        toAmountMinor: 5000,
        note: '',
        createdAt: '2026-10-20T12:00:00.000Z',
      },
      expense('2026-10-23', 'income-job', 20000, { type: 'income' }),
      // A schedule posted it: not typed in.
      expense('2026-10-20', 'rent', 40000, { recurring: { scheduleId: 's' } }),
    ];

    expect(weekResultOf(PLAN, entries, WEEK).handLoggedCount).toBe(5);
  });

  it('does not count a fixed cost typed in by hand: only spending the envelopes measure makes a week logged', () => {
    // Rent typed in by hand and nothing else: the week has no spending in `spentMinor`, so it is not logged.
    const entries = [expense('2026-10-21', 'rent', 40000), expense('2026-10-22', 'phone', 2000)];

    expect(weekResultOf(PLAN, entries, WEEK)).toMatchObject({ plannedMinor: 9800, spentMinor: 0, handLoggedCount: 0 });
    // With an envelope expense next to it, the week is logged once, by that expense.
    expect(weekResultOf(PLAN, [...entries, expense('2026-10-23', 'food', 800)], WEEK)).toMatchObject({
      spentMinor: 800,
      handLoggedCount: 1,
    });
  });

  it('counts an envelope expense typed in by hand as logged, and its spending is in the week', () => {
    const entries = [expense('2026-10-20', 'food', 1500), expense('2026-10-22', 'eating-out', 900)];

    expect(weekResultOf(PLAN, entries, WEEK)).toMatchObject({ spentMinor: 2400, handLoggedCount: 2 });
  });

  it('does not count an expense dated before the setup day, so it cannot make the week of setup logged', () => {
    // Set up on Friday 16 October: the Wednesday before has no plan, and `safeToSpend` leaves it out of the spending.
    const setupWeek = { start: '2026-10-12', end: '2026-10-18' };
    const before = [expense('2026-10-14', 'food', 800)];

    expect(weekResultOf(PLAN, before, setupWeek)).toMatchObject({ spentMinor: 0, handLoggedCount: 0 });
    // From the setup day on it counts, and so does an expense on the day itself.
    expect(weekResultOf(PLAN, [...before, expense('2026-10-16', 'food', 500)], setupWeek)).toMatchObject({
      spentMinor: 500,
      handLoggedCount: 1,
    });
    // A split week whose first part ends before setup: nothing dated in that part counts either.
    const plan = { ...PLAN, createdOn: '2026-11-01' };
    const split = { start: '2026-10-26', end: '2026-11-01' };
    expect(weekResultOf(plan, [expense('2026-10-27', 'food', 2000)], split)).toMatchObject({ handLoggedCount: 0 });
    expect(weekResultOf(plan, [expense('2026-11-01', 'food', 500)], split)).toMatchObject({ handLoggedCount: 1 });
  });

  it('gives a week with only a transfer and income logged nothing hand-logged', () => {
    const entries: Entry[] = [
      {
        id: 'move',
        type: 'transfer',
        date: '2026-10-20',
        accountId: 'cash',
        toAccountId: 'bank',
        amountMinor: 5000,
        eurMinor: 5000,
        toAmountMinor: 5000,
        note: '',
        createdAt: '2026-10-20T12:00:00.000Z',
      },
      expense('2026-10-23', 'income-job', 20000, { type: 'income' }),
    ];

    expect(weekResultOf(PLAN, entries, WEEK)).toMatchObject({ spentMinor: 0, handLoggedCount: 0 });
  });
});

async function stored(): Promise<WeekResult[]> {
  return db.weekResults.orderBy('weekStart').toArray();
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('recordCompletedWeeks', () => {
  const ENTRIES = [
    expense('2026-10-17', 'food', 1000),
    expense('2026-10-20', 'food', 2000),
    expense('2026-10-28', 'eating-out', 1500),
    expense('2026-11-03', 'food', 1200),
  ];

  it('records nothing without a plan', async () => {
    expect(await recordCompletedWeeks('2026-11-04')).toEqual({ recorded: 0 });
    expect(await stored()).toEqual([]);
  });

  it('records each finished week once, with the current plan, and never twice', async () => {
    await db.plan.put(PLAN);
    await db.entries.bulkAdd(ENTRIES);

    expect(await recordCompletedWeeks('2026-11-04')).toEqual({ recorded: 3 });
    const first = await stored();
    expect(first.map((w) => [w.weekStart, w.weekEnd, w.paused])).toEqual([
      ['2026-10-12', '2026-10-18', false],
      ['2026-10-19', '2026-10-25', false],
      ['2026-10-26', '2026-11-01', false],
    ]);
    for (const row of first) {
      expect(row).toMatchObject(weekResultOf(PLAN, ENTRIES, { start: row.weekStart, end: row.weekEnd }));
      expect(Number.isNaN(Date.parse(row.recordedAt))).toBe(false);
    }

    // The same day again, and the app opened twice at once: nothing new, nothing rewritten.
    expect(await recordCompletedWeeks('2026-11-04')).toEqual({ recorded: 0 });
    const runs = await Promise.all([recordCompletedWeeks('2026-11-10'), recordCompletedWeeks('2026-11-10')]);
    expect(runs.reduce((total, run) => total + run.recorded, 0)).toBe(0);
    expect(await stored()).toEqual(first);
  });

  it('two runs at once record each week once', async () => {
    await db.plan.put(PLAN);
    await db.entries.bulkAdd(ENTRIES);

    const runs = await Promise.all([recordCompletedWeeks('2026-11-11'), recordCompletedWeeks('2026-11-11')]);

    expect(runs.map((run) => run.recorded).sort()).toEqual([0, 4]);
    expect((await stored()).map((w) => w.weekStart)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']);
  });

  it('keeps the recorded weeks as they were when the plan or an old entry changes later', async () => {
    await db.plan.put(PLAN);
    await db.entries.bulkAdd(ENTRIES);
    await recordCompletedWeeks('2026-11-04');
    const before = await stored();

    const doubled: Plan = { ...PLAN, envelopes: [{ categoryId: 'food', monthlyMinor: 62000 }] };
    await db.plan.put(doubled);
    await db.entries.add(expense('2026-10-21', 'food', 9900));
    expect(await recordCompletedWeeks('2026-11-11')).toEqual({ recorded: 1 });

    const after = await stored();
    expect(after.slice(0, 3)).toEqual(before);
    // The week that finished after the edit is measured with the plan of that day.
    const entries = await db.entries.toArray();
    expect(after[3]).toMatchObject(weekResultOf(doubled, entries, { start: '2026-11-02', end: '2026-11-08' }));
  });

  it('waits until the Wednesday, so what is logged on Monday or Tuesday for the week before counts for it', async () => {
    await db.plan.put(PLAN);
    // Logged during the week of 19 October.
    await db.entries.bulkAdd([expense('2026-10-20', 'food', 2000)]);

    // Monday 26 October: the week before is not recorded yet, only the week of setup.
    expect(await recordCompletedWeeks('2026-10-26')).toEqual({ recorded: 1 });
    // A €70 Sunday dinner and a batch of the week's groceries, typed in on Monday morning for the days they were.
    await db.entries.bulkAdd([
      expense('2026-10-25', 'eating-out', 7000, { createdAt: '2026-10-26T07:00:00.000Z' }),
      expense('2026-10-22', 'food', 1500, { createdAt: '2026-10-26T07:05:00.000Z' }),
      expense('2026-10-23', 'food', 1800, { createdAt: '2026-10-26T07:06:00.000Z' }),
    ]);
    // Still nothing on Tuesday.
    expect(await recordCompletedWeeks('2026-10-27')).toEqual({ recorded: 0 });
    expect(await db.weekResults.get('2026-10-19')).toBeUndefined();

    // Wednesday: the week is recorded with all of it, so it is over its share (eating out 2800, food 7000).
    expect(await recordCompletedWeeks('2026-10-28')).toEqual({ recorded: 1 });
    expect(await db.weekResults.get('2026-10-19')).toMatchObject({
      plannedMinor: 9800,
      spentMinor: 2000 + 7000 + 1500 + 1800,
      eatingOutSpentMinor: 7000,
      handLoggedCount: 4,
    });

    // The batch was typed in during the next week, but it is not that week's logging.
    await recordCompletedWeeks('2026-11-04');
    expect(await db.weekResults.get('2026-10-26')).toMatchObject({ spentMinor: 0, handLoggedCount: 0 });
  });
});

describe('setAway', () => {
  it('keeps a note on the running week, which the week takes over when it is recorded', async () => {
    await db.plan.put(PLAN);
    await db.entries.bulkAdd([expense('2026-11-03', 'food', 1200)]);

    await setAway('2026-11-04', true);
    expect(await db.weekResults.get('2026-11-02')).toEqual({
      weekStart: '2026-11-02',
      weekEnd: '2026-11-08',
      plannedMinor: 0,
      spentMinor: 0,
      foodSpentMinor: 0,
      eatingOutSpentMinor: 0,
      handLoggedCount: 0,
      paused: true,
      recordedAt: '',
    });

    // The week is still running, and then waits on Monday and Tuesday: the note stays a note.
    for (const day of ['2026-11-08', '2026-11-09', '2026-11-10']) {
      await recordCompletedWeeks(day);
      expect((await db.weekResults.get('2026-11-02'))?.recordedAt, day).toBe('');
    }

    expect(await recordCompletedWeeks('2026-11-11')).toEqual({ recorded: 1 });
    const week = await db.weekResults.get('2026-11-02');
    expect(week).toMatchObject({
      ...weekResultOf(PLAN, await db.entries.toArray(), { start: '2026-11-02', end: '2026-11-08' }),
      paused: true,
    });
    expect(week?.foodSpentMinor).toBe(1200);
    expect(Number.isNaN(Date.parse(week?.recordedAt ?? ''))).toBe(false);
    // The other weeks were not marked.
    expect((await stored()).filter((w) => w.paused).map((w) => w.weekStart)).toEqual(['2026-11-02']);
  });

  it('takes the note back when switched off before the week is recorded', async () => {
    await db.plan.put(PLAN);

    await setAway('2026-11-08', true);
    await setAway('2026-11-08', false);
    expect(await db.weekResults.get('2026-11-02')).toBeUndefined();

    await recordCompletedWeeks('2026-11-11');
    expect((await db.weekResults.get('2026-11-02'))?.paused).toBe(false);
  });

  it('marks last week while it waits, next to this week, and each week keeps its own mark', async () => {
    await db.plan.put(PLAN);
    await db.entries.bulkAdd([expense('2026-10-27', 'food', 900), expense('2026-11-03', 'food', 1200)]);

    // Monday 2 November: last week (26 October - 1 November) is not recorded yet, and this week has begun.
    const lastWeek = weekAwaitingRecord(PLAN, '2026-11-02');
    if (lastWeek === null) throw new Error('last week waits on a Monday');
    await recordCompletedWeeks('2026-11-02');
    await setAway(lastWeek.start, true);
    await setAway('2026-11-02', true);

    const note = { plannedMinor: 0, spentMinor: 0, handLoggedCount: 0, paused: true, recordedAt: '' };
    expect(await db.weekResults.get('2026-10-26')).toMatchObject({ weekEnd: '2026-11-01', ...note });
    expect(await db.weekResults.get('2026-11-02')).toMatchObject({ weekEnd: '2026-11-08', ...note });

    // Switching last week off takes only its note back; any day of the week names it.
    await setAway('2026-10-29', false);
    expect(await db.weekResults.get('2026-10-26')).toBeUndefined();
    expect((await db.weekResults.get('2026-11-02'))?.paused).toBe(true);
    await setAway(lastWeek.end, true);

    // Tuesday: still waiting. Wednesday: last week is recorded as a week away, with what was spent in it.
    await recordCompletedWeeks('2026-11-03');
    expect((await db.weekResults.get('2026-10-26'))?.recordedAt).toBe('');
    expect(await recordCompletedWeeks('2026-11-04')).toEqual({ recorded: 1 });
    const recorded = await db.weekResults.get('2026-10-26');
    expect(recorded).toMatchObject({
      ...weekResultOf(PLAN, await db.entries.toArray(), { start: '2026-10-26', end: '2026-11-01' }),
      foodSpentMinor: 900,
      paused: true,
    });
    expect(recorded?.recordedAt).not.toBe('');
    // This week's note is still only a note.
    expect((await db.weekResults.get('2026-11-02'))?.recordedAt).toBe('');
  });

  it('changes only `paused` on a week that is already recorded', async () => {
    await db.plan.put(PLAN);
    await db.entries.bulkAdd([expense('2026-10-20', 'food', 2000)]);
    await recordCompletedWeeks('2026-11-02');
    const before = await db.weekResults.get('2026-10-19');

    await setAway('2026-10-21', true);
    expect(await db.weekResults.get('2026-10-19')).toEqual({ ...before, paused: true });
    await setAway('2026-10-21', false);
    expect(await db.weekResults.get('2026-10-19')).toEqual(before);
  });
});
