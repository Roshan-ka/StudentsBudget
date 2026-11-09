import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UNKNOWN } from './fixtures';
import { COLUMNS_PREF, guessChoice, headerKey, isComplete, mappingOf, rememberChoice, rememberedChoice, type ColumnChoice } from './mapping';
import { readRows, type Table } from './read-rows';
import { openStatement } from './statement';

// Matching a CSV's columns by hand: the app's first guess, the mapping it reads with, and what the phone remembers.

let stored: Record<string, string>;

beforeEach(() => {
  stored = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored[key] ?? null,
    setItem: (key: string, value: string) => {
      stored[key] = value;
    },
  });
  // writePref tells the components reading it; without a window there are none.
  vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function unknownTable(): Table {
  const statement = openStatement(UNKNOWN);
  if (statement.kind !== 'unknown') throw new Error('expected an unknown CSV');
  return statement.table;
}

const table = (header: string[], ...rows: string[][]): Table => ({ separator: ';', header, rows });

describe('guessChoice', () => {
  it('finds the date, money out and in by their names, who was paid, and the currency', () => {
    // Datum;Text;Soll;Haben;Währung
    expect(guessChoice(unknownTable())).toEqual({
      date: 0,
      dateOrder: 'dmy',
      amount: { kind: 'two', out: 2, in: 3 },
      payee: 1,
      purpose: null,
      currency: 4,
    });
  });

  it('takes one signed amount column, a year-first date, and the text columns by how many values differ', () => {
    const guessed = guessChoice(
      table(
        ['Booked', 'Kind', 'Counterparty', 'Value', 'Memo'],
        ['2026-11-01', 'Card', 'REWE', '-12.30', 'Groceries'],
        ['2026-11-02', 'Card', 'Mensa', '-3.50', 'Lunch'],
        ['2026-11-03', 'Transfer', 'Max', '200.00', 'Rent share'],
      ),
    );
    expect(guessed).toMatchObject({ date: 0, dateOrder: 'ymd', amount: { kind: 'one', column: 3 }, currency: null });
    // Counterparty and Memo differ on every row, Kind doesn't: the two with the most different values come first.
    expect([guessed.payee, guessed.purpose]).toEqual([2, 4]);
  });

  it('never takes a bare "in" in a name for money in', () => {
    const guessed = guessChoice(table(['Date', 'Amount', 'Amount in EUR', 'Text'], ['01.11.2026', '-5,00', '-5,00', 'Kiosk']));
    expect(guessed.amount).toEqual({ kind: 'one', column: 1 });
  });
});

describe('mappingOf', () => {
  it('names the chosen columns by the header’s own names, and reads the file through them', () => {
    const unknown = unknownTable();
    const mapping = mappingOf(guessChoice(unknown), unknown.header);
    expect(mapping).toMatchObject({
      date: { column: 'Datum', order: 'dmy' },
      amount: { out: 'Soll', in: 'Haben' },
      payee: ['Text'],
      purpose: [],
      currencyColumn: 'Währung',
    });
    const read = readRows(unknown, mapping);
    expect(read.rows.map((row) => [row.date, row.amountMinor, row.currency, row.payee])).toEqual([
      ['2026-11-01', -1230, 'EUR', 'Edeka Center'],
      ['2026-11-02', 45000, 'EUR', 'Lohn Oktober'],
    ]);
    expect(read.unread.map((row) => row.problem)).toEqual(['amount']);
  });
});

describe('isComplete', () => {
  const header = ['A', 'B', 'C', 'D'];
  const base: ColumnChoice = { date: 0, dateOrder: 'dmy', amount: { kind: 'one', column: 1 }, payee: 2, purpose: null, currency: null };

  it('wants the date, the amount and who was paid in columns of their own, within the header', () => {
    expect(isComplete(base, header)).toBe(true);
    expect(isComplete({ ...base, payee: 1 }, header)).toBe(false);
    expect(isComplete({ ...base, amount: { kind: 'two', out: 1, in: 1 } }, header)).toBe(false);
    expect(isComplete({ ...base, currency: 7 }, header)).toBe(false);
    // The optional details may share a column.
    expect(isComplete({ ...base, purpose: 2 }, header)).toBe(true);
  });
});

describe('remembering', () => {
  it('opens the next file with the same header row as it was matched, and nothing for another header', () => {
    const unknown = unknownTable();
    const choice = { ...guessChoice(unknown), purpose: 1 };
    rememberChoice(unknown.header, choice);

    expect(rememberedChoice(unknown.header)).toEqual(choice);
    expect(rememberedChoice(['Datum', 'Text', 'Betrag'])).toBeNull();
    expect(Object.keys(JSON.parse(stored[COLUMNS_PREF]))).toEqual([headerKey(unknown.header)]);
  });

  it('keeps the newest ten header rows, and reads nothing from what it can’t parse', () => {
    for (let n = 0; n < 12; n += 1) {
      rememberChoice(['Date', `Amount ${n}`, 'Text'], { date: 0, dateOrder: 'dmy', amount: { kind: 'one', column: 1 }, payee: 2, purpose: null, currency: null }, n);
    }
    const kept = Object.keys(JSON.parse(stored[COLUMNS_PREF]));
    expect(kept).toHaveLength(10);
    expect(kept).not.toContain(headerKey(['Date', 'Amount 0', 'Text']));

    stored[COLUMNS_PREF] = 'not json';
    expect(rememberedChoice(['Date', 'Amount 11', 'Text'])).toBeNull();
  });
});
