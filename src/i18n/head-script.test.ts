import { describe, expect, it } from 'vitest';
import { languageHeadScript } from './head-script';
import { LANGUAGE_STORAGE_KEY, pickLanguage, type Language } from './languages';

type Run = { stored?: string | null; browser?: string[]; storageThrows?: boolean };

/** Runs the head script against a stand-in browser and returns what it set on <html>. */
function run(offered: readonly Language[], { stored = null, browser = [], storageThrows = false }: Run) {
  const documentElement = { lang: 'en', dir: 'ltr' };
  const localStorage = {
    getItem(key: string) {
      if (storageThrows) throw new Error('blocked');
      return key === LANGUAGE_STORAGE_KEY ? stored : null;
    },
  };
  const navigator = { languages: browser, language: browser[0] };
  new Function('document', 'localStorage', 'navigator', languageHeadScript(offered))(
    { documentElement },
    localStorage,
    navigator,
  );
  return documentElement;
}

describe('languageHeadScript', () => {
  const offered: readonly Language[] = ['en', 'de'];

  it('sets <html lang> and dir before paint, as pickLanguage decides', () => {
    const cases: Run[] = [
      { stored: 'de', browser: ['en-GB'] },
      { stored: null, browser: ['fr-CA', 'de-AT'] },
      { stored: 'xx', browser: ['ja'] },
      { stored: null, browser: [] },
    ];
    for (const c of cases) {
      const expected = pickLanguage(c.stored ?? null, c.browser ?? [], offered);
      expect(run(offered, c)).toEqual({ lang: expected, dir: 'ltr' });
    }
  });

  it('leaves the page as rendered when storage can’t be read', () => {
    expect(run(offered, { storageThrows: true, browser: ['de'] })).toEqual({ lang: 'en', dir: 'ltr' });
  });

  it('offers only what it is given: a language not offered is never picked', () => {
    expect(run(['en'], { stored: 'de', browser: ['de-DE'] })).toEqual({ lang: 'en', dir: 'ltr' });
  });
});

describe('languageHeadScript with drafts that can be picked', () => {
  /** As `run`, with a list of languages that can be picked besides the offered ones. */
  function runWith(offered: readonly Language[], selectable: readonly Language[], c: Run) {
    const documentElement = { lang: 'en', dir: 'ltr' };
    const localStorage = { getItem: (key: string) => (key === LANGUAGE_STORAGE_KEY ? (c.stored ?? null) : null) };
    const browser = c.browser ?? [];
    new Function('document', 'localStorage', 'navigator', languageHeadScript(offered, selectable))(
      { documentElement },
      localStorage,
      { languages: browser, language: browser[0] },
    );
    return documentElement;
  }

  it('keeps a stored draft, and never picks one from the phone’s languages, as pickLanguage does', () => {
    expect(runWith(['en'], ['en', 'de'], { stored: 'de', browser: ['en-GB'] })).toEqual({ lang: 'de', dir: 'ltr' });
    expect(runWith(['en'], ['en', 'de'], { stored: null, browser: ['de-DE'] })).toEqual({ lang: 'en', dir: 'ltr' });
  });
});
