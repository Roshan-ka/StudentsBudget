import { db } from '@/db/db';

/**
 * How many changes the outbox still holds before signing out, or null when it can't be read (review B3, 17-11-2026).
 * Null is never nothing: sign-out then asks, as it does for changes it knows of, rather than wipe what may be unsent.
 */
export async function unsentChanges(): Promise<number | null> {
  try {
    return await db.outbox.count();
  } catch (error) {
    console.error('StudentsBudget: could not count the changes not yet in the account', error);
    return null;
  }
}
