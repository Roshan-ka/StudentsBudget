import { describe, expect, it } from 'vitest';
import { dateFormat, listFormat, numberFormat } from './format';

describe('the shared formatters', () => {
  it('builds each formatter once per locale and options', () => {
    expect(dateFormat('de-DE', { month: 'long' })).toBe(dateFormat('de-DE', { month: 'long' }));
    expect(dateFormat('de-DE', { month: 'long' })).not.toBe(dateFormat('fr-FR', { month: 'long' }));
    expect(numberFormat('en-IE', { style: 'percent' })).toBe(numberFormat('en-IE', { style: 'percent' }));
  });

  it('formats in the locale it is given', () => {
    expect(dateFormat('de-DE', { month: 'long' }).format(new Date(2026, 9, 1))).toBe('Oktober');
    expect(numberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 }).format(0.42)).toBe('42\u00a0%');
    expect(listFormat('es-ES').format(['a', 'b', 'c'])).toBe('a, b y c');
  });
});
