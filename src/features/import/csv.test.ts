import { describe, expect, it } from 'vitest';
import { cellKey, parseCsv } from './csv';

describe('parseCsv', () => {
  it('splits rows and fields, with CRLF, LF or CR line ends, and leaves blank lines out', () => {
    expect(parseCsv('a;b\r\nc;d\n\ne;f\rg;h', ';')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
      ['g', 'h'],
    ]);
  });

  it('reads quoted fields with the separator, a line break and doubled quotes inside', () => {
    expect(parseCsv('"REWE; Markt";"Miete\r\nNovember";"Er sagte ""Danke"""\n', ';')).toEqual([
      ['REWE; Markt', 'Miete\r\nNovember', 'Er sagte "Danke"'],
    ]);
  });

  it('keeps empty fields, quoted or not, and a row of separators', () => {
    expect(parseCsv('"";x;\n;;', ';')).toEqual([
      ['', 'x', ''],
      ['', '', ''],
    ]);
  });

  it('reads N26-style uneven quoting: some fields bare, some quoted', () => {
    expect(parseCsv('"Booking Date",Type,"Amount (EUR)"\n2026-10-31,Presentment,-13.99\n', ',')).toEqual([
      ['Booking Date', 'Type', 'Amount (EUR)'],
      ['2026-10-31', 'Presentment', '-13.99'],
    ]);
  });

  it('reads a last line without a line end', () => {
    expect(parseCsv('a,b\nc,d', ',')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(parseCsv('', ',')).toEqual([]);
  });
});

describe('cellKey', () => {
  it('compares header names trimmed, with spaces collapsed, in any case', () => {
    expect(cellKey('  Booking   Date ')).toBe('booking date');
    expect(cellKey('Betrag (€)')).toBe(cellKey('betrag (€)'));
  });
});
