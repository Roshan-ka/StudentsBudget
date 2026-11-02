import { describe, expect, it } from 'vitest';
import { listed } from './summary';

describe('listed', () => {
  it('joins as English always has: "a", "a and b", "a, b and c"', () => {
    expect(listed([])).toBe('');
    expect(listed(['a'])).toBe('a');
    expect(listed(['a', 'b'])).toBe('a and b');
    expect(listed(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('joins in the given locale', () => {
    expect(listed(['a', 'b', 'c'], 'de-DE')).toBe('a, b und c');
    expect(listed(['a', 'b'], 'fr-FR')).toBe('a et b');
  });
});
