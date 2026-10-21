import { describe, expect, it } from 'vitest';
import { CURRENCIES, formatMoney, formatRange, parseAmount } from './money';

describe('parseAmount', () => {
  it('parses whole and decimal amounts into minor units', () => {
    expect(parseAmount('6')).toBe(600);
    expect(parseAmount('6,50')).toBe(650);
    expect(parseAmount('6.5')).toBe(650);
    expect(parseAmount('1234,56')).toBe(123456);
  });

  it('rounds exactly where float multiplication would drift', () => {
    expect(parseAmount('0.29')).toBe(29);
    expect(parseAmount('1.15')).toBe(115);
    expect(parseAmount('19.99')).toBe(1999);
  });

  it('trims surrounding whitespace', () => {
    expect(parseAmount(' 6,50 ')).toBe(650);
  });

  it('returns null when the minor amount is not a safe integer', () => {
    expect(parseAmount('99999999999999999999')).toBeNull();
  });

  it('returns null for zero, negatives, empty, non-numeric and over-precise input', () => {
    for (const bad of ['0', '-5', 'abc', '6,505', '']) {
      expect(parseAmount(bad)).toBeNull();
    }
    for (const bad of ['0,00', '   ', '1,2,3', '1.234,56', '6,', '12abc']) {
      expect(parseAmount(bad)).toBeNull();
    }
  });
});

describe('formatMoney', () => {
  it('formats with two decimals by default', () => {
    expect(formatMoney(650, 'EUR')).toBe('€6.50');
  });

  it('drops decimals with { whole: true }', () => {
    expect(formatMoney(6300, 'EUR', { whole: true })).toBe('€63');
  });

  it('formats other currencies', () => {
    expect(formatMoney(100000, 'INR')).toContain('1,000.00');
  });

  it('puts the minus in front of a negative amount', () => {
    expect(formatMoney(-20000, 'EUR', { whole: true })).toBe('-€200');
    expect(formatMoney(-25000, 'EUR')).toBe('-€250.00');
    expect(formatMoney(-20, 'EUR')).toBe('-€0.20');
  });

  it('shows 0, never "-€0", for a whole figure that rounds to nothing', () => {
    for (const minor of [-1, -20, -49, 0, 20, 49]) {
      expect(formatMoney(minor, 'EUR', { whole: true }), String(minor)).toBe('€0');
    }
    expect(formatMoney(-30, 'INR', { whole: true })).toBe(formatMoney(0, 'INR', { whole: true }));
    // Half a euro rounds away from zero on both sides, and from there up the sign stays.
    expect(formatMoney(-50, 'EUR', { whole: true })).toBe('-€1');
    expect(formatMoney(50, 'EUR', { whole: true })).toBe('€1');
    expect(formatMoney(-51, 'EUR', { whole: true })).toBe('-€1');
    expect(formatMoney(-100, 'EUR', { whole: true })).toBe('-€1');
    expect(formatMoney(51, 'EUR', { whole: true })).toBe('€1');
  });
});

describe('formatRange', () => {
  it('shows whole euros with a single euro sign and an en dash', () => {
    expect(formatRange(20000, 26000)).toBe('€200–260');
  });
});

describe('CURRENCIES', () => {
  it('lists the seven supported codes, EUR first', () => {
    expect(CURRENCIES).toEqual(['EUR', 'INR', 'USD', 'GBP', 'CHF', 'CNY', 'TRY']);
  });
});
