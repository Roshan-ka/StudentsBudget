import { describe, expect, it } from 'vitest';
import { TIPS } from '@/data/tips';
import { DEFAULT_LANGUAGE, LANGUAGES, OFFERED, type Language } from '../languages';
import { CITY_WORDS, tipIn, type CityWords } from '.';

/** Every number in a text, without its separators, so "€1,000" and "1.000 €", or "€18.36" and "18,36 €", match. */
function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((number) => number.replace(/[.,]/g, ''));
}

const TRANSLATED = Object.entries(CITY_WORDS) as [Language, CityWords][];
const TIP_IDS = new Set(TIPS.map((tip) => tip.id));

describe('city content in other languages', () => {
  it('translates only tips that exist', () => {
    for (const [code, words] of TRANSLATED) {
      for (const id of Object.keys(words.tips)) expect(TIP_IDS.has(id), `${code}: ${id}`).toBe(true);
    }
  });

  it('keeps every number and the Estimate marker, so a translation never changes a fact', () => {
    for (const [code, words] of TRANSLATED) {
      for (const tip of TIPS) {
        const translated = words.tips[tip.id];
        if (translated === undefined) continue;
        for (const field of ['title', 'body', 'source'] as const) {
          const numbers = numbersIn(translated[field]);
          for (const number of numbersIn(tip[field])) {
            expect(numbers, `${code}: ${tip.id}.${field} keeps ${number}`).toContain(number);
          }
        }
        if (tip.source === 'Estimate') expect(translated.source, `${code}: ${tip.id}`).toBe('Estimate');
      }
    }
  });

  it('puts every tip in its own words, not the English ones', () => {
    for (const [code, words] of TRANSLATED) {
      for (const tip of TIPS) {
        const translated = words.tips[tip.id];
        if (translated === undefined) continue;
        expect(translated.title, `${code}: ${tip.id}`).not.toBe(tip.title);
        expect(translated.body, `${code}: ${tip.id}`).not.toBe(tip.body);
      }
    }
  });

  it('has every tip in every offered language', () => {
    for (const code of OFFERED) {
      if (code === DEFAULT_LANGUAGE) continue;
      for (const tip of TIPS) expect(CITY_WORDS[code]?.tips[tip.id], `${code}: ${tip.id}`).toBeDefined();
    }
  });

  it('shows a tip in its translation, or in English marked as English', () => {
    const tip = TIPS[0];
    expect(tipIn(tip, 'en')).toEqual({ ...tip, textLang: undefined });
    const german = tipIn(tip, 'de');
    expect(german.textLang).toBeUndefined();
    expect(german.title).toBe(CITY_WORDS.de?.tips[tip.id]?.title);
    expect(german.url).toBe(tip.url);
    expect(german.checked).toBe(tip.checked);
    // A language with no city content of its own yet.
    const without = (Object.keys(LANGUAGES) as Language[]).find((code) => code !== 'en' && !CITY_WORDS[code]);
    if (without !== undefined) expect(tipIn(tip, without)).toEqual({ ...tip, textLang: 'en' });
  });
});
