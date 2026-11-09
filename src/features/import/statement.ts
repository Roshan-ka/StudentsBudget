import { cellKey, parseCsv, SEPARATORS, type Separator } from './csv';
import { decodeStatement } from './decode';
import { isBankProfile, recognise, type BankProfile, type UnsupportedProfile } from './profiles';
import { readRows, type ReadRows, type Table } from './read-rows';

// Opening a statement file (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md): its bytes are read as
// text, its header row is found (DKB puts account lines above it), and the bank is recognised by the header's names.
// A file the import doesn't know comes back as a table for the column matching by hand.

/** Bigger files are refused before reading: a statement for a few weeks is a few kilobytes. */
export const MAX_STATEMENT_BYTES = 2_000_000;
export const MAX_STATEMENT_ROWS = 5_000;

/** How many lines from the top a header row may start at. */
const HEADER_WITHIN = 20;

export type Statement =
  | { kind: 'bank'; profile: BankProfile; table: Table; read: ReadRows }
  | { kind: 'unsupported'; profile: UnsupportedProfile }
  | { kind: 'unknown'; table: Table }
  | { kind: 'empty' }
  | { kind: 'tooBig' };

export function openStatement(bytes: Uint8Array): Statement {
  if (bytes.length > MAX_STATEMENT_BYTES) return { kind: 'tooBig' };
  const { text } = decodeStatement(bytes);

  for (const separator of SEPARATORS) {
    const lines = parseCsv(text, separator);
    for (let at = 0; at < Math.min(HEADER_WITHIN, lines.length); at += 1) {
      const profile = recognise(lines[at]);
      if (profile === null) continue;
      if (!isBankProfile(profile)) return { kind: 'unsupported', profile };
      const table = tableAt(lines, at, separator);
      if (table.rows.length > MAX_STATEMENT_ROWS) return { kind: 'tooBig' };
      return { kind: 'bank', profile, table, read: readRows(table, profile) };
    }
  }

  const table = guessTable(text);
  if (table === null || table.rows.length === 0) return { kind: 'empty' };
  if (table.rows.length > MAX_STATEMENT_ROWS) return { kind: 'tooBig' };
  return { kind: 'unknown', table };
}

/** The header at `at` and the rows below it that have its columns (one fewer allowed: a missing trailing separator). */
function tableAt(lines: string[][], at: number, separator: Separator): Table {
  const header = lines[at];
  const width = header.length;
  return {
    separator,
    header,
    rows: lines.slice(at + 1).filter((row) => row.length >= width - 1 && row.some((cell) => cell.trim() !== '')),
  };
}

/**
 * A CSV the import doesn't know: the separator that gives the most rows of one width (two columns at least) wins, `;`
 * on a tie, and the first row of that width within the top lines is the header.
 */
function guessTable(text: string): Table | null {
  let best: { lines: string[][]; separator: Separator; width: number; count: number } | null = null;
  for (const separator of SEPARATORS) {
    const lines = parseCsv(text, separator);
    const counts = new Map<number, number>();
    for (const row of lines) if (row.length >= 2) counts.set(row.length, (counts.get(row.length) ?? 0) + 1);
    for (const [width, count] of counts) {
      if (best === null || count > best.count) best = { lines, separator, width, count };
    }
  }
  if (best === null) return null;
  const { lines, separator, width } = best;
  const at = lines.findIndex((row, index) => index < HEADER_WITHIN && row.length === width && row.some((cell) => cellKey(cell) !== ''));
  return at === -1 ? null : tableAt(lines, at, separator);
}
