// Settings → Import and export in English (CSV import and export, docs/superpowers/plans/2026-11-09-csv-import-export.md):
// the entries as a spreadsheet file; the bank statement import follows.

export const importExport = {
  /** The row on the Settings list. */
  summary: 'Your entries as a spreadsheet file',
  export: {
    heading: 'Export to a spreadsheet',
    hint: 'Saves every entry as a CSV file for Excel, Numbers or Google Sheets. To move your data to another phone, use the backup instead.',
    empty: 'There are no entries to export yet.',
    button: 'Export entries',
    /** The share sheet's title for the file. */
    shareTitle: 'StudentsBudget entries',
    shared: 'Entries shared.',
    downloaded: (fileName: string) => `Download started: ${fileName}`,
    shareFailed: "The share sheet didn't open. You can download the file instead.",
    downloadInstead: 'Download instead',
    failed: 'Could not export your entries.',
  },
  /** The file's columns besides those named like the entry form's fields (date, type, category, account, amount, note). */
  columns: { currency: 'Currency', eur: 'Amount in EUR' },
  /** A transfer's category cell: where the money went. */
  transferTo: (account: string) => `To ${account}`,
};
