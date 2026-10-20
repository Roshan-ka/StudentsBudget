import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Entry, Plan, WeekResult } from '@/db/types';
import { addDays, type IsoDate, type IsoMonth } from '@/lib/dates';
import {
  badgeHistory,
  badgesFrom,
  goldWeeks,
  semesterWeeksFor,
  type Badge,
  type BadgeHistory,
  type MonthSpend,
} from './badges';

const SRC = fileURLToPath(new URL('../../', import.meta.url));

/** The source file an import names, or null for a package. */
function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? resolve(SRC, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(from), specifier)
      : null;
  if (base === null) return null;
  return ['.ts', '.tsx', '/index.ts'].map((ext) => base + ext).find((file) => existsSync(file)) ?? null;
}

/** Every source file `file` loads, itself included. `import type` loads no code, so it is not followed. */
function loadedBy(file: string): string[] {
  const seen = new Set<string>();
  const stack = [file];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    // `[^;]` crosses lines, so an import split over several lines is read whole.
    for (const [, specifier] of readFileSync(current, 'utf8').matchAll(/^import\s+(?!type\s)[^;]*?from\s+'([^']+)'/gm)) {
      const next = resolveImport(current, specifier);
      if (next !== null) stack.push(next);
    }
  }
  return [...seen].map((f) => relative(SRC, f).replaceAll('\\', '/'));
}

describe('badges.ts', () => {
  it('never loads the database, not even through another module', () => {
    const loaded = loadedBy(fileURLToPath(new URL('./badges.ts', import.meta.url)));
    // The walk itself works: it reaches the modules badges.ts uses.
    expect(loaded).toEqual(expect.arrayContaining(['features/badges/records.ts', 'lib/dates.ts']));
    expect(loaded).not.toContain('db/db.ts');
  });
});

/** A recorded week: under its plan, with groceries and something typed in, unless the overrides say otherwise. */
function week(weekStart: IsoDate, overrides: Partial<WeekResult> = {}): WeekResult {
  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    plannedMinor: 10000,
    spentMinor: 6000,
    foodSpentMinor: 3000,
    eatingOutSpentMinor: 1000,
    handLoggedCount: 3,
    paused: false,
    recordedAt: `${addDays(weekStart, 7)}T08:00:00.000Z`,
    ...overrides,
  };
}

/** `n` weeks in a row from Monday 19 October 2026; `shape` changes the i-th. */
function weeks(n: number, shape: (i: number) => Partial<WeekResult> = () => ({})): WeekResult[] {
  return Array.from({ length: n }, (_, i) => week(addDays('2026-10-19', 7 * i), shape(i)));
}

/** A finished month with something typed in, unless `handLoggedCount` says otherwise. */
const month = (m: IsoMonth, eatingOutMinor: number, handLoggedCount = 5): MonthSpend => ({
  month: m,
  eatingOutMinor,
  handLoggedCount,
});

/** Set up on Monday 19 October, so every week above is a whole week of the plan. No finished month yet. */
const HISTORY: BadgeHistory = { planStart: '2026-10-19', months: [], awayNotRecorded: false };

function badge(id: Badge['id'], results: WeekResult[], semesterWeeks = 26, history = HISTORY): Badge {
  const found = badgesFrom(results, semesterWeeks, history).find((b) => b.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
}

const underBudget = (results: WeekResult[], semesterWeeks?: number) =>
  badge('under-budget-week', results, semesterWeeks);
const streak = (results: WeekResult[], awayNotRecorded = false) =>
  badge('logging-streak', results, 26, { ...HISTORY, awayNotRecorded });
const ramen = (results: WeekResult[], history?: BadgeHistory) => badge('ramen-royalty', results, 26, history);
const latte = (months: MonthSpend[]) => badge('latte-survivor', [], 26, { ...HISTORY, months });

describe('badgesFrom with no data', () => {
  it('lists all four badges, none earned, each saying how to start', () => {
    expect(badgesFrom([], 26, { planStart: '2026-10-16', months: [], awayNotRecorded: false })).toEqual([
      { id: 'under-budget-week', title: 'Under-Budget Week', tier: null, progress: '0 of 4 weeks', earnedOn: null },
      {
        id: 'logging-streak',
        title: 'Logging Streak',
        tier: null,
        progress: 'A streak starts with a week of envelope spending you log yourself',
        earnedOn: null,
      },
      {
        id: 'ramen-royalty',
        title: 'Ramen Royalty',
        tier: null,
        progress: 'Your first full week of groceries sets the mark',
        earnedOn: null,
      },
      {
        id: 'latte-survivor',
        title: 'Latte Survivor',
        tier: null,
        progress: 'Your first full month of logging sets the mark',
        earnedOn: null,
      },
    ]);
  });
});

describe('Under-Budget Week', () => {
  it('is not earned at 3 of 4 weeks, and bronze from the 4th, dated the day that week ended', () => {
    expect(underBudget(weeks(3))).toMatchObject({ tier: null, progress: '3 of 4 weeks', earnedOn: null });

    const four = weeks(4);
    expect(underBudget(four)).toEqual({
      id: 'under-budget-week',
      title: 'Under-Budget Week',
      tier: 'bronze',
      progress: '4 of 12 weeks',
      earnedOn: four[3].weekEnd,
    });
  });

  it('stays bronze at 11 of 12 weeks and is silver from the 12th', () => {
    const twelve = weeks(12);
    expect(underBudget(twelve.slice(0, 11))).toMatchObject({
      tier: 'bronze',
      progress: '11 of 12 weeks',
      earnedOn: twelve[3].weekEnd,
    });
    expect(underBudget(twelve)).toMatchObject({ tier: 'silver', progress: '12 of 26 weeks', earnedOn: twelve[11].weekEnd });
  });

  it('is gold after a semester of weeks', () => {
    const all = weeks(27);
    expect(underBudget(all.slice(0, 25))).toMatchObject({ tier: 'silver', progress: '25 of 26 weeks' });
    expect(underBudget(all.slice(0, 26))).toMatchObject({
      tier: 'gold',
      progress: '26 weeks under budget',
      earnedOn: all[25].weekEnd,
    });
    // Gold stays dated the week it was reached.
    expect(underBudget(all)).toMatchObject({ tier: 'gold', progress: '27 weeks under budget', earnedOn: all[25].weekEnd });
  });

  it('takes gold from the semester it is given', () => {
    const twenty = weeks(20);
    expect(underBudget(twenty.slice(0, 12), 20)).toMatchObject({ tier: 'silver', progress: '12 of 20 weeks' });
    expect(underBudget(twenty, 20)).toMatchObject({ tier: 'gold', earnedOn: twenty[19].weekEnd });
  });

  it('keeps gold after silver when the semester it is given is shorter', () => {
    expect(goldWeeks(26)).toBe(26);
    expect(goldWeeks(8)).toBe(13);
    expect(underBudget(weeks(12), 8)).toMatchObject({ tier: 'silver', progress: '12 of 13 weeks' });
  });

  it("takes the semester from the profile's dates, and 26 weeks without a semester", () => {
    const dates = (semesterStart: string, semesterEnd: string) => ({ semesterStart, semesterEnd });
    // OTH winter 2026/27, 1 Oct – 14 Mar: 165 days, 24 weeks.
    const oth = semesterWeeksFor(dates('2026-10-01', '2027-03-14'));
    expect(oth).toBe(24);
    const all = weeks(26);
    expect(underBudget(all.slice(0, 23), oth)).toMatchObject({ tier: 'silver', progress: '23 of 24 weeks' });
    expect(underBudget(all.slice(0, 24), oth)).toMatchObject({ tier: 'gold', earnedOn: all[23].weekEnd });
    // The same 24 weeks are silver against the 26 of a semester the profile doesn't give.
    for (const none of [undefined, null, dates('', ''), dates('2026-10-01', ''), dates('2027-03-31', '2026-10-01')]) {
      expect(semesterWeeksFor(none)).toBe(26);
      expect(underBudget(all.slice(0, 24), semesterWeeksFor(none))).toMatchObject({ tier: 'silver' });
    }
  });

  it('keeps gold above silver when the profile gives a short semester', () => {
    // 1 Oct – 11 Nov: 42 days, 6 weeks; gold needs 13 all the same.
    const short = semesterWeeksFor({ semesterStart: '2026-10-01', semesterEnd: '2026-11-11' });
    expect(short).toBe(6);
    expect(underBudget(weeks(12), short)).toMatchObject({ tier: 'silver', progress: '12 of 13 weeks' });
    expect(underBudget(weeks(13), short)).toMatchObject({ tier: 'gold' });
  });

  it('counts a logged week spent exactly to plan, but not one over it, unplanned, away or with nothing logged', () => {
    const results = weeks(8, (i) =>
      [
        { spentMinor: 10000 },
        { spentMinor: 10001 },
        { plannedMinor: 0, spentMinor: 0 },
        { paused: true, spentMinor: 0 },
        // Under its plan, but nobody typed anything in: it says nothing about the budget.
        { handLoggedCount: 0, spentMinor: 0 },
        {},
        {},
        {},
      ][i],
    );
    expect(underBudget(results)).toMatchObject({ tier: 'bronze', progress: '4 of 12 weeks', earnedOn: results[7].weekEnd });
    expect(underBudget(weeks(4, () => ({ handLoggedCount: 0, spentMinor: 2000 })))).toMatchObject({
      tier: null,
      progress: '0 of 4 weeks',
    });
  });

  it('reads the weeks in date order and leaves out a mark for a week still running', () => {
    const results = [...weeks(4)].reverse();
    expect(underBudget(results)).toMatchObject({ tier: 'bronze', earnedOn: results[0].weekEnd });

    const running = week('2026-11-16', { plannedMinor: 0, spentMinor: 0, paused: true, recordedAt: '' });
    expect(underBudget([...weeks(3), running])).toMatchObject({ tier: null, progress: '3 of 4 weeks' });
  });
});

describe('Logging Streak', () => {
  const logged = (count: number) => ({ handLoggedCount: count });

  it('counts the weeks in a row with something typed in, and is earned at 4', () => {
    expect(streak(weeks(3))).toMatchObject({ tier: null, progress: '3 of 4 weeks in a row', earnedOn: null });
    const four = weeks(4);
    expect(streak(four)).toMatchObject({ tier: null, progress: '4 weeks in a row', earnedOn: four[3].weekEnd });
  });

  it('neither breaks nor grows over a week away', () => {
    const results = weeks(5, (i) => (i === 2 ? { paused: true, handLoggedCount: 0 } : {}));
    expect(streak(results)).toMatchObject({ progress: '4 weeks in a row', earnedOn: results[4].weekEnd });

    // Away last week: the streak waits.
    expect(streak(weeks(4, (i) => (i === 3 ? { paused: true, ...logged(0) } : {})))).toMatchObject({
      progress: 'Your streak is paused at 3 weeks',
      earnedOn: null,
    });
    // A week away with entries typed in still adds nothing.
    expect(streak(weeks(4, (i) => (i === 3 ? { paused: true } : {})))).toMatchObject({
      progress: 'Your streak is paused at 3 weeks',
    });
  });

  it('reads as paused while a week not recorded yet is marked away', () => {
    const four = weeks(4);
    expect(streak(four, true)).toMatchObject({ progress: 'Your streak is paused at 4 weeks', earnedOn: four[3].weekEnd });
    expect(streak(weeks(2), true)).toMatchObject({ progress: 'Your streak is paused at 2 weeks', earnedOn: null });
    expect(streak(four, false)).toMatchObject({ progress: '4 weeks in a row' });
  });

  it('starts again after a week with nothing typed in, and keeps the badge once earned', () => {
    const results = weeks(6, (i) => (i === 4 ? logged(0) : {}));
    // The run ended after it was earned: the next one is a new streak, not a first one.
    expect(streak(results.slice(0, 5))).toMatchObject({
      progress: 'A new streak starts with a week of envelope spending you log yourself',
      earnedOn: results[3].weekEnd,
    });
    expect(streak(results)).toMatchObject({ progress: '1 week in a row', earnedOn: results[3].weekEnd });

    expect(streak(weeks(3, (i) => (i === 1 ? logged(0) : {})))).toMatchObject({
      progress: '1 of 4 weeks in a row',
      earnedOn: null,
    });
    expect(streak(weeks(1, () => logged(0)))).toMatchObject({
      progress: 'A streak starts with a week of envelope spending you log yourself',
    });
  });

  it('leaves out a mark for a week still running', () => {
    const running = week('2026-11-16', { handLoggedCount: 0, paused: true, recordedAt: '' });
    expect(streak([...weeks(2), running])).toMatchObject({ progress: '2 of 4 weeks in a row' });
  });
});

describe('Ramen Royalty', () => {
  const food = (amounts: number[], shape: (i: number) => Partial<WeekResult> = () => ({})) =>
    weeks(amounts.length, (i) => ({ foodSpentMinor: amounts[i], ...shape(i) }));

  it('is earned by the first week that is cheaper on food than every week before it', () => {
    const results = food([3000, 4000, 2500, 2000]);
    expect(ramen(results)).toMatchObject({
      tier: null,
      progress: 'Cheapest grocery week so far: €20 (week of 09-11-2026)',
      earnedOn: results[2].weekEnd,
    });
  });

  it('shows the mark to beat until a cheaper week comes', () => {
    expect(ramen(food([3000, 3000, 4550]))).toMatchObject({
      progress: 'Cheapest grocery week so far: €30 (week of 19-10-2026). A cheaper week earns it',
      earnedOn: null,
    });
    expect(ramen(food([3050]))).toMatchObject({
      progress: 'Cheapest grocery week so far: €30.50 (week of 19-10-2026). A cheaper week earns it',
    });
  });

  it('leaves out weeks with no groceries, weeks away and the part week of setup', () => {
    // Nothing on food in the 2nd week, away in the 3rd: neither is the cheapest.
    expect(ramen(food([3000, 0, 1000, 4000], (i) => (i === 2 ? { paused: true } : {})))).toMatchObject({
      progress: 'Cheapest grocery week so far: €30 (week of 19-10-2026). A cheaper week earns it',
      earnedOn: null,
    });
    // Set up on Wednesday 21 October: the week of 19 October had only five days of the plan.
    expect(ramen(food([500, 3000]), { ...HISTORY, planStart: '2026-10-21' })).toMatchObject({
      progress: 'Cheapest grocery week so far: €30 (week of 26-10-2026). A cheaper week earns it',
      earnedOn: null,
    });
  });
});

describe('Latte Survivor', () => {
  it('is earned by a later month with at most half the eating out of the first full month', () => {
    expect(
      latte([month('2026-11', 12400), month('2026-12', 7000), month('2027-01', 6200), month('2027-02', 1000)]),
    ).toEqual({
      id: 'latte-survivor',
      title: 'Latte Survivor',
      tier: null,
      progress: 'January 2027: €62 on eating out, down from €124 in November 2026',
      earnedOn: '2027-01-31',
    });
  });

  it('says what a month has to come in under until then', () => {
    expect(latte([month('2026-11', 12400), month('2026-12', 6201)])).toMatchObject({
      progress: 'A month with €62 or less on eating out earns it (half of what you spent in November 2026)',
      earnedOn: null,
    });
    expect(latte([month('2026-11', 12345)])).toMatchObject({
      progress: 'A month with €61.72 or less on eating out earns it (half of what you spent in November 2026)',
      earnedOn: null,
    });
  });

  it('counts only months with spending logged by hand, as the mark and as the month under it', () => {
    // December was not logged at all: its €0 is no month of eating less.
    expect(latte([month('2026-11', 12400), month('2026-12', 0, 0), month('2027-01', 9000)])).toMatchObject({
      progress: 'A month with €62 or less on eating out earns it (half of what you spent in November 2026)',
      earnedOn: null,
    });
    // November was not logged: the mark is December, the first month that was.
    expect(latte([month('2026-11', 0, 0), month('2026-12', 8000), month('2027-01', 4000)])).toMatchObject({
      progress: 'January 2027: €40 on eating out, down from €80 in December 2026',
      earnedOn: '2027-01-31',
    });
    expect(latte([month('2026-11', 3000, 0)])).toMatchObject({
      progress: 'Your first full month of logging sets the mark',
      earnedOn: null,
    });
  });

  it('takes the mark from the first logged month that had eating out', () => {
    expect(latte([month('2026-11', 0), month('2026-12', 0)])).toMatchObject({
      progress: 'Your first full month with eating out sets the mark',
      earnedOn: null,
    });
    // November had none to halve, so December is the mark and November's €0 is not under it.
    expect(latte([month('2026-11', 0), month('2026-12', 6000), month('2027-01', 3500)])).toMatchObject({
      progress: 'A month with €30 or less on eating out earns it (half of what you spent in December 2026)',
      earnedOn: null,
    });
  });
});

describe('badgeHistory', () => {
  const plan = (createdOn: IsoDate): Plan => ({
    id: 'current',
    cityId: 'regensburg',
    incomes: [],
    fixed: [],
    oneOffs: [],
    envelopes: [{ categoryId: 'eating-out', monthlyMinor: 12400 }],
    createdOn,
  });

  const entry = (
    date: IsoDate,
    categoryId: string,
    eurMinor: number,
    overrides: Partial<Entry> = {},
  ): Entry =>
    ({
      id: `${date}-${categoryId}-${eurMinor}`,
      type: 'expense',
      date,
      accountId: 'cash',
      // An INR account: the badge counts the EUR amount.
      amountMinor: eurMinor * 95,
      eurMinor,
      categoryId,
      note: '',
      createdAt: `${date}T12:00:00.000Z`,
      ...overrides,
    }) as Entry;

  const ENTRIES = [
    entry('2026-10-20', 'eating-out', 900),
    entry('2026-11-02', 'eating-out', 1000),
    entry('2026-11-30', 'eating-out', 2000),
    entry('2026-11-10', 'going-out', 5000),
    entry('2026-11-11', 'eating-out', 7000, { type: 'income' }),
    entry('2026-12-24', 'eating-out', 1500),
    entry('2027-01-03', 'eating-out', 400),
  ];

  it('totals eating out in EUR and the expenses logged by hand for each finished month from the first full month', () => {
    // Set up mid-October, so November is the first full month; January is still running. November's income is
    // neither eating out nor spending logged.
    expect(badgeHistory(plan('2026-10-16'), ENTRIES, [], '2027-01-05')).toEqual({
      planStart: '2026-10-16',
      months: [
        { month: '2026-11', eatingOutMinor: 3000, handLoggedCount: 3 },
        { month: '2026-12', eatingOutMinor: 1500, handLoggedCount: 1 },
      ],
      awayNotRecorded: false,
    });
  });

  it('counts an expense for the month it is dated in, whenever it was typed in, and only expenses logged by hand', () => {
    const entries: Entry[] = [
      // For December, typed in on 2 January: it is December's.
      entry('2026-12-20', 'eating-out', 1500, { createdAt: '2027-01-02T09:00:00.000Z' }),
      // Posted by a schedule in December.
      entry('2026-12-01', 'rent', 40000, { recurring: { scheduleId: 's' } }),
      entry('2026-11-05', 'food', 800),
      // January has only income and a transfer typed in: no spending logged.
      entry('2027-01-07', 'income-job', 20000, { type: 'income' }),
      {
        id: 'move',
        type: 'transfer',
        date: '2027-01-08',
        accountId: 'cash',
        toAccountId: 'bank',
        amountMinor: 5000,
        eurMinor: 5000,
        toAmountMinor: 5000,
        note: '',
        createdAt: '2027-01-08T12:00:00.000Z',
      },
    ];
    expect(badgeHistory(plan('2026-10-16'), entries, [], '2027-02-01').months).toEqual([
      { month: '2026-11', eatingOutMinor: 0, handLoggedCount: 1 },
      { month: '2026-12', eatingOutMinor: 1500, handLoggedCount: 1 },
      { month: '2027-01', eatingOutMinor: 0, handLoggedCount: 0 },
    ]);
  });

  it('does not count a fixed cost typed in by hand: a month with only rent typed in is not logged', () => {
    const entries: Entry[] = [
      entry('2026-11-05', 'rent', 40000),
      entry('2026-12-05', 'rent', 40000),
      entry('2026-12-10', 'food', 800),
    ];
    expect(badgeHistory(plan('2026-10-16'), entries, [], '2027-01-05').months).toEqual([
      { month: '2026-11', eatingOutMinor: 0, handLoggedCount: 0 },
      { month: '2026-12', eatingOutMinor: 0, handLoggedCount: 1 },
    ]);
  });

  it('does not let a month with only rent typed in earn Latte Survivor', () => {
    const latteFor = (entries: Entry[]) =>
      badgesFrom([], 26, badgeHistory(plan('2026-10-16'), entries, [], '2027-01-05')).find(
        (b) => b.id === 'latte-survivor',
      );
    // November sets the mark (€80). December has only the rent typed in: it says nothing about eating out.
    expect(latteFor([entry('2026-11-10', 'eating-out', 8000), entry('2026-12-05', 'rent', 40000)])).toMatchObject({
      progress: 'A month with €40 or less on eating out earns it (half of what you spent in November 2026)',
      earnedOn: null,
    });
    // A month with groceries logged and no eating out does count, as before.
    expect(latteFor([entry('2026-11-10', 'eating-out', 8000), entry('2026-12-05', 'food', 900)])).toMatchObject({
      progress: 'December 2026: €0 on eating out, down from €80 in November 2026',
      earnedOn: '2026-12-31',
    });
  });

  it('starts with the month of setup when setup was on the 1st, and is empty while that month runs', () => {
    expect(badgeHistory(plan('2026-11-01'), ENTRIES, [], '2026-12-15').months).toEqual([
      { month: '2026-11', eatingOutMinor: 3000, handLoggedCount: 3 },
    ]);
    expect(badgeHistory(plan('2026-10-16'), ENTRIES, [], '2026-11-30').months).toEqual([]);
    expect(badgeHistory(plan('2026-10-16'), ENTRIES, [], 'not a date').months).toEqual([]);
  });

  it('says whether the week still running, or last week while it waits to be recorded, is marked away', () => {
    const mark = (weekStart: IsoDate, paused = true): WeekResult => ({
      ...week(weekStart),
      plannedMinor: 0,
      spentMinor: 0,
      paused,
      recordedAt: '',
    });
    // Monday 16 November: this week starts on the 16th, last week on the 9th.
    const away = (results: WeekResult[]) => badgeHistory(plan('2026-10-16'), [], results, '2026-11-16').awayNotRecorded;

    expect(away([mark('2026-11-16')])).toBe(true);
    expect(away([mark('2026-11-09')])).toBe(true);
    expect(away([])).toBe(false);
    // A mark on an older week, or a recorded week, is not a mark waiting for its week.
    expect(away([mark('2026-11-02')])).toBe(false);
    expect(away([week('2026-11-16', { paused: true })])).toBe(false);
    expect(away([week('2026-11-09', { paused: true })])).toBe(false);
  });
});

describe('copy', () => {
  it('never speaks of losing, breaking or failing', () => {
    const histories: BadgeHistory[] = [
      HISTORY,
      { ...HISTORY, awayNotRecorded: true },
      { ...HISTORY, months: [month('2026-11', 0)] },
      { ...HISTORY, months: [month('2026-11', 9000), month('2026-12', 8000)] },
      { ...HISTORY, months: [month('2026-11', 9000), month('2026-12', 0, 0)] },
    ];
    const cases = [
      weeks(0),
      weeks(5, (i) => (i === 4 ? { handLoggedCount: 0, spentMinor: 20000 } : {})),
      weeks(5, (i) => (i === 4 ? { paused: true } : {})),
      weeks(30),
    ];
    for (const history of histories) {
      for (const results of cases) {
        for (const b of badgesFrom(results, 26, history)) {
          expect(b.progress).not.toMatch(/lost|lose|broke|fail|warning|miss/i);
        }
      }
    }
  });
});
