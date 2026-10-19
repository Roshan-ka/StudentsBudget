import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import type { Plan, Schedule } from '@/db/types';
import { postDueRecurring } from './post-due';
import { keepScheduleState, updatePlan } from './update-plan';

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

const PLAN: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [{ categoryId: 'income-job', monthlyMinor: 40000, schedule: schedule({ id: 'job-s', day: 15 }) }],
  fixed: [{ categoryId: 'rent', monthlyMinor: 40000, schedule: schedule() }],
  oneOffs: [],
  envelopes: [{ categoryId: 'food', monthlyMinor: 20000 }],
  createdOn: '2026-10-16',
};

async function stored(): Promise<Plan> {
  const p = await db.plan.get('current');
  if (!p) throw new Error('no plan');
  return p;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.accounts.add({
    id: 'local',
    name: 'Local bank',
    kind: 'bank',
    currency: 'EUR',
    openingMinor: 0,
    createdAt: '2026-10-16T10:00:00.000Z',
  });
  await db.plan.put(PLAN);
});

describe('updatePlan', () => {
  it('writes what the change returns, given the stored plan', async () => {
    await updatePlan((p) => ({ ...p, envelopes: [{ categoryId: 'food', monthlyMinor: 25000 }] }));
    expect((await stored()).envelopes).toEqual([{ categoryId: 'food', monthlyMinor: 25000 }]);
  });

  it('keeps the watermark the poster moved while a change was open', async () => {
    // The editor opened with the plan as setup saved it; meanwhile November's rent was posted.
    const opened = await stored();
    await postDueRecurring('2026-11-01');
    expect((await stored()).fixed[0].schedule?.postedThrough).toBe('2026-11-30');

    // The change was made on the old copy: rent moves to the 3rd and costs more.
    const changed = { ...opened.fixed[0], schedule: { ...schedule(), day: 3, amountMinor: 42000 } };
    await updatePlan((p) => ({ ...opened, envelopes: p.envelopes, fixed: [changed] }));

    expect((await stored()).fixed[0].schedule).toEqual(
      schedule({ day: 3, amountMinor: 42000, postedThrough: '2026-11-30' }),
    );
    // So November is not posted a second time on the new day.
    expect(await postDueRecurring('2026-11-03')).toEqual({ posted: 0 });
  });

  it('lets a change move the watermark forward, as a resume does', async () => {
    await updatePlan((p) => ({
      ...p,
      fixed: [{ ...p.fixed[0], schedule: schedule({ startOn: '2027-01-16', postedThrough: '2027-01-15' }) }],
    }));
    expect((await stored()).fixed[0].schedule).toMatchObject({ startOn: '2027-01-16', postedThrough: '2027-01-15' });
  });

  it('never moves a watermark back', async () => {
    await db.plan.put({ ...PLAN, fixed: [{ ...PLAN.fixed[0], schedule: schedule({ postedThrough: '2026-12-31' }) }] });
    await updatePlan((p) => ({
      ...p,
      fixed: [{ ...p.fixed[0], schedule: schedule({ postedThrough: '2026-10-16' }) }],
    }));
    expect((await stored()).fixed[0].schedule?.postedThrough).toBe('2026-12-31');
  });

  it('follows a schedule that moved between the income and the fixed lists by its id', async () => {
    await db.plan.put({ ...PLAN, incomes: [], fixed: [{ ...PLAN.fixed[0], schedule: schedule({ postedThrough: '2026-12-31' }) }] });
    await updatePlan((p) => ({ ...p, incomes: [{ categoryId: 'income-job', monthlyMinor: 1, schedule: schedule() }], fixed: [] }));
    expect((await stored()).incomes[0].schedule?.postedThrough).toBe('2026-12-31');
  });

  it('gives a new schedule the watermark it was made with', async () => {
    await updatePlan((p) => ({
      ...p,
      fixed: [...p.fixed, { categoryId: 'gym', monthlyMinor: 3000, schedule: schedule({ id: 'gym-s', postedThrough: '2026-11-02' }) }],
    }));
    expect((await stored()).fixed[1].schedule?.postedThrough).toBe('2026-11-02');
  });

  it('rejects when there is no plan to change', async () => {
    await db.plan.clear();
    await expect(updatePlan((p) => p)).rejects.toThrow();
  });
});

describe('keepScheduleState', () => {
  // The wizard opened in a second tab before the line was paused there, or before it was resumed.
  const withRent = (s: Schedule): Plan => ({ ...PLAN, fixed: [{ ...PLAN.fixed[0], schedule: s }] });

  it('keeps a pause made elsewhere', () => {
    const stored = withRent(schedule({ paused: true }));
    const stale = withRent(schedule({ day: 3 }));
    expect(keepScheduleState(stored, stale).fixed[0].schedule).toEqual(schedule({ day: 3, paused: true }));
  });

  it('keeps a resume made elsewhere, with its later start', () => {
    const stored = withRent(schedule({ startOn: '2027-01-16', postedThrough: '2027-01-15' }));
    const stale = withRent(schedule({ paused: true }));
    expect(keepScheduleState(stored, stale).fixed[0].schedule).toEqual(schedule({ startOn: '2027-01-16' }));
  });

  it('keeps the later start the wizard set when it repaired a line', () => {
    const stored = withRent(schedule());
    const repaired = withRent(schedule({ startOn: '2026-12-06', postedThrough: '2026-12-05' }));
    expect(keepScheduleState(stored, repaired).fixed[0].schedule).toMatchObject({ startOn: '2026-12-06' });
  });

  it('leaves new schedules and the rest of the plan alone', () => {
    const next = { ...PLAN, envelopes: [], incomes: [{ ...PLAN.incomes[0], schedule: schedule({ id: 'new' }) }] };
    expect(keepScheduleState(PLAN, next)).toEqual(next);
  });
});
