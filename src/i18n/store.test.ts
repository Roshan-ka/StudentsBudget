import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGE_STORAGE_KEY } from './languages';
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
