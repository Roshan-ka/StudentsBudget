import { describe, expect, it } from 'vitest';
import {
  isNegativeText,
  isOverdrawn,
  parseOptionalAmount,
  parseSignedAmount,
  tickOverdrawn,
  typeOpening,
} from './opening-balance';

describe('parseOptionalAmount', () => {
  it('treats an empty field as 0, so a new wallet is valid', () => {
    expect(parseOptionalAmount('')).toBe(0);
    expect(parseOptionalAmount('   ')).toBe(0);
  });

  it('treats zero in any spelling as 0', () => {
    expect(parseOptionalAmount('0')).toBe(0);
    expect(parseOptionalAmount('00')).toBe(0);
    expect(parseOptionalAmount('0.0')).toBe(0);
    expect(parseOptionalAmount('0,00')).toBe(0);
  });

  it('parses positive amounts with a dot or a comma', () => {
    expect(parseOptionalAmount('250')).toBe(25000);
    expect(parseOptionalAmount(' 12,50 ')).toBe(1250);
    expect(parseOptionalAmount('12.5')).toBe(1250);
    expect(parseOptionalAmount('50000')).toBe(5000000);
  });

  it('rejects negatives, text and more than two decimals', () => {
    expect(parseOptionalAmount('-5')).toBeNull();
    expect(parseOptionalAmount('abc')).toBeNull();
    expect(parseOptionalAmount('1.234')).toBeNull();
    expect(parseOptionalAmount('0.001')).toBeNull();
    expect(parseOptionalAmount('1e3')).toBeNull();
  });
});

describe('parseSignedAmount', () => {
  it('reads what parseOptionalAmount reads', () => {
    expect(parseSignedAmount('')).toBe(0);
    expect(parseSignedAmount('0,00')).toBe(0);
    expect(parseSignedAmount(' 12,50 ')).toBe(1250);
    expect(parseSignedAmount('250')).toBe(25000);
  });

  it('reads a minus sign in front as an amount below zero', () => {
    expect(parseSignedAmount('-250')).toBe(-25000);
    expect(parseSignedAmount(' -12,50 ')).toBe(-1250);
    expect(parseSignedAmount('-12.5')).toBe(-1250);
    expect(parseSignedAmount('-0.05')).toBe(-5);
  });

  it('reads the typographic minus too, and a space after the sign', () => {
    expect(parseSignedAmount('−250')).toBe(-25000);
    expect(parseSignedAmount('- 250')).toBe(-25000);
  });

  it('reads "-0" as 0, never as -0', () => {
    expect(Object.is(parseSignedAmount('-0'), 0)).toBe(true);
    expect(Object.is(parseSignedAmount('-0,00'), 0)).toBe(true);
  });

  it('rejects a minus with no amount, text, a second sign and more than two decimals', () => {
    expect(parseSignedAmount('-')).toBeNull();
    expect(parseSignedAmount('- ')).toBeNull();
    expect(parseSignedAmount('--5')).toBeNull();
    expect(parseSignedAmount('+5')).toBeNull();
    expect(parseSignedAmount('-abc')).toBeNull();
    expect(parseSignedAmount('-1.234')).toBeNull();
    expect(parseSignedAmount('5-')).toBeNull();
  });
});

describe('isNegativeText', () => {
  it('is true for a leading minus, whatever surrounds it', () => {
    expect(isNegativeText('-250')).toBe(true);
    expect(isNegativeText('  -2')).toBe(true);
    expect(isNegativeText('-')).toBe(true);
    expect(isNegativeText('−2')).toBe(true);
  });

  it('is false for an amount without one, an empty field and text', () => {
    expect(isNegativeText('250')).toBe(false);
    expect(isNegativeText('')).toBe(false);
    expect(isNegativeText('5-')).toBe(false);
  });
});

describe('the Overdrawn checkbox', () => {
  it('puts a minus in front of the amount when ticked, and takes it away when cleared', () => {
    expect(tickOverdrawn('250', true)).toEqual({ text: '-250', waiting: false });
    expect(tickOverdrawn('-250', false)).toEqual({ text: '250', waiting: false });
    expect(tickOverdrawn('12,50', true)).toEqual({ text: '-12,50', waiting: false });
  });

  it('does not double a minus that is already there', () => {
    expect(tickOverdrawn('-250', true)).toEqual({ text: '-250', waiting: false });
    expect(tickOverdrawn('250', false)).toEqual({ text: '250', waiting: false });
  });

  it('waits for the amount when ticked on an empty field, and forgets the tick when cleared', () => {
    expect(tickOverdrawn('', true)).toEqual({ text: '', waiting: true });
    expect(tickOverdrawn('  ', true)).toEqual({ text: '', waiting: true });
    expect(tickOverdrawn('-', true)).toEqual({ text: '', waiting: true });
    expect(tickOverdrawn('', false)).toEqual({ text: '', waiting: false });
  });

  it('treats a bare 0 like an empty field, so a tick never makes "-0"', () => {
    expect(tickOverdrawn('0', true)).toEqual({ text: '', waiting: true });
    expect(tickOverdrawn('00', true)).toEqual({ text: '', waiting: true });
    expect(tickOverdrawn('0.00', true)).toEqual({ text: '', waiting: true });
    expect(tickOverdrawn(' 0,0 ', true)).toEqual({ text: '', waiting: true });
    // Anything else with a 0 in it is an amount.
    expect(tickOverdrawn('0.5', true)).toEqual({ text: '-0.5', waiting: false });
    expect(tickOverdrawn('10', true)).toEqual({ text: '-10', waiting: false });
    // Clearing the box on a bare 0 leaves it as it is.
    expect(tickOverdrawn('0', false)).toEqual({ text: '0', waiting: false });
  });

  it('gives a waiting tick to the first thing typed', () => {
    expect(typeOpening('2', true)).toEqual({ text: '-2', waiting: false });
    expect(typeOpening('250', true)).toEqual({ text: '-250', waiting: false });
  });

  it('keeps waiting while nothing is typed, and keeps the text as typed when nothing waits', () => {
    expect(typeOpening('', true)).toEqual({ text: '', waiting: true });
    expect(typeOpening('  ', true)).toEqual({ text: '  ', waiting: true });
    expect(typeOpening('250', false)).toEqual({ text: '250', waiting: false });
    expect(typeOpening('-250', false)).toEqual({ text: '-250', waiting: false });
  });

  it('lets a waiting tick take a minus the person types themselves', () => {
    expect(typeOpening('-', true)).toEqual({ text: '-', waiting: false });
    expect(typeOpening('-2', true)).toEqual({ text: '-2', waiting: false });
  });

  it('shows ticked for a minus in the text or a tick that is waiting', () => {
    expect(isOverdrawn('-250', false)).toBe(true);
    expect(isOverdrawn('', true)).toBe(true);
    expect(isOverdrawn('250', false)).toBe(false);
    expect(isOverdrawn('', false)).toBe(false);
  });

  it('turns a ticked box and the amount typed after it into a negative amount', () => {
    const ticked = tickOverdrawn('', true);
    const typed = typeOpening('250', ticked.waiting);

    expect(parseSignedAmount(typed.text)).toBe(-25000);
    expect(isOverdrawn(typed.text, typed.waiting)).toBe(true);
    // Clearing the box makes the amount positive again.
    expect(parseSignedAmount(tickOverdrawn(typed.text, false).text)).toBe(25000);
  });
});
