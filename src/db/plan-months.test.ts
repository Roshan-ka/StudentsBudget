import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Plan } from '@/db/types';
import { postDueRecurring } from '@/features/recurring/post-due';
import { updatePlan } from '@/features/recurring/update-plan';
import { draftFromPlan, draftToRecords } from '@/features/setup/draft';
import { saveWizard } from '@/features/setup/save-wizard';
import { db } from './db';
import { recordPlanMonth } from './plan-months';

// Plan history's writes (plan history, chunk 2): each of the person's own plan writes leaves this month's row; the
// recurring poster, which only moves watermarks, leaves none.

const LOCAL: Account = { id: 'local', name: 'Local bank', kind: 'bank', currency: 'EUR', openingMinor: 0, createdAt: '2026-10-16T10:00:00.000Z' };

const PLAN: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [],
  fixed: [
    {
      categoryId: 'rent',
      monthlyMinor: 40000,
      schedule: {
        id: 'rent-s',
        frequency: 'monthly',
        day: 1,
        accountId: 'local',
        amountMinor: 40000,
        startOn: '2026-10-17',
        postedThrough: '2026-10-16',
      },
    },
  ],
  oneOffs: [],
  envelopes: [{ categoryId: 'food', monthlyMinor: 20000 }],
  createdOn: '2026-10-16',
};

/** Fakes the date only: fake-indexeddb needs its real timers. */
function onDay(day: string) {
  vi.setSystemTime(new Date(`${day}T12:00:00`));
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  onDay('2026-10-20');
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.accounts.add(LOCAL);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('recordPlanMonth', () => {
  it('keeps the plan’s money parts as the month’s row, without schedules', async () => {
    await db.transaction('rw', db.planMonths, () => recordPlanMonth(PLAN, '2026-10-20'));
    expect(await db.planMonths.toArray()).toEqual([
      { month: '2026-10', incomes: [], fixed: [{ categoryId: 'rent', monthlyMinor: 40000 }], oneOffs: [], envelopes: PLAN.envelopes },
    ]);
  });
});

describe('the writes that leave a row', () => {
  it('a new setup starts the history with its month', async () => {
    const records = draftToRecords(draftFromPlan(PLAN), '2026-10-20');
    expect(await saveWizard(records, false)).toBe('saved');
    expect((await db.planMonths.toArray()).map((row) => row.month)).toEqual(['2026-10']);
  });

  it('a change replaces this month’s row and leaves earlier months as they were', async () => {
    await db.plan.put(PLAN);
    await updatePlan((plan) => plan);
    onDay('2026-11-03');
    await updatePlan((plan) => ({ ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 25000 }] }));
    await updatePlan((plan) => ({ ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 26000 }] }));
    const rows = await db.planMonths.toArray();
    expect(rows.map((row) => [row.month, row.envelopes[0].monthlyMinor])).toEqual([
      ['2026-10', 20000],
      ['2026-11', 26000],
    ]);
  });

  it('Edit plan leaves the month’s row', async () => {
    await db.plan.put(PLAN);
    const records = draftToRecords(draftFromPlan(PLAN), '2026-10-20', PLAN);
    expect(await saveWizard(records, true)).toBe('saved');
    expect((await db.planMonths.toArray()).map((row) => row.month)).toEqual(['2026-10']);
  });
});

describe('the writes that leave none', () => {
  it('the recurring poster only moves watermarks', async () => {
    await db.plan.put(PLAN);
    onDay('2026-11-01');
    expect(await postDueRecurring('2026-11-01')).toEqual({ posted: 1 });
    expect((await db.plan.get('current'))?.fixed[0].schedule?.postedThrough).not.toBe(PLAN.fixed[0].schedule?.postedThrough);
    expect(await db.planMonths.count()).toBe(0);
  });
});
