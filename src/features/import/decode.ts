// Reading a bank statement file's bytes as text (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md).
// Banks export UTF-8 (DKB, N26, Revolut, often with a BOM) or Windows-1252 (Sparkasse, older DKB files); nothing in the
// file says which, so valid UTF-8 is read as UTF-8 and anything else as Windows-1252, which reads every byte.

export type StatementEncoding = 'utf-8' | 'windows-1252';

/** The file's text, without a byte order mark, and the encoding it was read in. */
export function decodeStatement(bytes: Uint8Array): { text: string; encoding: StatementEncoding } {
  try {
    // `fatal` throws on bytes that aren't UTF-8; the decoder drops a leading BOM itself.
    return { text: stripBom(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), encoding: 'utf-8' };
  } catch {
    return { text: stripBom(new TextDecoder('windows-1252').decode(bytes)), encoding: 'windows-1252' };
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
