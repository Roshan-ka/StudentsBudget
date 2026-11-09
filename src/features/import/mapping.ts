import { readPref, writePref } from '@/lib/phone-pref';
import { parseStatementAmount } from './amounts';
import { cellKey } from './csv';
import { guessDateOrder, parseStatementDate, type DateOrder } from './dates';
import type { Mapping } from './profiles';
import type { Table } from './read-rows';

// Matching a CSV's columns by hand (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md, chunk 8): for a
// file the import doesn't recognise, the student says which column holds the date, the amount (one signed column, or
// money out and money in apart), who was paid and, if they like, the details and the currency. The app guesses a first
// choice from the values, and remembers each choice per header row on this phone, so the next file from the same bank
// opens matched.

/** A choice of columns by their place in the header. */
export type ColumnChoice = {
  date: number;
  dateOrder: DateOrder;
  amount: { kind: 'one'; column: number } | { kind: 'two'; out: number; in: number };
  payee: number;
  purpose: number | null;
  currency: number | null;
};

/** Where this phone keeps its choices, by header row (localStorage, through `writePref`: not synced, not backed up). */
export const COLUMNS_PREF = 'studentsbudget-import-columns';

/** How many header rows the phone remembers; the oldest goes first. */
const REMEMBERED = 10;

/** A header row as the remembered choices are keyed: its names, compared as `cellKey` does. */
export function headerKey(header: readonly string[]): string {
  return header.map(cellKey).join('|');
}

/** The mapping `readRows` reads with, from a choice. Columns are named by the header's own names. */
export function mappingOf(choice: ColumnChoice, header: readonly string[]): Mapping {
  const name = (index: number) => header[index] ?? '';
  const values: Mapping = {
    date: { column: name(choice.date), order: choice.dateOrder },
    amount: choice.amount.kind === 'one' ? { column: name(choice.amount.column) } : { out: name(choice.amount.out), in: name(choice.amount.in) },
    // The values decide the mark (`readRows` guesses it); a German file most likely writes a comma.
    decimal: ',',
    payee: [name(choice.payee)],
    purpose: choice.purpose === null ? [] : [name(choice.purpose)],
  };
  return choice.currency === null ? values : { ...values, currencyColumn: name(choice.currency) };
}

/** Whether a choice's columns are all in the header and the required ones differ. */
export function isComplete(choice: ColumnChoice, header: readonly string[]): boolean {
  const inHeader = (index: number | null) => index === null || (index >= 0 && index < header.length);
  const amounts = choice.amount.kind === 'one' ? [choice.amount.column] : [choice.amount.out, choice.amount.in];
  const required = [choice.date, ...amounts, choice.payee];
  return [...required, choice.purpose, choice.currency].every(inHeader) && new Set(required).size === required.length;
}

/** The share of a column's non-empty values that `test` accepts (0 for an empty column). */
function share(table: Table, column: number, test: (value: string) => boolean): number {
  const values = table.rows.map((row) => (row[column] ?? '').trim()).filter((value) => value !== '');
  return values.length === 0 ? 0 : values.filter(test).length / values.length;
}

// Names that say a column is money out, or money in. Never a bare "in" or "out": "Amount in EUR" is no money in.
const OUT_NAMES = /\b(soll|ausgang|ausgaben?|lastschrift|belastung|debit|withdrawals?|money out|paid out)\b/i;
const IN_NAMES = /\b(haben|eingang|einnahmen?|gutschrift|credit|deposits?|money in|paid in)\b/i;
const CURRENCY_NAMES = /\b(w(ä|ae)hrung|currency|devise|moneda)\b/i;

/**
 * A first choice from the file's values and names: the date column is the one whose values are dates; the amount is one
 * signed column, or two whose names say out and in (Soll/Haben, Debit/Credit); who was paid is the text column with the
 * most different values, the details the next; a currency column holds three-letter codes.
 */
export function guessChoice(table: Table): ColumnChoice {
  const columns = table.header.map((_, index) => index);
  const anyDate = (value: string) => ['dmy', 'ymd', 'mdy'].some((order) => parseStatementDate(value, order as DateOrder) !== null);
  const anyAmount = (value: string) => parseStatementAmount(value, ',') !== null || parseStatementAmount(value, '.') !== null;

  const date = columns.find((column) => share(table, column, anyDate) >= 0.8) ?? 0;
  const amountColumns = columns.filter((column) => column !== date && share(table, column, anyAmount) >= 0.8);
  const out = amountColumns.find((column) => OUT_NAMES.test(table.header[column]));
  const into = amountColumns.find((column) => column !== out && IN_NAMES.test(table.header[column]));
  const amount: ColumnChoice['amount'] =
    out !== undefined && into !== undefined ? { kind: 'two', out, in: into } : { kind: 'one', column: amountColumns[0] ?? Math.min(1, columns.length - 1) };

  const currency = columns.find((column) => CURRENCY_NAMES.test(table.header[column]) || share(table, column, (value) => /^[A-Z]{3}$/.test(value)) >= 0.8) ?? null;
  const used = new Set([date, ...(amount.kind === 'one' ? [amount.column] : [amount.out, amount.in]), ...(currency === null ? [] : [currency])]);
  const distinct = (column: number) => new Set(table.rows.map((row) => (row[column] ?? '').trim()).filter((value) => value !== '')).size;
  const texts = columns.filter((column) => !used.has(column)).sort((a, b) => distinct(b) - distinct(a) || a - b);

  const dates = table.rows.map((row) => row[date] ?? '');
  return {
    date,
    dateOrder: guessDateOrder(dates, 'dmy'),
    amount,
    payee: texts[0] ?? columns.find((column) => !used.has(column)) ?? 0,
    purpose: texts[1] ?? null,
    currency,
  };
}

/** The choice this phone remembers for this header row, if it still fits it. */
export function rememberedChoice(header: readonly string[]): ColumnChoice | null {
  try {
    const stored = JSON.parse(readPref(COLUMNS_PREF) ?? '{}') as Record<string, { choice: ColumnChoice }>;
    const choice = stored[headerKey(header)]?.choice;
    return choice !== undefined && isComplete(choice, header) ? choice : null;
  } catch {
    return null;
  }
}

/** Remembers the choice for this header row, keeping the newest REMEMBERED rows. */
export function rememberChoice(header: readonly string[], choice: ColumnChoice, now = Date.now()): void {
  let stored: Record<string, { choice: ColumnChoice; at: number }> = {};
  try {
    stored = JSON.parse(readPref(COLUMNS_PREF) ?? '{}') as typeof stored;
  } catch {
    // Unreadable: start again.
  }
  stored[headerKey(header)] = { choice, at: now };
  const newest = Object.entries(stored)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, REMEMBERED);
  writePref(COLUMNS_PREF, JSON.stringify(Object.fromEntries(newest)));
}
