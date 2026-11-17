import { LANGUAGES } from '../../languages';
import { plural, type PluralForms } from '../../plural';

/**
 * A German text by a count, in the form German picks for it ("1 Konto", "0 Konten"). Every German count goes through
 * here rather than `n === 1 ? …` (review U7, 17-11-2026), as French and Spanish already did.
 */
export const byCount = (n: number, forms: PluralForms) => plural(LANGUAGES.de.locale, n, forms);
