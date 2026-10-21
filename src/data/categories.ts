import type { Category } from '@/db/types';

const ROWS: Omit<Category, 'order'>[] = [
  { id: 'food', name: 'Food & groceries', kind: 'flexible' },
  { id: 'eating-out', name: 'Eating out', kind: 'flexible' },
  { id: 'going-out', name: 'Going out', kind: 'flexible' },
  { id: 'transport', name: 'Transport', kind: 'flexible' },
  { id: 'shopping', name: 'Shopping', kind: 'flexible' },
  { id: 'health', name: 'Health & pharmacy', kind: 'flexible' },
  { id: 'personal-care', name: 'Personal care', kind: 'flexible' },
  { id: 'study', name: 'Study materials', kind: 'flexible' },
  { id: 'household', name: 'Household', kind: 'flexible' },
  { id: 'travel', name: 'Travel', kind: 'flexible' },
  { id: 'gifts', name: 'Gifts', kind: 'flexible' },
  { id: 'other', name: 'Other', kind: 'flexible' },
  { id: 'rent', name: 'Rent', kind: 'fixed' },
  { id: 'phone', name: 'Phone & internet', kind: 'fixed' },
  { id: 'insurance', name: 'Insurance', kind: 'fixed' },
  { id: 'subscriptions', name: 'Subscriptions', kind: 'fixed' },
  { id: 'transport-pass', name: 'Deutschlandticket / semester ticket', kind: 'fixed' },
  { id: 'gym', name: 'Gym & sports', kind: 'fixed' },
  { id: 'utilities', name: 'Utilities & Rundfunkbeitrag', kind: 'fixed' },
  { id: 'one-off', name: 'One-off costs', kind: 'oneoff' },
  { id: 'income-job', name: 'Job', kind: 'income' },
  { id: 'income-parents', name: 'Parents', kind: 'income' },
  { id: 'income-bafoeg', name: 'BAföG', kind: 'income' },
  { id: 'income-sperrkonto', name: 'Blocked account', kind: 'income' },
  { id: 'income-scholarship', name: 'Scholarship', kind: 'income' },
  { id: 'income-other', name: 'Other income', kind: 'income' },
];

/** The 26 built-in categories. `order` is the position in this list, starting at 0. */
export const CATEGORIES: Category[] = ROWS.map((row, order) => ({ ...row, order }));

/**
 * The flexible categories setup asks a guess for: the original six. Guesses are saved once and the city
 * ranges cover only these, so the categories added later are planned but never guessed.
 */
export const GUESS_CATEGORY_IDS: readonly string[] = [
  'food',
  'eating-out',
  'going-out',
  'transport',
  'shopping',
  'other',
];

/** The income sources a new setup asks about. Edit plan and Settings offer all of them. */
export const SETUP_INCOME_IDS: readonly string[] = ['income-job', 'income-parents', 'income-sperrkonto', 'income-other'];

/** The fixed costs a new setup asks about, besides rent, which has its own question. */
export const SETUP_FIXED_IDS: readonly string[] = ['phone', 'insurance', 'transport-pass'];

/** The envelopes a new setup asks about: the original six, the ones the city ranges cover. */
export const SETUP_ENVELOPE_IDS: readonly string[] = GUESS_CATEGORY_IDS;
