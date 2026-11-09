import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import type { Entry, Plan } from '@/db/types';
import { askRequest, MAX_DATA } from '@/features/ai/contract';
import { categoryNameIn } from '@/i18n/category-name';
import { MESSAGES } from '@/i18n/messages';
import { monthStatus, planSummary, weekToSpend } from '@/lib/budget';
import { askSnapshot, MAX_RECENT, NOTE_LENGTH, snapshotBytes, type AskSnapshot } from './snapshot';

const en = MESSAGES.en;
const TODAY = '2026-11-12';

const PLAN: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [
    { categoryId: 'income-parents', monthlyMinor: 50000 },
    { categoryId: 'income-job', monthlyMinor: 45000 },
  ],
  fixed: [{ categoryId: 'rent', monthlyMinor: 40000 }],
  oneOffs: [
    { id: 'fee', name: 'Semester fee', amountMinor: 30000, createdMonth: '2026-09', dueMonth: '2027-03' },
    { id: 'old', name: 'Deposit', amountMinor: 50000, createdMonth: '2026-08', dueMonth: '2026-10' },
  ],
  envelopes: [
    { categoryId: 'food', monthlyMinor: 31000 },
    { categoryId: 'eating-out', monthlyMinor: 12400 },
    { categoryId: 'transport', monthlyMinor: 5000 },
  ],
  createdOn: '2026-09-20',
};

let made = 0;
function entry(date: string, type: 'expense' | 'income', categoryId: string, eurMinor: number, note = ''): Entry {
  made += 1;
  return {
    id: `e${made}`,
    date,
    accountId: 'acc-local',
    amountMinor: eurMinor,
    eurMinor,
    note,
    createdAt: `${date}T10:00:${String(made % 60).padStart(2, '0')}.000Z`,
    type,
    categoryId,
  };
}

const ENTRIES: Entry[] = [
  entry('2026-09-25', 'expense', 'food', 4200, 'REWE'),
  entry('2026-10-03', 'expense', 'food', 6100, 'Aldi'),
  entry('2026-10-15', 'expense', 'eating-out', 1850, 'pizza with Tom'),
  entry('2026-11-01', 'income', 'income-parents', 50000),
  entry('2026-11-01', 'expense', 'rent', 40000, 'rent'),
  entry('2026-11-04', 'expense', 'food', 3240, 'Edeka'),
  entry('2026-11-10', 'expense', 'eating-out', 1200, 'döner'),
  entry('2026-11-11', 'expense', 'transport', 290, 'bus'),
  // Dated ahead of today: it counts in the month, as on Home, but isn't among the recent entries yet.
  entry('2026-11-20', 'expense', 'food', 2500, 'planned shop'),
  {
    id: 'transfer',
    date: '2026-11-05',
    accountId: 'acc-local',
    amountMinor: 10000,
    eurMinor: 10000,
    note: 'cash',
    createdAt: '2026-11-05T10:00:00.000Z',
    type: 'transfer',
    toAccountId: 'acc-cash',
    toAmountMinor: 10000,
  },
];

const snap = () => askSnapshot({ plan: PLAN, entries: ENTRIES }, TODAY, en);
const cents = (eurValue: number) => Math.round(eurValue * 100);

describe('askSnapshot', () => {
  it('gives this month as Home does: monthStatus over the envelopes, planned less spent', () => {
    const { month, thisMonth } = snap();
    const rows = monthStatus(PLAN, ENTRIES, '2026-11');
    const planned = rows.reduce((n, row) => n + row.plannedMinor, 0);
    const spent = rows.reduce((n, row) => n + row.spentMinor, 0);

    expect(month).toBe('2026-11');
    expect(cents(thisMonth.plannedEur)).toBe(planned);
    expect(cents(thisMonth.spentEur)).toBe(spent);
    expect(cents(thisMonth.leftEur)).toBe(planned - spent);
    // Every envelope planned or used, with its figures; rent is a fixed cost, not an envelope.
    expect(thisMonth.envelopes).toEqual(
      rows
        .filter((row) => row.plannedMinor > 0 || row.spentMinor > 0)
        .map((row) => ({
          categoryId: row.categoryId,
          plannedEur: row.plannedMinor / 100,
          spentEur: row.spentMinor / 100,
          leftEur: (row.plannedMinor - row.spentMinor) / 100,
        })),
    );
    expect(thisMonth.envelopes.map((row) => row.categoryId)).toEqual(['food', 'eating-out', 'transport']);
  });

  it('gives this week as Home does: weekToSpend, with each envelope’s share', () => {
    const { thisWeek } = snap();
    const week = weekToSpend(PLAN, ENTRIES, TODAY);

    // This week, two whole ones, and Monday the 30th, a stub week that counts whole.
    expect(thisWeek).toMatchObject({ start: week.weekStart, end: week.weekEnd, weeksLeftInMonth: 4 });
    expect(cents(thisWeek.leftEur)).toBe(week.totalMinor);
    for (const row of thisWeek.envelopes) {
      const same = week.envelopes.find((e) => e.categoryId === row.categoryId)!;
      expect([cents(row.shareEur), cents(row.spentEur), cents(row.safeEur)]).toEqual([
        same.weekShareMinor,
        same.spentThisWeekMinor,
        same.safeMinor,
      ]);
    }
  });

  it('gives the plan as planSummary weighs it, with its incomes and fixed costs', () => {
    const { plan } = snap();
    const summary = planSummary(PLAN, '2026-11');

    expect(plan).toEqual({
      incomeEur: summary.incomeMinor / 100,
      fixedEur: summary.fixedMinor / 100,
      setAsideEur: summary.setAsideMinor / 100,
      availableEur: summary.availableMinor / 100,
      envelopesEur: summary.envelopesMinor / 100,
      overByEur: summary.overByMinor / 100,
      incomes: [
        { categoryId: 'income-parents', monthlyEur: 500 },
        { categoryId: 'income-job', monthlyEur: 450 },
      ],
      fixed: [{ categoryId: 'rent', monthlyEur: 400 }],
    });
    expect(askSnapshot({ plan: { ...PLAN, spendingBudgetMinor: 60000 }, entries: [] }, TODAY, en).plan.spendingBudgetEur).toBe(600);
  });

  it('leaves out a paused line, as planSummary does', () => {
    const paused: Plan = {
      ...PLAN,
      incomes: [
        PLAN.incomes[0],
        {
          ...PLAN.incomes[1],
          schedule: {
            id: 'job',
            frequency: 'monthly',
            day: 1,
            accountId: 'acc-local',
            amountMinor: 45000,
            startOn: '2026-09-21',
            postedThrough: '2026-11-01',
            paused: true,
          },
        },
      ],
    };
    const { plan } = askSnapshot({ plan: paused, entries: ENTRIES }, TODAY, en);
    expect(plan.incomes).toEqual([{ categoryId: 'income-parents', monthlyEur: 500 }]);
    expect(plan.incomeEur).toBe(500);
  });

  it('gives the two months before this one, newest first, but none before the plan began', () => {
    expect(snap().pastMonths.map((past) => past.month)).toEqual(['2026-10', '2026-09']);
    const october = snap().pastMonths[0];
    expect(october).toEqual({
      month: '2026-10',
      plannedEur: 484,
      spentEur: 79.5,
      envelopes: [
        { categoryId: 'food', plannedEur: 310, spentEur: 61 },
        { categoryId: 'eating-out', plannedEur: 124, spentEur: 18.5 },
        { categoryId: 'transport', plannedEur: 50, spentEur: 0 },
      ],
    });

    // In October the plan began only in September: one month.
    expect(askSnapshot({ plan: PLAN, entries: ENTRIES }, '2026-10-20', en).pastMonths.map((past) => past.month)).toEqual([
      '2026-09',
    ]);
  });

  it('lists the one-offs not yet due, with what this month and the months before set aside', () => {
    expect(snap().oneOffs).toEqual([
      // €300 over six months from September: €50 a month, two months before November.
      { name: 'Semester fee', amountEur: 300, dueMonth: '2027-03', setAsideThisMonthEur: 50, setAsideBeforeEur: 100 },
    ]);
  });

  it('lists the month’s five largest expenses, largest first', () => {
    const many = [...ENTRIES, ...[700, 900, 1100, 1300].map((minor) => entry('2026-11-06', 'expense', 'food', minor))];
    const top = askSnapshot({ plan: PLAN, entries: many }, TODAY, en).topExpenses;

    expect(top.map((row) => row.amountEur)).toEqual([400, 32.4, 25, 13, 12]);
    expect(top[0]).toEqual({ date: '2026-11-01', type: 'expense', amountEur: 400, categoryId: 'rent', note: 'rent' });
  });

  it('lists recent expenses and incomes up to today, newest first, without transfers', () => {
    const { recent } = snap();

    expect(recent.map((row) => `${row.date} ${row.type} ${row.amountEur}`)).toEqual([
      '2026-11-11 expense 2.9',
      '2026-11-10 expense 12',
      '2026-11-04 expense 32.4',
      '2026-11-01 expense 400',
      '2026-11-01 income 500',
      '2026-10-15 expense 18.5',
      '2026-10-03 expense 61',
      '2026-09-25 expense 42',
    ]);
    // An empty note leaves the key out.
    expect(recent.find((row) => row.type === 'income')).not.toHaveProperty('note');
  });

  it('keeps at most 60 recent entries', () => {
    const lots = Array.from({ length: 90 }, (_, i) => entry(`2026-10-${String((i % 28) + 1).padStart(2, '0')}`, 'expense', 'food', 100));
    expect(askSnapshot({ plan: PLAN, entries: lots }, TODAY, en).recent).toHaveLength(MAX_RECENT);
  });

  it('names every category it uses, in the phone’s language, and no other', () => {
    const de = askSnapshot({ plan: PLAN, entries: ENTRIES }, TODAY, MESSAGES.de);
    const used = new Set<string>([
      ...de.plan.incomes.map((row) => row.categoryId),
      ...de.plan.fixed.map((row) => row.categoryId),
      ...de.thisMonth.envelopes.map((row) => row.categoryId),
      ...de.recent.map((row) => row.categoryId),
    ]);

    expect(Object.keys(de.categories).sort()).toEqual([...used].sort());
    expect(de.categories['eating-out']).toBe(categoryNameIn(MESSAGES.de, 'eating-out'));
    expect(de.categories['eating-out']).not.toBe(categoryNameIn(en, 'eating-out'));
  });

  it('writes money only in euros under a key ending in Eur, with at most two decimals; other numbers are counts', () => {
    const numbers: [string, number][] = [];
    const walk = (value: unknown, key: string) => {
      if (typeof value === 'number') numbers.push([key, value]);
      else if (Array.isArray(value)) value.forEach((inner) => walk(inner, key));
      else if (value !== null && typeof value === 'object') for (const [k, inner] of Object.entries(value)) walk(inner, k);
    };
    walk(snap(), '');

    expect(numbers.length).toBeGreaterThan(20);
    for (const [key, value] of numbers) {
      if (key.endsWith('Eur')) expect(Math.round(value * 100) / 100, key).toBe(value);
      else {
        expect(key).toBe('weeksLeftInMonth');
        expect(Number.isInteger(value)).toBe(true);
      }
    }
  });

  it('holds no account and no balance: names, ids and currencies of accounts never appear', () => {
    const text = JSON.stringify(snap());

    for (const word of ['acc-local', 'acc-cash', 'accountId', 'balance', 'opening', 'EUR', 'Sparkasse']) {
      expect(text).not.toContain(word);
    }
  });

  it('scrubs notes and one-off names, and cuts them to 60 characters', () => {
    const notes = [
      entry('2026-11-11', 'expense', 'food', 500, 'Lastschrift DE89 3704 0044 0532 0130 00 REWE'),
      entry('2026-11-11', 'expense', 'food', 600, 'card 4930 1234 5678 9012 at Edeka'),
      entry('2026-11-11', 'expense', 'food', 700, `${'a very long note about groceries '.repeat(4)}end`),
    ];
    const plan: Plan = { ...PLAN, oneOffs: [{ ...PLAN.oneOffs[0], name: 'Fee to DE89370400440532013000' }] };
    const snapshot = askSnapshot({ plan, entries: notes }, TODAY, en);
    const text = JSON.stringify(snapshot);

    expect(text).not.toMatch(/DE89|3704|0532|4930|5678|9012/);
    expect(snapshot.recent.map((row) => row.note)).toContain('Lastschrift REWE');
    for (const row of snapshot.recent) expect(Array.from(row.note ?? '').length).toBeLessThanOrEqual(NOTE_LENGTH);
    expect(snapshot.oneOffs[0].name).toBe('Fee to');
  });

  it('fits MAX_DATA at its largest, leaving out the oldest recent entries first', () => {
    const flexible = CATEGORIES.filter((c) => c.kind === 'flexible').map((c) => c.id);
    // Three bytes a letter, 60 letters a note: the heaviest note there is.
    const heavy = '漢'.repeat(80);
    const plan: Plan = {
      ...PLAN,
      spendingBudgetMinor: 123456,
      envelopes: flexible.map((categoryId) => ({ categoryId, monthlyMinor: 1234567 })),
      oneOffs: Array.from({ length: 30 }, (_, i) => ({
        id: `o${i}`,
        name: heavy,
        amountMinor: 1234567,
        createdMonth: '2026-09',
        dueMonth: '2027-09',
      })),
    };
    const entries = Array.from({ length: 300 }, (_, i) =>
      entry(
        `2026-${['09', '10', '11'][i % 3]}-${String((i % 11) + 1).padStart(2, '0')}`,
        'expense',
        flexible[i % flexible.length],
        123456 + i,
        heavy,
      ),
    );
    const snapshot: AskSnapshot = askSnapshot({ plan, entries }, TODAY, MESSAGES.de);

    expect(snapshotBytes(snapshot)).toBeLessThanOrEqual(MAX_DATA);
    // Some recent entries had to go, and they were the oldest: what is left is the newest, in order.
    expect(snapshot.recent.length).toBeGreaterThan(0);
    expect(snapshot.recent.length).toBeLessThan(MAX_RECENT);
    const newest = entries
      .filter((row) => row.date <= TODAY)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .map((row) => `${row.date} ${row.eurMinor / 100}`);
    expect(snapshot.recent.map((row) => `${row.date} ${row.amountEur}`)).toEqual(newest.slice(0, snapshot.recent.length));

    // And the function takes it.
    const request = { feature: 'ask', lang: 'de', today: TODAY, snapshot, turns: [{ role: 'user', text: 'Wie stehe ich?' }] };
    expect(askRequest.safeParse(request).success).toBe(true);
  });
});
