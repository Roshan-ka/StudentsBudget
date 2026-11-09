import type { StatementRow } from './read-rows';

// The note an imported entry gets (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md): who was paid,
// and what for, as the student would read it. Account and card numbers never reach a note (the Concept: no bank data
// kept beyond what the budget needs): an IBAN, a card number, a SEPA mandate or reference, and any long run of digits
// (a reference number) are taken out.

/** The longest note an import writes. */
export const MAX_NOTE = 200;

const MASKS: readonly RegExp[] = [
  // An IBAN: written in blocks of digits ("DE00 1203 0000 …", German and most others), or in one piece of capitals and
  // digits ("GB29NWBK60161331926819"); and the word "IBAN" before it.
  /\b[A-Z]{2}\d{2}(?: ?\d{4}){3,7}(?: ?\d{1,3})?\b/g,
  /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
  /\bIBAN:?(?=\s|$)/g,
  // A card: DKB's "Debitk.99 VISA Debit" and Sparkasse's "Debitk.1 2029-12", a masked number "4930 **** **** 1234",
  // Revolut's "*1234".
  /\bDebitk\.\s*\d+(?:\s+\d{4}-\d{2})?(?:\s+VISA\s+Debit)?/gi,
  /\b\d{4}(?:[ -]?[\d*]{4}){3}\b/g,
  /\*{1,}\s?\d{4}\b/g,
  // SEPA fields: EREF+…, MREF+…, CRED+… and the like, up to the next space; and their empty "NOTPROVIDED".
  /\b(?:EREF|KREF|MREF|CRED|DEBT|COAM|OAMT|IBAN|BIC|ABWA|ABWE)\+\S*/g,
  /\bNOTPROVIDED\b/gi,
  // A card payment's own time stamp ("2026-10-29T18:12"): the entry has its date already.
  /\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?/g,
  // Any run of eight digits or more: a reference, a customer or a mandate number.
  /\b\d{8,}\b/g,
];

function clean(text: string): string {
  let value = text;
  for (const mask of MASKS) value = value.replace(mask, ' ');
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:/·-]+|[\s,;:/·-]+$/g, '')
    .trim();
}

/** "Payee · purpose", each cleaned, either alone when the other has nothing left, at most MAX_NOTE characters. */
export function importNote(row: Pick<StatementRow, 'payee' | 'purpose'>): string {
  const payee = clean(row.payee);
  const purpose = clean(row.purpose);
  const parts = [payee, purpose === payee ? '' : purpose].filter((part) => part !== '' && part !== '-');
  const note = parts.join(' · ');
  return note.length <= MAX_NOTE ? note : `${note.slice(0, MAX_NOTE - 1).trimEnd()}…`;
}
