import { describe, expect, it } from 'vitest';
import { contentsOf, listed } from './summary';

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

describe('contentsOf', () => {
  it('counts the accounts and entries, and names the plan', () => {
    expect(contentsOf(3, 42, true)).toBe('3 accounts, 42 entries and your plan');
    expect(contentsOf(1, 1, false)).toBe('1 account and 1 entry');
  });

  it("joins the parts the language's way", () => {
    expect(contentsOf(3, 42, true, 'de')).toContain(' und ');
  });
});
