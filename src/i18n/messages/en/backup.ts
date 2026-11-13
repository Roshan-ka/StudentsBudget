// Backup in English: Settings → Backup (export, restore, delete everything), the restore section on /setup and
// backup.ts's file checks.

export const backup = {
  heading: 'Backup',
  /** The Backup row on the Settings list. */
  summary: 'Export, restore or delete the data on this phone',
  intro:
    'Everything you enter stays on this phone unless you link it to your account. A backup file is a copy you keep ' +
    'yourself, so export one now and then and keep it somewhere safe.',
  export: {
    heading: 'Export a backup',
    hint: 'Saves everything as one file. On an iPhone, choose Save to Files in the share sheet.',
    button: 'Export backup',
    /** The share sheet's title for the file. */
    shareTitle: 'StudentsBudget backup',
    shared: 'Backup shared.',
    downloaded: (fileName: string) => `Download started: ${fileName}`,
    shareFailed: "The share sheet didn't open. You can download the file instead.",
    download: 'Download',
    failed: 'Could not export your data.',
  },
  restore: {
    heading: 'Restore from a backup',
    file: 'File to restore',
    reading: 'Reading…',
    confirmGroup: 'Confirm restore',
    /** "Replace all data with <file name>?", the file name in bold between the two parts. */
    question: { before: 'Replace all data with ', after: '?' },
    linked: 'This phone is linked to your account: your account and your other phones follow at the next sync.',
    replace: 'Replace all data',
    cancel: 'Cancel',
    readFailed: 'Could not read that file.',
    failed: 'Could not restore the backup. The data on this device is unchanged.',
    setupHeading: 'Have a backup? Restore it',
    /** Setup's quiet button that opens the file field (13-11-2026). */
    setupButton: 'Restore a backup',
  },
  delete: {
    heading: 'Delete everything',
    intro:
      'Removes your plan, accounts, entries, saved weeks and badges, discount answers, profile and exchange rates ' +
      'from this phone. A phone linked to your account is unlinked: your account keeps its copy, and you stay signed ' +
      'in. Changes not synced yet are lost.',
    warning:
      "This can't be undone on this phone. To get your data back later, export a backup first, or save to your " +
      'account.',
    /** The word typed to confirm, in capitals. */
    word: 'DELETE',
    typeToConfirm: (word: string) => `Type ${word} to confirm`,
    button: 'Delete everything',
    cancel: 'Cancel',
    failed: 'Could not delete your data. Try again.',
  },
  /** parseBackup's answers to a file it can't restore. */
  file: {
    notBackup: "This isn't a StudentsBudget backup file. Choose one the app exported: its name starts with studentsbudget-backup.",
    newer: 'This backup is from a newer version of the app. Reload the app while online to update it, then try again.',
    incomplete: 'This backup file is incomplete. Choose another backup, or export a new one.',
    damaged: (problem: string) => `This backup file is damaged: ${problem}. Choose another backup, or export a new one.`,
  },
  /** What the rows of a file or the account say about each other that can't be true (backup.ts's findProblem). */
  problems: {
    entryAccount: "an entry uses an account that isn't in the file",
    transferAccount: "a transfer goes to an account that isn't in the file",
    entryCategory: "an entry uses a category that isn't in the file",
    planCategory: 'the plan or the guesses use an unknown category',
    duplicateId: 'two rows share the same id',
    weekShape: "a saved week doesn't run from Monday to Sunday",
    zeroAmount: 'an amount is zero or negative',
    negativeAmount: 'an amount is negative',
    impossibleSchedule: 'a fixed cost or income has an impossible schedule',
  },
  /** "Saved 19.10.2026, 12:00". */
  saved: (dateTime: string) => `Saved ${dateTime}`,
};
