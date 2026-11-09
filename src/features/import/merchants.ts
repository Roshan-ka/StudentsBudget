// The shops and payers an imported row can be recognised by (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md):
// a short list of the big chains and the usual money in, so a first import, which has no history to learn from, doesn't
// put everything under Other. The student's own earlier choices win over it (`categorize.ts`). Order matters: the first
// rule that fits decides, so the narrower ones come first ("Aldi Talk" is a phone contract, not groceries; "Miete" to
// the Studierendenwerk is rent, not the Mensa).

export type MerchantRule = { label: string; pattern: RegExp; categoryId: string };

/**
 * Text as the rules read it: lower case, with umlauts and ß written out (ä → ae), so one pattern fits "BAföG",
 * "BAFOEG" and "Bafög", and any run of spaces as one.
 */
export function fold(text: string): string {
  return text
    .toLocaleLowerCase('de-DE')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

const rule = (label: string, categoryId: string, pattern: RegExp): MerchantRule => ({ label, pattern, categoryId });

/** Money out. Each pattern matches whole words (`\b`) of the folded text. */
export const OUT_RULES: readonly MerchantRule[] = [
  rule('Rent', 'rent', /\b(miete|mietzahlung|wohnheim|kaltmiete|warmmiete)\b/),
  rule('Aldi Talk', 'phone', /\baldi ?talk\b/),
  rule('Telekom', 'phone', /\btelekom\b/),
  rule('Vodafone', 'phone', /\bvodafone\b/),
  rule('O2', 'phone', /\b(o2|telefonica)\b/),
  rule('congstar', 'phone', /\bcongstar\b/),
  rule('1&1', 'phone', /\b1&1\b/),
  rule('Rundfunkbeitrag', 'utilities', /\b(rundfunk\w*|beitragsservice|ard zdf)\b/),
  rule('REWAG', 'utilities', /\b(rewag|stadtwerke)\b/),
  rule('Health insurance', 'insurance', /\b(techniker krankenkasse|aok|barmer|dak[- ]gesundheit)\b/),
  rule('Deutschlandticket', 'transport-pass', /\b(deutschlandticket|d-ticket)\b/),
  rule('RVV', 'transport', /\brvv\b/),
  rule('Deutsche Bahn', 'transport', /\b(deutsche bahn|db (vertrieb|fernverkehr|regio|bahn))\b/),
  rule('Flixbus', 'transport', /\bflix(bus|train)\b/),
  rule('Amazon Prime', 'subscriptions', /\b(amazon prime|prime video)\b/),
  rule('Spotify', 'subscriptions', /\bspotify\b/),
  rule('Netflix', 'subscriptions', /\bnetflix\b/),
  rule('Disney+', 'subscriptions', /\bdisney(\+| ?plus)/),
  rule('YouTube Premium', 'subscriptions', /\byoutube ?premium\b/),
  rule('McFit', 'gym', /\b(mcfit|fitx|hochschulsport)\b/),
  rule('Mensa', 'eating-out', /\b(mensa|studierendenwerk|studentenwerk|cafeteria)\b/),
  rule('Lieferando', 'eating-out', /\b(lieferando|wolt|mcdonald'?s|burger king)\b/),
  rule('REWE', 'food', /\brewe\b/),
  rule('Lidl', 'food', /\blidl\b/),
  rule('Aldi', 'food', /\baldi\b/),
  rule('Edeka', 'food', /\bedeka\b/),
  rule('Netto', 'food', /\bnetto\b/),
  rule('Penny', 'food', /\bpenny\b/),
  rule('Kaufland', 'food', /\bkaufland\b/),
  rule('Norma', 'food', /\bnorma\b/),
  rule('Alnatura', 'food', /\b(alnatura|denns)\b/),
  rule('dm', 'personal-care', /\bdm\b|\bdm-drogerie\b/),
  rule('Rossmann', 'personal-care', /\brossmann\b/),
  rule('Apotheke', 'health', /\b(\w*apotheke|docmorris)\b/),
  rule('IKEA', 'household', /\bikea\b/),
  rule('Amazon', 'shopping', /\b(amazon|amzn)\b/),
  rule('Zalando', 'shopping', /\b(zalando|primark|h&m|tk maxx)/),
  rule('Cinema', 'going-out', /\b(kino|cinemaxx)\b/),
  rule('Travel', 'travel', /\b(booking\.com|airbnb|ryanair|eurowings|lufthansa)\b/),
];

/** Money in. */
export const IN_RULES: readonly MerchantRule[] = [
  rule('BAföG', 'income-bafoeg', /\b(bafoeg|ausbildungsfoerderung)\b/),
  rule('Blocked account', 'income-sperrkonto', /\b(expatrio|fintiba|coracle|sperrkonto)\b/),
  rule('Scholarship', 'income-scholarship', /\b(\w*stipendium|daad)\b/),
  rule('Salary', 'income-job', /\b(gehalt|lohn|entgelt|minijob)\b/),
  rule('Parents', 'income-parents', /\btaschengeld\b/),
];

/** The first rule that fits the text, among the rules for money out or money in. */
export function chainRule(text: string, direction: 'out' | 'in'): MerchantRule | null {
  const folded = fold(text);
  return (direction === 'out' ? OUT_RULES : IN_RULES).find((candidate) => candidate.pattern.test(folded)) ?? null;
}

/** Words of a payee's name that don't tell one shop from another: legal forms, "sagt danke", a store's "Markt". */
const NAME_NOISE = new Set(['gmbh', 'mbh', 'ag', 'se', 'kg', 'co', 'ohg', 'ev', 'e.v', 'sagt', 'danke', 'markt', 'filiale', 'store', 'gmbh&co']);

/**
 * The shop's name as the import remembers it (`ImportMark.merchant`), so the next import of the same shop finds the
 * student's choice: the payee (or, without one, the purpose), folded, without numbers and the noise words, at most its
 * first two words. "REWE Markt GmbH" and "REWE SAGT DANKE 1234" are both "rewe"; "Max Mustermann" stays a person.
 */
export function merchantKey(payee: string, purpose: string): string {
  const words = fold(payee || purpose)
    .split(' ')
    // A word with a digit is a store number, a date or a reference ("1234", "P1234", "10/2026"): never the name.
    .filter((word) => !/\d/.test(word))
    .map((word) => word.replace(/^[^\p{L}&+]+|[^\p{L}&+]+$/gu, ''))
    .filter((word) => /\p{L}/u.test(word) && !NAME_NOISE.has(word));
  return words.slice(0, 2).join(' ');
}
