import type { Tip } from '@/data/tips';
import { contentLang } from '../content';
import type { Language } from '../languages';
import { tips as deTips } from './de/tips';

// The city content (src/data) in other languages (language switch, plan 2: docs/superpowers/plans/
// 2026-11-03-language-switch-2.md). Only the words, by item id: every number, source URL, checked date, category and
// order stays in src/data, in English, which the MCP server answers in.

/** A tip's words in another language. A source that is 'Estimate' stays 'Estimate': the app reads it as a marker. */
export type TipWords = Pick<Tip, 'title' | 'body' | 'source'>;

/** The city content's words in one language, by item id. */
export type CityWords = { tips: Readonly<Partial<Record<string, TipWords>>> };

/** Every language with city content of its own. A language without it, or an item it doesn't have, shows English. */
export const CITY_WORDS: Partial<Record<Language, CityWords>> = { de: { tips: deTips } };

/**
 * An item with its words in a language. `textLang` is the `lang` attribute for them: 'en' while they are still English
 * in another language (`contentLang`), so a screen reader reads just that item as English.
 */
export type InLanguage<T> = T & { textLang: 'en' | undefined };

/** A tip in `lang`, or in English, marked so, where it has no translation. */
export function tipIn(tip: Tip, lang: Language): InLanguage<Tip> {
  const words = lang === 'en' ? undefined : CITY_WORDS[lang]?.tips[tip.id];
  return words === undefined ? { ...tip, textLang: contentLang(lang) } : { ...tip, ...words, textLang: undefined };
}
