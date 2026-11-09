import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import type { Entry, ImportMark } from '@/db/types';
import { categorize } from './categorize';

// The category an imported row gets: the student's own choice first (a changed import, else a typed entry), then the
// chain list, then Other. An import's own guess, left as it was, never teaches anything.

let clock = 0;
/** An expense or income, created one minute after the one before, so "newest" is the last one made. */
function entry(type: 'expense' | 'income', categoryId: string, note: string, extra: { imported?: ImportMark; recurring?: { scheduleId: string } } = {}): Entry {
  clock += 1;
  return {
    id: `e${clock}`,
    type,
    date: '2026-11-01',
    accountId: 'bank',
    amountMinor: 1000,
    eurMinor: 1000,
    categoryId,
    note,
    createdAt: new Date(Date.UTC(2026, 10, 1, 8, clock)).toISOString(),
    ...extra,
  };
}

const out = (payee: string, purpose = '') => ({ amountMinor: -1000, payee, purpose });
const into = (payee: string, purpose = '') => ({ amountMinor: 1000, payee, purpose });

describe('categorize', () => {
  it('uses the chain list on a first import, and Other or Other income for the rest', () => {
    expect(categorize(out('REWE Markt GmbH'), [], CATEGORIES)).toEqual({ categoryId: 'food', source: 'chain', merchant: 'rewe' });
    expect(categorize(into('Bundesamt fuer Ausbildungsfoerderung', 'BAFOEG 10/2026'), [], CATEGORIES)).toMatchObject({
      categoryId: 'income-bafoeg',
      source: 'chain',
    });
    expect(categorize(out('Bäckerei Müller'), [], CATEGORIES)).toEqual({
      categoryId: 'other',
      source: 'fallback',
      merchant: 'baeckerei mueller',
    });
    expect(categorize(into('Max Mustermann', 'Rent share'), [], CATEGORIES)).toMatchObject({ categoryId: 'income-other', source: 'fallback' });
  });

  it('saves money back from a shop as other income: a refund', () => {
    expect(categorize(into('AMZN Mktp DE', 'Erstattung'), [], CATEGORIES)).toMatchObject({ categoryId: 'income-other', source: 'chain' });
  });

  it('learns a category the student changed after an import, for the same shop, the newest change winning', () => {
    const history = [
      entry('expense', 'eating-out', 'REWE Markt GmbH', { imported: { batchId: 'b1', merchant: 'rewe', guess: 'food' } }),
      entry('expense', 'household', 'REWE SAGT DANKE', { imported: { batchId: 'b2', merchant: 'rewe', guess: 'food' } }),
    ];
    expect(categorize(out('REWE SAGT DANKE 1234'), history, CATEGORIES)).toEqual({ categoryId: 'household', source: 'yours', merchant: 'rewe' });
  });

  it('never learns from an import whose guess the student left as it was', () => {
    const history = [entry('expense', 'shopping', 'Bäckerei Müller', { imported: { batchId: 'b1', merchant: 'baeckerei mueller', guess: 'shopping' } })];
    expect(categorize(out('Bäckerei Müller'), history, CATEGORIES)).toMatchObject({ categoryId: 'other', source: 'fallback' });
  });

  it('learns from an entry the student typed whose first word is one of the row’s words, as quick add does', () => {
    const history = [entry('expense', 'eating-out', 'Bäckerei croissant'), entry('expense', 'food', 'rewe 23,40')];
    expect(categorize(out('REWE Markt GmbH'), history, CATEGORIES)).toMatchObject({ categoryId: 'food', source: 'typed' });
    expect(categorize(out('Bäckerei Müller', 'Brötchen'), history, CATEGORIES)).toMatchObject({ categoryId: 'eating-out', source: 'typed' });
  });

  it('puts the student’s own choice before the chain list', () => {
    const typed = [entry('expense', 'eating-out', 'rewe lunch')];
    expect(categorize(out('REWE Markt GmbH'), typed, CATEGORIES)).toMatchObject({ categoryId: 'eating-out', source: 'typed' });
    const changed = [entry('expense', 'gifts', 'Amazon', { imported: { batchId: 'b1', merchant: 'amzn mktp', guess: 'shopping' } })];
    expect(categorize(out('AMZN Mktp DE'), changed, CATEGORIES)).toMatchObject({ categoryId: 'gifts', source: 'yours' });
  });

  it('learns money in from money in only, and not from what a schedule posted', () => {
    const history = [
      entry('expense', 'food', 'max dinner'),
      entry('income', 'income-job', 'Rent', { recurring: { scheduleId: 's1' } }),
      entry('income', 'income-parents', 'max transfer'),
    ];
    expect(categorize(into('Max Mustermann'), history, CATEGORIES)).toMatchObject({ categoryId: 'income-parents', source: 'typed' });
    expect(categorize(out('Max Mustermann'), history, CATEGORIES)).toMatchObject({ categoryId: 'food', source: 'typed' });
  });

  it('passes over a learned category that no longer exists', () => {
    const history = [entry('expense', 'retired-category', 'REWE', { imported: { batchId: 'b1', merchant: 'rewe', guess: 'food' } })];
    expect(categorize(out('REWE Markt GmbH'), history, CATEGORIES)).toMatchObject({ categoryId: 'food', source: 'chain' });
  });
});
