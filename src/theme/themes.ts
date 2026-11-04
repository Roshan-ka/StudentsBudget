// The app's colour themes (redesign, chunk 8: docs/superpowers/plans/2026-11-04-redesign.md). Light by default, dark as
// a choice, or Same as phone, which follows the phone's own setting. The choice is per phone, like the language: kept
// in localStorage, not synced, not backed up. The colours themselves live in globals.css (`:root` and `.dark`).

/** What a person can choose in Settings → Appearance. */
export const THEME_CHOICES = ['light', 'dark', 'system'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** What a page is drawn in. */
export type Theme = 'light' | 'dark';

/** A new phone, and any phone whose storage can't be read, is light. */
export const DEFAULT_THEME_CHOICE: ThemeChoice = 'light';

export const THEME_STORAGE_KEY = 'studentsbudget-theme';

/** The phone's own setting, for Same as phone. */
export const PREFERS_DARK = '(prefers-color-scheme: dark)';

/** Each theme's page colour (`--background` in globals.css), for the browser's theme-color. */
export const THEME_COLORS: Record<Theme, string> = { light: '#fbf6ec', dark: '#1b1915' };

/** A stored value as a choice: nothing stored, or a value this build doesn't know, is the default. */
export function choiceOf(stored: string | null): ThemeChoice {
  return THEME_CHOICES.find((choice) => choice === stored) ?? DEFAULT_THEME_CHOICE;
}

/** The theme a choice draws: Same as phone follows the phone's own dark setting. */
export function themeOf(choice: ThemeChoice, phonePrefersDark: boolean): Theme {
  if (choice === 'system') return phonePrefersDark ? 'dark' : 'light';
  return choice;
}

/**
 * The inline script the root layout puts in <head>: before the first paint it puts the phone's theme on <html> (the
 * `dark` class and `color-scheme`) and on the theme-color meta, so a dark phone never flashes the light page. Plain ES5,
 * generated from the values above; storage that can't be read leaves the page light, as rendered.
 */
export function themeHeadScript(): string {
  return (
    '(function(){try{' +
    `var k=${JSON.stringify(THEME_CHOICES)},c=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
    `if(k.indexOf(c)<0)c=${JSON.stringify(DEFAULT_THEME_CHOICE)};` +
    `var d=c==='dark'||(c==='system'&&window.matchMedia(${JSON.stringify(PREFERS_DARK)}).matches);` +
    "var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';" +
    "var m=document.querySelector('meta[name=\"theme-color\"]');" +
    `if(m)m.setAttribute('content',d?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)})` +
    '}catch(e){}})()'
  );
}
