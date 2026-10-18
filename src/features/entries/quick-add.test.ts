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

  it('reads "N euro M" as N euros and M cents, not as a second amount', () => {
    expect(parseQuickAdd('coffee 3 euros 50')).toEqual({ amountMinor: 350, note: 'coffee' });
    expect(parseQuickAdd('Döner 6 Euro 50')).toEqual({ amountMinor: 650, note: 'Döner' });
    expect(parseQuickAdd('coffee six euros fifty')).toEqual({ amountMinor: 650, note: 'coffee' });
    expect(parseQuickAdd('3 euros 5')).toEqual({ amountMinor: 305, note: '' });
    expect(parseQuickAdd('coffee 6 euro 05')).toEqual({ amountMinor: 605, note: 'coffee' });
    expect(parseQuickAdd('coffee 3 € 50')).toEqual({ amountMinor: 350, note: 'coffee' });
    expect(parseQuickAdd('coffee 3 EUR 50')).toEqual({ amountMinor: 350, note: 'coffee' });
    expect(parseQuickAdd('lunch twenty euros fifty five')).toEqual({ amountMinor: 2055, note: 'lunch' });
    expect(parseQuickAdd('lunch twenty-five euros fifty')).toEqual({ amountMinor: 2550, note: 'lunch' });
    expect(parseQuickAdd('lunch 12 euros six')).toEqual({ amountMinor: 1206, note: 'lunch' });
    expect(parseQuickAdd('coffee 0 euro 50')).toEqual({ amountMinor: 50, note: 'coffee' });
  });

  it('takes "cent" or "cents" after the cents part into the amount', () => {
    expect(parseQuickAdd('coffee 6 euros 50 cents')).toEqual({ amountMinor: 650, note: 'coffee' });
    expect(parseQuickAdd('coffee 6 EURO 50 CENT')).toEqual({ amountMinor: 650, note: 'coffee' });
    expect(parseQuickAdd('Döner 6 Euro 50 Cents')).toEqual({ amountMinor: 650, note: 'Döner' });
  });

  it('prefers a "N euro M" amount at the end of the line over an earlier plain number', () => {
    expect(parseQuickAdd('2 coffees 3 euros 50')).toEqual({ amountMinor: 350, note: '2 coffees' });
    expect(parseQuickAdd('2 coffees 3 euros 50 cents')).toEqual({ amountMinor: 350, note: '2 coffees' });
  });

  it('returns null when anything follows the cents part, as it is then a quantity', () => {
    for (const text of [
      '6 euros 2 coffees',
      'taxi 12 euros 30 minutes',
      'rent 400 eur 2 months',
      'coffee 6 € 2 Stück',
      'lunch 12 euros two friends',
      'coffee 2 euros 3 for 2',
      '3 euros 50 for 2',
      'coffee six euros fifty cents with Tom',
      'coffee 6 euros 50 cents cash',
      'coffee 6 euros 50 euros',
      'coffee 6 euros 50 cents €',
    ]) {
      expect(parseQuickAdd(text), text).toBeNull();
    }
  });

  it('returns null when a marker sits between two numbers that are not euros and cents', () => {
    for (const text of [
      'coffee 3 euros 150',
      'coffee 3 euros 123',
      'coffee 3 euros 5,50',
      'coffee 3 euros €5',
      'coffee 3,50 euros 20',
      'coffee €3 euro 20',
      'coffee 3 euros one hundred',
      'coffee six euros twelve hundred',
      'coffee 3 euros 5€',
      'coffee 3 euros 5eur',
    ]) {
      expect(parseQuickAdd(text), text).toBeNull();
    }
  });

  it('reads "and" after hundred or thousand, "<n> hundred" and "<n> thousand"', () => {
    const cases: [string, number][] = [
      ['a hundred and twenty euros', 120],
      ['one hundred and five euros', 105],
      ['two hundred and fifty', 250],
      ['twenty five hundred euros', 2500],
      ['twelve hundred euros', 1200],
      ['nineteen hundred', 1900],
      ['one thousand euros', 1000],
      ['two thousand euros', 2000],
      ['a thousand', 1000],
      ['thousand', 1000],
      ['two thousand five hundred', 2500],
      ['one thousand and five', 1005],
      ['one thousand two hundred and thirty-four euros', 1234],
      ['two hundred fifty thousand', 250000],
    ];
    for (const [words, euros] of cases) {
      expect(parseQuickAdd(`laptop ${words}`), words).toEqual({ amountMinor: euros * 100, note: 'laptop' });
    }
  });

  it('returns null for a number-word run it cannot read whole, instead of a partial amount', () => {
    for (const text of [
      'books one million euros',
      'books two billion',
      'books a hundred and euros',
      'books one hundred and',
      'books one hundred and coffee',
      'books one thousand and',
      'books one hundred hundred',
      'books two thousand thousand',
      'books zero hundred',
      'books two and a half euros',
      'books six and cake',
    ]) {
      expect(parseQuickAdd(text), text).toBeNull();
    }
  });

  it('returns null for digits followed by a scale or cent word it does not read', () => {
    for (const text of [
      'coffee 2 thousand euros',
      'coffee 2 hundred',
      'coffee 5 million',
      'coffee 50 cents',
      'coffee 50 cent',
      'coffee fifty cents',
      'coffee 2 coffees 50 cents',
    ]) {
      expect(parseQuickAdd(text), text).toBeNull();
    }
  });

  it('does not mind "and" that is not right after a number-word run', () => {
    expect(parseQuickAdd('salt and pepper six euros')).toEqual({ amountMinor: 600, note: 'salt and pepper' });
    expect(parseQuickAdd('bread and butter 6')).toEqual({ amountMinor: 600, note: 'bread and butter' });
  });

  it('reads a letter marker written onto the number', () => {
    expect(parseQuickAdd('2 coffees 7eur')).toEqual({ amountMinor: 700, note: '2 coffees' });
    expect(parseQuickAdd('2 coffees 7euro')).toEqual({ amountMinor: 700, note: '2 coffees' });
    expect(parseQuickAdd('2 coffees 7EUROS')).toEqual({ amountMinor: 700, note: '2 coffees' });
    expect(parseQuickAdd('coffee 6eur')).toEqual({ amountMinor: 600, note: 'coffee' });
    expect(parseQuickAdd('coffee 6,50eur')).toEqual({ amountMinor: 650, note: 'coffee' });
    expect(parseQuickAdd('2 coffees eur7,40')).toEqual({ amountMinor: 740, note: '2 coffees' });
    expect(parseQuickAdd('2 coffees €7')).toEqual({ amountMinor: 700, note: '2 coffees' });
  });

  it('leaves words that merely start or end like a marker alone', () => {
    expect(parseQuickAdd('Friseur 25')).toEqual({ amountMinor: 2500, note: 'Friseur' });
    expect(parseQuickAdd('eurostar 12')).toEqual({ amountMinor: 1200, note: 'eurostar' });
    expect(parseQuickAdd('Eurogruppe')).toBeNull();
  });

  it('returns null when a token looks like a number or a price but is not an amount', () => {
    for (const text of [
      '3 coffees $7',
      '3 coffees £7',
      '3 coffees ¥700',
      '3 coffees €6,505',
      'coffee 6,505 2',
      '2 coffees 6,505',
      '2 coffees 12abc 6',
      '2 coffees 3pm 6',
      'coffee 6€ 3pm',
      'coffee 7$',
      'coffee 6. 2',
      'coffee €€6',
      'coffee 6€€',
    ]) {
      expect(parseQuickAdd(text), text).toBeNull();
    }
  });

  it('ignores the sentence-final punctuation that dictation adds at the end of the line', () => {
    const cases: [string, number, string][] = [
      ['Döner 6 €.', 600, 'Döner'],
      ['Coffee €6.', 600, 'Coffee'],
      ['Coffee 6€.', 600, 'Coffee'],
      ['Döner 6,50 €.', 650, 'Döner'],
      ['Döner 6 Euro 50.', 650, 'Döner'],
      ['Coffee six euros fifty.', 650, 'Coffee'],
      ['Coffee 6 euros.', 600, 'Coffee'],
      ['Coffee 6!', 600, 'Coffee'],
      ['Coffee 6?', 600, 'Coffee'],
      ['Coffee 6…', 600, 'Coffee'],
      ['Coffee 6 euros?!', 600, 'Coffee'],
      ['Coffee 6 euros...', 600, 'Coffee'],
      ['Coffee 6 .', 600, 'Coffee'],
      ['Coffee 6,50.', 650, 'Coffee'],
      ['Coffee 6.50.', 650, 'Coffee'],
    ];
    for (const [text, amountMinor, note] of cases) {
      expect(parseQuickAdd(text), text).toEqual({ amountMinor, note });
    }
  });

  it('still returns null for a full stop inside the line, and for punctuation with no amount', () => {
    expect(parseQuickAdd('coffee 6. 2')).toBeNull();
    expect(parseQuickAdd('coffee.')).toBeNull();
    expect(parseQuickAdd('...')).toBeNull();
    expect(parseQuickAdd('€.')).toBeNull();
  });

  it('ignores a trailing comma, semicolon or colon on a word, but not on a number', () => {
    expect(parseQuickAdd('Coffee, 6 €')).toEqual({ amountMinor: 600, note: 'Coffee' });
    expect(parseQuickAdd('Coffee: six euros')).toEqual({ amountMinor: 600, note: 'Coffee' });
    expect(parseQuickAdd('Coffee; 6 euros, thanks')).toEqual({ amountMinor: 600, note: 'Coffee; thanks' });
    expect(parseQuickAdd('Coffee six, euros')).toEqual({ amountMinor: 600, note: 'Coffee' });
    expect(parseQuickAdd('Coffee six euros, fifty')).toEqual({ amountMinor: 650, note: 'Coffee' });
    expect(parseQuickAdd('Coffee 6 €, thanks')).toEqual({ amountMinor: 600, note: 'Coffee thanks' });
    expect(parseQuickAdd('Coffee, with Tom, 6')).toEqual({ amountMinor: 600, note: 'Coffee, with Tom' });
    expect(parseQuickAdd('Coffee 6,50')).toEqual({ amountMinor: 650, note: 'Coffee' });
    expect(parseQuickAdd('Coffee 6, 2')).toBeNull();
  });

  it('returns null when the chosen number has a bare number straight before it', () => {
    for (const text of ['coffee 7 40', 'coffee seven forty', 'coffee 2 6', '7 40', 'coffee 7 forty']) {
      expect(parseQuickAdd(text), text).toBeNull();
    }
  });

  it('keeps an amount that has other words between it and the number before it, or a marker', () => {
    expect(parseQuickAdd('2 coffees 7,40')).toEqual({ amountMinor: 740, note: '2 coffees' });
    expect(parseQuickAdd('coffee 7 40 €')).toEqual({ amountMinor: 4000, note: 'coffee 7' });
    expect(parseQuickAdd('coffee 7 €40')).toEqual({ amountMinor: 4000, note: 'coffee 7' });
    expect(parseQuickAdd('coffee 0 40')).toEqual({ amountMinor: 4000, note: 'coffee 0' });
    expect(parseQuickAdd('coffee twenty five')).toEqual({ amountMinor: 2500, note: 'coffee' });
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

  it('leaves out a comma, semicolon or colon that dictation puts after the word', () => {
    expect(keywordOf('Coffee, 6 €')).toBe('coffee');
    expect(keywordOf('Döner: with Tom')).toBe('döner');
    expect(keywordOf('Döner; with Tom')).toBe('döner');
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
