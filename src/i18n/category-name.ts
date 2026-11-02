import type { Messages } from './messages';

/** A category's name in the dictionary's language, or its id for one that isn't built in (as categoryName does). */
export function categoryNameIn(t: Messages, id: string): string {
  return (t.categories as Record<string, string>)[id] ?? id;
}
