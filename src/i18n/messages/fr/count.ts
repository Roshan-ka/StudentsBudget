import { LANGUAGES } from '../../languages';
import { plural, type PluralForms } from '../../plural';

/**
 * A French text by a count, in the form French picks for it: 0 and 1 are singular ("0 compte", "1 compte"), unlike in
 * English. Every French count goes through here rather than `n === 1 ? …`.
 */
export const byCount = (n: number, forms: PluralForms) => plural(LANGUAGES.fr.locale, n, forms);

/**
 * The narrow no-break space French puts before ":", ";", "?" and "!" and inside « » (tested in messages.test.ts).
 * Written out as an escape in the dictionaries, so it can be seen.
 */
export const NNBSP = ' ';
