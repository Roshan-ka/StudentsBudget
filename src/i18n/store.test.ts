import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGE_STORAGE_KEY, LANGUAGES, OFFERED, type Language } from './languages';
import { applyLanguageToDocument, getLanguageSnapshot, setLanguage, subscribeToLanguage } from './store';

let stored: Record<string, string>;
let documentElement: { lang: string; dir: string };

beforeEach(() => {
  stored = {};
  documentElement = { lang: 'en', dir: 'ltr' };
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored[key] ?? null,
    setItem: (key: string, value: string) => {
      stored[key] = value;
    },
  });
  vi.stubGlobal('navigator', { languages: ['en-GB'], language: 'en-GB' });
  vi.stubGlobal('document', { documentElement });
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the language store', () => {
  it('reads the phone’s language when nothing was chosen', () => {
    expect(getLanguageSnapshot()).toBe('en');
  });

  it('remembers a choice on this phone, sets <html> and tells every subscriber', () => {
    const heard = vi.fn();
    const unsubscribe = subscribeToLanguage(heard);
    setLanguage('en');
    expect(stored[LANGUAGE_STORAGE_KEY]).toBe('en');
    expect(heard).toHaveBeenCalledTimes(1);
    expect(documentElement).toEqual({ lang: 'en', dir: 'ltr' });
    unsubscribe();
    setLanguage('en');
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('puts the language and its direction on <html>', () => {
    documentElement.lang = 'xx';
    documentElement.dir = 'rtl';
    applyLanguageToDocument('en');
    expect(documentElement).toEqual({ lang: 'en', dir: 'ltr' });
  });
});

describe('the language store in a build that lists drafts', () => {
  // A language in the registry that isn't offered yet; none once every one is.
  const draft = (Object.keys(LANGUAGES) as Language[]).find((code) => !OFFERED.includes(code));

  it.skipIf(draft === undefined)('keeps a draft that was chosen, and never takes one from the phone', () => {
    if (draft === undefined) return;
    stored[LANGUAGE_STORAGE_KEY] = draft;
    expect(getLanguageSnapshot()).toBe(draft);
    delete stored[LANGUAGE_STORAGE_KEY];
    vi.stubGlobal('navigator', { languages: [LANGUAGES[draft].locale], language: LANGUAGES[draft].locale });
    expect(getLanguageSnapshot()).toBe('en');
  });

  it('takes an offered language from the phone when nothing was chosen', () => {
    vi.stubGlobal('navigator', { languages: ['de-AT', 'en-GB'], language: 'de-AT' });
    expect(getLanguageSnapshot()).toBe('de');
  });
});
