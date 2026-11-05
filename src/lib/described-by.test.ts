import { describe, expect, it } from 'vitest';
import { describedBy } from './described-by';

describe('describedBy', () => {
  it('joins the ids that apply, in order', () => {
    expect(describedBy('amount-currency', 'amount-error')).toBe('amount-currency amount-error');
  });

  it('leaves out what does not apply', () => {
    expect(describedBy('hint', false, null, undefined, '', 'error')).toBe('hint error');
  });

  it('is undefined when nothing applies, so the attribute is left out', () => {
    expect(describedBy(false, null, undefined)).toBeUndefined();
    expect(describedBy()).toBeUndefined();
  });
});
