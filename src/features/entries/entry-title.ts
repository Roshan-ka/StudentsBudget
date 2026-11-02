import type { Entry } from '@/db/types';
import { categoryNameIn } from '@/i18n/category-name';
import type { Messages } from '@/i18n/messages';
import { categoryName } from './categories';

/**
 * What a list calls an entry: its note, else its category (Transfer for a transfer), with the category as `label`
 * under a note that says something else. The poster writes a scheduled entry's note as its category's English name
 * (post-due.ts), so such a note reads as the category's name in the dictionary's language, and is said once, not
 * "Rent" over "Rent".
 */
export function entryTitle(entry: Entry, t: Messages): { title: string; label: string | null } {
  const label = entry.type === 'transfer' ? t.entries.transfer : categoryNameIn(t, entry.categoryId);
  const note = entry.type !== 'transfer' && entry.note === categoryName(entry.categoryId) ? label : entry.note;
  return { title: note || label, label: note !== '' && note !== label ? label : null };
}
