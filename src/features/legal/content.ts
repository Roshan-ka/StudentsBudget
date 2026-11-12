import type { Language } from '@/i18n/languages';

// The legal pages' texts (docs/superpowers/plans/2026-11-12-legal-pages.md), as structured data rather than messages:
// long, in German (the binding text) and English only, and each section shown only in a build that does what it
// describes.

/** The two languages the legal texts are written in. */
export type LegalLang = 'de' | 'en';

/** A paragraph, a list, or lines that belong together (an address). */
export type LegalBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: readonly string[] }
  | { kind: 'lines'; lines: readonly string[] };

export type LegalText = { heading: string; blocks: readonly LegalBlock[] };

/**
 * When a section applies: always, or only in a build that has the part it describes (Supabase's settings, the AI, the
 * weekly reminder, the discount map).
 */
export type LegalWhen = 'always' | 'supabase' | 'ai' | 'reminder' | 'map';

export type LegalSection = {
  /** Its anchor on the page: `/privacy#<id>`. */
  id: string;
  when: LegalWhen;
  de: LegalText;
  en: LegalText;
};

/** German for a German phone; English for everyone else, with a note on a French or Spanish one. */
export function legalLangFor(lang: Language): { lang: LegalLang; fallback: boolean } {
  if (lang === 'de') return { lang: 'de', fallback: false };
  return { lang: 'en', fallback: lang !== 'en' };
}

/** The sections a build shows: those it has the parts for. */
export function sectionsFor(
  sections: readonly LegalSection[],
  build: Readonly<Record<Exclude<LegalWhen, 'always'>, boolean>>,
): LegalSection[] {
  return sections.filter((section) => section.when === 'always' || build[section.when]);
}

/** The words around the sections, in the text's own language. */
export const LEGAL_WORDS: Record<LegalLang, { updated: (date: string) => string; draft: string }> = {
  de: { updated: (date) => `Stand: ${date}`, draft: 'Entwurf: Name, Anschrift und E-Mail stehen noch aus.' },
  en: { updated: (date) => `As of ${date}`, draft: 'Draft: the name, address and email are still to come.' },
};
