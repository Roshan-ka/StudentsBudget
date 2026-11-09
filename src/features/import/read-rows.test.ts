import { describe, expect, it } from 'vitest';
import type { Mapping } from './profiles';
import { readRows, sepaText, type Table } from './read-rows';

// Reading a table through a mapping, for what the bank profiles don't show on their own: money out and in apart (a CSV
// matched by hand), a fee, rows without a date or an amount, and the SEPA purpose. The banks' own files are in
// statement.test.ts.

const MANUAL: Mapping = {
  date: { column: 'Datum', order: 'dmy' },
  amount: { out: 'Soll', in: 'Haben' },
  decimal: ',',
  currencyColumn: 'Währung',
  payee: ['Text'],
  purpose: [],
};

function table(header: string[], ...rows: string[][]): Table {
  return { separator: ';', header, rows };
}

describe('readRows', () => {
  it('reads money out and money in from their own columns, as a negative and a positive amount', () => {
    const read = readRows(
      table(['Datum', 'Text', 'Soll', 'Haben', 'Währung'], ['01.11.2026', 'Edeka Center', '12,30', '', 'EUR'], ['02.11.2026', 'Lohn', '', '450,00', 'eur']),
      MANUAL,
    );

    expect(read.unread).toEqual([]);
    expect(read.rows).toEqual([
      { index: 1, date: '2026-11-01', amountMinor: -1230, currency: 'EUR', payee: 'Edeka Center', purpose: '', bookingText: '', pending: false, kind: 'payment' },
      { index: 2, date: '2026-11-02', amountMinor: 45000, currency: 'EUR', payee: 'Lohn', purpose: '', bookingText: '', pending: false, kind: 'payment' },
    ]);
  });

  it('a money-out column written negative is still money out', () => {
    const read = readRows(table(['Datum', 'Text', 'Soll', 'Haben', 'Währung'], ['01.11.2026', 'Edeka', '-12,30', '', 'EUR']), MANUAL);
    expect(read.rows[0].amountMinor).toBe(-1230);
  });

  it('lists the rows without a readable date or amount, with their text, and leaves blank rows out', () => {
    const read = readRows(
      table(['Datum', 'Text', 'Soll', 'Haben', 'Währung'], ['', 'Ohne Datum', '1,00', '', 'EUR'], ['03.11.2026', 'Kaputt', '', '', 'EUR'], ['', '', '', '', '']),
      MANUAL,
    );

    expect(read.rows).toEqual([]);
    expect(read.unread).toEqual([
      { index: 1, problem: 'date', text: 'Ohne Datum · 1,00 · EUR' },
      { index: 2, problem: 'amount', text: '03.11.2026 · Kaputt · EUR' },
    ]);
  });

  it('takes a fee off the amount, whichever sign the bank gives it', () => {
    const mapping: Mapping = { ...MANUAL, amount: { column: 'Betrag' }, fee: 'Gebühr' };
    const read = readRows(
      table(['Datum', 'Text', 'Betrag', 'Gebühr', 'Währung'], ['03.11.2026', 'ATM', '-50,00', '1,00', 'EUR'], ['04.11.2026', 'ATM', '-50,00', '-1,00', 'EUR']),
      mapping,
    );
    expect(read.rows.map((row) => row.amountMinor)).toEqual([-5100, -5100]);
  });

  it('uses the fixed currency without a currency column, and none without either', () => {
    const header = ['Datum', 'Text', 'Betrag'];
    const row = ['03.11.2026', 'Mensa', '-3,50'];
    const base: Mapping = { ...MANUAL, amount: { column: 'Betrag' }, currencyColumn: undefined };
    expect(readRows(table(header, row), { ...base, currency: 'EUR' }).rows[0].currency).toBe('EUR');
    expect(readRows(table(header, row), base).rows[0].currency).toBeNull();
  });
});

describe('sepaText', () => {
  it('takes the text after the tag up to the next SEPA tag', () => {
    expect(sepaText('EREF+NOTPROVIDED MREF+M-1 CRED+DE98ZZZ0 SVWZ+Rundfunkbeitrag 11.2026 ABWA+ARD ZDF', 'SVWZ+')).toBe(
      'Rundfunkbeitrag 11.2026 ',
    );
    expect(sepaText('SVWZ+Miete November', 'SVWZ+')).toBe('Miete November');
    expect(sepaText('Miete November', 'SVWZ+')).toBe('Miete November');
  });
});
