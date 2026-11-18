// Entries in English: the list, the entry form, quick add and buildEntry's errors.

export const entries = {
  addEntry: 'Add entry',
  transfer: 'Transfer',
  /** The tag on an entry a fixed cost or income added by itself. */
  recurring: 'Automatic',
  noAccount: 'Add an account first, in Settings → Accounts and transfers.',
  saveFailed: 'Couldn’t save the entry.',
  list: {
    label: 'Entries',
    unknownAccount: 'Unknown account',
    /** Back to the current month, keeping a category (18-11-2026: it was "Clear", which read as deleting). */
    thisMonth: 'This month',
    /** The name of the chip that takes a category off: its visible word, the category, first. */
    showAllCategories: (category: string) => `${category}: show all categories`,
    monthNav: 'Month',
    previous: 'Previous',
    next: 'Next',
    nothingYet: 'Nothing logged here yet.',
    /** Under it, on the empty month's card. */
    nothingYetHint: 'Log with quick add above.',
  },
  edit: {
    heading: 'Edit entry',
    deleteQuestion: 'Delete this entry?',
    yes: 'Yes',
    cancel: 'Cancel',
    delete: 'Delete',
    deleteFailed: 'Couldn’t delete the entry.',
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
    noAmount: 'Add an amount, like “döner 6”.',
    /** A date in the line, or from the AI, after today (quick add dates, 18-11-2026). */
    futureDate: 'That day is still to come. Quick add saves what you’ve already spent.',
    whichAmount: 'Which amount?',
    amountGroup: 'Amount',
    whichCategory: 'Which category?',
    categoryGroup: 'Category',
    more: 'More',
    /** "Saved €6 · döner · Eating out". */
    saved: (what: string) => `Saved ${what}`,
    undo: 'Undo',
    undoFailed: 'Couldn’t undo.',
    /** A line quick add was asking about when a new one replaced it (18-11-2026, after review P3). */
    notSaved: (line: string) => `“${line}” wasn’t saved.`,
    /** Puts that line back in the field, and its question with it; named after the line. */
    bringBack: 'Bring it back',
    bringBackNamed: (line: string) => `Bring it back: ${line}`,
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
        'This line was read on the phone. To use the AI, enter the code from your authenticator app in Settings → ' +
        'Your account.',
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
      noSpeech: 'Didn’t catch anything. Try again.',
      offline: 'You’re offline. Speaking an entry needs a connection.',
      noMic: 'No microphone found.',
      failed: 'Couldn’t hear that. Try again, or type it.',
    },
  },
  /** The receipt scan (docs/superpowers/plans/2026-11-13-receipt-scan.md): read on the phone, checked, then saved. */
  scan: {
    /** The button beside "Import a bank statement", and the card's heading while a photo is read. */
    button: 'Scan a receipt',
    /** Once per phone, before the first scan. `size` is the download in MB, written in the language ("10"). */
    firstScan: (size: string) =>
      `Your first scan downloads the receipt reader once, about ${size} MB. After that, scanning works offline.`,
    continue: 'Continue',
    cancel: 'Cancel',
    reading: 'Reading the receipt…',
    /** The progress bar's name. */
    progress: 'Reading progress',
    onPhone: 'Read on this phone. The photo isn’t sent or kept.',
    /** The thumbnail's text. */
    photo: 'Photo of the receipt',
    checkHeading: 'Check the receipt',
    checkHint: 'Change anything that was read wrong, then save.',
    failedHeading: 'Couldn’t read this receipt',
    failedHint: 'Faded or crumpled receipts are hard to read. Type in what it says, or try another photo.',
    /** Under the hint when reading failed while the phone was offline: the first scan's download needs a connection. */
    offline: 'You’re offline. The first scan needs a connection to download the receipt reader.',
    tryAgain: 'Try another photo',
    pickCategory: 'Pick a category.',
    discard: 'Discard',
  },
  /** buildEntry's answers to an expense or income it can't save. */
  errors: {
    enterAmount: 'Enter an amount.',
    noRate: (currency: string) => `No exchange rate for ${currency} yet. Set one in Settings → Accounts and transfers.`,
  },
};
