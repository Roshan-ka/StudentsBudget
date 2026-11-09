import type { IsoDate } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { guessDecimalMark, parseStatementAmount } from './amounts';
import { cellKey, type Separator } from './csv';
import { guessDateOrder, parseStatementDate } from './dates';
import type { Mapping } from './profiles';

// A statement's table read through a mapping (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md):
// each row becomes a dated, signed amount with its text, or a row the import couldn't read. Nothing here decides what a
// row becomes in the app (that is planImport's): this only reads what the bank wrote.

/** A statement's header row and the rows below it. */
export type Table = { separator: Separator; header: string[]; rows: string[][] };

/** What the bank says a row is: a payment, a top-up of this account, a cash withdrawal, or a move inside the bank. */
export type RowKind = 'payment' | 'topUp' | 'cash' | 'internal';

export type StatementRow = {
  /** Its place among the table's rows, from 1. */
  index: number;
  date: IsoDate;
  /** In the row's currency's minor units; negative for money out. A fee is already taken off. */
  amountMinor: Minor;
  /** The row's currency code as the bank wrote it ("EUR"), or null when the file has none (the account's, then). */
  currency: string | null;
  payee: string;
  purpose: string;
  bookingText: string;
  pending: boolean;
  kind: RowKind;
};

/** A row without a readable date or amount, with its text, so the summary can show it. */
export type UnreadRow = { index: number; problem: 'date' | 'amount'; text: string };

export type ReadRows = { rows: StatementRow[]; unread: UnreadRow[] };

/** The row's cells joined, for a row the import couldn't read. */
const rowText = (row: readonly string[]) => tidy(row.filter((cell) => cell.trim() !== '').join(' · ')).slice(0, 160);

/** Whitespace collapsed (the banks join SEPA lines with runs of spaces), trimmed. */
function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The upper-case, underscore form a bank's type is compared in ("Card Payment" and "CARD_PAYMENT" alike). */
function typeKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '_');
}

/** The SEPA tags a purpose field can hold, in the order banks write them. */
const SEPA_TAG = /(?:EREF|KREF|MREF|CRED|DEBT|COAM|OAMT|SVWZ|ABWA|ABWE|IBAN|BIC)\+/;

/** The text after `tag` up to the next SEPA tag, or the whole text when the tag isn't there. */
export function sepaText(text: string, tag: string): string {
  const at = text.indexOf(tag);
  if (at === -1) return text;
  const rest = text.slice(at + tag.length);
  const next = SEPA_TAG.exec(rest);
  return next === null ? rest : rest.slice(0, next.index);
}

export function readRows(table: Table, mapping: Mapping): ReadRows {
  const indexOf = new Map(table.header.map((name, index) => [cellKey(name), index] as const));
  const column = (name: string | undefined) => (name === undefined ? -1 : (indexOf.get(cellKey(name)) ?? -1));
  const cell = (row: readonly string[], index: number) => (index === -1 ? '' : (row[index] ?? '').trim());

  const date = column(mapping.date.column);
  const dateFallback = column(mapping.date.fallback);
  const amount: { one: number } | { out: number; in: number } =
    'column' in mapping.amount
      ? { one: column(mapping.amount.column) }
      : { out: column(mapping.amount.out), in: column(mapping.amount.in) };
  const fee = column(mapping.fee);
  const currency = column(mapping.currencyColumn);
  const names = mapping.payee;
  const payee = 'out' in names ? { out: names.out.map(column), in: names.in.map(column) } : { out: names.map(column), in: names.map(column) };
  const purpose = mapping.purpose.map(column);
  const bookingText = column(mapping.bookingText);
  const state = column(mapping.state?.column);
  const booked = new Set((mapping.state?.booked ?? []).map(cellKey));
  const kind = column(mapping.kind?.column);
  const internalWhen = column(mapping.internalWhen?.column);
  const summaryWords = new Set((mapping.summaryWords ?? []).map(cellKey));

  // The order and the mark the values themselves show win over the expected ones: a spreadsheet may have saved the file
  // again in its own format (dates as 31.10.2026, amounts as -7,95).
  const order = guessDateOrder(
    table.rows.map((row) => cell(row, date) || cell(row, dateFallback)),
    mapping.date.order,
  );
  const amountCells = table.rows.flatMap((row) => ('one' in amount ? [cell(row, amount.one)] : [cell(row, amount.out), cell(row, amount.in)]));
  const decimal = guessDecimalMark(amountCells, mapping.decimal);
  const parse = (text: string) => (text === '' ? null : parseStatementAmount(text, decimal));

  const rows: StatementRow[] = [];
  const unread: UnreadRow[] = [];
  table.rows.forEach((row, at) => {
    const index = at + 1;
    if (row.every((value) => value.trim() === '')) return;
    if (summaryWords.size > 0 && row.some((value) => summaryWords.has(cellKey(value)))) return;

    const day = parseStatementDate(cell(row, date), order) ?? parseStatementDate(cell(row, dateFallback), order);
    if (day === null) {
      unread.push({ index, problem: 'date', text: rowText(row) });
      return;
    }

    let minor: Minor | null;
    if ('one' in amount) {
      minor = parse(cell(row, amount.one));
    } else {
      // Money out and money in apart: either side, whichever has a number, and never both.
      const out = parse(cell(row, amount.out));
      const into = parse(cell(row, amount.in));
      minor = out !== null && out !== 0 ? -Math.abs(out) : into !== null ? Math.abs(into) : out;
    }
    if (minor === null) {
      unread.push({ index, problem: 'amount', text: rowText(row) });
      return;
    }
    const charged = parse(cell(row, fee));
    if (charged !== null) minor -= Math.abs(charged);

    const payeeColumns = minor < 0 ? payee.out : payee.in;
    const purposeText = tidy(purpose.map((index) => cell(row, index)).filter((text) => text !== '').join(' '));
    const bankType = typeKey(cell(row, kind));
    const internal =
      (mapping.kind?.internal ?? []).includes(bankType) ||
      (mapping.internalWhen?.values ?? []).includes(typeKey(cell(row, internalWhen)));
    const stateValue = cell(row, state);

    rows.push({
      index,
      date: day,
      amountMinor: minor,
      currency: cell(row, currency).toUpperCase() || (mapping.currency ?? null),
      payee: tidy(payeeColumns.map((index) => cell(row, index)).find((text) => text !== '') ?? ''),
      purpose: tidy(mapping.purposeAfter ? sepaText(purposeText, mapping.purposeAfter) : purposeText),
      bookingText: tidy(cell(row, bookingText)),
      pending: stateValue !== '' && booked.size > 0 && !booked.has(cellKey(stateValue)),
      kind: internal
        ? 'internal'
        : mapping.kind?.topUp.includes(bankType)
          ? 'topUp'
          : mapping.kind?.cash.includes(bankType)
            ? 'cash'
            : 'payment',
    });
  });
  return { rows, unread };
}
