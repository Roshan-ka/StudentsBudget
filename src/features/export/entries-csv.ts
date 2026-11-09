import type { Account, Entry } from '@/db/types';
import { categoryNameIn } from '@/i18n/category-name';
import type { Messages } from '@/i18n/messages';
import { DEFAULT_REGION, REGIONS, type Region } from '@/i18n/regions';
import { formatDate, todayIso } from '@/lib/dates';
import type { Minor } from '@/lib/money';

// The entries as a CSV file for a spreadsheet (CSV export, docs/superpowers/plans/2026-11-09-csv-import-export.md):
// one row per expense, income and transfer, in the region's format (Excel set to German reads `;` and a decimal comma),
// with the headers, types and category names in the phone's language. The JSON backup stays the full copy for
// another phone: this file is for reading and sums, not for importing again.

/** UTF-8's byte order mark: without it, Excel reads the file in the system's code page and garbles umlauts. */
const BOM = '﻿';

/** An amount in minor units as a spreadsheet reads a number: no thousands separator, two decimals, the region's mark. */
function amountCell(minor: Minor, decimal: string): string {
  const sign = minor < 0 ? '-' : '';
  const value = Math.abs(minor);
  return `${sign}${Math.floor(value / 100)}${decimal}${String(value % 100).padStart(2, '0')}`;
}

/**
 * A text field: quoted when it holds the separator, a quote or a line break. Text that starts like a formula
 * (= + - @, a tab or a return) gets a `'` first, so a spreadsheet shows it rather than running it: a bank's text or a
 * note can start with anything.
 */
function textCell(text: string, separator: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return safe.includes(separator) || /["\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The file's name for the day it is made: `studentsbudget-entries-2026-11-09.csv`. */
export function entriesFileName(now: Date): string {
  return `studentsbudget-entries-${todayIso(now)}.csv`;
}

/** The CSV text, oldest entry first, with a BOM and CRLF line ends. */
export function entriesCsv(entries: readonly Entry[], accounts: readonly Account[], t: Messages, region: Region = DEFAULT_REGION): string {
  const { separator, decimal } = REGIONS[region].csv;
  const names = new Map(accounts.map((account) => [account.id, account]));
  const nameOf = (id: string) => names.get(id)?.name ?? t.entries.list.unknownAccount;
  const columns = t.importExport.columns;

  const header = [
    t.common.dateField.label,
    t.entries.form.typeLabel,
    t.entries.form.category,
    t.entries.form.account,
    t.entries.form.amount,
    columns.currency,
    columns.eur,
    t.entries.form.note,
  ];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const rows = sorted.map((entry) => {
    const type = entry.type === 'transfer' ? t.entries.transfer : t.entries.form[entry.type];
    const category = entry.type === 'transfer' ? t.importExport.transferTo(nameOf(entry.toAccountId)) : categoryNameIn(t, entry.categoryId);
    return [
      formatDate(entry.date, region),
      textCell(type, separator),
      textCell(category, separator),
      textCell(nameOf(entry.accountId), separator),
      amountCell(entry.amountMinor, decimal),
      names.get(entry.accountId)?.currency ?? '',
      amountCell(entry.eurMinor, decimal),
      textCell(entry.note, separator),
    ].join(separator);
  });
  return BOM + [header.map((cell) => textCell(cell, separator)).join(separator), ...rows].join('\r\n') + '\r\n';
}
