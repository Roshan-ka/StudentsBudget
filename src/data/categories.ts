import type { Category } from '@/db/types';

const ROWS: Omit<Category, 'order'>[] = [
  { id: 'food', name: 'Food & groceries', kind: 'flexible' },
  { id: 'eating-out', name: 'Eating out', kind: 'flexible' },
  { id: 'going-out', name: 'Going out', kind: 'flexible' },
  { id: 'transport', name: 'Transport', kind: 'flexible' },
  { id: 'shopping', name: 'Shopping', kind: 'flexible' },
  { id: 'other', name: 'Other', kind: 'flexible' },
  { id: 'rent', name: 'Rent', kind: 'fixed' },
  { id: 'phone', name: 'Phone & internet', kind: 'fixed' },
  { id: 'insurance', name: 'Insurance', kind: 'fixed' },
  { id: 'subscriptions', name: 'Subscriptions', kind: 'fixed' },
  { id: 'transport-pass', name: 'Deutschlandticket / semester ticket', kind: 'fixed' },
  { id: 'one-off', name: 'One-off costs', kind: 'oneoff' },
  { id: 'income-job', name: 'Job', kind: 'income' },
  { id: 'income-parents', name: 'Parents', kind: 'income' },
  { id: 'income-bafoeg', name: 'BAföG', kind: 'income' },
  { id: 'income-sperrkonto', name: 'Blocked account', kind: 'income' },
  { id: 'income-scholarship', name: 'Scholarship', kind: 'income' },
  { id: 'income-other', name: 'Other income', kind: 'income' },
];

/** The 18 built-in categories. `order` is the position in this list, starting at 0. */
export const CATEGORIES: Category[] = ROWS.map((row, order) => ({ ...row, order }));
