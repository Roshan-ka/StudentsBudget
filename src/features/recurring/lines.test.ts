import { describe, expect, it } from 'vitest';
import type { Plan, Schedule } from '@/db/types';
import {
  addableCategories,
  applyLineChange,
  describeLine,
  overBudgetLine,
  removeLine,
  setLinePaused,
} from './lines';

const TODAY = '2026-11-10';

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'rent-s',
    frequency: 'monthly',
    day: 1,
    accountId: 'local',
    amountMinor: 40000,
    startOn: '2026-10-17',
    postedThrough: '2026-11-30',
    ...overrides,
  };
}

const PLAN: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [
    { categoryId: 'income-job', monthlyMinor: 40000 },
    { categoryId: 'income-parents', monthlyMinor: 50000, schedule: schedule({ id: 'parents-s', accountId: 'home', amountMinor: 5_000_000 }) },
  ],
  fixed: [
    { categoryId: 'rent', monthlyMinor: 40000, schedule: schedule() },
    { categoryId: 'phone', monthlyMinor: 2500 },
  ],
  oneOffs: [],
  envelopes: [{ categoryId: 'food', monthlyMinor: 31000 }],
  createdOn: '2026-10-16',
};

const ACCOUNTS = [
  { id: 'local', name: 'Local bank', currency: 'EUR' as const },
  { id: 'home', name: 'Home bank', currency: 'INR' as const },
];

describe('applyLineChange', () => {
  it('changes the day and amount and keeps the schedule id, start and watermark', () => {
    const next = applyLineChange(
      PLAN,
      {
        categoryId: 'rent',
        auto: { frequency: 'monthly', day: 3, accountId: 'local', amountMinor: 42000, currency: 'EUR' },
        monthlyMinor: 0,
      },
      TODAY,
      ACCOUNTS,
    );
    expect(next.fixed[0]).toEqual({
      categoryId: 'rent',
      monthlyMinor: 42000,
      schedule: schedule({ day: 3, amountMinor: 42000 }),
    });
    expect(next.fixed[1]).toBe(PLAN.fixed[1]);
    expect(next.incomes).toBe(PLAN.incomes);
  });

  it('works out the plan figure of a weekly euro line from its amount', () => {
    const next = applyLineChange(
      PLAN,
      {
        categoryId: 'income-job',
        auto: { frequency: 'weekly', day: 5, accountId: 'local', amountMinor: 2500, currency: 'EUR' },
        monthlyMinor: 0,
      },
      TODAY,
      ACCOUNTS,
    );
    expect(next.incomes[0]).toMatchObject({
      categoryId: 'income-job',
      monthlyMinor: 10833,
      schedule: { frequency: 'weekly', day: 5, accountId: 'local', amountMinor: 2500, startOn: '2026-11-11', postedThrough: TODAY },
    });
  });

  it('keeps the euro plan figure that was typed for a line on a foreign account', () => {
    const next = applyLineChange(
      PLAN,
      {
        categoryId: 'income-parents',
        auto: { frequency: 'monthly', day: 1, accountId: 'home', amountMinor: 5_500_000, currency: 'INR' },
        monthlyMinor: 55000,
      },
      TODAY,
      ACCOUNTS,
    );
    expect(next.incomes[1]).toEqual({
      categoryId: 'income-parents',
      monthlyMinor: 55000,
      schedule: schedule({ id: 'parents-s', accountId: 'home', amountMinor: 5_500_000 }),
    });
  });

  it('keeps a pause through an edit', () => {
    const paused = setLinePaused(PLAN, 'rent', true, TODAY);
    const next = applyLineChange(
      paused,
      { categoryId: 'rent', auto: { frequency: 'monthly', day: 2, accountId: 'local', amountMinor: 40000, currency: 'EUR' }, monthlyMinor: 0 },
      TODAY,
      ACCOUNTS,
    );
    expect(next.fixed[0].schedule).toMatchObject({ paused: true, day: 2 });
  });

  describe('a line whose account is gone', () => {
    const orphaned: Plan = {
      ...PLAN,
      fixed: [{ categoryId: 'rent', monthlyMinor: 40000, schedule: schedule({ accountId: 'gone', postedThrough: '2026-09-30', paused: true }) }],
    };
    const local = { frequency: 'monthly' as const, day: 1, accountId: 'local', amountMinor: 40000, currency: 'EUR' as const };

    it('is added again from tomorrow once an account is picked, so the months it missed are not posted', () => {
      const next = applyLineChange(orphaned, { categoryId: 'rent', auto: local, monthlyMinor: 0 }, TODAY, ACCOUNTS);
      expect(next.fixed[0].schedule).toEqual(
        schedule({ accountId: 'local', startOn: '2026-11-11', postedThrough: TODAY, paused: true }),
      );
    });

    it('keeps a watermark that is later than today', () => {
      const ahead = { ...orphaned, fixed: [{ ...orphaned.fixed[0], schedule: schedule({ accountId: 'gone' }) }] };
      const next = applyLineChange(ahead, { categoryId: 'rent', auto: local, monthlyMinor: 0 }, TODAY, ACCOUNTS);
      expect(next.fixed[0].schedule).toMatchObject({ startOn: '2026-11-11', postedThrough: '2026-11-30' });
    });

    it('is not restarted by an edit that keeps a known account', () => {
      const next = applyLineChange(PLAN, { categoryId: 'rent', auto: local, monthlyMinor: 0 }, TODAY, ACCOUNTS);
      expect(next.fixed[0].schedule).toEqual(schedule());
    });
  });

  it('turns auto-adding off by dropping the schedule and keeping the amount typed', () => {
    const next = applyLineChange(PLAN, { categoryId: 'rent', auto: null, monthlyMinor: 41000 }, TODAY, ACCOUNTS);
    expect(next.fixed[0]).toEqual({ categoryId: 'rent', monthlyMinor: 41000 });
  });

  it('turns it on again as a new schedule that starts tomorrow', () => {
    const off = applyLineChange(PLAN, { categoryId: 'rent', auto: null, monthlyMinor: 40000 }, TODAY, ACCOUNTS);
    const on = applyLineChange(
      off,
      { categoryId: 'rent', auto: { frequency: 'monthly', day: 1, accountId: 'local', amountMinor: 40000, currency: 'EUR' }, monthlyMinor: 0 },
      TODAY,
      ACCOUNTS,
    );
    expect(on.fixed[0].schedule).toMatchObject({ startOn: '2026-11-11', postedThrough: TODAY });
    expect(on.fixed[0].schedule?.id).not.toBe('rent-s');
  });

  it('adds a new line in category order', () => {
    const next = applyLineChange(
      PLAN,
      { categoryId: 'insurance', auto: { frequency: 'monthly', day: 15, accountId: 'local', amountMinor: 11000, currency: 'EUR' }, monthlyMinor: 0 },
      TODAY,
      ACCOUNTS,
    );
    expect(next.fixed.map((l) => l.categoryId)).toEqual(['rent', 'phone', 'insurance']);
    expect(next.fixed[2].schedule).toMatchObject({ day: 15, startOn: '2026-11-11', postedThrough: TODAY });

    const withBafoeg = applyLineChange(PLAN, { categoryId: 'income-bafoeg', auto: null, monthlyMinor: 30000 }, TODAY, ACCOUNTS);
    expect(withBafoeg.incomes.map((l) => l.categoryId)).toEqual(['income-job', 'income-parents', 'income-bafoeg']);
  });
});

describe('setLinePaused', () => {
  it('pauses without touching the watermark', () => {
    const next = setLinePaused(PLAN, 'rent', true, TODAY);
    expect(next.fixed[0].schedule).toEqual(schedule({ paused: true }));
  });

  it('resumes from tomorrow and skips what was paused', () => {
    const paused = setLinePaused(
      { ...PLAN, fixed: [{ categoryId: 'rent', monthlyMinor: 40000, schedule: schedule({ postedThrough: '2026-10-31' }) }] },
      'rent',
      true,
      TODAY,
    );
    const resumed = setLinePaused(paused, 'rent', false, '2027-01-15');
    expect(resumed.fixed[0].schedule).toEqual(schedule({ startOn: '2027-01-16', postedThrough: '2027-01-15' }));
  });

  it('leaves a line without a schedule alone', () => {
    expect(setLinePaused(PLAN, 'phone', true, TODAY).fixed[1]).toBe(PLAN.fixed[1]);
  });
});

describe('removeLine', () => {
  it('takes the line out of the plan', () => {
    expect(removeLine(PLAN, 'rent').fixed.map((l) => l.categoryId)).toEqual(['phone']);
    expect(removeLine(PLAN, 'income-job').incomes.map((l) => l.categoryId)).toEqual(['income-parents']);
  });
});

describe('addableCategories', () => {
  it('offers the fixed and income categories the plan has no line for, in category order', () => {
    expect(addableCategories(PLAN).map((c) => c.id)).toEqual([
      'insurance',
      'subscriptions',
      'transport-pass',
      'gym',
      'utilities',
      'income-bafoeg',
      'income-sperrkonto',
      'income-scholarship',
      'income-other',
    ]);
  });
});

describe('describeLine', () => {
  it('gives the amount in the account currency, the timing and the account', () => {
    expect(describeLine(PLAN.fixed[0], ACCOUNTS)).toBe('€400.00 · Monthly on day 1 · Local bank');
    expect(describeLine(PLAN.incomes[1], ACCOUNTS)).toBe('₹50,000.00 · Monthly on day 1 · Home bank');
  });

  it('says when a line is paused, and that it is out of the plan meanwhile', () => {
    expect(describeLine(setLinePaused(PLAN, 'rent', true, TODAY).fixed[0], ACCOUNTS)).toBe(
      '€400.00 · Monthly on day 1 · Local bank · Paused · not in your plan for now',
    );
  });

  it('asks for an account when the one it used is gone', () => {
    expect(describeLine(PLAN.fixed[0], [ACCOUNTS[1]])).toBe('Monthly on day 1 · Pick an account for this');
  });

  it('gives the monthly amount of a line that is not added automatically', () => {
    expect(describeLine(PLAN.fixed[1], ACCOUNTS)).toBe('€25.00 a month · Not added automatically');
  });
});

describe('overBudgetLine', () => {
  it('is null while the plan fits', () => {
    expect(overBudgetLine(PLAN, '2026-11')).toBeNull();
  });

  it('says calmly by how much the plan is over, in whole euros rounded up', () => {
    // 900 income - 425 fixed = 475 available; envelopes 480.50.
    const over = { ...PLAN, envelopes: [{ categoryId: 'food', monthlyMinor: 48050 }] };
    expect(overBudgetLine(over, '2026-11')).toBe('Your plan is €6 over your income');
  });
});
