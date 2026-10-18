import { describe, expect, it } from 'vitest';
import { parseOpeningBalance } from './opening-balance';

describe('parseOpeningBalance', () => {
  it('treats an empty field as 0, so a new wallet is valid', () => {
    expect(parseOpeningBalance('')).toBe(0);
    expect(parseOpeningBalance('   ')).toBe(0);
  });

  it('treats zero in any spelling as 0', () => {
    expect(parseOpeningBalance('0')).toBe(0);
    expect(parseOpeningBalance('00')).toBe(0);
    expect(parseOpeningBalance('0.0')).toBe(0);
    expect(parseOpeningBalance('0,00')).toBe(0);
  });

  it('parses positive amounts with a dot or a comma', () => {
    expect(parseOpeningBalance('250')).toBe(25000);
    expect(parseOpeningBalance(' 12,50 ')).toBe(1250);
    expect(parseOpeningBalance('12.5')).toBe(1250);
    expect(parseOpeningBalance('50000')).toBe(5000000);
  });

  it('rejects negatives, text and more than two decimals', () => {
    expect(parseOpeningBalance('-5')).toBeNull();
    expect(parseOpeningBalance('abc')).toBeNull();
    expect(parseOpeningBalance('1.234')).toBeNull();
    expect(parseOpeningBalance('0.001')).toBeNull();
    expect(parseOpeningBalance('1e3')).toBeNull();
  });
});
