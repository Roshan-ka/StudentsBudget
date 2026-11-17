import { describe, expect, it } from 'vitest';
import type { Entry } from '@/db/types';
import { OFFERED } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
import { guessCategory, wordCategory } from './category-words';
import { EXPENSE_CATEGORIES } from './categories';
import { readQuickAdd } from './quick-add';

function expense(note: string, categoryId: string): Entry {
  return {
    id: `e-${note}`,
    type: 'expense',
    date: '2026-11-10',
    accountId: 'cash',
    amountMinor: 600,
    eurMinor: 600,
    categoryId,
    note,
    createdAt: '2026-11-10T12:00:00.000Z',
  };
}

/** The example inside a hint text: what sits between its quotes. */
function exampleIn(hint: string): string {
  const match = /[“„«"]\s*([^”“»"]+?)\s*[”“»"]/u.exec(hint);
  if (match === null) throw new Error(`no example in ${hint}`);
  return match[1];
}

describe('wordCategory (review P2, 17-11-2026)', () => {
  it('files the hint’s own example under Eating out, in every offered language', () => {
    for (const lang of OFFERED) {
      const hint = MESSAGES[lang].entries.quickAdd.hint;
      const line = readQuickAdd(exampleIn(hint));
      if (line === null || 'kind' in line.reading) throw new Error(`no amount in ${hint}`);
      expect(wordCategory(line.reading.note), lang).toBe('eating-out');
    }
  });

  it.each([
    ['Döner', 'eating-out'],
    ['doener mit Tom', 'eating-out'],
    ['kebab', 'eating-out'],
    ['Pizza', 'eating-out'],
    ['Kaffee', 'eating-out'],
    ['Café', 'eating-out'],
    ['Bäcker', 'eating-out'],
    ['Mensa', 'eating-out'],
    ['REWE', 'food'],
    ['Lidl', 'food'],
    ['Lebensmittel', 'food'],
    ['Kino', 'going-out'],
    ['dm', 'personal-care'],
  ])('reads “%s” as %s', (note, categoryId) => {
    expect(wordCategory(note)).toBe(categoryId);
  });

  it('puts a named shop before a food word: coffee from REWE is groceries', () => {
    expect(wordCategory('rewe kaffee')).toBe('food');
  });

  it('matches whole words only, and leaves the rest to the chips', () => {
    expect(wordCategory('dönerbox')).toBeNull();
    expect(wordCategory('pizzeria')).toBeNull();
    expect(wordCategory('bus')).toBeNull();
    expect(wordCategory('books')).toBeNull();
    expect(wordCategory('')).toBeNull();
  });

  it('only ever answers a category an expense can be filed under', () => {
    const ids = new Set(EXPENSE_CATEGORIES.map((c) => c.id));
    for (const note of ['döner', 'rewe', 'miete', 'telekom', 'spotify', 'kino', 'ikea', 'apotheke', 'flixbus']) {
      const id = wordCategory(note);
      expect(id !== null && ids.has(id), note).toBe(true);
    }
  });
});

describe('guessCategory', () => {
  it('takes the student’s own earlier choice over the word list', () => {
    expect(guessCategory('döner', [expense('döner', 'food')])).toBe('food');
  });

  it('falls back to the word list on a phone with no history', () => {
    expect(guessCategory('döner', [])).toBe('eating-out');
    expect(guessCategory('bus', [])).toBeNull();
  });
});
