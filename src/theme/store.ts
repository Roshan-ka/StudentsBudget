import { useSyncExternalStore } from 'react';
import {
  choiceOf,
  DEFAULT_THEME_CHOICE,
  PREFERS_DARK,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  themeOf,
  type ThemeChoice,
} from './themes';

// The phone's theme choice as an external store, as src/i18n/store.ts does for the language: read from localStorage in
// the browser, the default on the server, so every page stays prerendered (in light).

const listeners = new Set<() => void>();

function storedChoice(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage can be blocked (a private window): the page stays light.
    return null;
  }
}

/** The choice this phone made, or the default. */
export function getThemeChoiceSnapshot(): ThemeChoice {
  return choiceOf(storedChoice());
}

/** The server's and the first render's choice: the default, which the pages are prerendered in. */
export function getServerThemeChoiceSnapshot(): ThemeChoice {
  return DEFAULT_THEME_CHOICE;
}

/** Notifies `listener` when the choice changes: here, or in another tab of the app (the storage event). */
export function subscribeToThemeChoice(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** The theme choice of this phone, for a component: the default in the first render, the phone's right after. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribeToThemeChoice, getThemeChoiceSnapshot, getServerThemeChoiceSnapshot);
}

/** Puts the theme a choice draws on <html> and the theme-color meta, as the head script does before the first paint. */
export function applyThemeToDocument(choice: ThemeChoice): void {
  const theme = themeOf(choice, window.matchMedia(PREFERS_DARK).matches);
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

/** The person's choice: kept on this phone, put on <html>, and shown at once wherever the app reads it. */
export function setThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Not kept when storage is blocked; it still applies until the app is closed.
  }
  applyThemeToDocument(choice);
  for (const listener of listeners) listener();
}
