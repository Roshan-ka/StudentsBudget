import { describe, expect, it } from 'vitest';
import { LANGUAGES, OFFERED } from '../languages';
import { MESSAGES } from '.';

/** Every key path in a dictionary, with functions (texts that take values) as leaves. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, inner]) => keyPaths(inner, prefix ? `${prefix}.${key}` : key));
}

describe('the dictionaries', () => {
  it('has one for every language in the registry, each with exactly English’s keys', () => {
    const english = keyPaths(MESSAGES.en).sort();
    for (const code of Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[]) {
      expect(keyPaths(MESSAGES[code]).sort(), code).toEqual(english);
    }
  });

  it('keeps every bottom-navigation label short enough for five side by side at 375 px', () => {
    for (const code of OFFERED) {
      for (const label of Object.values(MESSAGES[code].shell.nav)) {
        expect(label.length, `${code}: ${label}`).toBeLessThanOrEqual(9);
      }
    }
  });
});
