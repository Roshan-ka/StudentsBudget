import { useSyncExternalStore } from 'react';
import { LANGUAGES, type Language } from './languages';
import { MESSAGES, type Messages } from './messages';
import { getLanguageSnapshot, getServerLanguageSnapshot, subscribeToLanguage } from './store';

/**
 * This phone's language. The default on the server and in the first render (pages are prerendered in it), the phone's
 * own right after: the text then switches without a hydration error.
 */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribeToLanguage, getLanguageSnapshot, getServerLanguageSnapshot);
}

/** The dictionary of this phone's language (`t`), with the language and its locale for formatting. */
export function useT(): { t: Messages; lang: Language; locale: string } {
  const lang = useLanguage();
  return { t: MESSAGES[lang], lang, locale: LANGUAGES[lang].locale };
}
