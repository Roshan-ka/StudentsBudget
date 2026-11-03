import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, LANGUAGES, OFFERED, pickLanguage, selectableIn, type Language } from './languages';

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

describe('selectableIn', () => {
  it('lets a production build pick only the offered languages, and any other build every one, to try drafts', () => {
    expect(selectableIn('production')).toEqual(OFFERED);
    expect(selectableIn('development')).toEqual(Object.keys(LANGUAGES));
    expect(selectableIn(undefined)).toEqual(Object.keys(LANGUAGES));
  });
});

describe('pickLanguage with drafts that can be picked', () => {
  const offered: readonly Language[] = ['en'];
  const selectable: readonly Language[] = ['en', 'de'];

  it('keeps a stored choice of a draft that can be picked', () => {
    expect(pickLanguage('de', ['en-GB'], offered, selectable)).toBe('de');
  });

  it('never picks a draft from the phone’s own languages', () => {
    expect(pickLanguage(null, ['de-DE'], offered, selectable)).toBe('en');
    expect(pickLanguage('fr', ['de-DE'], offered, selectable)).toBe('en');
  });
});
