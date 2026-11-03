import type { BackupData } from '@/db/bulk';
import { listFormat } from '@/i18n/format';
import { LANGUAGES, type Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';

/**
 * "a", "a and b", "a, b and c" in English (the default locale), built by hand so it reads the same in every browser
 * engine; another locale joins with its own "and" (Intl.ListFormat).
 */
export function listed(parts: string[], locale: string = 'en-IE'): string {
  if (locale !== 'en-IE') return listFormat(locale).format(parts);
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** What a set of data holds, counted: its accounts and entries, and whether it has a plan. */
export type Contents = { accounts: number; entries: number; hasPlan: boolean };

export function contentsOf(d: Pick<BackupData, 'accounts' | 'entries' | 'plan'>): Contents {
  return { accounts: d.accounts.length, entries: d.entries.length, hasPlan: d.plan !== null };
}

/** What a set of data holds, in words: "3 accounts, 42 entries and your plan", in `lang`. */
export function contentsText({ accounts, entries, hasPlan }: Contents, lang: Language = 'en'): string {
  const counts = MESSAGES[lang].common.counts;
  const parts = [counts.accounts(accounts), counts.entries(entries)];
  if (hasPlan) parts.push(counts.plan);
  return listed(parts, LANGUAGES[lang].locale);
}
