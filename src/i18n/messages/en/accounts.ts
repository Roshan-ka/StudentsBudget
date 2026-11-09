// Accounts in English: Settings → Accounts, moving money between them (transfer.ts's errors too) and the exchange
// rates. A transfer's amount, note, date check and Save changes are the entry form's (`entries.form`).

export const accounts = {
  heading: 'Accounts',
  /** The Accounts row on the Settings list: how many, and their total in euros. */
  summary: (count: number, total: string) => `${count} ${count === 1 ? 'account' : 'accounts'} · ${total}`,
  summaryNone: 'No accounts yet',
  add: 'Add account',
  none: 'No accounts yet. Add your bank account, your wallet or your account back home.',
  kinds: { bank: 'Bank', cash: 'Cash' },
  name: 'Name',
  type: 'Type',
  currency: 'Currency',
  opening: 'Opening balance',
  currencyLocked: "The currency can't change once the account has entries, or a fixed cost or income runs through it.",
  save: 'Save account',
  cancel: 'Cancel',
  edit: 'Edit',
  delete: 'Delete',
  makeDefault: 'Make default',
  editAccount: (name: string) => `Edit ${name}`,
  deleteAccount: (name: string) => `Delete ${name}`,
  deleteQuestion: (name: string) => `Delete ${name}?`,
  makeDefaultOf: (name: string) => `Make default: ${name}`,
  defaultMark: 'Default for new entries',
  nowDefault: (name: string) => `${name} is now the default for new entries.`,
  total: 'Total',
  /** "Without INR, USD: no exchange rate yet." */
  withoutRates: (currencies: string) => `Without ${currencies}: no exchange rate yet.`,
  errors: {
    name: 'Enter a name.',
    opening: 'Enter the opening balance as a number, like 250 or 12.50.',
    saveFailed: 'Could not save the account.',
    inUse: 'This account has entries. Delete them first.',
    hasSchedule:
      'This account pays or receives a fixed cost or income. Change that first in Settings → Plan → Fixed costs and income.',
    deleteFailed: 'Could not delete the account.',
    defaultFailed: 'Could not change the default account.',
  },
  transfer: {
    open: 'Move money between accounts',
    needsTwo: 'Add a second account to move money between your accounts.',
    from: 'From',
    to: 'To',
    received: 'Amount received',
    move: 'Move money',
    saved: 'Transfer saved.',
    saveFailed: 'Could not save the transfer.',
    cancel: 'Cancel',
    /** buildTransfer's answers; an amount or a rate missing reads as an expense's would (`entries.errors`). */
    pickTwo: 'Pick two different accounts.',
    enterReceived: 'Enter the amount received.',
  },
  rates: {
    heading: 'Exchange rates',
    /** "1 € = 95.12 INR · ECB, 30 Oct". */
    rate: (rate: string, currency: string, source: string) => `1 € = ${rate} ${currency} · ${source}`,
    setByYou: 'set by you',
    ecb: (day: string) => `ECB, ${day}`,
    noRate: (currency: string) => `No rate yet. Enter one to log ${currency} spending.`,
    yourRate: (currency: string) => `Your rate for ${currency} per €1`,
    save: 'Save rate',
    useEcb: 'Use ECB rate again',
    invalid: 'Enter a rate greater than zero, like 95.12.',
    saveFailed: 'Could not save the rate.',
    ecbFailed: 'Could not switch back to the ECB rate.',
  },
};
