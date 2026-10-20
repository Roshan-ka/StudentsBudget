import { describe, expect, it } from 'vitest';
import type { Entry, Plan, WeekResult } from '@/db/types';
import { addDays, type IsoDate } from '@/lib/dates';
import { badgeHistory, badgesFrom, goldWeeks, type Badge, type BadgeHistory, type MonthSpend } from './badges';

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

/** Set up on Monday 19 October, so every week above is a whole week of the plan. No finished month yet. */
const HISTORY: BadgeHistory = { planStart: '2026-10-19', months: [] };

function badge(id: Badge['id'], results: WeekResult[], semesterWeeks = 26, history = HISTORY): Badge {
  const found = badgesFrom(results, semesterWeeks, history).find((b) => b.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
}

const underBudget = (results: WeekResult[], semesterWeeks?: number) =>
  badge('under-budget-week', results, semesterWeeks);
const streak = (results: WeekResult[]) => badge('logging-streak', results);
const ramen = (results: WeekResult[], history?: BadgeHistory) => badge('ramen-royalty', results, 26, history);
const latte = (months: MonthSpend[]) => badge('latte-survivor', [], 26, { ...HISTORY, months });

describe('badgesFrom with no data', () => {
  it('lists all four badges, none earned, each saying how to start', () => {
    expect(badgesFrom([], 26, { planStart: '2026-10-16', months: [] })).toEqual([
      { id: 'under-budget-week', title: 'Under-Budget Week', tier: null, progress: '0 of 4 weeks', earnedOn: null },
      {
        id: 'logging-streak',
        title: 'Logging Streak',
        tier: null,
        progress: 'Log something this week to start a streak',
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

  it('counts a week spent exactly to plan, but not one over it, one with nothing planned, or one away', () => {
    const results = weeks(7, (i) =>
      [
        { spentMinor: 10000 },
        { spentMinor: 10001 },
        { plannedMinor: 0, spentMinor: 0 },
        { paused: true, spentMinor: 0 },
        {},
        {},
        {},
      ][i],
    );
    expect(underBudget(results)).toMatchObject({ tier: 'bronze', progress: '4 of 12 weeks', earnedOn: results[6].weekEnd });
  });

  it('reads the weeks in date order and leaves out a note for a week still running', () => {
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

  it('starts again after a week with nothing typed in, and keeps the badge once earned', () => {
    const results = weeks(6, (i) => (i === 4 ? logged(0) : {}));
    expect(streak(results.slice(0, 5))).toMatchObject({
      progress: 'Log something this week to start a new streak',
      earnedOn: results[3].weekEnd,
    });
    expect(streak(results)).toMatchObject({ progress: '1 week in a row', earnedOn: results[3].weekEnd });

    expect(streak(weeks(3, (i) => (i === 1 ? logged(0) : {})))).toMatchObject({
      progress: '1 of 4 weeks in a row',
      earnedOn: null,
    });
    expect(streak(weeks(1, () => logged(0)))).toMatchObject({
      progress: 'Log something this week to start a streak',
    });
  });

  it('leaves out a note for a week still running', () => {
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
      progress: 'Cheapest food week so far: €20 (week of 09-11-2026)',
      earnedOn: results[2].weekEnd,
    });
  });

  it('shows the mark to beat until a cheaper week comes', () => {
    expect(ramen(food([3000, 3000, 4550]))).toMatchObject({
      progress: 'Cheapest food week so far: €30 (week of 19-10-2026). A cheaper week earns it',
      earnedOn: null,
    });
    expect(ramen(food([3050]))).toMatchObject({
      progress: 'Cheapest food week so far: €30.50 (week of 19-10-2026). A cheaper week earns it',
    });
  });

  it('leaves out weeks with no groceries, weeks away and the part week of setup', () => {
    // Nothing on food in the 2nd week, away in the 3rd: neither is the cheapest.
    expect(ramen(food([3000, 0, 1000, 4000], (i) => (i === 2 ? { paused: true } : {})))).toMatchObject({
      progress: 'Cheapest food week so far: €30 (week of 19-10-2026). A cheaper week earns it',
      earnedOn: null,
    });
    // Set up on Wednesday 21 October: the week of 19 October had only five days of the plan.
    expect(ramen(food([500, 3000]), { planStart: '2026-10-21', months: [] })).toMatchObject({
      progress: 'Cheapest food week so far: €30 (week of 26-10-2026). A cheaper week earns it',
      earnedOn: null,
    });
  });
});

describe('Latte Survivor', () => {
  it('is earned by a later month with at most half the eating out of the first full month', () => {
    expect(
      latte([
        { month: '2026-11', eatingOutMinor: 12400 },
        { month: '2026-12', eatingOutMinor: 7000 },
        { month: '2027-01', eatingOutMinor: 6200 },
        { month: '2027-02', eatingOutMinor: 1000 },
      ]),
    ).toEqual({
      id: 'latte-survivor',
      title: 'Latte Survivor',
      tier: null,
      progress: 'January 2027: €62 on eating out, down from €124 in November 2026',
      earnedOn: '2027-01-31',
    });
  });

  it('says what a month has to come in under until then', () => {
    expect(
      latte([
        { month: '2026-11', eatingOutMinor: 12400 },
        { month: '2026-12', eatingOutMinor: 6201 },
      ]),
    ).toMatchObject({ progress: 'A month with €62 or less on eating out earns it (half of November 2026)', earnedOn: null });
    expect(latte([{ month: '2026-11', eatingOutMinor: 12345 }])).toMatchObject({
      progress: 'A month with €61.72 or less on eating out earns it (half of November 2026)',
      earnedOn: null,
    });
  });

  it('needs eating out in the first full month to halve', () => {
    expect(
      latte([
        { month: '2026-11', eatingOutMinor: 0 },
        { month: '2026-12', eatingOutMinor: 0 },
      ]),
    ).toMatchObject({ progress: 'Your first full month, November 2026, had no eating out to halve', earnedOn: null });
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

  const entry = (date: IsoDate, categoryId: string, eurMinor: number, type: 'expense' | 'income' = 'expense'): Entry => ({
    id: `${date}-${categoryId}-${eurMinor}`,
    type,
    date,
    accountId: 'cash',
    amountMinor: eurMinor * 100,
    eurMinor,
    categoryId,
    note: '',
    createdAt: `${date}T12:00:00.000Z`,
  });

  const ENTRIES = [
    entry('2026-10-20', 'eating-out', 900),
    entry('2026-11-02', 'eating-out', 1000),
    entry('2026-11-30', 'eating-out', 2000),
    entry('2026-11-10', 'going-out', 5000),
    entry('2026-11-11', 'eating-out', 7000, 'income'),
    entry('2026-12-24', 'eating-out', 1500),
    entry('2027-01-03', 'eating-out', 400),
  ];

  it('totals eating out in EUR for each finished month from the first full month after setup', () => {
    // Set up mid-October, so November is the first full month; January is still running.
    expect(badgeHistory(plan('2026-10-16'), ENTRIES, '2027-01-05')).toEqual({
      planStart: '2026-10-16',
      months: [
        { month: '2026-11', eatingOutMinor: 3000 },
        { month: '2026-12', eatingOutMinor: 1500 },
      ],
    });
  });

  it('starts with the month of setup when setup was on the 1st, and is empty while that month runs', () => {
    expect(badgeHistory(plan('2026-11-01'), ENTRIES, '2026-12-15').months).toEqual([
      { month: '2026-11', eatingOutMinor: 3000 },
    ]);
    expect(badgeHistory(plan('2026-10-16'), ENTRIES, '2026-11-30').months).toEqual([]);
    expect(badgeHistory(plan('2026-10-16'), ENTRIES, 'not a date').months).toEqual([]);
  });
});

describe('copy', () => {
  it('never speaks of losing, breaking or failing', () => {
    const histories: BadgeHistory[] = [
      HISTORY,
      { planStart: '2026-10-19', months: [{ month: '2026-11', eatingOutMinor: 0 }] },
      { planStart: '2026-10-19', months: [{ month: '2026-11', eatingOutMinor: 9000 }, { month: '2026-12', eatingOutMinor: 8000 }] },
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
