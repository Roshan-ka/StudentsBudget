import type { Language } from '../languages';
import { de } from './de';
import { en, type Messages } from './en';
import { es } from './es';
import { fr } from './fr';

export type { Messages } from './en';

/**
 * Every language's dictionary. Imported statically, never with import(): the service worker caches only the files a
 * page names, so a dictionary loaded later would be missing offline. A language in the registry without a dictionary
 * fails typecheck here. Until its own dictionary is written, a language that isn't offered yet uses English.
 */
export const MESSAGES: Record<Language, Messages> = {
  en,
  de,
  es,
  fr,
};
