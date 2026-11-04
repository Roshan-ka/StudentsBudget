// The language picker in English: Settings → Language and the picker on setup. Each language is listed by its own
// name, from the registry (src/i18n/languages.ts).
export const language = {
  heading: 'Language',
  label: 'Language',
  hint: 'Only on this phone. Money follows the language; dates follow the region (Germany).',
  /** A language a dev build lists before it is offered. */
  draft: (name: string) => `${name} (draft)`,
};
