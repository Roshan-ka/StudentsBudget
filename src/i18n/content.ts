import { DEFAULT_LANGUAGE, type Language } from './languages';

/**
 * The `lang` attribute for city content (tips, discounts, swaps, sources) that is still English in another language,
 * so a screen reader reads it as English. Nothing in English, where the page already says so. A translated item brings
 * its own (`textLang`, src/i18n/city).
 */
export function contentLang(lang: Language): 'en' | undefined {
  return lang === DEFAULT_LANGUAGE ? undefined : 'en';
}
