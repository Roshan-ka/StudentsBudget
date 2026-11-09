// CSV as RFC 4180 reads it (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md): fields in double quotes
// may hold the separator, line breaks and doubled quotes (""); lines end in CRLF, LF or CR. Banks quote unevenly (N26
// leaves some fields bare), so a field is quoted only when it starts with a quote.

/** The separators a statement may use: Sparkasse and DKB `;`, N26 and Revolut `,`, a spreadsheet's export perhaps a tab. */
export const SEPARATORS = [';', ',', '\t'] as const;
export type Separator = (typeof SEPARATORS)[number];

/** Every row of the text as its fields, as written (not trimmed). A blank line is left out. */
export function parseCsv(text: string, separator: Separator): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  // Whether anything was read for the current field (so an empty quoted field still counts).
  let started = false;

  const endField = () => {
    row.push(field);
    field = '';
    started = false;
  };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && !started) {
      quoted = true;
      started = true;
    } else if (char === separator) {
      endField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      endRow();
    } else {
      field += char;
      started = true;
    }
  }
  if (field !== '' || started || row.length > 0) endRow();
  return rows;
}

/** A header cell or a column name as compared: trimmed, spaces collapsed, lower case. */
export function cellKey(cell: string): string {
  return cell.replace(/\s+/g, ' ').trim().toLowerCase();
}
