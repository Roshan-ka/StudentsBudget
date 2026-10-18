import { describe, expect, it } from 'vitest';
import type { Entry } from '@/db/types';
import { keywordOf, parseQuickAdd, suggestCategory } from './quick-add';

describe('parseQuickAdd', () => {
  const cases: [string, number, string][] = [
    ['döner 6', 600, 'döner'],
    ['Döner 6 €', 600, 'Döner'],
    ['€6 coffee', 600, 'coffee'],
    ['coffee 6€', 600, 'coffee'],
    ['kebab 6,50', 650, 'kebab'],
    ['döner six euros', 600, 'döner'],
    ['pizza twenty-five euros', 2500, 'pizza'],
    ['2 coffees 7,40', 740, '2 coffees'],
    ['2 coffees €7', 700, '2 coffees'],
  ];

  it.each(cases)('parses "%s" into %i minor units and the note "%s"', (text, amountMinor, note) => {
    expect(parseQuickAdd(text)).toEqual({ amountMinor, note });
  });

  it('returns null when there is no amount', () => {
    expect(parseQuickAdd('döner')).toBeNull();
    expect(parseQuickAdd('')).toBeNull();
    expect(parseQuickAdd('   ')).toBeNull();
    expect(parseQuickAdd('€')).toBeNull();
  });

  it('reads a currency marker attached to the number or as its own token, in any case', () => {
    expect(parseQuickAdd('coffee 6,50€')).toEqual({ amountMinor: 650, note: 'coffee' });
    expect(parseQuickAdd('coffee €6,50')).toEqual({ amountMinor: 650, note: 'coffee' });
    expect(parseQuickAdd('coffee € 6')).toEqual({ amountMinor: 600, note: 'coffee' });
    expect(parseQuickAdd('coffee 6 euro')).toEqual({ amountMinor: 600, note: 'coffee' });
    expect(parseQuickAdd('coffee 6 EUR')).toEqual({ amountMinor: 600, note: 'coffee' });
    expect(parseQuickAdd('coffee 6 Euros')).toEqual({ amountMinor: 600, note: 'coffee' });
    expect(parseQuickAdd('coffee EUR 6')).toEqual({ amountMinor: 600, note: 'coffee' });
  });

  it('prefers the candidate next to a marker over a later one', () => {
    expect(parseQuickAdd('3 coffees 6 € for 2')).toEqual({ amountMinor: 600, note: '3 coffees for 2' });
    expect(parseQuickAdd('coffee for 2 €6 today 4')).toEqual({ amountMinor: 600, note: 'coffee for 2 today 4' });
  });

  it('takes the last of several candidates next to a marker', () => {
    expect(parseQuickAdd('6 € coffee 7 €')).toEqual({ amountMinor: 700, note: '6 € coffee' });
  });

  it('takes the last candidate when none is next to a marker', () => {
    expect(parseQuickAdd('2 coffees 3 cakes 9')).toEqual({ amountMinor: 900, note: '2 coffees 3 cakes' });
    expect(parseQuickAdd('2 coffees 3 cakes 9 today')).toEqual({ amountMinor: 900, note: '2 coffees 3 cakes today' });
  });

  it('does not treat a marker that is not next to the number as its marker', () => {
    expect(parseQuickAdd('euro store 5')).toEqual({ amountMinor: 500, note: 'euro store' });
  });

  it('reads number words, with a space or a hyphen in compounds', () => {
    expect(parseQuickAdd('lunch zero')).toBeNull();
    expect(parseQuickAdd('lunch nineteen')).toEqual({ amountMinor: 1900, note: 'lunch' });
    expect(parseQuickAdd('lunch twenty five')).toEqual({ amountMinor: 2500, note: 'lunch' });
    expect(parseQuickAdd('lunch twenty-five')).toEqual({ amountMinor: 2500, note: 'lunch' });
    expect(parseQuickAdd('lunch ninety')).toEqual({ amountMinor: 9000, note: 'lunch' });
    expect(parseQuickAdd('lunch ninety-nine euros')).toEqual({ amountMinor: 9900, note: 'lunch' });
  });

  it('reads "hundred" with an optional unit before it and a number after it', () => {
    expect(parseQuickAdd('books one hundred euros')).toEqual({ amountMinor: 10000, note: 'books' });
    expect(parseQuickAdd('books a hundred')).toEqual({ amountMinor: 10000, note: 'books' });
    expect(parseQuickAdd('books hundred')).toEqual({ amountMinor: 10000, note: 'books' });
    expect(parseQuickAdd('books two hundred')).toEqual({ amountMinor: 20000, note: 'books' });
    expect(parseQuickAdd('books one hundred twenty')).toEqual({ amountMinor: 12000, note: 'books' });
    expect(parseQuickAdd('books one hundred twenty-five euros')).toEqual({ amountMinor: 12500, note: 'books' });
    expect(parseQuickAdd('books one hundred five')).toEqual({ amountMinor: 10500, note: 'books' });
  });

  it('matches number words case-insensitively and keeps the note as typed', () => {
    expect(parseQuickAdd('Döner SIX Euros')).toEqual({ amountMinor: 600, note: 'Döner' });
    expect(parseQuickAdd('Pizza Twenty-Five EUR')).toEqual({ amountMinor: 2500, note: 'Pizza' });
  });

  it('ends a number-word run at a word that is not a number word', () => {
    expect(parseQuickAdd('two coffees six euros')).toEqual({ amountMinor: 600, note: 'two coffees' });
    expect(parseQuickAdd('two coffees six')).toEqual({ amountMinor: 600, note: 'two coffees' });
    expect(parseQuickAdd('a coffee six')).toEqual({ amountMinor: 600, note: 'a coffee' });
  });

  it('combines digit and word candidates', () => {
    expect(parseQuickAdd('2 coffees six euros')).toEqual({ amountMinor: 600, note: '2 coffees' });
    expect(parseQuickAdd('six coffees 7,40')).toEqual({ amountMinor: 740, note: 'six coffees' });
  });

  it('ignores a zero amount, and returns null when zero is the only candidate', () => {
    expect(parseQuickAdd('coffee 0')).toBeNull();
    expect(parseQuickAdd('coffee 0,00 €')).toBeNull();
    expect(parseQuickAdd('coffee zero euros')).toBeNull();
    expect(parseQuickAdd('coffee 0 6')).toEqual({ amountMinor: 600, note: 'coffee 0' });
  });

  it('ignores digit tokens parseAmount rejects', () => {
    expect(parseQuickAdd('coffee 6,505')).toBeNull();
    expect(parseQuickAdd('coffee 1.234,56')).toBeNull();
    expect(parseQuickAdd('coffee 12abc')).toBeNull();
  });

  it('returns an empty note when only the amount was typed', () => {
    expect(parseQuickAdd('6')).toEqual({ amountMinor: 600, note: '' });
    expect(parseQuickAdd('  6,50 €  ')).toEqual({ amountMinor: 650, note: '' });
    expect(parseQuickAdd('€6')).toEqual({ amountMinor: 600, note: '' });
    expect(parseQuickAdd('six euros')).toEqual({ amountMinor: 600, note: '' });
  });

  it('is not confused by words that are property names of plain objects', () => {
    expect(parseQuickAdd('constructor toString 6')).toEqual({ amountMinor: 600, note: 'constructor toString' });
  });

  it('collapses whitespace in the note and keeps the original casing and characters', () => {
    expect(parseQuickAdd('  Döner   mit   Tom \t 6  ')).toEqual({ amountMinor: 600, note: 'Döner mit Tom' });
    expect(parseQuickAdd('6 Straße  Café')).toEqual({ amountMinor: 600, note: 'Straße Café' });
  });
});

describe('keywordOf', () => {
  it('returns the first word, lower-cased', () => {
    expect(keywordOf('Döner with Tom')).toBe('döner');
    expect(keywordOf('  Coffee  ')).toBe('coffee');
    expect(keywordOf('ÄPFEL')).toBe('äpfel');
  });

  it('returns null for a blank note', () => {
    expect(keywordOf('  ')).toBeNull();
    expect(keywordOf('')).toBeNull();
  });
});

describe('suggestCategory', () => {
  let n = 0;
  function entry(
    type: 'expense' | 'income' | 'transfer',
    note: string,
    categoryId: string,
    createdAt: string,
  ): Entry {
    n += 1;
    const base = { id: `e${n}`, date: '2026-10-16', accountId: 'cash', amountMinor: 600, eurMinor: 600, note, createdAt };
    return type === 'transfer'
      ? { ...base, type, toAccountId: 'bank', toAmountMinor: 600 }
      : { ...base, type, categoryId };
  }

  it('suggests the category of the most recent expense with the same keyword', () => {
    const history = [
      entry('expense', 'Döner', 'eating-out', '2026-10-10T12:00:00.000Z'),
      entry('expense', 'döner with Tom', 'food', '2026-10-14T12:00:00.000Z'),
      entry('expense', 'bus ticket', 'transport', '2026-10-15T12:00:00.000Z'),
    ];

    expect(suggestCategory('döner again', history)).toBe('food');
  });

  it('picks the latest createdAt whatever the order of the history', () => {
    const newer = entry('expense', 'döner', 'food', '2026-10-14T12:00:00.000Z');
    const older = entry('expense', 'Döner', 'eating-out', '2026-10-10T12:00:00.000Z');

    expect(suggestCategory('döner', [newer, older])).toBe('food');
    expect(suggestCategory('döner', [older, newer])).toBe('food');
  });

  it('returns null when no expense has the keyword', () => {
    const history = [entry('expense', 'bus ticket', 'transport', '2026-10-15T12:00:00.000Z')];

    expect(suggestCategory('döner', history)).toBeNull();
    expect(suggestCategory('döner', [])).toBeNull();
  });

  it('matches the first word only, not a longer word that starts the same', () => {
    const history = [entry('expense', 'dönerbox', 'food', '2026-10-15T12:00:00.000Z')];

    expect(suggestCategory('döner', history)).toBeNull();
  });

  it('returns null for a blank note', () => {
    const history = [entry('expense', '', 'food', '2026-10-15T12:00:00.000Z')];

    expect(suggestCategory('  ', history)).toBeNull();
    expect(suggestCategory('', history)).toBeNull();
  });

  it('ignores transfers and income', () => {
    const history = [
      entry('transfer', 'döner', '', '2026-10-15T12:00:00.000Z'),
      entry('income', 'döner', 'job', '2026-10-16T12:00:00.000Z'),
      entry('expense', 'döner', 'food', '2026-10-10T12:00:00.000Z'),
    ];

    expect(suggestCategory('döner', history)).toBe('food');
    expect(suggestCategory('döner', history.slice(0, 2))).toBeNull();
  });
});
