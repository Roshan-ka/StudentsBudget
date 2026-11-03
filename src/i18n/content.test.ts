import { describe, expect, it } from 'vitest';
import { LANGUAGES, type Language } from './languages';
import { contentLang } from './content';

describe('contentLang', () => {
  it('marks city content as English in every other language, and adds nothing in English', () => {
    expect(contentLang('en')).toBeUndefined();
    for (const lang of Object.keys(LANGUAGES) as Language[]) {
      if (lang !== 'en') expect(contentLang(lang)).toBe('en');
    }
  });
});
