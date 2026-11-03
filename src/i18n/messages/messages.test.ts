import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../languages';
import { MESSAGES, type Messages } from '.';

/** Every key path in a dictionary, with functions (texts that take values) as leaves. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, inner]) => keyPaths(inner, prefix ? `${prefix}.${key}` : key));
}

/** Every text of a dictionary by its path: a string as it is, a text that takes values as it reads with "A", "B"…. */
function texts(value: unknown, prefix: string): Map<string, string> {
  if (typeof value === 'string') return new Map([[prefix, value]]);
  if (typeof value === 'function') {
    const sample = Array.from({ length: value.length }, (_, i) => String.fromCharCode(65 + i));
    return new Map([[prefix, String((value as (...args: string[]) => unknown)(...sample))]]);
  }
  if (typeof value !== 'object' || value === null) return new Map();
  return new Map(Object.entries(value).flatMap(([key, inner]) => [...texts(inner, `${prefix}.${key}`)]));
}

/** Texts German shares with English on purpose: words that are the same, a name, and a bare format. */
const SAME_IN_GERMAN = new Set([
  'common.accountOption',
  'categories.income-bafoeg',
  'setup.accounts.name',
  'setup.accounts.bank',
  'setup.oneOffs.name',
  'setup.lines.range',
  'setup.editPlan.heading',
  'accounts.name',
  'accounts.kinds.bank',
  'accounts.rates.rate',
  'backup.heading',
  'auth.signedIn.as.after',
  'auth.passkeys.heading',
  'auth.passkeys.unnamed',
  'badges.tiers.bronze',
  'badges.tiers.gold',
]);

describe('the dictionaries', () => {
  it('has one for every language in the registry, each with exactly English’s keys', () => {
    const english = keyPaths(MESSAGES.en).sort();
    for (const code of Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[]) {
      expect(keyPaths(MESSAGES[code]).sort(), code).toEqual(english);
    }
  });

  it('has German for every text of the areas written in German so far, apart from what is the same in both', () => {
    const { en, de } = MESSAGES;
    for (const area of Object.keys(en) as (keyof Messages)[]) {
      // Not written yet: the draft has English underneath (src/i18n/messages/de/index.ts).
      if (de[area] === en[area]) continue;
      const german = texts(de[area], area);
      for (const [path, english] of texts(en[area], area)) {
        if (!SAME_IN_GERMAN.has(path)) expect(german.get(path), path).not.toBe(english);
      }
    }
    // An allow-listed text that no longer exists is a stale entry.
    const all = new Set([...texts(en, 'x')].map(([path]) => path.slice(2)));
    for (const path of SAME_IN_GERMAN) expect(all.has(path), path).toBe(true);
  });

  it('keeps every bottom-navigation label short enough for five side by side at 375 px, drafts included', () => {
    for (const code of Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[]) {
      for (const label of Object.values(MESSAGES[code].shell.nav)) {
        expect(label.length, `${code}: ${label}`).toBeLessThanOrEqual(9);
      }
    }
  });
});
