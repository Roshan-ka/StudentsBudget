// Takes account and card numbers out of every text before it goes to the model (the AI phase, chunk 2,
// docs/superpowers/plans/2026-11-09-ai-phase-1.md; the Concept: account and card numbers are removed on the server
// before anything goes to the AI). The function runs it on everything a request carries: the line, the questions, the
// names, the notes in Ask's snapshot and the setup draft.
//
// The masks are the CSV import's (`importNote`, src/features/import/note.ts), less its time stamps, which a quick-add
// line may need ("on 2026-11-08"), plus emails and phone numbers, which a typed note can hold. The function can't
// import the app's code, so they are written again here; `scrub.test.ts` holds them to the import's own examples and
// every bank file it was built with, so a mask the import gains and this file lacks fails there.

const MASKS: readonly RegExp[] = [
  // An email address: before the IBAN and number masks, which would leave its pieces behind.
  /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g,
  // An IBAN: in blocks of digits ("DE00 1203 0000 …"), or in one piece of capitals and digits ("GB29NWBK60161331926819").
  /\b[A-Z]{2}\d{2}(?: ?\d{4}){3,7}(?: ?\d{1,3})?\b/g,
  /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
  /\bIBAN:?(?=\s|$)/g,
  // A card: DKB's "Debitk.99 VISA Debit" and Sparkasse's "Debitk.1 2029-12", a number "4930 **** **** 1234", "*1234".
  /\bDebitk\.\s*\d+(?:\s+\d{4}-\d{2})?(?:\s+VISA\s+Debit)?/gi,
  /\b\d{4}(?:[ -]?[\d*]{4}){3}\b/g,
  /\*{1,}\s?\d{4}\b/g,
  // SEPA fields (EREF+…, MREF+…, CRED+…), up to the next space, and their empty "NOTPROVIDED".
  /\b(?:EREF|KREF|MREF|CRED|DEBT|COAM|OAMT|IBAN|BIC|ABWA|ABWE)\+\S*/g,
  /\bNOTPROVIDED\b/gi,
  // A phone number: international ("+49 151 23456789", "0049 …") or German ("0941 123456", "0151/2345678"). Seven
  // digits at least, so no amount or date is taken.
  /(?:\+|\b00)[1-9]\d{0,2}(?:[ /-]?\d){6,13}\b/g,
  /\b0[1-9]\d{1,4}(?:[ /-]?\d){4,10}\b/g,
  // Any run of eight digits or more: a reference, a customer or a mandate number.
  /\b\d{8,}\b/g,
];

/** The text with every account, card, reference and phone number and every email taken out, spaces tidied. */
export function scrub(text: string): string {
  let value = text;
  for (const mask of MASKS) value = value.replace(mask, ' ');
  return value
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Every string in a JSON value scrubbed, keys and the rest kept as they are. */
export function scrubJson(value: Json): Json {
  if (typeof value === 'string') return scrub(value);
  if (Array.isArray(value)) return value.map(scrubJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, scrubJson(inner)]));
  }
  return value;
}
