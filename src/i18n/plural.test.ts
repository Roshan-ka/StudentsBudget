import { describe, expect, it } from 'vitest';
import { plural } from './plural';

describe('plural', () => {
  it('picks English one or other', () => {
    expect(plural('en-IE', 1, { one: 'entry', other: 'entries' })).toBe('entry');
    expect(plural('en-IE', 0, { one: 'entry', other: 'entries' })).toBe('entries');
    expect(plural('en-IE', 2, { one: 'entry', other: 'entries' })).toBe('entries');
  });

  it('follows the language’s own rules: French treats 0 as one', () => {
    expect(plural('fr-FR', 0, { one: 'entrée', other: 'entrées' })).toBe('entrée');
  });

  it('uses a form the language has, and falls back to other when it isn’t given', () => {
    // Spanish has a `many` form for a million and up.
    expect(plural('es-ES', 1_000_000, { one: 'a', many: 'b', other: 'c' })).toBe('b');
    expect(plural('es-ES', 1_000_000, { one: 'a', other: 'c' })).toBe('c');
    // Polish has `few` (2–4) and `many` (5+): any language's forms work with no new code.
    expect(plural('pl-PL', 3, { one: 'wpis', few: 'wpisy', many: 'wpisów', other: 'wpisu' })).toBe('wpisy');
    expect(plural('pl-PL', 5, { one: 'wpis', few: 'wpisy', many: 'wpisów', other: 'wpisu' })).toBe('wpisów');
  });
});
