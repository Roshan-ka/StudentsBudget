import { listFormat } from '@/i18n/format';
import { LANGUAGES, type Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';

/** "1 entry", "42 entries". */
export function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * "a", "a and b", "a, b and c" in English (the default locale), built by hand so it reads the same in every browser
 * engine; another locale joins with its own "and" (Intl.ListFormat).
 */
export function listed(parts: string[], locale: string = 'en-IE'): string {
  if (locale !== 'en-IE') return listFormat(locale).format(parts);
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** What a set of data holds, in words: "3 accounts, 42 entries and your plan", in `lang`. */
export function contentsOf(accounts: number, entries: number, hasPlan: boolean, lang: Language = 'en'): string {
  const counts = MESSAGES[lang].common.counts;
  const parts = [counts.accounts(accounts), counts.entries(entries)];
  if (hasPlan) parts.push(counts.plan);
  return listed(parts, LANGUAGES[lang].locale);
}
