import { describe, expect, it } from 'vitest';
import {
  DKB,
  DKB_COMMA,
  DKB_OLD,
  DKB_VISA,
  N26,
  N26_OLD_DE,
  N26_RESAVED,
  REVOLUT,
  SPARKASSE_CAMT,
  SPARKASSE_MT940,
  UNKNOWN,
  utf8,
} from './fixtures';
import { BANK_PROFILES, recognise } from './profiles';
import { MAX_STATEMENT_BYTES, openStatement, type Statement } from './statement';

// Each bank's file, read the whole way: the bytes as text, the header found, the bank recognised by its column names,
// and every row read. The files are in fixtures.ts, written to each bank's layout as profiles.ts documents it.

function bank(statement: Statement) {
  if (statement.kind !== 'bank') throw new Error(`Expected a bank statement, got ${statement.kind}`);
  return statement;
}

/** The rows as date, amount, payee, purpose, pending and kind, for comparing in a table. */
const rowsOf = (statement: Statement) =>
  bank(statement).read.rows.map((row) => [row.date, row.amountMinor, row.payee, row.purpose, row.pending, row.kind]);

describe('openStatement', () => {
  it('reads Sparkasse CSV-CAMT V2 in Windows-1252: the umlauts, a pending row, the value date when the booking day is empty', () => {
    const statement = bank(openStatement(SPARKASSE_CAMT));

    expect(statement.profile.id).toBe('sparkasse-camt');
    expect(statement.table.separator).toBe(';');
    expect(statement.read.unread).toEqual([]);
    expect(rowsOf(statement)).toEqual([
      ['2026-10-30', -2345, 'REWE Markt GmbH', '2026-10-29T18:12 Debitk.1 2029-12', false, 'payment'],
      ['2026-10-31', 93400, 'Bundesamt fuer Ausbildungsfoerderung', 'BAFOEG 10/2026', false, 'payment'],
      ['2026-11-01', -125000, 'Studierendenwerk Niederbayern/Oberpfalz', 'Miete November', false, 'payment'],
      ['2026-11-02', -5000, 'Sparkasse Regensburg', 'GA NR00001234 BLZ75050000 0', false, 'payment'],
      ['2026-11-03', -310, 'Bäckerei Müller', 'Brötchen', true, 'payment'],
      ['2026-11-04', -10000, 'Revolut', 'Aufladen', false, 'payment'],
    ]);
    expect(statement.read.rows.map((row) => [row.currency, row.bookingText])[3]).toEqual(['EUR', 'BARGELDAUSZAHLUNG']);
  });

  it('reads Sparkasse CSV-MT940: only the text after SVWZ+ is the purpose', () => {
    const statement = bank(openStatement(SPARKASSE_MT940));
    expect(statement.profile.id).toBe('sparkasse-mt940');
    expect(rowsOf(statement)).toEqual([['2026-11-01', -1836, 'Rundfunk ARD, ZDF, Deutschlandradio', 'Rundfunkbeitrag 11.2026', false, 'payment']]);
  });

  it('reads DKB below its account lines, with either separator: the payee by direction, pending, no daily balance', () => {
    for (const file of [DKB, DKB_COMMA]) {
      const statement = bank(openStatement(file));
      expect(statement.profile.id).toBe('dkb');
      expect(rowsOf(statement)).toEqual([
        ['2026-11-04', -1249, 'Lidl sagt Danke', '2026-11-03 Debitk.99 VISA Debit', false, 'payment'],
        ['2026-11-03', 20000, 'Eltern Mustermann', 'Taschengeld November', false, 'payment'],
        ['2026-11-05', -1099, 'Spotify', 'Spotify P1234', true, 'payment'],
      ]);
      expect(statement.read.rows.every((row) => row.currency === 'EUR')).toBe(true);
    }
    expect(bank(openStatement(DKB_COMMA)).table.separator).toBe(',');
  });

  it('reads the older DKB file in ISO-8859-1, its trailing separators, without the closing line', () => {
    const statement = bank(openStatement(DKB_OLD));
    expect(statement.profile.id).toBe('dkb-old');
    expect(rowsOf(statement)).toEqual([['2022-10-28', -5508, 'Rundfunk ARD, ZDF, DRadio', 'Rundfunkbeitrag', false, 'payment']]);
  });

  it('reads N26 with its uneven quoting and a comma inside a quoted reference', () => {
    const statement = bank(openStatement(N26));
    expect(statement.profile.id).toBe('n26');
    expect(rowsOf(statement)).toEqual([
      ['2026-11-02', -795, 'dm-drogerie markt', '-', false, 'payment'],
      ['2026-11-01', 30000, 'Max Mustermann', 'Rent share, November', false, 'payment'],
      ['2026-10-31', -1399, 'Netflix', '', false, 'payment'],
    ]);
    expect(statement.read.rows[1].bookingText).toBe('Credit Transfer');
  });

  it('reads N26 that a spreadsheet saved again with `;`, a decimal comma and the day first', () => {
    const statement = bank(openStatement(N26_RESAVED));
    expect(statement.profile.id).toBe('n26');
    expect(rowsOf(statement)).toEqual([
      ['2026-11-02', -795, 'dm-drogerie markt', '-', false, 'payment'],
      ['2026-10-31', -1399, 'Netflix', '', false, 'payment'],
    ]);
  });

  it('reads the older N26 file from the German app', () => {
    const statement = bank(openStatement(N26_OLD_DE));
    expect(statement.profile.id).toBe('n26-old-de');
    expect(rowsOf(statement)).toEqual([['2021-03-01', -350, 'Mensa Uni Regensburg', '', false, 'payment']]);
  });

  it('reads Revolut: top-ups and cash by their type, in any case, fees taken off, other states pending, moves inside marked', () => {
    const statement = bank(openStatement(REVOLUT));
    expect(statement.profile.id).toBe('revolut');
    expect(bank(statement).read.rows.map((row) => [row.date, row.amountMinor, row.currency, row.payee, row.pending, row.kind])).toEqual([
      ['2026-11-01', 10000, 'EUR', 'Top-Up by *1234', false, 'topUp'],
      ['2026-11-03', -1840, 'EUR', 'Lieferando', false, 'payment'],
      ['2026-11-03', -5100, 'EUR', 'Cash at Sparkasse', false, 'cash'],
      ['2026-11-04', -2000, 'EUR', 'Exchanged to INR', false, 'internal'],
      ['2026-11-04', 500, 'EUR', 'To EUR Savings', false, 'internal'],
      // Pending and reverted rows have no completed date: the started one stands in, and they are marked pending.
      ['2026-11-05', -1200, 'EUR', 'Amazon', true, 'payment'],
      ['2026-11-02', -25000, 'INR', 'Chai Point', false, 'payment'],
      ['2026-11-01', -900, 'EUR', 'Refunded thing', true, 'payment'],
      ['2026-11-05', 2500, 'EUR', 'Top-Up by *1234', false, 'topUp'],
    ]);
  });

  it('recognises DKB’s Visa card file and says it isn’t supported yet', () => {
    expect(openStatement(DKB_VISA)).toEqual({ kind: 'unsupported', profile: expect.objectContaining({ id: 'dkb-visa', what: 'creditCard' }) });
  });

  it('hands a CSV it doesn’t know over as a table for the column matching', () => {
    const statement = openStatement(UNKNOWN);
    expect(statement).toEqual({
      kind: 'unknown',
      table: {
        separator: ';',
        header: ['Datum', 'Text', 'Soll', 'Haben', 'Währung'],
        rows: [
          ['01.11.2026', 'Edeka Center', '12,30', '', 'EUR'],
          ['02.11.2026', 'Lohn Oktober', '', '450,00', 'EUR'],
          ['03.11.2026', 'Kaputt', '', '', 'EUR'],
        ],
      },
    });
  });

  it('says a file is empty, and refuses one that is too big before reading it', () => {
    expect(openStatement(new Uint8Array())).toEqual({ kind: 'empty' });
    expect(openStatement(utf8('just one line\n'))).toEqual({ kind: 'empty' });
    expect(openStatement(new Uint8Array(MAX_STATEMENT_BYTES + 1))).toEqual({ kind: 'tooBig' });
  });
});

describe('the profiles', () => {
  it('each recognise only their own header', () => {
    for (const profile of BANK_PROFILES) {
      expect(recognise(profile.header)).toBe(profile);
    }
  });

  it('never read a column that holds an account number, an IBAN, a BIC or a mandate', () => {
    const forbidden = /iban|kontonummer|blz|bic|mandat|gläubiger|glaeubiger|auftragskonto|account number|partner iban/i;
    for (const profile of BANK_PROFILES) {
      const read = [
        profile.date.column,
        profile.date.fallback,
        ...('column' in profile.amount ? [profile.amount.column] : [profile.amount.out, profile.amount.in]),
        profile.fee,
        profile.currencyColumn,
        ...('out' in profile.payee ? [...profile.payee.out, ...profile.payee.in] : profile.payee),
        ...profile.purpose,
        profile.bookingText,
        profile.state?.column,
        profile.kind?.column,
        profile.internalWhen?.column,
      ].filter((name) => name !== undefined);
      expect(read.filter((name) => forbidden.test(name)), profile.id).toEqual([]);
    }
  });
});
