import { describe, expect, it } from 'vitest';
import { guessDateOrder, parseStatementDate } from './dates';

describe('parseStatementDate', () => {
  it('reads the day first with a two- or four-digit year (Sparkasse, DKB, a spreadsheet)', () => {
    expect(parseStatementDate('30.10.26', 'dmy')).toBe('2026-10-30');
    expect(parseStatementDate('31.10.2022', 'dmy')).toBe('2022-10-31');
    expect(parseStatementDate('1.2.2026', 'dmy')).toBe('2026-02-01');
    expect(parseStatementDate('01/11/2026', 'dmy')).toBe('2026-11-01');
  });

  it('reads the year first, with a time after it (N26, Revolut)', () => {
    expect(parseStatementDate('2026-11-02', 'ymd')).toBe('2026-11-02');
    expect(parseStatementDate('2026-11-03 08:00:00', 'ymd')).toBe('2026-11-03');
    expect(parseStatementDate('2026-11-03T08:00:00Z', 'ymd')).toBe('2026-11-03');
  });

  it('reads the month first only when asked', () => {
    expect(parseStatementDate('11/02/2026', 'mdy')).toBe('2026-11-02');
    expect(parseStatementDate('11/02/2026', 'dmy')).toBe('2026-02-11');
  });

  it('refuses a day that does not exist, and what is not a date in that order', () => {
    for (const [text, order] of [
      ['31.02.26', 'dmy'],
      ['32.01.2026', 'dmy'],
      ['2026-13-01', 'ymd'],
      ['2026-11-02', 'dmy'],
      ['02.11.2026', 'ymd'],
      ['', 'dmy'],
      ['Tagessaldo', 'dmy'],
    ] as const) {
      expect(parseStatementDate(text, order)).toBeNull();
    }
  });
});

describe('guessDateOrder', () => {
  it('is year first when every date is', () => {
    expect(guessDateOrder(['2026-11-02', '2026-10-31 09:00:00'], 'dmy')).toBe('ymd');
  });

  it('is day first when a first part is over 12, month first when a second part is', () => {
    expect(guessDateOrder(['02.11.2026', '31.10.2026'], 'ymd')).toBe('dmy');
    expect(guessDateOrder(['11/02/2026', '10/31/2026'], 'dmy')).toBe('mdy');
  });

  it('keeps the expected order when the dates fit either, day first for one that expected the year first', () => {
    expect(guessDateOrder(['02.11.2026', '01.11.2026'], 'mdy')).toBe('mdy');
    expect(guessDateOrder(['02.11.2026'], 'ymd')).toBe('dmy');
    expect(guessDateOrder(['', ''], 'ymd')).toBe('ymd');
  });
});
