import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Entry } from '@/db/types';
import { OFFERED, type Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
import { guessCategory } from './category-words';
import { readQuickAdd, suggestCategory } from './quick-add';
import { readLineDate } from './quick-add-date';
import {
  accountFor,
  checkReading,
  chosenAmount,
  localQuickAddProvider,
  type QuickAddContext,
  type QuickAddProvider,
  type QuickAddReading,
} from './quick-add-provider';

// The real suggestCategory, wrapped so a test can count the calls.
vi.mock('./quick-add', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./quick-add')>();
  return { ...actual, suggestCategory: vi.fn(actual.suggestCategory) };
});

beforeEach(() => {
  vi.mocked(suggestCategory).mockClear();
});

function account(id: string, kind: Account['kind'], currency: Account['currency'], createdAt: string): Account {
  return { id, name: id, kind, currency, openingMinor: 0, createdAt };
}

const cash = account('cash', 'cash', 'EUR', '2026-10-01T10:00:00.000Z');
const bank = account('bank', 'bank', 'EUR', '2026-10-01T09:00:00.000Z');
const accounts = [bank, cash];

let n = 0;
function expense(note: string, categoryId: string, createdAt: string, recurring?: { scheduleId: string }): Entry {
  n += 1;
  return {
    id: `e${n}`,
    type: 'expense',
    date: '2026-10-16',
    accountId: 'cash',
    amountMinor: 600,
    eurMinor: 600,
    categoryId,
    note,
    createdAt,
    ...(recurring && { recurring }),
  };
}

function context(history: Entry[]): QuickAddContext {
  return { today: '2026-10-20', accounts, history };
}

/** Every line `quick-add.test.ts` feeds to `parseQuickAdd`: amounts, choices and lines with no amount. */
const LINES = [
  'döner 6', 'Döner 6 €', '€6 coffee', 'coffee 6€', 'kebab 6,50', 'döner six euros', 'pizza twenty-five euros',
  '2 coffees 7,40', '2 coffees €7', 'döner', '', '   ', '€',
  'coffee 6,50€', 'coffee €6,50', 'coffee € 6', 'coffee 6 euro', 'coffee 6 EUR', 'coffee 6 Euros', 'coffee EUR 6',
  '3 coffees 6 € for 2', 'coffee for 2 €6 today 4', '6 € coffee 7 €', '2 coffees 3 cakes 9', '2 coffees 3 cakes 9 today',
  'euro store 5',
  'lunch zero', 'lunch nineteen', 'lunch twenty five', 'lunch twenty-five', 'lunch ninety', 'lunch ninety-nine euros',
  'books one hundred euros', 'books a hundred', 'books hundred', 'books two hundred', 'books one hundred twenty',
  'books one hundred twenty-five euros', 'books one hundred five',
  'Döner SIX Euros', 'Pizza Twenty-Five EUR', 'two coffees six euros', 'two coffees six', 'a coffee six',
  '2 coffees six euros', 'six coffees 7,40', 'coffee 0', 'coffee 0,00 €', 'coffee zero euros', 'coffee 0 6',
  'coffee 6,505', 'coffee 1.234,56', 'coffee 12abc', '6', '  6,50 €  ', '€6', 'six euros',
  'coffee 3 euros 50', 'Döner 6 Euro 50', 'coffee six euros fifty', '3 euros 5', 'coffee 6 euro 05', 'coffee 3 € 50',
  'coffee 3 EUR 50', 'lunch twenty euros fifty five', 'lunch twenty-five euros fifty', 'lunch 12 euros six',
  'coffee 0 euro 50', 'coffee 6 euros 50 cents', 'coffee 6 EURO 50 CENT', 'Döner 6 Euro 50 Cents',
  '2 coffees 3 euros 50', '2 coffees 3 euros 50 cents',
  '6 euros 2 coffees', 'taxi 12 euros 30 minutes', 'rent 400 eur 2 months', 'coffee 6 € 2 Stück',
  'lunch 12 euros two friends', 'coffee 2 euros 3 for 2', '3 euros 50 for 2', 'coffee six euros fifty cents with Tom',
  'coffee 6 euros 50 cents cash', 'coffee 6 euros 50 euros', 'coffee 6 euros 50 cents €',
  'coffee 3 euros 150', 'coffee 3 euros 123', 'coffee 3 euros 5,50', 'coffee 3 euros €5', 'coffee 3,50 euros 20',
  'coffee €3 euro 20', 'coffee 3 euros one hundred', 'coffee six euros twelve hundred', 'coffee 3 euros 5€',
  'coffee 3 euros 5eur',
  'laptop a hundred and twenty euros', 'laptop one hundred and five euros', 'laptop two hundred and fifty',
  'laptop twenty five hundred euros', 'laptop twelve hundred euros', 'laptop nineteen hundred',
  'laptop one thousand euros', 'laptop two thousand euros', 'laptop a thousand', 'laptop thousand',
  'laptop two thousand five hundred', 'laptop one thousand and five', 'laptop one thousand two hundred and thirty-four euros',
  'laptop two hundred fifty thousand',
  'books one million euros', 'books two billion', 'books a hundred and euros', 'books one hundred and',
  'books one hundred and coffee', 'books one thousand and', 'books one hundred hundred', 'books two thousand thousand',
  'books zero hundred', 'books two and a half euros', 'books six and cake',
  'coffee 2 thousand euros', 'coffee 2 hundred', 'coffee 5 million', 'coffee 50 cents', 'coffee 50 cent',
  'coffee fifty cents', 'coffee 2 coffees 50 cents',
  'salt and pepper six euros', 'bread and butter 6',
  '2 coffees 7eur', '2 coffees 7euro', '2 coffees 7EUROS', 'coffee 6eur', 'coffee 6,50eur', '2 coffees eur7,40',
  'Friseur 25', 'eurostar 12', 'Eurogruppe',
  '3 coffees $7', '3 coffees £7', '3 coffees ¥700', '3 coffees €6,505', 'coffee 6,505 2', '2 coffees 6,505',
  '2 coffees 12abc 6', '2 coffees 3pm 6', 'coffee 6€ 3pm', 'coffee 7$', 'coffee 6. 2', 'coffee €€6', 'coffee 6€€',
  'Döner 6 €.', 'Coffee €6.', 'Coffee 6€.', 'Döner 6,50 €.', 'Döner 6 Euro 50.', 'Coffee six euros fifty.',
  'Coffee 6 euros.', 'Coffee 6!', 'Coffee 6?', 'Coffee 6…', 'Coffee 6 euros?!', 'Coffee 6 euros...', 'Coffee 6 .',
  'Coffee 6,50.', 'Coffee 6.50.', 'coffee.', '...', '€.',
  'Coffee, 6 €', 'Coffee: six euros', 'Coffee; 6 euros, thanks', 'Coffee six, euros', 'Coffee six euros, fifty',
  'Coffee 6 €, thanks', 'Coffee, with Tom, 6', 'Coffee 6,50', 'Coffee 6, 2',
  'coffee seven forty euros.', 'coffee 7 40 euros', 'coffee seven forty five euros', 'coffee 7 40 EUR',
  'Coffee 7 40 Euro', 'coffee 7 05 euros', 'coffee 7 40 euros for 2', 'coffee 7 40 €', 'coffee 7 40€',
  'Coffee 7 40 €.', 'coffee seven forty €', 'coffee 7 40euros', 'coffee 7 40', 'coffee seven forty', 'coffee 7 forty',
  'coffee 2 6', '7 40',
  '2 coffees 7 euros', 'döner 6 €', '6€', '6,50 €',
  'coffee 6,50 40', 'coffee 7 140', 'coffee 7 one hundred', 'coffee 7 6,50', 'coffee 7 040',
  'coffee 7 €40', 'coffee 0 40', 'coffee twenty five', 'constructor toString 6',
  '  Döner   mit   Tom \t 6  ', '6 Straße  Café', 'phone charger 12',
];

/** The lines with no date in them ("today" is one: quick add dates, 18-11-2026), which read as the parser reads them. */
const UNDATED = LINES.filter((text) => readLineDate(text, '2026-10-20', 'en') === null);

/** Lines with a date in them, for the readings the field keeps as they are. */
const DATED = ['10 haircut on 27 november 2025', 'coffee 7 40 euros yesterday', 'döner 6 on 3.10', 'döner 6 2026-10-01'];

/** Histories that give a suggestion for some lines and none for others. */
const HISTORIES: [string, Entry[]][] = [
  ['no history', []],
  [
    'earlier expenses',
    [
      expense('Döner', 'eating-out', '2026-10-10T12:00:00.000Z'),
      expense('döner with Tom', 'food', '2026-10-14T12:00:00.000Z'),
      expense('Coffee', 'eating-out', '2026-10-12T12:00:00.000Z'),
      expense('books for the seminar', 'study', '2026-10-11T12:00:00.000Z'),
      expense('laptop', 'shopping', '2026-10-09T12:00:00.000Z'),
      expense('rent October', 'rent', '2026-10-01T12:00:00.000Z'),
      // A posted entry teaches nothing: its note is the category name.
      expense('Phone & internet', 'phone', '2026-10-16T12:00:00.000Z', { scheduleId: 's1' }),
      // A category that is not built in, from an old backup: quick add has always saved under it.
      expense('lunch', 'mensa', '2026-10-13T12:00:00.000Z'),
    ],
  ],
];

/** The amount or choice `readQuickAdd` reads from a line, or null. */
const parseQuickAdd = (text: string) => readQuickAdd(text)?.reading ?? null;

/** What quick add reads, written out: `parseQuickAdd`, then `guessCategory` on the note (history, then the words). */
function readBefore(text: string, history: Entry[]): QuickAddReading | null {
  const parsed = parseQuickAdd(text);
  if (parsed === null) return null;
  const categoryId = guessCategory(parsed.note, history);
  return 'kind' in parsed
    ? { kind: 'choice', options: parsed.options, note: parsed.note, categoryId }
    : { kind: 'amount', amountMinor: parsed.amountMinor, note: parsed.note, categoryId };
}

describe('localQuickAddProvider', () => {
  it.each(HISTORIES)('reads every parser line with no date as parseQuickAdd plus guessCategory (%s)', async (_, history) => {
    const ctx = context(history);
    expect(LINES.length - UNDATED.length).toBe(2);
    for (const text of UNDATED) {
      expect(await localQuickAddProvider.read(text, ctx), text).toStrictEqual(readBefore(text, history));
    }
  });

  it.each(HISTORIES)('gives readings the field keeps as they are (%s)', async (_, history) => {
    const ctx = context(history);
    for (const text of [...LINES, ...DATED]) {
      const reading = await localQuickAddProvider.read(text, ctx);
      expect(checkReading(reading, ctx), text).toStrictEqual(reading);
    }
  });

  it('suggests a category from the history and leaves the account and date to the field', async () => {
    const ctx = context(HISTORIES[1][1]);

    expect(await localQuickAddProvider.read('döner 6', ctx)).toStrictEqual({
      kind: 'amount',
      amountMinor: 600,
      note: 'döner',
      categoryId: 'food',
    });
    expect(await localQuickAddProvider.read('bus 3', ctx)).toStrictEqual({
      kind: 'amount',
      amountMinor: 300,
      note: 'bus',
      categoryId: null,
    });
    expect(await localQuickAddProvider.read('döner', ctx)).toBeNull();
  });

  it('gives a choice one category, read once for the line', async () => {
    const ctx = context(HISTORIES[1][1]);

    expect(await localQuickAddProvider.read('coffee 7 40 euros', ctx)).toStrictEqual({
      kind: 'choice',
      options: [740, 4000],
      note: 'coffee',
      categoryId: 'eating-out',
    });
    expect(suggestCategory).toHaveBeenCalledTimes(1);
  });
});

describe('a euro marker when the default account is not in euros', () => {
  const early = '2026-10-01T08:00:00.000Z';
  // Marked as the default in Settings: the rule alone would pick a euro account over it.
  const rupees = { ...account('home-bank', 'bank', 'INR', early), isDefault: true as const };
  const euroBank = account('local-bank', 'bank', 'EUR', '2026-10-02T08:00:00.000Z');
  const euroCash = account('wallet', 'cash', 'EUR', '2026-10-03T08:00:00.000Z');
  const pounds = account('pound-bank', 'bank', 'GBP', '2026-10-04T08:00:00.000Z');
  const read = (text: string, list: Account[]) =>
    localQuickAddProvider.read(text, { today: '2026-10-20', accounts: list, history: [] });

  it('names the first euro bank account for "Döner 6 €", "€6", "6 eur" and "6 euros"', async () => {
    const list = [rupees, euroCash, euroBank];

    for (const text of ['Döner 6 €', 'döner €6', 'döner 6eur', 'döner 6 euros', 'eur 6 döner', 'döner 6 euro 50']) {
      const reading = await read(text, list);

      expect(reading, text).toMatchObject({ kind: 'amount', accountId: 'local-bank' });
      expect(checkReading(reading, context([])), text).not.toBeNull();
    }
    expect(await read('Döner 6 €', list)).toStrictEqual({
      kind: 'amount',
      amountMinor: 600,
      note: 'Döner',
      categoryId: 'eating-out',
      accountId: 'local-bank',
    });
  });

  it('names a euro cash account when no bank account is in euros', async () => {
    expect(await read('döner 6 €', [rupees, euroCash, pounds])).toMatchObject({ accountId: 'wallet' });
  });

  it('keeps the default for a line with no euro marker, or when no account is in euros', async () => {
    expect(await read('döner 6', [rupees, euroBank])).toStrictEqual({
      kind: 'amount',
      amountMinor: 600,
      note: 'döner',
      categoryId: 'eating-out',
    });
    expect(await read('döner 6 €', [rupees, pounds])).toStrictEqual({
      kind: 'amount',
      amountMinor: 600,
      note: 'döner',
      categoryId: 'eating-out',
    });
    // The default is in euros already: the field saves there, so the reading names nothing. Unmarked, the rule picks
    // the euro wallet over the first account in rupees.
    const unmarked = account('home-bank', 'bank', 'INR', early);
    expect(await read('döner 6 €', [unmarked, euroCash])).not.toHaveProperty('accountId');
    expect(await read('döner 6 €', [{ ...euroBank, isDefault: true as const }, unmarked])).not.toHaveProperty('accountId');
  });

  it('counts accounts from the one created first, in whatever order they arrive', async () => {
    const earlierBank = { ...euroBank, id: 'bank-0', createdAt: '2026-10-01T07:00:00.000Z' };

    expect(await read('döner 6 €', [euroBank, euroCash, rupees, earlierBank])).toMatchObject({ accountId: 'bank-0' });
  });

  it('carries the account through a choice, so its buttons and the saved entry are in euros', async () => {
    const list = [rupees, euroBank];
    const reading = await read('coffee 7 40 euros', list);

    expect(reading).toStrictEqual({
      kind: 'choice',
      options: [740, 4000],
      note: 'coffee',
      categoryId: 'eating-out',
      accountId: 'local-bank',
    });
    if (reading?.kind !== 'choice') throw new Error('expected a choice');
    expect(chosenAmount(reading, 740)).toStrictEqual({
      kind: 'amount',
      amountMinor: 740,
      note: 'coffee',
      categoryId: 'eating-out',
      accountId: 'local-bank',
    });
    // The field shows and saves in the currency of the account the reading names.
    expect(accountFor(list, reading.accountId)?.currency).toBe('EUR');
    expect(accountFor(list, undefined)?.currency).toBe('INR');
  });

  it('is dropped by checkReading when the account is gone', async () => {
    const reading = await read('döner 6 €', [rupees, euroBank]);

    expect(checkReading(reading, { today: '2026-10-20', accounts: [rupees], history: [] })).toStrictEqual({
      kind: 'amount',
      amountMinor: 600,
      note: 'döner',
      categoryId: 'eating-out',
    });
    const choice = await read('coffee 7 40 euros', [rupees, euroBank]);
    expect(checkReading(choice, { today: '2026-10-20', accounts: [rupees], history: [] })).not.toHaveProperty('accountId');
  });
});

describe('checkReading', () => {
  const ctx = context([expense('lunch', 'mensa', '2026-10-13T12:00:00.000Z')]);
  const fake = (reading: QuickAddReading | null): QuickAddProvider => ({ read: async () => reading });

  it('keeps a category, account and date it knows', async () => {
    const reading: QuickAddReading = {
      kind: 'amount',
      amountMinor: 650,
      note: 'kebab',
      categoryId: 'eating-out',
      accountId: 'bank',
      date: '2026-10-19',
    };

    expect(checkReading(await fake(reading).read('kebab 6,50', ctx), ctx)).toStrictEqual(reading);
  });

  it('keeps a category an earlier expense was filed under', async () => {
    const reading: QuickAddReading = { kind: 'amount', amountMinor: 500, note: 'lunch', categoryId: 'mensa' };

    expect(checkReading(await fake(reading).read('lunch 5', ctx), ctx)).toStrictEqual(reading);
  });

  it('drops an unknown category, so the field asks with the chips', async () => {
    const reading = await fake({ kind: 'amount', amountMinor: 600, note: 'döner', categoryId: 'kebab-shop' }).read(
      'döner 6',
      ctx,
    );

    expect(checkReading(reading, ctx)).toStrictEqual({ kind: 'amount', amountMinor: 600, note: 'döner', categoryId: null });
  });

  it('drops an income category: quick add logs expenses', async () => {
    const reading = await fake({ kind: 'amount', amountMinor: 600, note: 'job', categoryId: 'income-job' }).read(
      'job 6',
      ctx,
    );

    expect(checkReading(reading, ctx)).toMatchObject({ categoryId: null });
  });

  it('drops an unknown category on a choice', async () => {
    const reading = await fake({ kind: 'choice', options: [740, 4000], note: 'coffee', categoryId: 'coffee-shop' }).read(
      'coffee 7 40',
      ctx,
    );

    expect(checkReading(reading, ctx)).toStrictEqual({
      kind: 'choice',
      options: [740, 4000],
      note: 'coffee',
      categoryId: null,
    });
  });

  it('drops an unknown account, so the field picks one', async () => {
    const reading = await fake({
      kind: 'amount',
      amountMinor: 600,
      note: 'döner',
      categoryId: 'eating-out',
      accountId: 'deleted-account',
    }).read('döner 6', ctx);

    expect(checkReading(reading, ctx)).toStrictEqual({
      kind: 'amount',
      amountMinor: 600,
      note: 'döner',
      categoryId: 'eating-out',
    });
  });

  it('drops a date that is not a real day, so the entry is dated today', async () => {
    for (const date of ['2026-02-30', 'yesterday', '20-10-2026', '']) {
      const reading = await fake({ kind: 'amount', amountMinor: 600, note: 'döner', categoryId: null, date }).read(
        'döner 6',
        ctx,
      );

      expect(checkReading(reading, ctx), date).toStrictEqual({
        kind: 'amount',
        amountMinor: 600,
        note: 'döner',
        categoryId: null,
      });
    }
  });

  it('treats an amount that is not whole cents above zero as no reading', async () => {
    for (const amountMinor of [0, -600, 6.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const reading = await fake({ kind: 'amount', amountMinor, note: 'döner', categoryId: null }).read('döner', ctx);

      expect(checkReading(reading, ctx), String(amountMinor)).toBeNull();
    }
    const choice = await fake({ kind: 'choice', options: [740, 40.5], note: 'coffee', categoryId: null }).read(
      'coffee 7 40',
      ctx,
    );
    expect(checkReading(choice, ctx)).toBeNull();
  });

  it('passes no reading on as none', () => {
    expect(checkReading(null, ctx)).toBeNull();
  });

  // The one change from before the provider: such a line used to be saved, with an amount that is not whole cents.
  it('drops a local reading too large to be whole cents', async () => {
    for (const text of ['coffee 90071992547409 euro 99', 'coffee 90071992547409 99']) {
      const reading = await localQuickAddProvider.read(text, ctx);

      expect(reading, text).not.toBeNull();
      expect(checkReading(reading, ctx), text).toBeNull();
    }
  });
});

describe('a date in the line (quick add dates, 18-11-2026)', () => {
  const de = (history: Entry[] = []): QuickAddContext => ({ ...context(history), lang: 'de' });

  it('takes the date out and dates the reading', async () => {
    expect(await localQuickAddProvider.read('10 haircut on 27 november 2025', context([]))).toStrictEqual({
      kind: 'amount',
      amountMinor: 1000,
      note: 'haircut',
      categoryId: null,
      date: '2025-11-27',
    });
    expect(await localQuickAddProvider.read('Döner 6 gestern', de())).toStrictEqual({
      kind: 'amount',
      amountMinor: 600,
      note: 'Döner',
      categoryId: 'eating-out',
      date: '2026-10-19',
    });
  });

  it('reads date words in the phone’s language and English only', async () => {
    expect(await localQuickAddProvider.read('döner 6 gestern', context([]))).toMatchObject({ note: 'döner gestern' });
    expect(await localQuickAddProvider.read('döner 6 gestern', context([]))).not.toHaveProperty('date');
    expect(await localQuickAddProvider.read('Döner 6 yesterday', de())).toMatchObject({ date: '2026-10-19' });
  });

  it('keeps the amount when taking a date out would leave none', async () => {
    expect(await localQuickAddProvider.read('6 mai Döner', de())).toStrictEqual({
      kind: 'amount',
      amountMinor: 600,
      note: 'mai Döner',
      categoryId: 'eating-out',
    });
    expect(await localQuickAddProvider.read('6 mai Döner gestern', de())).toMatchObject({
      amountMinor: 600,
      note: 'mai Döner',
      date: '2026-10-19',
    });
    expect(await localQuickAddProvider.read('lunch with jan 12', context([]))).toStrictEqual({
      kind: 'amount',
      amountMinor: 1200,
      note: 'lunch with jan',
      categoryId: null,
    });
  });

  it('dates a choice, and the amount tapped keeps the day', async () => {
    const reading = await localQuickAddProvider.read('coffee 7 40 euros yesterday', context([]));
    expect(reading).toStrictEqual({
      kind: 'choice',
      options: [740, 4000],
      note: 'coffee',
      categoryId: 'eating-out',
      date: '2026-10-19',
    });
    if (reading?.kind !== 'choice') throw new Error('expected a choice');
    expect(chosenAmount(reading, 740)).toMatchObject({ amountMinor: 740, date: '2026-10-19' });
  });

  it('dates a weekday: "last friday" on Tuesday 20.10.2026 is 16.10.2026', async () => {
    expect(await localQuickAddProvider.read('coffee 3 last friday', context([]))).toStrictEqual({
      kind: 'amount',
      amountMinor: 300,
      note: 'coffee',
      categoryId: 'eating-out',
      date: '2026-10-16',
    });
  });

  it('leaves a day after today on the reading: the field refuses it', async () => {
    expect(await localQuickAddProvider.read('döner 6 on 3 december 2026', context([]))).toMatchObject({
      date: '2026-12-03',
    });
  });
});

describe('chosenAmount', () => {
  it('saves the tapped amount under the category the line was read with, without reading it again', async () => {
    const reading = await localQuickAddProvider.read('coffee 7 40 euros', context(HISTORIES[1][1]));
    if (reading?.kind !== 'choice') throw new Error('expected a choice');
    vi.mocked(suggestCategory).mockClear();

    expect(chosenAmount(reading, 740)).toStrictEqual({
      kind: 'amount',
      amountMinor: 740,
      note: 'coffee',
      categoryId: 'eating-out',
    });
    expect(chosenAmount(reading, 4000)).toStrictEqual({
      kind: 'amount',
      amountMinor: 4000,
      note: 'coffee',
      categoryId: 'eating-out',
    });
    expect(suggestCategory).not.toHaveBeenCalled();
  });

  it('keeps a line without a category without one, so the chips follow', () => {
    expect(chosenAmount({ kind: 'choice', options: [740, 4000], note: 'coffee', categoryId: null }, 740)).toStrictEqual({
      kind: 'amount',
      amountMinor: 740,
      note: 'coffee',
      categoryId: null,
    });
  });
});

describe('accountFor', () => {
  it('takes the account the reading names', () => {
    expect(accountFor(accounts, 'bank')).toBe(bank);
  });

  it('falls back to the default account without one, or for one that is gone: the euro bank account, not cash', () => {
    expect(accountFor(accounts, undefined)).toBe(bank);
    expect(accountFor(accounts, 'deleted-account')).toBe(bank);
    expect(accountFor([], 'bank')).toBeUndefined();
  });

  it('falls back to the account marked as the default, even if it is cash', () => {
    const markedCash = { ...cash, isDefault: true as const };

    expect(accountFor([bank, markedCash], undefined)).toBe(markedCash);
    expect(accountFor([bank, markedCash], 'deleted-account')).toBe(markedCash);
    // A reading that names an account still wins.
    expect(accountFor([bank, markedCash], 'bank')).toBe(bank);
  });

  it('counts from the account created first, in whatever order the accounts arrive', () => {
    const earlier = { ...bank, id: 'bank-0', createdAt: '2026-10-01T08:00:00.000Z' };

    expect(accountFor([cash, bank, earlier], undefined)).toBe(earlier);
  });

  it('is the first euro bank account for accounts made together in setup, where every createdAt is the same', () => {
    const together = '2026-10-16T08:00:00.000Z';
    const setup = [
      { ...cash, createdAt: together },
      { ...bank, id: 'home-bank', name: 'Home bank', currency: 'INR' as const, createdAt: together },
      { ...bank, id: 'local-bank', name: 'Local bank', createdAt: together },
    ];

    expect(accountFor(setup, undefined)?.id).toBe('local-bank');
  });
});

describe('number words in the phone’s language (18-11-2026)', () => {
  const on = (lang: Language): QuickAddContext => ({ ...context([]), lang });

  it('reads German, French and Spanish number words as the amount', async () => {
    expect(await localQuickAddProvider.read('Döner sechs Euro fünfzig', on('de'))).toStrictEqual({
      kind: 'amount',
      amountMinor: 650,
      note: 'Döner',
      categoryId: 'eating-out',
    });
    expect(await localQuickAddProvider.read('pizza vingt-cinq euros', on('fr'))).toStrictEqual({
      kind: 'amount',
      amountMinor: 2500,
      note: 'pizza',
      categoryId: 'eating-out',
    });
    expect(await localQuickAddProvider.read('café seis euros con cincuenta', on('es'))).toStrictEqual({
      kind: 'amount',
      amountMinor: 650,
      note: 'café',
      categoryId: 'eating-out',
    });
  });

  it('gives two readings for "sieben vierzig", as for "seven forty"', async () => {
    expect(await localQuickAddProvider.read('Kaffee sieben vierzig', on('de'))).toStrictEqual({
      kind: 'choice',
      options: [740, 4000],
      note: 'Kaffee',
      categoryId: 'eating-out',
    });
  });

  it('reads a date written in number words, after the words become digits', async () => {
    expect(await localQuickAddProvider.read('Friseur zehn am siebenundzwanzig November', on('de'))).toMatchObject({
      amountMinor: 1000,
      note: 'Friseur',
      date: '2025-11-27',
    });
  });

  it('keeps an article, English number words, and refuses a scale it cannot read', async () => {
    expect(await localQuickAddProvider.read('ein Döner sechs', on('de'))).toMatchObject({ amountMinor: 600, note: 'ein Döner' });
    expect(await localQuickAddProvider.read('döner six euros', on('de'))).toMatchObject({ amountMinor: 600, note: 'döner' });
    expect(await localQuickAddProvider.read('Lotto zwei Millionen', on('de'))).toBeNull();
  });

  it('reads no German number words on an English phone', async () => {
    expect(await localQuickAddProvider.read('Döner sechs Euro', context([]))).toBeNull();
  });
});

describe('the hint’s own example (18-11-2026)', () => {
  it.each(OFFERED)('saves €6 under Eating out, dated yesterday, in %s', async (lang) => {
    const example = /[“„«"]\s*([^”“»"]+?)\s*[”“»"]/u.exec(MESSAGES[lang].entries.quickAdd.hint)?.[1] ?? '';
    expect(await localQuickAddProvider.read(example, { ...context([]), lang })).toMatchObject({
      kind: 'amount',
      amountMinor: 600,
      categoryId: 'eating-out',
      date: '2026-10-19',
    });
  });
});
