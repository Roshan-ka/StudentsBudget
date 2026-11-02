/** A text in each plural form a language may have; `other` is always given and stands in for any form left out. */
export type PluralForms = { other: string } & Partial<Record<Exclude<Intl.LDMLPluralRule, 'other'>, string>>;

const rules = new Map<string, Intl.PluralRules>();

/** The form of `forms` the language's rules pick for `n` (`Intl.PluralRules`), or `other` when that form isn't given. */
export function plural(locale: string, n: number, forms: PluralForms): string {
  let rule = rules.get(locale);
  if (rule === undefined) {
    rule = new Intl.PluralRules(locale);
    rules.set(locale, rule);
  }
  return forms[rule.select(n)] ?? forms.other;
}
