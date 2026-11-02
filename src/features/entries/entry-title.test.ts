import { describe, expect, it } from 'vitest';
import type { Entry } from '@/db/types';
import { MESSAGES, type Messages } from '@/i18n/messages';
import { entryTitle } from './entry-title';

const en = MESSAGES.en;
// Another language's names, as a dictionary would give them.
const other: Messages = {
  ...en,
  categories: { ...en.categories, rent: 'Miete' },
  entries: { ...en.entries, transfer: 'Umbuchung' },
};

const base = { id: 'e1', date: '2026-10-01', accountId: 'a1', amountMinor: 50000, eurMinor: 50000, createdAt: '' };
const expense = (note: string): Entry => ({ ...base, type: 'expense', categoryId: 'rent', note });
const transfer = (note: string): Entry => ({ ...base, type: 'transfer', toAccountId: 'a2', toAmountMinor: 50000, note });

describe('entryTitle', () => {
  it('is the note, with the category under it', () => {
    expect(entryTitle(expense('Rent for October'), en)).toEqual({ title: 'Rent for October', label: 'Rent' });
    expect(entryTitle(expense('Rent for October'), other)).toEqual({ title: 'Rent for October', label: 'Miete' });
  });

  it('is the category without a note', () => {
    expect(entryTitle(expense(''), en)).toEqual({ title: 'Rent', label: null });
    expect(entryTitle(expense(''), other)).toEqual({ title: 'Miete', label: null });
  });

  it("says a posted entry's note, its category's English name, once and in the dictionary's language", () => {
    expect(entryTitle(expense('Rent'), en)).toEqual({ title: 'Rent', label: null });
    expect(entryTitle(expense('Rent'), other)).toEqual({ title: 'Miete', label: null });
  });

  it("keeps a note that is another category's name", () => {
    expect(entryTitle(expense('Gifts'), other)).toEqual({ title: 'Gifts', label: 'Miete' });
  });

  it('calls a transfer a transfer', () => {
    expect(entryTitle(transfer(''), other)).toEqual({ title: 'Umbuchung', label: null });
    expect(entryTitle(transfer('Savings'), other)).toEqual({ title: 'Savings', label: 'Umbuchung' });
  });
});
