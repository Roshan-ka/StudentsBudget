import { readPref, writePref } from '@/lib/phone-pref';

/**
 * The category and account the entry form last saved an expense or an income with, so the next one starts there
 * (pain points, chunk 6). Per phone (localStorage), never synced or backed up. An id that is gone (a deleted account)
 * is simply not found, and the form falls back to its default.
 */
export type LastChoice = { categoryId: string; accountId: string };
export type MoneyType = 'expense' | 'income';

export const LAST_CHOICE_KEY = 'studentsbudget-entry-form';

/** The stored choice for `type`, or null for nothing stored or anything this build can't read. */
export function lastChoiceIn(stored: string | null, type: MoneyType): LastChoice | null {
  if (stored === null) return null;
  try {
    const all: unknown = JSON.parse(stored);
    if (typeof all !== 'object' || all === null) return null;
    const choice: unknown = (all as Record<string, unknown>)[type];
    if (typeof choice !== 'object' || choice === null) return null;
    const { categoryId, accountId } = choice as Record<string, unknown>;
    return typeof categoryId === 'string' && typeof accountId === 'string' ? { categoryId, accountId } : null;
  } catch {
    return null;
  }
}

/** `stored` with `type`'s choice replaced, keeping the other type's. */
export function withLastChoice(stored: string | null, type: MoneyType, choice: LastChoice): string {
  const other: MoneyType = type === 'expense' ? 'income' : 'expense';
  const kept = lastChoiceIn(stored, other);
  return JSON.stringify({ ...(kept ? { [other]: kept } : {}), [type]: choice });
}

export function readLastChoice(type: MoneyType): LastChoice | null {
  return lastChoiceIn(readPref(LAST_CHOICE_KEY), type);
}

export function rememberChoice(type: MoneyType, choice: LastChoice): void {
  writePref(LAST_CHOICE_KEY, withLastChoice(readPref(LAST_CHOICE_KEY), type, choice));
}
