import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Entry } from '@/db/types';
import { parseQuickAdd, suggestCategory } from './quick-add';
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

/** What quick add read before the provider: `parseQuickAdd`, then `suggestCategory` on the note. */
function readBefore(text: string, history: Entry[]): QuickAddReading | null {
  const parsed = parseQuickAdd(text);
  if (parsed === null) return null;
  const categoryId = suggestCategory(parsed.note, history);
  return 'kind' in parsed
    ? { kind: 'choice', options: parsed.options, note: parsed.note, categoryId }
    : { kind: 'amount', amountMinor: parsed.amountMinor, note: parsed.note, categoryId };
}

describe('localQuickAddProvider', () => {
  it.each(HISTORIES)('reads every parser line as parseQuickAdd plus suggestCategory did (%s)', async (_, history) => {
    const ctx = context(history);
    for (const text of LINES) {
      expect(await localQuickAddProvider.read(text, ctx), text).toStrictEqual(readBefore(text, history));
    }
  });

  it.each(HISTORIES)('gives readings the field keeps as they are (%s)', async (_, history) => {
    const ctx = context(history);
    for (const text of LINES) {
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
      categoryId: null,
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
      categoryId: null,
    });
    expect(await read('döner 6 €', [rupees, pounds])).toStrictEqual({
      kind: 'amount',
      amountMinor: 600,
      note: 'döner',
      categoryId: null,
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
      categoryId: null,
      accountId: 'local-bank',
    });
    if (reading?.kind !== 'choice') throw new Error('expected a choice');
    expect(chosenAmount(reading, 740)).toStrictEqual({
      kind: 'amount',
      amountMinor: 740,
      note: 'coffee',
      categoryId: null,
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
      categoryId: null,
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
