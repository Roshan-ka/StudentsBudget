import { describe, expect, it } from 'vitest';
import { CITIES } from '@/data/cities';
import { DISCOUNTS } from '@/data/discounts';
import { SEMESTER_FEES, SEMESTER_PERIODS } from '@/data/semesters';
import { SWAPS } from '@/data/swaps';
import { TIPS } from '@/data/tips';
import { DEFAULT_LANGUAGE, LANGUAGES, OFFERED, type Language } from '../languages';
import { CITY_WORDS, discountIn, feePartIn, periodIn, rangeIn, swapIn, tipIn, type CityWords } from '.';

/**
 * Every number in a text, without its separators, so "€1,000", "1.000 €" and French "1 000 €" (a narrow no-break
 * space), or "€18.36" and "18,36 €", match.
 */
function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,  ]\d+)*/g) ?? []).map((number) => number.replace(/[.,  ]/g, ''));
}

/** Every text a language's city content gives: each item's words and the semester texts. */
function allTexts(words: CityWords): string[] {
  const items = [words.tips, words.discounts, words.swaps, words.ranges].flatMap((kind) => Object.values(kind));
  const fields = items.flatMap((item) => Object.values(item ?? {}).filter((value) => typeof value === 'string'));
  return [...fields, ...Object.values(words.semesters).filter((text) => text !== undefined)];
}

/** An item's fields; only its texts matter here (a swap's amounts are numbers). */
type Texts = Readonly<Record<string, unknown>>;

const textOf = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * Each kind of city content: its items, the words a translation gives (`fields`; a field the English item lacks, as a
 * swap's `toSource` can, must be lacking in the translation too) and the ones that must read differently (`own`).
 */
const KINDS: {
  kind: Exclude<keyof CityWords, 'semesters'>;
  items: readonly ({ id: string } & Texts)[];
  fields: string[];
  own: string[];
}[] = [
  { kind: 'tips', items: TIPS, fields: ['title', 'body', 'source'], own: ['title', 'body'] },
  { kind: 'discounts', items: DISCOUNTS, fields: ['offer', 'conditions', 'source'], own: ['offer', 'conditions'] },
  { kind: 'swaps', items: SWAPS, fields: ['title', 'body', 'per', 'source', 'toSource'], own: ['title', 'body', 'per'] },
  // A range is known by its category; an Estimate range's words are the marker itself.
  {
    kind: 'ranges',
    items: CITIES.regensburg.ranges.map((range) => ({ id: range.categoryId, source: range.source })),
    fields: ['source'],
    own: [],
  },
];

/** Every semester text the app shows, which `semesters` translates by its English words. */
const SEMESTER_TEXTS = new Set([
  ...SEMESTER_PERIODS.map((period) => period.source),
  ...SEMESTER_FEES.flatMap((fee) => [
    ...(fee.parts ?? []).flatMap((part) => [part.label, part.source]),
    ...(fee.reRegistration ? [fee.reRegistration.source] : []),
  ]),
]);

const TRANSLATED = Object.entries(CITY_WORDS) as [Language, CityWords][];

/** Every translated item of every language, with the English one it translates (undefined for a stale id). */
function* pairs() {
  for (const [code, words] of TRANSLATED) {
    for (const { kind, items, fields, own } of KINDS) {
      for (const [id, translated] of Object.entries(words[kind] as Record<string, Texts>)) {
        yield { label: `${code}: ${kind}.${id}`, english: items.find((item) => item.id === id), translated, fields, own };
      }
    }
  }
}

describe('city content in other languages', () => {
  it('translates only items that exist', () => {
    for (const { label, english } of pairs()) expect(english, label).toBeDefined();
  });

  it('keeps every number and the Estimate marker, so a translation never changes a fact', () => {
    for (const { label, english, translated, fields } of pairs()) {
      if (english === undefined) continue;
      for (const field of fields) {
        const source = textOf(english[field]);
        const words = textOf(translated[field]);
        expect(words === undefined, `${label}.${field} is there exactly when English has it`).toBe(source === undefined);
        if (source === undefined) continue;
        const numbers = numbersIn(words ?? '');
        for (const number of numbersIn(source)) expect(numbers, `${label}.${field} keeps ${number}`).toContain(number);
      }
      if (english.source === 'Estimate') expect(translated.source, label).toBe('Estimate');
    }
  });

  it('puts every item in its own words, not the English ones', () => {
    for (const { label, english, translated, own } of pairs()) {
      if (english === undefined) continue;
      for (const field of own) expect(translated[field], `${label}.${field}`).not.toBe(english[field]);
    }
  });

  it('has every item in every offered language', () => {
    for (const code of OFFERED) {
      if (code === DEFAULT_LANGUAGE) continue;
      for (const { kind, items } of KINDS) {
        for (const item of items) expect(CITY_WORDS[code]?.[kind][item.id], `${code}: ${kind}.${item.id}`).toBeDefined();
      }
      for (const text of SEMESTER_TEXTS) expect(CITY_WORDS[code]?.semesters[text], `${code}: ${text}`).toBeDefined();
    }
  });

  it('translates only semester texts the app has, keeping their numbers, in their own words', () => {
    for (const [code, words] of TRANSLATED) {
      for (const [english, translated = ''] of Object.entries(words.semesters)) {
        expect(SEMESTER_TEXTS.has(english), `${code}: a stale semester text: ${english}`).toBe(true);
        const numbers = numbersIn(translated);
        for (const number of numbersIn(english)) expect(numbers, `${code}: ${english} keeps ${number}`).toContain(number);
        expect(translated, `${code}: ${english}`).not.toBe(english);
      }
    }
  });

  it('puts the narrow no-break space French needs before : ; ? ! and inside « », quotes in another language aside', () => {
    const french = CITY_WORDS.fr;
    if (french === undefined) return;
    for (const text of allTexts(french)) {
      // A quoted page keeps its own punctuation: « Rückmeldung für das SoSe 2027: … ».
      expect(text.replace(/«[^»]*»/g, '«»'), text).not.toMatch(/(^|[^ ])[:;?!]/);
      expect(text, text).not.toMatch(/«[^ ]|[^ ]»/);
    }
  });

  it('shows an item in its translation, or in English marked as English', () => {
    const tip = TIPS[0];
    expect(tipIn(tip, 'en')).toEqual({ ...tip, textLang: undefined });
    const german = tipIn(tip, 'de');
    expect(german.textLang).toBeUndefined();
    expect(german.title).toBe(CITY_WORDS.de?.tips[tip.id]?.title);
    expect(german.url).toBe(tip.url);
    expect(german.checked).toBe(tip.checked);

    const pool = DISCOUNTS.find((discount) => discount.id === 'sportpark-ost-pool');
    if (pool === undefined) throw new Error('the Sportpark Ost pool discount is gone');
    expect(discountIn(pool, 'de').place).toBe('Hallenbad Sportpark Ost');
    expect(discountIn(pool, 'de').address).toBe(pool.address);
    expect(swapIn(SWAPS[0], 'de').fromMinor).toBe(SWAPS[0].fromMinor);

    const [part] = SEMESTER_FEES[0].parts ?? [];
    if (part === undefined) throw new Error('the first semester fee has no parts');
    expect(feePartIn(part, 'de')).toMatchObject({ label: 'Grundbeitrag des Studierendenwerks', minor: part.minor, textLang: undefined });
    // A part whose words aren't all translated stays English as a whole.
    expect(feePartIn({ ...part, label: 'Something new' }, 'de')).toEqual({ ...part, label: 'Something new', textLang: 'en' });
    expect(periodIn(SEMESTER_PERIODS[0], 'de').source).toMatch(/^Universität Regensburg, Akademischer Kalender/);
    const rent = CITIES.regensburg.ranges.find((range) => range.categoryId === 'rent');
    if (rent === undefined) throw new Error('the rent range is gone');
    expect(rangeIn(rent, 'de')).toMatchObject({ minMinor: rent.minMinor, textLang: undefined });

    // A language with no city content of its own yet.
    const without = (Object.keys(LANGUAGES) as Language[]).find((code) => code !== 'en' && !CITY_WORDS[code]);
    if (without !== undefined) expect(tipIn(tip, without)).toEqual({ ...tip, textLang: 'en' });
  });
});
