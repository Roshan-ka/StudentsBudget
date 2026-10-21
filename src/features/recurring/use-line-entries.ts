'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { LineEntries, LineType } from './schedule';

/**
 * The entries a schedule posted for a line, for `firstAddedOn` to look through: its category's, of its type. Undefined
 * until the database has answered for this type and category, so a first date is never shown from half the picture.
 * The query returns the key it ran for: while a new category loads, `useLiveQuery` still hands back the last answer,
 * which belongs to the previous category and is dropped here.
 */
export function useLineEntries(type: LineType, categoryId: string): LineEntries | undefined {
  const found = useLiveQuery(
    async (): Promise<LineEntries> => ({
      type,
      categoryId,
      entries: await db.entries
        .where('categoryId')
        .equals(categoryId)
        .filter((e) => e.type !== 'transfer' && e.type === type && e.recurring !== undefined)
        .toArray(),
    }),
    [type, categoryId],
  );
  return found !== undefined && found.type === type && found.categoryId === categoryId ? found : undefined;
}
