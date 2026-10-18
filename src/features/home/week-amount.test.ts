import { describe, expect, it } from 'vitest';
import { formatWeekAmount } from './week-amount';

describe('formatWeekAmount', () => {
  it('shows whole euros', () => {
    expect(formatWeekAmount(4200)).toEqual({ text: '€42', over: false });
    expect(formatWeekAmount(-26400)).toEqual({ text: '€264', over: true });
  });

  it('keeps the cents of a non-zero amount that would round to €0', () => {
    expect(formatWeekAmount(-40)).toEqual({ text: '€0.40', over: true });
    expect(formatWeekAmount(-49)).toEqual({ text: '€0.49', over: true });
    expect(formatWeekAmount(-1)).toEqual({ text: '€0.01', over: true });
    expect(formatWeekAmount(40)).toEqual({ text: '€0.40', over: false });
    expect(formatWeekAmount(49)).toEqual({ text: '€0.49', over: false });
  });

  it('rounds from 50 cents up to a whole euro', () => {
    expect(formatWeekAmount(-50)).toEqual({ text: '€1', over: true });
    expect(formatWeekAmount(50)).toEqual({ text: '€1', over: false });
  });

  it('shows exactly zero as €0, never as over', () => {
    expect(formatWeekAmount(0)).toEqual({ text: '€0', over: false });
  });
});
