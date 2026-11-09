import { describe, expect, it } from 'vitest';
import { guessDecimalMark, parseStatementAmount } from './amounts';

describe('parseStatementAmount', () => {
  it('reads a decimal comma with dots between thousands (Sparkasse, DKB)', () => {
    expect(parseStatementAmount('-23,45', ',')).toBe(-2345);
    expect(parseStatementAmount('934,00', ',')).toBe(93400);
    expect(parseStatementAmount('-1.250,00', ',')).toBe(-125000);
    expect(parseStatementAmount('100.000,00 €', ',')).toBe(10000000);
    expect(parseStatementAmount('-10,22 €', ',')).toBe(-1022);
    expect(parseStatementAmount('1.234,56 EUR', ',')).toBe(123456);
  });

  it('reads a decimal point with commas between thousands (N26, Revolut)', () => {
    expect(parseStatementAmount('-7.95', '.')).toBe(-795);
    expect(parseStatementAmount('300.00', '.')).toBe(30000);
    expect(parseStatementAmount('1,234.5', '.')).toBe(123450);
    expect(parseStatementAmount('-3.5', '.')).toBe(-350);
  });

  it('reads a whole amount, a plus, a Unicode minus, a trailing minus, brackets and spaces between thousands', () => {
    expect(parseStatementAmount('50', ',')).toBe(5000);
    expect(parseStatementAmount('+12,30', ',')).toBe(1230);
    expect(parseStatementAmount('−12,30', ',')).toBe(-1230);
    expect(parseStatementAmount('12,30-', ',')).toBe(-1230);
    expect(parseStatementAmount('(12.30)', '.')).toBe(-1230);
    expect(parseStatementAmount('1 006,50 €', ',')).toBe(100650);
  });

  it('takes a third decimal only when it is a zero, and zero as zero', () => {
    expect(parseStatementAmount('12.500', '.')).toBe(1250);
    expect(parseStatementAmount('12.345', '.')).toBeNull();
    expect(parseStatementAmount('-0,00', ',')).toBe(0);
    expect(Object.is(parseStatementAmount('-0,00', ','), -0)).toBe(false);
  });

  it('refuses what is not an amount', () => {
    for (const text of ['', '-', 'abc', '12,3,4', '1.2.3', '12 Euro 50', '--5']) {
      expect(parseStatementAmount(text, ',')).toBeNull();
    }
    expect(parseStatementAmount('99999999999999999999', ',')).toBeNull();
  });
});

describe('guessDecimalMark', () => {
  it('goes by the mark before the last one or two digits', () => {
    expect(guessDecimalMark(['-7,95', '-13,99'], '.')).toBe(',');
    expect(guessDecimalMark(['-7.95', '1,234.50'], ',')).toBe('.');
    expect(guessDecimalMark(['-10,22 €', '100.000,00 €'], '.')).toBe(',');
  });

  it('keeps the expected mark when the values say nothing', () => {
    expect(guessDecimalMark(['50', '100', ''], '.')).toBe('.');
    expect(guessDecimalMark([], ',')).toBe(',');
  });
});
