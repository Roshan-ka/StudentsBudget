import { DEFAULT_LANGUAGE, type Language } from './languages';

/**
 * The `lang` attribute for city content (tips, discounts, swaps, sources): it stays English until it is translated
 * with its sources, so in another language a screen reader reads it as English. Nothing in English, where the page
 * already says so.
 */
export function contentLang(lang: Language): 'en' | undefined {
  return lang === DEFAULT_LANGUAGE ? undefined : 'en';
}
