import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import type { Account, Entry, Plan, PlanLine, Rate, Schedule } from '@/db/types';
import type { CurrencyCode } from '@/lib/money';
import { postDueRecurring, recurringEntryId } from './post-due';

const CREATED_AT = '2026-10-16T10:00:00.000Z';

function account(id: string, currency: CurrencyCode = 'EUR'): Account {
  return { id, name: id, kind: 'bank', currency, openingMinor: 0, createdAt: CREATED_AT };
}

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'rent-s',
    frequency: 'monthly',
    day: 1,
    accountId: 'local',
    amountMinor: 40000,
    startOn: '2026-10-17',
    postedThrough: '2026-10-16',
    ...overrides,
  };
}

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'current',
    cityId: 'regensburg',
    incomes: [],
    fixed: [{ categoryId: 'rent', monthlyMinor: 40000, schedule: schedule() }],
    oneOffs: [],
    envelopes: [],
    createdOn: '2026-10-16',
    ...overrides,
  };
}

function ecb(currency: CurrencyCode, perEur: number): Rate {
  return { currency, perEur, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'ecb' };
}

async function storedPlan(): Promise<Plan> {
  const p = await db.plan.get('current');
  if (!p) throw new Error('no plan');
  return p;
}

async function scheduleOf(categoryId: string): Promise<Schedule | undefined> {
  const p = await storedPlan();
  return [...p.incomes, ...p.fixed].find((l: PlanLine) => l.categoryId === categoryId)?.schedule;
}

async function entries(): Promise<Entry[]> {
  return db.entries.orderBy('date').toArray();
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.accounts.bulkAdd([account('local'), account('home', 'INR')]);
});

describe('recurringEntryId', () => {
  it('names the schedule and the period', () => {
    expect(recurringEntryId('abc', '2026-11-01')).toBe('rec:abc:2026-11-01');
  });
});

describe('postDueRecurring', () => {
  it('posts nothing without a plan', async () => {
    expect(await postDueRecurring('2026-11-01')).toEqual({ posted: 0 });
    expect(await entries()).toEqual([]);
  });

  it('posts a fixed cost as an expense on its day and moves the watermark to the end of that month', async () => {
    await db.plan.put(plan());

    expect(await postDueRecurring('2026-10-31')).toEqual({ posted: 0 });
    expect(await postDueRecurring('2026-11-01')).toEqual({ posted: 1 });

    const [rent] = await entries();
    expect(rent).toMatchObject({
      id: 'rec:rent-s:2026-11-01',
      type: 'expense',
      date: '2026-11-01',
      accountId: 'local',
      categoryId: 'rent',
      amountMinor: 40000,
      eurMinor: 40000,
      note: 'Rent',
      recurring: { scheduleId: 'rent-s' },
    });
    expect(Number.isNaN(Date.parse(rent.createdAt))).toBe(false);
    expect(await scheduleOf('rent')).toMatchObject({ postedThrough: '2026-11-30', startOn: '2026-10-17' });
  });

  it('posts an income as an income, and catches up every missed period oldest first', async () => {
    await db.plan.put(
      plan({
        incomes: [
          {
            categoryId: 'income-job',
            monthlyMinor: 10833,
            schedule: schedule({ id: 'job-s', frequency: 'weekly', day: 5, amountMinor: 2500 }),
          },
        ],
        fixed: [],
      }),
    );

    // Fridays after setup: 23 and 30 October, 6 November.
    expect(await postDueRecurring('2026-11-07')).toEqual({ posted: 3 });
    const posted = await entries();
    expect(posted.map((e) => [e.date, e.type, e.amountMinor])).toEqual([
      ['2026-10-23', 'income', 2500],
      ['2026-10-30', 'income', 2500],
      ['2026-11-06', 'income', 2500],
    ]);
    expect(posted.map((e) => e.id)).toEqual([
      'rec:job-s:2026-10-19',
      'rec:job-s:2026-10-26',
      'rec:job-s:2026-11-02',
    ]);
    expect(posted[0]).toMatchObject({ categoryId: 'income-job', note: 'Job' });
    expect(await scheduleOf('income-job')).toMatchObject({ postedThrough: '2026-11-08' });
  });

  it('runs again without posting twice', async () => {
    await db.plan.put(plan());
    expect(await postDueRecurring('2026-11-01')).toEqual({ posted: 1 });
    expect(await postDueRecurring('2026-11-01')).toEqual({ posted: 0 });
    expect(await postDueRecurring('2026-11-20')).toEqual({ posted: 0 });
    expect(await entries()).toHaveLength(1);
  });

  it('posts once when two calls run at the same time', async () => {
    await db.plan.put(plan());
    const results = await Promise.all([postDueRecurring('2026-12-01'), postDueRecurring('2026-12-01')]);
    expect(results.map((r) => r.posted).sort()).toEqual([0, 2]);
    expect((await entries()).map((e) => e.date)).toEqual(['2026-11-01', '2026-12-01']);
  });

  it('posts once when two tabs run at the same time', async () => {
    await db.plan.put(plan());
    // A fresh module graph is a second tab: its own queue and its own connection to the same database.
    vi.resetModules();
    const otherTab = await import('./post-due');
    const results = await Promise.all([postDueRecurring('2026-12-01'), otherTab.postDueRecurring('2026-12-01')]);
    expect(results.map((r) => r.posted).sort()).toEqual([0, 2]);
    expect(await entries()).toHaveLength(2);
  });

  it('does not bring back an occurrence that was deleted', async () => {
    await db.plan.put(plan());
    await postDueRecurring('2026-11-01');
    await db.entries.delete('rec:rent-s:2026-11-01');

    expect(await postDueRecurring('2026-11-02')).toEqual({ posted: 0 });
    expect(await postDueRecurring('2026-12-01')).toEqual({ posted: 1 });
    expect((await entries()).map((e) => e.date)).toEqual(['2026-12-01']);
  });

  it('skips a period whose entry already exists and still moves past it', async () => {
    await db.plan.put(plan());
    // Restored from a backup, say: the entry is there but the plan's watermark is older.
    await db.entries.add({
      id: 'rec:rent-s:2026-11-01',
      type: 'expense',
      date: '2026-11-01',
      accountId: 'local',
      categoryId: 'rent',
      amountMinor: 39000,
      eurMinor: 39000,
      note: 'Rent, edited',
      createdAt: CREATED_AT,
      recurring: { scheduleId: 'rent-s' },
    });

    expect(await postDueRecurring('2026-12-01')).toEqual({ posted: 1 });
    const posted = await entries();
    expect(posted.map((e) => [e.date, e.amountMinor, e.note])).toEqual([
      ['2026-11-01', 39000, 'Rent, edited'],
      ['2026-12-01', 40000, 'Rent'],
    ]);
    expect(await scheduleOf('rent')).toMatchObject({ postedThrough: '2026-12-31' });
  });

  it('converts a foreign amount with the rate in use, a manual one first', async () => {
    await db.plan.put(
      plan({
        incomes: [
          {
            categoryId: 'income-parents',
            monthlyMinor: 50000,
            schedule: schedule({ id: 'parents-s', accountId: 'home', amountMinor: 5_000_000 }),
          },
        ],
        fixed: [],
      }),
    );
    await db.fxRates.bulkPut([ecb('INR', 95), { ...ecb('INR', 100), source: 'manual' }]);

    expect(await postDueRecurring('2026-11-01')).toEqual({ posted: 1 });
    expect((await entries())[0]).toMatchObject({ accountId: 'home', amountMinor: 5_000_000, eurMinor: 50000 });
  });

  it('posts nothing for a foreign account without a rate, and catches up once a rate exists', async () => {
    await db.plan.put(
      plan({
        incomes: [
          {
            categoryId: 'income-parents',
            monthlyMinor: 50000,
            schedule: schedule({ id: 'parents-s', accountId: 'home', amountMinor: 5_000_000 }),
          },
        ],
      }),
    );

    // Rent is in EUR and still posts; the INR income waits.
    expect(await postDueRecurring('2026-12-01')).toEqual({ posted: 2 });
    expect((await entries()).every((e) => e.type === 'expense' && e.categoryId === 'rent')).toBe(true);
    expect(await scheduleOf('income-parents')).toMatchObject({ postedThrough: '2026-10-16' });

    await db.fxRates.put(ecb('INR', 95));
    expect(await postDueRecurring('2026-12-02')).toEqual({ posted: 2 });
    const incomes = (await entries()).filter((e) => e.type === 'income');
    expect(incomes.map((e) => [e.date, e.eurMinor])).toEqual([
      ['2026-11-01', 52632],
      ['2026-12-01', 52632],
    ]);
    expect(await scheduleOf('income-parents')).toMatchObject({ postedThrough: '2026-12-31' });
  });

  it('skips a line whose account is gone and leaves its watermark', async () => {
    await db.plan.put(plan({ fixed: [{ categoryId: 'rent', monthlyMinor: 40000, schedule: schedule({ accountId: 'gone' }) }] }));
    expect(await postDueRecurring('2026-12-01')).toEqual({ posted: 0 });
    expect(await scheduleOf('rent')).toMatchObject({ postedThrough: '2026-10-16' });
  });

  it('skips a paused line and a line without a schedule', async () => {
    await db.plan.put(
      plan({
        incomes: [{ categoryId: 'income-job', monthlyMinor: 40000 }],
        fixed: [{ categoryId: 'rent', monthlyMinor: 40000, schedule: schedule({ paused: true }) }],
      }),
    );
    expect(await postDueRecurring('2026-12-01')).toEqual({ posted: 0 });
    expect(await scheduleOf('rent')).toMatchObject({ postedThrough: '2026-10-16', paused: true });
  });

  it('never posts an occurrence dated before the plan was created', async () => {
    // A damaged or hand-edited file: the schedule claims to start long before the plan existed.
    await db.plan.put(
      plan({
        createdOn: '2026-10-16',
        fixed: [
          {
            categoryId: 'rent',
            monthlyMinor: 40000,
            schedule: schedule({ day: 20, startOn: '2020-01-01', postedThrough: '2019-12-31' }),
          },
        ],
      }),
    );
    expect(await postDueRecurring('2026-11-20')).toEqual({ posted: 2 });
    expect((await entries()).map((e) => e.date)).toEqual(['2026-10-20', '2026-11-20']);
  });

  it('leaves a schedule it cannot read alone', async () => {
    await db.plan.put(plan({ fixed: [{ categoryId: 'rent', monthlyMinor: 40000, schedule: schedule({ day: 0 }) }] }));
    expect(await postDueRecurring('2026-12-01')).toEqual({ posted: 0 });
  });

  it('leaves the rest of the plan as it was', async () => {
    const before = plan({ incomes: [{ categoryId: 'income-job', monthlyMinor: 40000 }] });
    await db.plan.put(before);
    await postDueRecurring('2026-11-01');
    const after = await storedPlan();
    expect({ ...after, fixed: [] }).toEqual({ ...before, fixed: [] });
    expect(after.fixed[0]).toEqual({ ...before.fixed[0], schedule: schedule({ postedThrough: '2026-11-30' }) });
  });
});
