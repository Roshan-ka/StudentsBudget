import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LANGUAGES,
  OFFERED,
  pickLanguage,
  SELECTABLE,
  type Language,
} from './languages';

// The phone's language as an external store for useSyncExternalStore (see use-t.ts), modelled on use-today.ts: read
// from localStorage and the browser's languages in the browser, the default on the server, so every page stays
// prerendered in it.

const listeners = new Set<() => void>();

function storedChoice(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Storage can be blocked (a private window): the phone's own languages decide.
    return null;
  }
}

/**
 * The language this phone shows. A string, so two equal reads don't re-render. A draft this build lists is kept once
 * chosen; the phone's own languages pick only an offered one.
 */
export function getLanguageSnapshot(): Language {
  return pickLanguage(storedChoice(), navigator.languages ?? [navigator.language], OFFERED, SELECTABLE);
}

/** The server's and the first render's language: the default, which the pages are prerendered in. */
export function getServerLanguageSnapshot(): Language {
  return DEFAULT_LANGUAGE;
}

/** Notifies `listener` when the language changes: a choice made here, or in another tab of the app (the storage event). */
export function subscribeToLanguage(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Puts the language and its writing direction on <html>, as the head script does before the first paint. */
export function applyLanguageToDocument(language: Language): void {
  document.documentElement.lang = language;
  document.documentElement.dir = LANGUAGES[language].dir;
}

/** The person's choice: kept on this phone, put on <html>, and shown at once wherever the app reads the language. */
export function setLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Not kept when storage is blocked; it still applies until the app is closed.
  }
  applyLanguageToDocument(language);
  for (const listener of listeners) listener();
}
