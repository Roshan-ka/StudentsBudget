import { LANGUAGES } from '../../languages';
import { plural, type PluralForms } from '../../plural';

/**
 * An English text by a count, in the form English picks for it ("1 account", "0 accounts"). Every English count goes
 * through here rather than `n === 1 ? …` (review U7, 17-11-2026), as French and Spanish already did.
 */
export const byCount = (n: number, forms: PluralForms) => plural(LANGUAGES.en.locale, n, forms);
