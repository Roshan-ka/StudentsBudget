import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, LANGUAGES, OFFERED, type Language } from '../languages';
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

/**
 * Texts a language shares with English on purpose, by language: words that are the same, a name, and a bare format.
 * Every language with a dictionary of its own has an entry, even an empty one.
 */
const SAME_AS_ENGLISH: Partial<Record<Language, ReadonlySet<string>>> = {
  de: new Set([
    'common.accountOption',
    'common.dateField.letters.month',
    'home.leftThisMonth.overThisMonth.before',
    'categories.income-bafoeg',
    'setup.accounts.name',
    'setup.accounts.bank',
    'setup.oneOffs.name',
    'setup.lines.range',
    'setup.editPlan.heading',
    'shell.headings.plan',
    'accounts.name',
    'accounts.kinds.bank',
    'accounts.rates.rate',
    'backup.heading',
    'auth.signedIn.as.after',
    'auth.passkeys.heading',
    'auth.passkeys.unnamed',
    'badges.tiers.bronze',
    'badges.tiers.gold',
  ]),
  es: new Set([
    'common.accountOption',
    'home.leftThisMonth.overThisMonth.before',
    'common.dateField.letters.day',
    'common.dateField.letters.month',
    'categories.income-bafoeg',
    'setup.lines.range',
    'setup.editPlan.heading',
    'shell.headings.plan',
    'accounts.total',
    'accounts.rates.rate',
    'backup.restore.question.after',
    'auth.secondStep.prompt.after',
    'auth.signedIn.as.after',
  ]),
  fr: new Set([
    'common.accountOption',
    'home.leftThisMonth.overThisMonth.before',
    'common.dateField.label',
    'common.dateField.letters.month',
    'common.source.label',
    'categories.income-bafoeg',
    'categories.income-parents',
    'shell.headings.badges',
    'entries.form.note',
    'setup.accounts.type',
    'setup.editPlan.heading',
    'shell.headings.plan',
    'accounts.type',
    'accounts.total',
    'accounts.rates.rate',
    'auth.secondStep.prompt.after',
    'auth.signedIn.as.after',
    'charts.income.source',
    'badges.tiers.bronze',
    'badges.card.heading',
  ]),
};

/** Every language besides English with a dictionary of its own; a draft has English underneath its unwritten areas. */
const WRITTEN = (Object.keys(LANGUAGES) as Language[]).filter(
  (code) => code !== DEFAULT_LANGUAGE && MESSAGES[code] !== MESSAGES.en,
);

describe('the dictionaries', () => {
  it('has one for every language in the registry, each with exactly English’s keys', () => {
    const english = keyPaths(MESSAGES.en).sort();
    for (const code of Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[]) {
      expect(keyPaths(MESSAGES[code]).sort(), code).toEqual(english);
    }
  });

  it('gives every offered language its own text in every area, with no English underneath', () => {
    for (const code of OFFERED) {
      if (code === DEFAULT_LANGUAGE) continue;
      for (const area of Object.keys(MESSAGES.en) as (keyof Messages)[]) {
        expect(MESSAGES[code][area], `${code}.${area}`).not.toBe(MESSAGES.en[area]);
      }
    }
  });

  it('has its own text for every text of the areas a language has written, apart from what is the same in both', () => {
    const { en } = MESSAGES;
    const all = new Set([...texts(en, 'x')].map(([path]) => path.slice(2)));
    for (const code of WRITTEN) {
      const same = SAME_AS_ENGLISH[code];
      expect(same, `${code} needs an entry in SAME_AS_ENGLISH`).toBeDefined();
      for (const area of Object.keys(en) as (keyof Messages)[]) {
        // Not written yet: a draft has English underneath (src/i18n/messages/<code>/index.ts).
        if (MESSAGES[code][area] === en[area]) continue;
        const own = texts(MESSAGES[code][area], area);
        for (const [path, english] of texts(en[area], area)) {
          if (!same?.has(path)) expect(own.get(path), `${code}: ${path}`).not.toBe(english);
        }
      }
      // An allow-listed text that no longer exists is a stale entry.
      for (const path of same ?? []) expect(all.has(path), `${code}: ${path}`).toBe(true);
    }
  });

  it("counts by each language's own plural rules", () => {
    // Spanish counts 0 as plural, as English does; French counts it as singular.
    expect(MESSAGES.es.common.counts.accounts(0)).toBe('0 cuentas');
    expect(MESSAGES.es.common.counts.accounts(1)).toBe('1 cuenta');
    expect(MESSAGES.es.common.counts.entries(2)).toBe('2 registros');
    expect(MESSAGES.fr.common.counts.accounts(0)).toBe('0 compte');
    expect(MESSAGES.fr.common.counts.accounts(1)).toBe('1 compte');
    expect(MESSAGES.fr.common.counts.entries(2)).toBe('2 saisies');
  });

  it('puts the narrow no-break space French needs before : ; ? ! and inside « »', () => {
    const { en, fr } = MESSAGES;
    for (const area of Object.keys(en) as (keyof Messages)[]) {
      if (fr[area] === en[area]) continue;
      for (const [path, text] of texts(fr[area], area)) {
        expect(text, path).not.toMatch(/(^|[^ ])[:;?!]/);
        expect(text, path).not.toMatch(/«[^ ]|[^ ]»/);
      }
    }
  });

  it('keeps every bottom-navigation label short enough for five side by side at 375 px, drafts included', () => {
    for (const code of Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[]) {
      for (const label of Object.values(MESSAGES[code].shell.nav)) {
        expect(label.length, `${code}: ${label}`).toBeLessThanOrEqual(9);
      }
    }
  });
});
