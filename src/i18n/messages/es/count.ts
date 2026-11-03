import { LANGUAGES } from '../../languages';
import { plural, type PluralForms } from '../../plural';

/**
 * A Spanish text by a count, in the form Spanish picks for it ("1 cuenta", "0 cuentas": Spanish counts 0 as plural,
 * as English does). Every Spanish count goes through here rather than `n === 1 ? …`, so the forms come from the
 * language's own rules.
 */
export const byCount = (n: number, forms: PluralForms) => plural(LANGUAGES.es.locale, n, forms);
