import { describe, expect, it } from 'vitest';
import type { Entry, Plan } from '@/db/types';
import { safeToSpend } from '@/lib/budget';
import { notCountedNote } from './not-counted';

const plan: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [],
  fixed: [],
  oneOffs: [],
  envelopes: [{ categoryId: 'food', monthlyMinor: 31000 }],
  createdOn: '2026-10-16',
};

function entry(overrides: Partial<Entry> & { date: string }): Entry {
  return {
    id: 'e1',
    type: 'expense',
    categoryId: 'food',
    accountId: 'a1',
    amountMinor: 2000,
    eurMinor: 2000,
    note: '',
    createdAt: '2026-10-16T12:00:00.000Z',
    ...overrides,
  } as Entry;
}

describe('notCountedNote', () => {
  it('names an expense dated before the plan started', () => {
    expect(notCountedNote(entry({ date: '2026-10-13' }), plan.createdOn)).toBe('Before your plan started, not counted');
    expect(notCountedNote(entry({ date: '2026-10-15' }), plan.createdOn)).toBe('Before your plan started, not counted');
  });

  it('leaves alone an expense from the setup day on', () => {
    expect(notCountedNote(entry({ date: '2026-10-16' }), plan.createdOn)).toBeNull();
    expect(notCountedNote(entry({ date: '2026-10-18' }), plan.createdOn)).toBeNull();
  });

  it('leaves alone income and transfers, which no envelope counts anyway', () => {
    expect(notCountedNote(entry({ type: 'income', date: '2026-10-13' }), plan.createdOn)).toBeNull();
    const transfer: Entry = {
      id: 't1',
      type: 'transfer',
      accountId: 'a1',
      toAccountId: 'a2',
      amountMinor: 5000,
      toAmountMinor: 5000,
      eurMinor: 5000,
      date: '2026-10-13',
      note: '',
      createdAt: '2026-10-16T12:00:00.000Z',
    };
    expect(notCountedNote(transfer, plan.createdOn)).toBeNull();
  });

  it('marks exactly the expenses the weekly figures leave out', () => {
    // Week Mon 12 - Sun 18 Oct, plan from Fri 16: Tue 13 is listed in the week but never spent against food.
    const before = entry({ id: 'before', date: '2026-10-13' });
    const after = entry({ id: 'after', date: '2026-10-16' });

    const [food] = safeToSpend(plan, [before], '2026-10-18').envelopes;
    expect(food.spentThisWeekMinor).toBe(0);
    expect(notCountedNote(before, plan.createdOn)).not.toBeNull();

    const [counted] = safeToSpend(plan, [after], '2026-10-18').envelopes;
    expect(counted.spentThisWeekMinor).toBe(2000);
    expect(notCountedNote(after, plan.createdOn)).toBeNull();
  });
});
