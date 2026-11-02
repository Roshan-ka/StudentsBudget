import { categories } from './categories';
import { home } from './home';
import { shell } from './shell';

/**
 * English, the reference dictionary: every other language has exactly its keys (`Messages`), area by area. A text
 * that takes values is a function, so a translation can't drop one.
 */
export const en = { shell, categories, home };

export type Messages = typeof en;
