// Entries in English: the list, the entry form, quick add and buildEntry's errors.

export const entries = {
  addEntry: 'Add entry',
  transfer: 'Transfer',
  recurring: 'Recurring',
  noAccount: 'Add an account in Settings first.',
  saveFailed: 'Could not save the entry.',
  list: {
    label: 'Entries',
    unknownAccount: 'Unknown account',
    clear: 'Clear',
    monthNav: 'Month',
    previous: '‹ Previous',
    next: 'Next ›',
    nothingYet: 'Nothing logged here yet.',
  },
  edit: {
    heading: 'Edit entry',
    deleteQuestion: 'Delete this entry?',
    yes: 'Yes',
    cancel: 'Cancel',
    delete: 'Delete',
    deleteFailed: 'Could not delete the entry.',
  },
  form: {
    typeLabel: 'Entry type',
    expense: 'Expense',
    income: 'Income',
    amount: 'Amount',
    account: 'Account',
    category: 'Category',
    note: 'Note',
    pickDate: 'Pick a date.',
    saveChanges: 'Save changes',
    saveIncome: 'Save income',
    saveExpense: 'Save expense',
  },
  quickAdd: {
    label: 'Quick add',
    placeholder: 'What and how much, like “döner 6”',
    add: 'Add',
    noAmount: 'Add an amount, like “döner 6”',
    whichAmount: 'Which amount?',
    amountGroup: 'Amount',
    whichCategory: 'Which category?',
    categoryGroup: 'Category',
    more: 'More',
    /** "Saved €6 · döner · Eating out". */
    saved: (what: string) => `Saved ${what}`,
    undo: 'Undo',
    undoFailed: 'Could not undo.',
    /** The mic button (P2): its two labels, and the status while it listens. */
    mic: 'Speak an entry',
    stopMic: 'Stop listening',
    listening: 'Listening…',
    /** Shown once per phone before the first use: where the speech goes. */
    micNote: {
      text:
        'Your browser turns what you say into text. To do that it may send the recording to its speech service ' +
        '(Chrome sends it to Google). StudentsBudget only gets the text.',
      continue: 'Continue',
      cancel: 'Cancel',
    },
    /** Why listening stopped without text (speech.ts `SpeechProblem`). */
    micErrors: {
      denied: 'The microphone is blocked. Allow it for this site in your browser settings.',
      noSpeech: "Didn't catch anything. Try again.",
      offline: "You're offline. Speaking an entry needs a connection.",
      noMic: 'No microphone found.',
      failed: "Couldn't hear that. Try again, or type it.",
    },
  },
  /** buildEntry's answers to an expense or income it can't save. */
  errors: {
    enterAmount: 'Enter an amount.',
    noRate: (currency: string) => `No exchange rate for ${currency} yet. Set one in Settings.`,
  },
};
