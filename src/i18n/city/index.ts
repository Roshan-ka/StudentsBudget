import type { CityRange } from '@/data/cities';
import type { Discount } from '@/data/discounts';
import type { FeePart, SemesterFee, SemesterPeriod } from '@/data/semesters';
import type { Swap } from '@/data/swaps';
import type { Tip } from '@/data/tips';
import { contentLang } from '../content';
import type { Language } from '../languages';
import { discounts as deDiscounts } from './de/discounts';
import { ranges as deRanges } from './de/ranges';
import { semesters as deSemesters } from './de/semesters';
import { swaps as deSwaps } from './de/swaps';
import { tips as deTips } from './de/tips';
import { discounts as esDiscounts } from './es/discounts';
import { ranges as esRanges } from './es/ranges';
import { semesters as esSemesters } from './es/semesters';
import { swaps as esSwaps } from './es/swaps';
import { tips as esTips } from './es/tips';
import { discounts as frDiscounts } from './fr/discounts';
import { ranges as frRanges } from './fr/ranges';
import { semesters as frSemesters } from './fr/semesters';
import { swaps as frSwaps } from './fr/swaps';
import { tips as frTips } from './fr/tips';

// The city content (src/data) in other languages (language switch, plan 2: docs/superpowers/plans/
// 2026-11-03-language-switch-2.md). Only the words, by item id: every number, source URL, checked date, category and
// order stays in src/data, in English, which the MCP server answers in.

/** A tip's words in another language. A source that is 'Estimate' stays 'Estimate': the app reads it as a marker. */
export type TipWords = Pick<Tip, 'title' | 'body' | 'source'>;

/** A discount's words. Its place keeps its name unless the name holds a common word ("Sportpark Ost pool"). */
export type DiscountWords = Pick<Discount, 'offer' | 'conditions' | 'source'> & { place?: string };

/** A swap's words; `toSource` exactly when the swap has one. `per` is its unit in the swap line ("per meal"). */
export type SwapWords = Pick<Swap, 'title' | 'body' | 'per' | 'source' | 'toSource'>;

/** A city range's words (setup and Home), by its category. 'Estimate' stays 'Estimate', as for a tip. */
export type RangeWords = Pick<CityRange, 'source'>;

/**
 * The city content's words in one language: tips, discounts, swaps and the city's ranges by id (a range by its
 * category). The semester texts have no id and are partly built from templates, so they are keyed by their exact
 * English text: period and fee-part sources, fee-part labels and the re-registration's source.
 */
export type CityWords = {
  tips: Readonly<Partial<Record<string, TipWords>>>;
  discounts: Readonly<Partial<Record<string, DiscountWords>>>;
  swaps: Readonly<Partial<Record<string, SwapWords>>>;
  ranges: Readonly<Partial<Record<string, RangeWords>>>;
  semesters: Readonly<Partial<Record<string, string>>>;
};

/** Every language with city content of its own. A language without it, or an item it doesn't have, shows English. */
export const CITY_WORDS: Partial<Record<Language, CityWords>> = {
  de: { tips: deTips, discounts: deDiscounts, swaps: deSwaps, ranges: deRanges, semesters: deSemesters },
  es: { tips: esTips, discounts: esDiscounts, swaps: esSwaps, ranges: esRanges, semesters: esSemesters },
  fr: { tips: frTips, discounts: frDiscounts, swaps: frSwaps, ranges: frRanges, semesters: frSemesters },
};

/**
 * An item with its words in a language. `textLang` is the `lang` attribute for them: 'en' while they are still English
 * in another language (`contentLang`), so a screen reader reads just that item as English.
 */
export type InLanguage<T> = T & { textLang: 'en' | undefined };

/** `item` with `words` over it, or as it is, marked English, when there are none. */
function withWords<T>(item: T, words: Partial<T> | undefined, lang: Language): InLanguage<T> {
  return words === undefined ? { ...item, textLang: contentLang(lang) } : { ...item, ...words, textLang: undefined };
}

const wordsIn = (lang: Language): CityWords | undefined => (lang === 'en' ? undefined : CITY_WORDS[lang]);

/** A tip in `lang`, or in English, marked so, where it has no translation. */
export function tipIn(tip: Tip, lang: Language): InLanguage<Tip> {
  return withWords(tip, wordsIn(lang)?.tips[tip.id], lang);
}

/** A discount in `lang`, or in English, marked so. Its address stays as the place gives it. */
export function discountIn(discount: Discount, lang: Language): InLanguage<Discount> {
  return withWords(discount, wordsIn(lang)?.discounts[discount.id], lang);
}

/** A swap in `lang`, or in English, marked so. */
export function swapIn(swap: Swap, lang: Language): InLanguage<Swap> {
  return withWords(swap, wordsIn(lang)?.swaps[swap.id], lang);
}

/** A city range (setup, Home) in `lang`, or in English, marked so. */
export function rangeIn(range: CityRange, lang: Language): InLanguage<CityRange> {
  return withWords(range, wordsIn(lang)?.ranges[range.categoryId], lang);
}

/** The translation of a semester text, found by its English words. */
const semesterText = (english: string, lang: Language) => wordsIn(lang)?.semesters[english];

/** A semester period's source in `lang`, or in English, marked so. */
export function periodIn(period: SemesterPeriod, lang: Language): InLanguage<SemesterPeriod> {
  const source = semesterText(period.source, lang);
  return withWords(period, source === undefined ? undefined : { source }, lang);
}

/** A semester fee part's label and source in `lang`, or both in English, marked so. */
export function feePartIn(part: FeePart, lang: Language): InLanguage<FeePart> {
  const label = semesterText(part.label, lang);
  const source = semesterText(part.source, lang);
  return withWords(part, label === undefined || source === undefined ? undefined : { label, source }, lang);
}

type ReRegistration = NonNullable<SemesterFee['reRegistration']>;

/** A re-registration's source in `lang`, or in English, marked so. */
export function reRegistrationIn(reRegistration: ReRegistration, lang: Language): InLanguage<ReRegistration> {
  const source = semesterText(reRegistration.source, lang);
  return withWords(reRegistration, source === undefined ? undefined : { source }, lang);
}
