// Backup in English: Settings → Backup (export, restore, delete everything), the restore section on /setup and
// backup.ts's file checks.

export const backup = {
  /** The Backup row on the Settings list. */
  summary: 'Export, restore or delete the data on this phone',
  /** The one line under the page heading (16-11-2026). */
  intro: 'Your data stays on this phone unless you link an account.',
  /** The rest of the intro, folded under this question. */
  more: 'Why keep a backup?',
  moreText: 'A backup file is a copy you keep yourself, so export one now and then and keep it somewhere safe.',
  export: {
    heading: 'Export a backup',
    /** The card's one line. */
    hint: 'One file with everything. On an iPhone, choose Save to Files.',
    button: 'Export backup',
    /** The share sheet's title for the file. */
    shareTitle: 'StudentsBudget backup',
    shared: 'Backup shared.',
    downloaded: (fileName: string) => `Download started: ${fileName}`,
    shareFailed: 'The share sheet didn’t open. You can download the file instead.',
    download: 'Download',
    failed: 'Couldn’t export your data.',
  },
  restore: {
    heading: 'Restore a backup',
    /** The card's one line. */
    intro: 'Replaces the data on this phone with the file’s.',
    /** The card's button that opens the hidden file field. */
    choose: 'Choose a backup file',
    file: 'File to restore',
    reading: 'Reading…',
    confirmGroup: 'Confirm restore',
    /** "Replace all data with <file name>?", the file name in bold between the two parts. */
    question: { before: 'Replace all data with ', after: '?' },
    linked: 'This phone is linked to your account: your account and your other phones follow at the next sync.',
    replace: 'Replace all data',
    cancel: 'Cancel',
    readFailed: 'Couldn’t read that file.',
    /** A file over `MAX_BACKUP_BYTES`, refused before it is read. */
    tooLarge: 'That file is over 20 MB, too large to be a StudentsBudget backup. Choose one the app exported.',
    failed: 'Couldn’t restore the backup. The data on this phone is unchanged.',
    setupHeading: 'Have a backup? Restore it',
    /** Setup's quiet button that opens the file field (13-11-2026). */
    setupButton: 'Restore a backup',
  },
  delete: {
    heading: 'Delete everything',
    /** The card's one line. */
    intro: 'Removes your plan, accounts, entries and all your other data from this phone.',
    /** In the confirmation, before the warning. */
    linked:
      'A phone linked to your StudentsBudget account is unlinked: that account keeps its copy, and you stay signed in. ' +
      'Changes not synced yet are lost.',
    warning:
      'This can’t be undone on this phone. To get your data back later, export a backup first, or sync it to your ' +
      'account.',
    /** The word typed to confirm, in capitals. */
    word: 'DELETE',
    typeToConfirm: (word: string) => `Type ${word} to confirm`,
    button: 'Delete everything',
    cancel: 'Cancel',
    failed: 'Couldn’t delete your data. Try again.',
  },
  /** parseBackup's answers to a file it can't restore. */
  file: {
    notBackup: 'This isn’t a StudentsBudget backup file. Choose one the app exported: its name starts with studentsbudget-backup.',
    newer: 'This backup is from a newer version of the app. Reload the app while online to update it, then try again.',
    incomplete: 'This backup file is incomplete. Choose another backup, or export a new one.',
    damaged: (problem: string) => `This backup file is damaged: ${problem}. Choose another backup, or export a new one.`,
  },
  /** What the rows of a file or the account say about each other that can't be true (backup.ts's findProblem). */
  problems: {
    entryAccount: 'an entry uses an account that isn’t in the file',
    transferAccount: 'a transfer goes to an account that isn’t in the file',
    entryCategory: 'an entry uses a category that isn’t in the file',
    planCategory: 'the plan uses an unknown category',
    duplicateId: 'two rows share the same id',
    weekShape: 'a saved week doesn’t run from Monday to Sunday',
    zeroAmount: 'an amount is zero or negative',
    negativeAmount: 'an amount is negative',
    impossibleSchedule: 'a fixed cost or income has an impossible schedule',
  },
  /** "Saved 19.10.2026, 12:00". */
  saved: (dateTime: string) => `Saved ${dateTime}`,
};
