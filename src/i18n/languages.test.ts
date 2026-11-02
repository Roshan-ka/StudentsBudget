import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, LANGUAGES, OFFERED, pickLanguage, type Language } from './languages';

describe('the language registry', () => {
  it('gives every language a valid locale of its own, its name in itself, and a writing direction', () => {
    for (const [code, info] of Object.entries(LANGUAGES)) {
      expect(Intl.getCanonicalLocales(info.locale)).toEqual([info.locale]);
      expect(info.locale.split('-')[0]).toBe(code);
      expect(info.name.length).toBeGreaterThan(0);
      expect(['ltr', 'rtl']).toContain(info.dir);
    }
  });

  it('offers only languages it knows, the default first', () => {
    expect(OFFERED[0]).toBe(DEFAULT_LANGUAGE);
    for (const code of OFFERED) expect(Object.keys(LANGUAGES)).toContain(code);
  });
});

describe('pickLanguage', () => {
  const offered: readonly Language[] = ['en', 'de'];

  it('keeps a stored choice it offers', () => {
    expect(pickLanguage('de', ['en-GB'], offered)).toBe('de');
  });

  it('ignores a stored choice it doesn’t offer, and goes by the phone’s languages', () => {
    expect(pickLanguage('fr', ['de-AT', 'en'], offered)).toBe('de');
    expect(pickLanguage('nonsense', ['de-AT'], offered)).toBe('de');
  });

  it('takes the first of the phone’s languages it offers, by its main part, in any case', () => {
    expect(pickLanguage(null, ['fr-CA', 'DE-de', 'en'], offered)).toBe('de');
  });

  it('falls back to the default when nothing matches', () => {
    expect(pickLanguage(null, ['fr-CA', 'ja'], offered)).toBe(DEFAULT_LANGUAGE);
    expect(pickLanguage(null, [], offered)).toBe(DEFAULT_LANGUAGE);
  });
});
