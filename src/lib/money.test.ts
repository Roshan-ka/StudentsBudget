import { describe, expect, it } from 'vitest';
import { CURRENCIES, amountInputText, formatMoney, formatRange, parseAmount } from './money';

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
    for (const bad of ['0,00', '   ', '1,2,3', '6,', '12abc']) {
      expect(parseAmount(bad)).toBeNull();
    }
  });

  it('reads thousands that can’t be misread: dots before a decimal comma, commas before a decimal point, spaces', () => {
    expect(parseAmount('1.234,56')).toBe(123456);
    expect(parseAmount('12.345.678,90')).toBe(1234567890);
    expect(parseAmount('1,200.50')).toBe(120050);
    expect(parseAmount('1 200')).toBe(120000);
    expect(parseAmount('1 200,50')).toBe(120050);
    expect(parseAmount('1 200.50')).toBe(120050);
  });

  it('refuses a bare dot or comma group: "1.200" may be a mistyped "1.20" (review, 09-11-2026)', () => {
    for (const bad of ['1.200', '1,200', '6,505', '1.000.50', '1,000,50', '1.000,000', '1 000.000', '€6']) {
      expect(parseAmount(bad), bad).toBeNull();
    }
    // One or two digits after a dot stay decimals: "1.00" is one euro.
    expect(parseAmount('1.00')).toBe(100);
  });
});

describe('amountInputText', () => {
  it('writes an amount for editing with the language’s decimal mark, which parseAmount reads back', () => {
    expect(amountInputText(650)).toBe('6.50');
    expect(amountInputText(650, 'de-DE')).toBe('6,50');
    expect(amountInputText(650, 'fr-FR')).toBe('6,50');
    expect(amountInputText(600, 'de-DE')).toBe('6');
    expect(amountInputText(123456, 'de-DE')).toBe('1234,56');
    expect(amountInputText(-2550, 'de-DE')).toBe('-25,50');
    for (const locale of ['en-IE', 'de-DE', 'fr-FR', 'es-ES']) {
      expect(parseAmount(amountInputText(123456, locale)), locale).toBe(123456);
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

// The language switch (plan 1, chunk 2): money follows the chosen language; English, the default, stays as it was.
describe('formatMoney and formatRange in another language', () => {
  it('formats in the given locale', () => {
    expect(formatMoney(650, 'EUR', { locale: 'de-DE' })).toBe('6,50\u00a0€');
    expect(formatMoney(6300, 'EUR', { whole: true, locale: 'de-DE' })).toBe('63\u00a0€');
    expect(formatMoney(126350, 'EUR', { locale: 'fr-FR' })).toBe('1\u202f263,50\u00a0€');
  });

  it('keeps a whole figure that rounds to nothing at zero, in any locale', () => {
    expect(formatMoney(-30, 'EUR', { whole: true, locale: 'de-DE' })).toBe('0\u00a0€');
  });

  it('puts the euro sign where the locale puts it, once, on a range', () => {
    expect(formatRange(20000, 26000, 'de-DE')).toBe('200–260\u00a0€');
    expect(formatRange(20000, 26000)).toBe('€200–260');
  });
});
