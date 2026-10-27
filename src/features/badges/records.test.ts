import { describe, expect, it } from 'vitest';
import type { Entry, Plan } from '@/db/types';
import { weekToSpend } from '@/lib/budget';
import type { IsoDate } from '@/lib/dates';
import { loggedExpenseTest } from './records';

// Food and eating out have envelopes; the plan was set up on Friday 16 October 2026.
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

function entry(date: IsoDate, categoryId: string, overrides: Partial<Entry> = {}): Entry {
  return {
    id: `${date}-${categoryId}`,
    type: 'expense',
    date,
    accountId: 'cash',
    amountMinor: 500,
    eurMinor: 500,
    categoryId,
    note: '',
    createdAt: `${date}T12:00:00.000Z`,
    ...overrides,
  } as Entry;
}

const logged = (e: Entry, plan: Plan = PLAN) => loggedExpenseTest(plan)(e);

describe('loggedExpenseTest', () => {
  it('counts an expense typed in by hand in an envelope, on the setup day or later', () => {
    expect(logged(entry('2026-10-16', 'food'))).toBe(true);
    expect(logged(entry('2026-10-20', 'eating-out'))).toBe(true);
  });

  it('counts a flexible category the plan has no envelope for, because the check-in measures it too', () => {
    expect(logged(entry('2026-10-20', 'going-out'))).toBe(true);
    expect(logged(entry('2026-10-20', 'study'))).toBe(true);
  });

  it('does not count a fixed cost typed in by hand, such as rent', () => {
    for (const categoryId of ['rent', 'phone', 'insurance', 'subscriptions', 'transport-pass', 'gym', 'utilities']) {
      expect(logged(entry('2026-10-20', categoryId)), categoryId).toBe(false);
    }
    expect(logged(entry('2026-10-20', 'one-off'))).toBe(false);
  });

  it('does not count income, a transfer or what a schedule posted', () => {
    expect(logged(entry('2026-10-20', 'income-job', { type: 'income' }))).toBe(false);
    expect(logged(entry('2026-10-20', 'food', { recurring: { scheduleId: 's' } }))).toBe(false);
    const transfer: Entry = {
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
    };
    expect(logged(transfer)).toBe(false);
  });

  it('does not count an expense dated before the setup day', () => {
    expect(logged(entry('2026-10-15', 'food'))).toBe(false);
    expect(logged(entry('2026-09-30', 'eating-out'))).toBe(false);
  });

  it('follows the plan it is made for: its envelopes, and its setup day', () => {
    // A category outside the flexible ones counts when the plan has an envelope for it, as `weekToSpend` sums it.
    const odd: Plan = { ...PLAN, envelopes: [...PLAN.envelopes, { categoryId: 'rent', monthlyMinor: 10000 }] };
    expect(logged(entry('2026-10-20', 'rent'), odd)).toBe(true);
    expect(logged(entry('2026-10-10', 'food'), { ...PLAN, createdOn: '2026-10-01' })).toBe(true);
  });

  it('measures the categories weekToSpend adds up, not a list of its own', () => {
    const measured = weekToSpend(PLAN, [], '2026-10-20').envelopes.map((e) => e.categoryId);
    expect(measured).toContain('going-out');
    expect(measured).not.toContain('rent');
    for (const categoryId of measured) expect(logged(entry('2026-10-20', categoryId)), categoryId).toBe(true);
  });
});
