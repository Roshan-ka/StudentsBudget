import { describe, expect, it } from 'vitest';
import type { Entry } from '@/db/types';
import { keywordsOf, parseQuickAdd, suggestCategory } from './quick-add';

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

  it('offers both readings when a whole number sits straight before a number that could be cents', () => {
    const cases: [string, [number, number], string][] = [
      // Before a currency word: "seven forty euros" could be €7.40 or a count of 7 and €40.
      ['coffee seven forty euros.', [740, 4000], 'coffee'],
      ['coffee 7 40 euros', [740, 4000], 'coffee'],
      ['coffee seven forty five euros', [745, 4500], 'coffee'],
      ['coffee 7 40 EUR', [740, 4000], 'coffee'],
      ['Coffee 7 40 Euro', [740, 4000], 'Coffee'],
      ['coffee 7 05 euros', [705, 500], 'coffee'],
      ['coffee 7 40 euros for 2', [740, 4000], 'coffee for 2'],
      // The € sign after it is a marker like the word: on its own or written onto the number.
      ['coffee 7 40 €', [740, 4000], 'coffee'],
      ['coffee 7 40€', [740, 4000], 'coffee'],
      ['Coffee 7 40 €.', [740, 4000], 'Coffee'],
      ['coffee seven forty €', [740, 4000], 'coffee'],
      ['coffee 7 40euros', [740, 4000], 'coffee'],
      // With no marker at all.
      ['coffee 7 40', [740, 4000], 'coffee'],
      ['coffee seven forty', [740, 4000], 'coffee'],
      ['coffee 7 forty', [740, 4000], 'coffee'],
      ['coffee 2 6', [206, 600], 'coffee'],
      ['7 40', [740, 4000], ''],
    ];
    for (const [text, options, note] of cases) {
      expect(parseQuickAdd(text), text).toEqual({ kind: 'choice', note, options });
    }
  });

  it('still reads one amount when the numbers are apart, or there is only one', () => {
    expect(parseQuickAdd('two coffees six euros')).toEqual({ amountMinor: 600, note: 'two coffees' });
    expect(parseQuickAdd('six coffees 7,40')).toEqual({ amountMinor: 740, note: 'six coffees' });
    expect(parseQuickAdd('2 coffees 7 euros')).toEqual({ amountMinor: 700, note: '2 coffees' });
    expect(parseQuickAdd('döner 6')).toEqual({ amountMinor: 600, note: 'döner' });
    expect(parseQuickAdd('döner 6 €')).toEqual({ amountMinor: 600, note: 'döner' });
    expect(parseQuickAdd('€6')).toEqual({ amountMinor: 600, note: '' });
    expect(parseQuickAdd('6€')).toEqual({ amountMinor: 600, note: '' });
    expect(parseQuickAdd('6,50 €')).toEqual({ amountMinor: 650, note: '' });
  });

  it('returns null when a bare number sits straight before the chosen one and they cannot be euros and cents', () => {
    for (const text of ['coffee 6,50 40', 'coffee 7 140', 'coffee 7 one hundred', 'coffee 7 6,50', 'coffee 7 040']) {
      expect(parseQuickAdd(text), text).toBeNull();
    }
  });

  it('keeps an amount that has other words between it and the number before it, or a marker in front of it', () => {
    expect(parseQuickAdd('2 coffees 7,40')).toEqual({ amountMinor: 740, note: '2 coffees' });
    // "€40" says the amount plainly: 7 is a count.
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

describe('keywordsOf', () => {
  it('returns the words in order, lower-cased', () => {
    expect(keywordsOf('Döner with Tom')).toEqual(['döner', 'tom']);
    expect(keywordsOf('  Coffee  ')).toEqual(['coffee']);
    expect(keywordsOf('ÄPFEL')).toEqual(['äpfel']);
  });

  it('leaves out a full stop, comma, semicolon or colon at either end of a word', () => {
    expect(keywordsOf('Coffee, 6 €')).toEqual(['coffee']);
    expect(keywordsOf('Döner: with Tom')).toEqual(['döner', 'tom']);
    expect(keywordsOf('Döner; with Tom.')).toEqual(['döner', 'tom']);
    expect(keywordsOf('Coffee.')).toEqual(['coffee']);
  });

  it('leaves out any punctuation at either end of a word, but keeps a hyphen', () => {
    expect(keywordsOf('Döner!')).toEqual(['döner']);
    expect(keywordsOf('"döner"')).toEqual(['döner']);
    expect(keywordsOf('“döner” (mit Tom)?')).toEqual(['döner', 'tom']);
    expect(keywordsOf('Döner… 6')).toEqual(['döner']);
    expect(keywordsOf("'coffee'")).toEqual(['coffee']);
    // A hyphen inside a word, or at its end, is part of it.
    expect(keywordsOf('e-bike repair')).toEqual(['e-bike', 'repair']);
    expect(keywordsOf('t-shirt-')).toEqual(['t-shirt-']);
    // A word that is only punctuation or symbols is no word.
    expect(keywordsOf('Phone & internet')).toEqual(['phone', 'internet']);
    expect(keywordsOf('döner - 6 €')).toEqual(['döner']);
  });

  it('leaves out the German stop words too', () => {
    expect(keywordsOf('kino mit anna')).toEqual(['kino', 'anna']);
    expect(keywordsOf('Geschenk für meine Mutter')).toEqual(['geschenk', 'mutter']);
    expect(keywordsOf('Brötchen beim Bäcker im Dorf am See')).toEqual(['brötchen', 'bäcker', 'dorf', 'see']);
    expect(keywordsOf('der Zug zur Uni und zum Bahnhof von der Arbeit')).toEqual(['zug', 'uni', 'bahnhof', 'arbeit']);
    expect(keywordsOf('das ein eine mein meine vom')).toEqual([]);
  });

  it('leaves out numbers, number words, currency markers and the stop words', () => {
    expect(keywordsOf('lunch at mensa')).toEqual(['lunch', 'mensa']);
    expect(keywordsOf('2 coffees 7,40')).toEqual(['coffees']);
    expect(keywordsOf('two coffees')).toEqual(['coffees']);
    expect(keywordsOf('twenty-five postcards')).toEqual(['postcards']);
    expect(keywordsOf('6 € coffee')).toEqual(['coffee']);
    expect(keywordsOf('coffee 6eur EUR euros')).toEqual(['coffee']);
    expect(keywordsOf('a gift for my mum')).toEqual(['gift', 'mum']);
    expect(keywordsOf('the end of the line from the shop on a bus to the lab in a car with a dog and an owl')).toEqual([
      'end',
      'line',
      'shop',
      'bus',
      'lab',
      'car',
      'dog',
      'owl',
    ]);
  });

  it('returns nothing for a blank note or one of only numbers and stop words', () => {
    expect(keywordsOf('  ')).toEqual([]);
    expect(keywordsOf('')).toEqual([]);
    expect(keywordsOf('a 5 of the 7,40 €')).toEqual([]);
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

  it('matches a whole word, not a longer word that starts the same', () => {
    const history = [entry('expense', 'dönerbox', 'food', '2026-10-15T12:00:00.000Z')];

    expect(suggestCategory('döner', history)).toBeNull();
    expect(suggestCategory('dönerbox', [entry('expense', 'döner', 'food', '2026-10-15T12:00:00.000Z')])).toBeNull();
  });

  it('returns null for a blank note, or one with no word that can choose a category', () => {
    const history = [entry('expense', '', 'food', '2026-10-15T12:00:00.000Z')];

    expect(suggestCategory('  ', history)).toBeNull();
    expect(suggestCategory('', history)).toBeNull();
    expect(suggestCategory('a 5', [entry('expense', 'a 5', 'food', '2026-10-15T12:00:00.000Z')])).toBeNull();
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

  it('ignores entries a schedule posted, whose note is the category name', () => {
    const posted: Entry = {
      id: 'posted',
      type: 'expense',
      date: '2026-10-01',
      accountId: 'bank',
      amountMinor: 3000,
      eurMinor: 3000,
      categoryId: 'phone',
      note: 'Phone & internet',
      createdAt: '2026-10-16T12:00:00.000Z',
      recurring: { scheduleId: 's1' },
    };
    const parsed = parseQuickAdd('phone charger 12');

    // No suggestion, so quick add asks with the chips instead of filing it under Phone & internet.
    expect(parsed).toEqual({ amountMinor: 1200, note: 'phone charger' });
    expect(suggestCategory('phone charger', [posted])).toBeNull();
    // A note the person typed still teaches the category, even next to a posted one.
    const typed = entry('expense', 'phone case', 'shopping', '2026-10-10T12:00:00.000Z');
    expect(suggestCategory('phone charger', [posted, typed])).toBe('shopping');
  });

  describe('beyond the first word', () => {
    it('finds "mensa 4" from "lunch at mensa 5"', () => {
      const history = [entry('expense', 'mensa', 'eating-out', '2026-10-15T12:00:00.000Z')];
      const parsed = parseQuickAdd('lunch at mensa 5');

      expect(parsed).toEqual({ amountMinor: 500, note: 'lunch at mensa' });
      expect(suggestCategory('lunch at mensa', history)).toBe('eating-out');
    });

    it('matches coffees in "2 coffees 7,40", not the "2 tickets" before it', () => {
      const history = [
        entry('expense', '2 coffees', 'eating-out', '2026-10-10T12:00:00.000Z'),
        entry('expense', '2 tickets', 'going-out', '2026-10-15T12:00:00.000Z'),
      ];
      const parsed = parseQuickAdd('2 coffees 7,40');

      expect(parsed).toEqual({ amountMinor: 740, note: '2 coffees' });
      expect(suggestCategory('2 coffees', history)).toBe('eating-out');
      // With no coffee in the history the number alone suggests nothing: "2" is not a word to match.
      expect(suggestCategory('2 coffees', history.slice(1))).toBeNull();
    });

    it('skips a stop word at the start: "a coffee 3"', () => {
      const history = [
        entry('expense', 'a gift', 'shopping', '2026-10-16T12:00:00.000Z'),
        entry('expense', 'coffee', 'eating-out', '2026-10-10T12:00:00.000Z'),
      ];
      const parsed = parseQuickAdd('a coffee 3');

      expect(parsed).toEqual({ amountMinor: 300, note: 'a coffee' });
      expect(suggestCategory('a coffee', history)).toBe('eating-out');
    });

    it('ignores the full stop dictation puts after the word: "Coffee. 6"', () => {
      const history = [entry('expense', 'coffee', 'eating-out', '2026-10-10T12:00:00.000Z')];
      const parsed = parseQuickAdd('Coffee. 6');

      expect(parsed).not.toBeNull();
      expect(suggestCategory(parsed?.note ?? '', history)).toBe('eating-out');
      // The same word with a full stop in the history matches too.
      const dotted = [entry('expense', 'Coffee.', 'eating-out', '2026-10-10T12:00:00.000Z')];
      expect(suggestCategory('coffee', dotted)).toBe('eating-out');
    });

    it('ignores the euro sign around the amount: "6 € coffee 7 €"', () => {
      const history = [
        entry('expense', '6 € tickets', 'going-out', '2026-10-15T12:00:00.000Z'),
        entry('expense', 'coffee', 'eating-out', '2026-10-10T12:00:00.000Z'),
      ];
      const parsed = parseQuickAdd('6 € coffee 7 €');

      expect(parsed).not.toBeNull();
      expect(suggestCategory(parsed?.note ?? '', history)).toBe('eating-out');
    });

    it('lets the first word that has a history decide, and the latest expense with it win', () => {
      const history = [
        entry('expense', 'lunch', 'eating-out', '2026-10-01T12:00:00.000Z'),
        entry('expense', 'mensa lunch', 'food', '2026-10-05T12:00:00.000Z'),
        entry('expense', 'mensa', 'eating-out', '2026-10-09T12:00:00.000Z'),
        entry('expense', 'lunch at mensa', 'food', '2026-10-12T12:00:00.000Z'),
      ];

      // "lunch" comes first in the note, and the latest expense that starts with it (12 Oct) wins over "mensa"'s (9 Oct).
      expect(suggestCategory('lunch at mensa', history)).toBe('food');
      // Only "mensa" is known: the latest expense that starts with it (9 Oct). "lunch at mensa" (12 Oct) starts with
      // "lunch", so "mensa" is only where that lunch was.
      expect(suggestCategory('dinner at mensa', history)).toBe('eating-out');
      expect(suggestCategory('dinner at mensa', history.slice(0, 3))).toBe('eating-out');
    });

    it('matches only the first word of an earlier note: "bus 3" is Transport, not the newer "snacks for the bus"', () => {
      const history = [
        entry('expense', 'bus ticket', 'transport', '2026-10-10T12:00:00.000Z'),
        entry('expense', 'snacks for the bus', 'food', '2026-10-15T12:00:00.000Z'),
      ];
      const parsed = parseQuickAdd('bus 3');

      expect(parsed).toEqual({ amountMinor: 300, note: 'bus' });
      expect(suggestCategory('bus', history)).toBe('transport');
      // The word is still found when it starts the earlier note, whatever follows.
      expect(suggestCategory('snacks', history)).toBe('food');
    });

    it('asks with the chips when the word only came later in an earlier note: "ikea 40" after "bus to ikea"', () => {
      const history = [entry('expense', 'bus to ikea', 'transport', '2026-10-15T12:00:00.000Z')];

      expect(suggestCategory('ikea', history)).toBeNull();
      expect(suggestCategory('bus', history)).toBe('transport');
    });

    it('does not match a name the earlier note ended with: "cinema with tom 9" after "döner with Tom"', () => {
      const history = [entry('expense', 'döner with Tom', 'eating-out', '2026-10-15T12:00:00.000Z')];
      const parsed = parseQuickAdd('cinema with tom 9');

      expect(parsed).toEqual({ amountMinor: 900, note: 'cinema with tom' });
      expect(suggestCategory(parsed?.note ?? '', history)).toBeNull();
    });

    it('reads the German stop words as stop words: "kino mit anna 9" after "pizza mit lisa"', () => {
      const history = [entry('expense', 'pizza mit lisa', 'eating-out', '2026-10-15T12:00:00.000Z')];
      const parsed = parseQuickAdd('kino mit anna 9');

      expect(parsed).toEqual({ amountMinor: 900, note: 'kino mit anna' });
      expect(suggestCategory(parsed?.note ?? '', history)).toBeNull();
      // "mit" starts no note either, so it never decides a category.
      const odd = [entry('expense', 'mit freunden essen', 'eating-out', '2026-10-15T12:00:00.000Z')];
      expect(suggestCategory('kino mit anna', odd)).toBeNull();
      expect(suggestCategory('freunden', odd)).toBe('eating-out');
    });

    it('finds the word through the punctuation dictation adds: "Döner!" and "“döner”" match "döner"', () => {
      const history = [entry('expense', 'döner', 'eating-out', '2026-10-10T12:00:00.000Z')];

      expect(suggestCategory('Döner!', history)).toBe('eating-out');
      expect(suggestCategory('"döner"', history)).toBe('eating-out');
      expect(suggestCategory('(döner)', history)).toBe('eating-out');
      const loud = [entry('expense', 'Döner!', 'eating-out', '2026-10-10T12:00:00.000Z')];
      expect(suggestCategory('döner', loud)).toBe('eating-out');
      // Still a whole word: the hyphen is part of it.
      expect(suggestCategory('döner', [entry('expense', 'döner-box', 'food', '2026-10-10T12:00:00.000Z')])).toBeNull();
    });

    it('does not read a stop word, so "with" never matches another note', () => {
      const history = [entry('expense', 'coffee with Tom', 'eating-out', '2026-10-10T12:00:00.000Z')];

      expect(suggestCategory('cinema with the lads', history)).toBeNull();
    });

    it('takes the first word that has a history even when a later one has a better match (known limit)', () => {
      const history = [
        entry('expense', 'big pizza', 'eating-out', '2026-10-10T12:00:00.000Z'),
        entry('expense', 'rewe', 'food', '2026-10-12T12:00:00.000Z'),
      ];

      expect(suggestCategory('big rewe shop', history)).toBe('eating-out');
    });
  });
});
