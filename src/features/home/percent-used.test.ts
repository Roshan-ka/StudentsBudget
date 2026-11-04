import { describe, expect, it } from 'vitest';
import { percentUsed } from './percent-used';

describe('percentUsed', () => {
  it('is the share of the plan spent, rounded', () => {
    expect(percentUsed(22000, 7200)).toBe(33);
    expect(percentUsed(66000, 24800)).toBe(38);
  });

  it('stops at full when more is spent than planned', () => {
    expect(percentUsed(6000, 7200)).toBe(100);
  });

  it('reads a plan of €0 as empty without spending and full with it', () => {
    expect(percentUsed(0, 0)).toBe(0);
    expect(percentUsed(0, 500)).toBe(100);
  });

  it('never goes below empty, as with a refund larger than the spending', () => {
    expect(percentUsed(10000, -500)).toBe(0);
  });
});
