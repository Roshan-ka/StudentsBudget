// The language menu in English: the globe in every page's header (16-11-2026). Each language is listed by its own
// name, from the registry (src/i18n/languages.ts).
export const language = {
  label: 'Language',
  /** Under the languages in the globe's menu. */
  hint: 'Only on this phone. Money follows the language; dates follow the region (Germany).',
  /** A language a dev build lists before it is offered. */
  draft: (name: string) => `${name} (draft)`,
};
