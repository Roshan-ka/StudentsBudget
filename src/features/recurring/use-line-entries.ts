'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { LineEntries, LineType } from './schedule';

/**
 * The entries a schedule posted for a line, for `firstAddedOn` to look through: its category's, of its type. Undefined
 * until the database has answered, so a first date is not shown from half the picture.
 */
export function useLineEntries(type: LineType, categoryId: string): LineEntries | undefined {
  const entries = useLiveQuery(
    () =>
      db.entries
        .where('categoryId')
        .equals(categoryId)
        .filter((e) => e.type !== 'transfer' && e.type === type && e.recurring !== undefined)
        .toArray(),
    [type, categoryId],
  );
  return entries === undefined ? undefined : { type, categoryId, entries };
}
