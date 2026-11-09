// Entries in English: the list, the entry form, quick add and buildEntry's errors.

export const entries = {
  addEntry: 'Add entry',
  transfer: 'Transfer',
  recurring: 'Recurring',
  noAccount: 'Add an account first, in Settings → Accounts and transfers.',
  saveFailed: 'Could not save the entry.',
  list: {
    label: 'Entries',
    unknownAccount: 'Unknown account',
    clear: 'Clear',
    monthNav: 'Month',
    previous: 'Previous',
    next: 'Next',
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
    saveAnother: 'Save and add another',
    savedAnother: 'Saved. Add the next one.',
    /** The expense categories' groups in the category list. */
    groups: { flexible: 'Envelopes', fixed: 'Fixed costs', oneoff: 'One-off costs' },
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
    /** Under the field, and read with it: an example of a line. */
    hint: 'What and how much, like “döner 6”.',
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
    /** The status while the AI reads a line (the AI phase, chunk 7). */
    reading: 'Reading…',
    /** Under the field when the AI said no and the line was read on the phone instead. */
    aiHint: {
      'daily-limit': 'Today’s AI reads are used up, so quick add reads your lines on this phone for now.',
      'second-step':
        'This line was read on the phone. To use the AI, give your authenticator app’s code in Settings → Your account.',
    },
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
    noRate: (currency: string) => `No exchange rate for ${currency} yet. Set one in Settings → Accounts and transfers.`,
  },
};
