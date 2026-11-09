import type { CurrencyCode } from '@/lib/money';
import type { DecimalMark } from './amounts';
import { cellKey } from './csv';
import type { DateOrder } from './dates';

// The bank statements the import knows (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md), as data:
// a profile names the columns it reads, and a file is recognised by its header names, never by position (N26, DKB and
// Revolut have each changed their layout at least once). No bank publishes its layout: these come from open-source
// parsers and their test files, and forum posts quoting real exports, read on 09.11.2026:
// - Sparkasse: rubti/beancount-import `giro.py`; daalja's `spk_csv-camt2homebank.py` gist; Firefly III
//   `import-configurations/de/sparkasse`; gnucash-de, 20.08.2017 (MT940).
// - DKB: hamvocke/dkb2homebank (`testfiles/`); siddhantgoel/beancount-dkb (`extractors/ec.py`, `CHANGELOG.md`).
// - N26: siddhantgoel/beancount-n26; leolabs/you-need-a-parser (`ynap-parsers/src/de/n26`); homebanking-hilfe.de t=27517.
// - Revolut: ledger-autosync `examples/plugins/revolut.py`; ofxstatement-revolut (mlaitinen, Ralphovi).
// Columns that hold an account number, an IBAN, a BIC, a card number or a mandate are never named here, so they are
// never read. A layout that turns out wrong in a real export is a fix to this data.

/** How a statement's columns are read. Column names are compared with `cellKey` (trimmed, any case). */
export type Mapping = {
  /** The booking date, or `fallback` where it is empty; `order` is the expected order, which the values may overrule. */
  date: { column: string; fallback?: string; order: DateOrder };
  /** One signed column, or money out and money in apart (a CSV matched by hand). */
  amount: { column: string } | { out: string; in: string };
  /** The expected decimal mark, which the values may overrule (a spreadsheet saves the file in its own format). */
  decimal: DecimalMark;
  /** A fee charged on top of the amount (Revolut): it always costs money. */
  fee?: string;
  /** The row's own currency; without it, every row is in `currency`, or else in the account's. */
  currencyColumn?: string;
  currency?: CurrencyCode;
  /** Who was paid, or paid: the first of these columns with text in it. DKB writes them apart by direction. */
  payee: readonly string[] | { out: readonly string[]; in: readonly string[] };
  /** What it was for. With `purposeAfter`, only the text after that SEPA tag (Sparkasse's MT940: `SVWZ+`). */
  purpose: readonly string[];
  purposeAfter?: string;
  /** The bank's own word for the kind of booking ("KARTENZAHLUNG", "Presentment"), kept for telling transfers apart. */
  bookingText?: string;
  /** A row whose value here isn't one of `booked` is still pending. An empty value counts as booked. */
  state?: { column: string; booked: readonly string[] };
  /** The bank's own type of row (upper case, spaces as `_`): a top-up, a cash withdrawal, a move inside the bank. */
  kind?: {
    column: string;
    topUp: readonly string[];
    cash: readonly string[];
    internal?: readonly string[];
  };
  /** Rows that are moves inside the bank, by another column (Revolut's savings vault, `Product` `Deposit`). */
  internalWhen?: { column: string; values: readonly string[] };
  /** Rows that aren't bookings at all: a daily balance, a closing line (DKB). Any cell equal to one of these words. */
  summaryWords?: readonly string[];
};

export type BankName = 'Sparkasse' | 'DKB' | 'N26' | 'Revolut';

export type BankProfile = Mapping & {
  id: string;
  bank: BankName;
  /** Every one of these names is in the file's header row. */
  header: readonly string[];
  /** Words in an account's name that make it the one the statement is for (`sparkasse`). */
  accountHints: readonly string[];
};

/** A statement the import recognises but can't read yet: it says so, rather than matching its columns by hand. */
export type UnsupportedProfile = { id: string; bank: BankName; header: readonly string[]; what: 'creditCard' };

const SPARKASSE_COMMON = {
  bank: 'Sparkasse',
  date: { column: 'Buchungstag', fallback: 'Valutadatum', order: 'dmy' },
  amount: { column: 'Betrag' },
  decimal: ',',
  currencyColumn: 'Waehrung',
  payee: ['Beguenstigter/Zahlungspflichtiger'],
  bookingText: 'Buchungstext',
  state: { column: 'Info', booked: ['Umsatz gebucht'] },
  accountHints: ['sparkasse'],
} as const;

export const BANK_PROFILES: readonly BankProfile[] = [
  {
    // CSV-CAMT V2: 17 columns, every field quoted, Windows-1252.
    ...SPARKASSE_COMMON,
    id: 'sparkasse-camt',
    header: ['Auftragskonto', 'Buchungstag', 'Valutadatum', 'Buchungstext', 'Verwendungszweck', 'Beguenstigter/Zahlungspflichtiger', 'Kontonummer/IBAN', 'Betrag', 'Waehrung'],
    purpose: ['Verwendungszweck'],
  },
  {
    // CSV-MT940: the purpose holds the SEPA fields together (EREF+…MREF+…SVWZ+text); the readable text follows SVWZ+.
    ...SPARKASSE_COMMON,
    id: 'sparkasse-mt940',
    header: ['Auftragskonto', 'Buchungstag', 'Valutadatum', 'Buchungstext', 'Verwendungszweck', 'Beguenstigter/Zahlungspflichtiger', 'BLZ', 'Betrag', 'Waehrung'],
    purpose: ['Verwendungszweck'],
    purposeAfter: 'SVWZ+',
  },
  {
    // Since late 2023: a few account lines above the header; `;` (or `,` since about 09-2024); UTF-8.
    id: 'dkb',
    bank: 'DKB',
    header: ['Buchungsdatum', 'Status', 'Zahlungspflichtige*r', 'Zahlungsempfänger*in', 'Verwendungszweck', 'Umsatztyp', 'Betrag (€)'],
    date: { column: 'Buchungsdatum', order: 'dmy' },
    amount: { column: 'Betrag (€)' },
    decimal: ',',
    currency: 'EUR',
    // The other name column is the account holder's own.
    payee: { out: ['Zahlungsempfänger*in'], in: ['Zahlungspflichtige*r'] },
    purpose: ['Verwendungszweck'],
    bookingText: 'Umsatztyp',
    // Only "Gebucht" is confirmed; anything else (most likely "Vorgemerkt") waits as pending.
    state: { column: 'Status', booked: ['Gebucht'] },
    summaryWords: ['Tagessaldo', 'Abschluss'],
    accountHints: ['dkb'],
  },
  {
    // Before 2023 (archived files): ISO-8859-1, every line ending in `;`, 6 to 9 lines above the header.
    id: 'dkb-old',
    bank: 'DKB',
    header: ['Buchungstag', 'Wertstellung', 'Buchungstext', 'Auftraggeber / Begünstigter', 'Verwendungszweck', 'Betrag (EUR)'],
    date: { column: 'Buchungstag', order: 'dmy' },
    amount: { column: 'Betrag (EUR)' },
    decimal: ',',
    currency: 'EUR',
    payee: ['Auftraggeber / Begünstigter'],
    purpose: ['Verwendungszweck'],
    bookingText: 'Buchungstext',
    summaryWords: ['Tagessaldo', 'Abschluss'],
    accountHints: ['dkb'],
  },
  {
    // The current export (from the web app, one file per account or Space): `,` with uneven quoting, UTF-8.
    id: 'n26',
    bank: 'N26',
    header: ['Booking Date', 'Partner Name', 'Payment Reference', 'Amount (EUR)'],
    date: { column: 'Booking Date', order: 'ymd' },
    amount: { column: 'Amount (EUR)' },
    decimal: '.',
    currency: 'EUR',
    payee: ['Partner Name'],
    purpose: ['Payment Reference'],
    bookingText: 'Type',
    accountHints: ['n26'],
  },
  {
    // Until about 2021, in English.
    id: 'n26-old',
    bank: 'N26',
    header: ['Date', 'Payee', 'Transaction type', 'Payment reference', 'Amount (EUR)'],
    date: { column: 'Date', order: 'ymd' },
    amount: { column: 'Amount (EUR)' },
    decimal: '.',
    currency: 'EUR',
    payee: ['Payee'],
    purpose: ['Payment reference'],
    bookingText: 'Transaction type',
    accountHints: ['n26'],
  },
  {
    // Until about 2021, from the German app.
    id: 'n26-old-de',
    bank: 'N26',
    header: ['Datum', 'Empfänger', 'Transaktionstyp', 'Verwendungszweck', 'Betrag (EUR)'],
    date: { column: 'Datum', order: 'ymd' },
    amount: { column: 'Betrag (EUR)' },
    decimal: '.',
    currency: 'EUR',
    payee: ['Empfänger'],
    purpose: ['Verwendungszweck'],
    bookingText: 'Transaktionstyp',
    accountHints: ['n26'],
  },
  {
    // The personal account's statement: `,`, mostly unquoted, UTF-8. A file can mix currencies. Pending, reverted and
    // declined rows are in it; only COMPLETED counts. The fee is apart from the amount.
    id: 'revolut',
    bank: 'Revolut',
    header: ['Type', 'Product', 'Started Date', 'Completed Date', 'Description', 'Amount', 'Fee', 'Currency', 'State'],
    date: { column: 'Completed Date', fallback: 'Started Date', order: 'ymd' },
    amount: { column: 'Amount' },
    decimal: '.',
    fee: 'Fee',
    currencyColumn: 'Currency',
    payee: ['Description'],
    purpose: [],
    bookingText: 'Type',
    state: { column: 'State', booked: ['COMPLETED'] },
    kind: { column: 'Type', topUp: ['TOPUP'], cash: ['ATM'], internal: ['EXCHANGE'] },
    internalWhen: { column: 'Product', values: ['DEPOSIT'] },
    accountHints: ['revolut'],
  },
];

export const UNSUPPORTED_PROFILES: readonly UnsupportedProfile[] = [
  // DKB's Visa card since 2023 (its first line names the card, with the number masked).
  { id: 'dkb-visa', bank: 'DKB', header: ['Belegdatum', 'Beschreibung', 'Betrag (€)', 'Fremdwährungsbetrag'], what: 'creditCard' },
];

/** The profile whose header names are all in this row, or null. */
export function recognise(row: readonly string[]): BankProfile | UnsupportedProfile | null {
  const names = new Set(row.map(cellKey));
  const fits = (header: readonly string[]) => header.every((name) => names.has(cellKey(name)));
  return BANK_PROFILES.find((profile) => fits(profile.header)) ?? UNSUPPORTED_PROFILES.find((profile) => fits(profile.header)) ?? null;
}

export function isBankProfile(profile: BankProfile | UnsupportedProfile): profile is BankProfile {
  return 'date' in profile;
}
