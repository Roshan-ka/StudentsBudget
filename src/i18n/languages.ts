// The app's languages (language switch, plan 1: docs/superpowers/plans/2026-11-02-language-switch.md). This registry
// is the single source: the Language type, the picker, the head script, the formatters' locales and the tests all come
// from it, so a further language is an entry here plus its dictionary (see "Adding a language" in CLAUDE.md).

/** What the app needs to know about a language. */
export type LanguageInfo = {
  /** The locale its numbers, money and date labels ("Mon 26 Oct") are formatted in; a full date follows the region. */
  locale: string;
  /** Its name in itself, as the picker shows it. */
  name: string;
  /** Its writing direction, set on <html> with the language. */
  dir: 'ltr' | 'rtl';
};

export const LANGUAGES = {
  en: { locale: 'en-IE', name: 'English', dir: 'ltr' },
  de: { locale: 'de-DE', name: 'Deutsch', dir: 'ltr' },
  es: { locale: 'es-ES', name: 'Español', dir: 'ltr' },
  fr: { locale: 'fr-FR', name: 'Français', dir: 'ltr' },
} as const satisfies Record<string, LanguageInfo>;

export type Language = keyof typeof LANGUAGES;

/** The language pages are prerendered in, and the one a phone gets when nothing else matches. */
export const DEFAULT_LANGUAGE: Language = 'en';

/**
 * The languages a person can pick, the default first. A language can be in the registry, and be drafted, before it
 * is offered here; offering it needs its whole dictionary, with no English underneath (messages.test.ts).
 */
export const OFFERED: readonly Language[] = ['en', 'de', 'fr'];

/**
 * What a build lets a person pick in the language picker: the offered languages in production, and every language in
 * the registry in any other build (`next dev`, the e2e), so a draft can be tried before it is offered.
 */
export function selectableIn(env: string | undefined): readonly Language[] {
  return env === 'production' ? OFFERED : (Object.keys(LANGUAGES) as Language[]);
}

/** What this build lets a person pick (`selectableIn`). The phone's own languages only ever pick an offered one. */
export const SELECTABLE: readonly Language[] = selectableIn(process.env.NODE_ENV);

/** Where this phone keeps the person's choice (localStorage): per phone, never synced or backed up. */
export const LANGUAGE_STORAGE_KEY = 'studentsbudget-language';

/**
 * The language to show: the stored choice when it can be picked (`selectable`, which the offered ones are part of),
 * else the first of the phone's languages whose main part (`de` of `de-AT`) is offered, else the default. A draft is
 * never picked from the phone's languages: only someone who chose it sees it.
 */
export function pickLanguage(
  stored: string | null,
  browser: readonly string[],
  offered: readonly Language[] = OFFERED,
  selectable: readonly Language[] = offered,
): Language {
  const isIn = (list: readonly Language[]) => (code: string): code is Language =>
    (list as readonly string[]).includes(code);
  const isSelectable = isIn(selectable);
  const isOffered = isIn(offered);
  if (stored !== null && (isSelectable(stored) || isOffered(stored))) return stored;
  for (const tag of browser) {
    const main = tag.toLowerCase().split('-')[0];
    if (isOffered(main)) return main;
  }
  return DEFAULT_LANGUAGE;
}
