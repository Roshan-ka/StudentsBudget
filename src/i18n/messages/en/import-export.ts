// Settings → Import and export in English (CSV import and export, docs/superpowers/plans/2026-11-09-csv-import-export.md):
// a bank statement in, the entries out as a spreadsheet file.

export const importExport = {
  /** The row on the Settings list. */
  summary: 'Import a bank statement, or export your entries',
  import: {
    heading: 'Import a bank statement',
    hint:
      "Download a CSV statement from your bank's website or app, then pick it here. Statements from Sparkasse, DKB, " +
      "N26 and Revolut are recognised. The file is read on this phone only and isn't kept.",
    file: 'Statement file (CSV)',
    noPlan: 'Set up your plan first: the import counts each row against it.',
    toSetup: 'Go to setup',
    reading: 'Reading the file…',
    recognised: (bank: string, rows: number, from: string, to: string) =>
      `${bank}: ${rows} ${rows === 1 ? 'row' : 'rows'}, ${from} to ${to}`,
    account: 'Import into',
    submit: 'Import',
    choose: 'Choose another file',
    problems: {
      tooBig: 'This file is too big for a statement: at most 2 MB and 5,000 rows.',
      empty: 'This file has no rows the app can read.',
      unknown: "The app doesn't recognise this file's columns. Statements from Sparkasse, DKB, N26 and Revolut work.",
      creditCard: (bank: string) =>
        `This is a ${bank} credit card export, which the app can't read yet. Export your current account's statement instead.`,
      failed: 'Could not read the file.',
      noRate: (currency: string) =>
        `There's no exchange rate for ${currency} yet. Enter one in Settings → Accounts and transfers, then import again.`,
      noAccount: 'That account no longer exists. Choose another one.',
      saveFailed: 'Could not save the import.',
    },
  },
  /** What an import did, shown in place of its form. */
  result: {
    heading: 'Import finished',
    added: (entries: number, transfers: number) => {
      const counted = `${entries} ${entries === 1 ? 'entry' : 'entries'} added`;
      return transfers === 0 ? `${counted}.` : `${counted}, ${transfers} of them ${transfers === 1 ? 'a transfer' : 'transfers'}.`;
    },
    nothing: 'Nothing new: every row was already in the app, or was left out.',
    opening: (account: string, amount: string) =>
      `The starting balance of ${account} moved by ${amount}: some rows came before you added the account, so its balance today stays the same.`,
    skipped: (count: number) => `Left out (${count})`,
    reasons: {
      unreadable: 'Could not be read',
      pending: 'Still pending at the bank',
      internal: 'A move inside the bank',
      zero: 'An amount of zero',
      currency: "Not in the account's currency",
      future: 'Dated after today',
      beforePlan: 'From before your plan started',
      otherCurrencyTransfer: 'A transfer to an account in another currency',
      noTransferAccount: 'No account in the app to transfer to',
      duplicate: 'Already in the app',
    },
    undo: 'Undo this import',
    undone: (count: number) => `Import undone: ${count} ${count === 1 ? 'entry' : 'entries'} removed.`,
    another: 'Import another file',
  },
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
