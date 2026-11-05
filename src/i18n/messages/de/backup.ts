import type { Messages } from '../en';

// Backup auf Deutsch: Einstellungen → Backup (exportieren, wiederherstellen, alles löschen), die Wiederherstellung auf
// /setup und die Prüfungen aus backup.ts. "Backup" ist im Deutschen gängig und bleibt so.
export const backup: Messages['backup'] = {
  heading: 'Backup',
  summary: 'Daten auf diesem Handy exportieren, wiederherstellen oder löschen',
  intro:
    'Alles, was du eingibst, bleibt auf diesem Handy, außer du verknüpfst es mit deinem Konto. Eine Backup-Datei ist ' +
    'eine Kopie, die du selbst aufbewahrst: Exportier ab und zu eine und bewahr sie sicher auf.',
  export: {
    heading: 'Backup exportieren',
    hint: 'Speichert alles in einer Datei. Auf dem iPhone wähle im Teilen-Menü „In Dateien sichern“.',
    button: 'Backup exportieren',
    shareTitle: 'StudentsBudget-Backup',
    shared: 'Backup geteilt.',
    downloaded: (fileName) => `Download gestartet: ${fileName}`,
    shareFailed: 'Das Teilen-Menü hat sich nicht geöffnet. Du kannst die Datei stattdessen herunterladen.',
    downloadInstead: 'Stattdessen herunterladen',
    failed: 'Deine Daten konnten nicht exportiert werden.',
  },
  restore: {
    heading: 'Aus einem Backup wiederherstellen',
    file: 'Datei zum Wiederherstellen',
    reading: 'Wird gelesen …',
    confirmGroup: 'Wiederherstellen bestätigen',
    question: { before: 'Alle Daten durch ', after: ' ersetzen?' },
    linked:
      'Dieses Handy ist mit deinem Konto verknüpft: Dein Konto und deine anderen Handys ziehen beim nächsten Sync nach.',
    replace: 'Alle Daten ersetzen',
    cancel: 'Abbrechen',
    readFailed: 'Die Datei konnte nicht gelesen werden.',
    failed: 'Das Backup konnte nicht wiederhergestellt werden. Die Daten auf diesem Gerät sind unverändert.',
    setupHeading: 'Hast du ein Backup? Stell es wieder her',
    setupIntro: 'StudentsBudget schon benutzt? Wähle deine Backup-Datei und mach da weiter, wo du aufgehört hast.',
  },
  delete: {
    heading: 'Alles löschen',
    intro:
      'Entfernt deinen Plan, deine Konten und Einträge, gespeicherte Wochen und Abzeichen, Antworten zu Rabatten, dein ' +
      'Profil und die Wechselkurse von diesem Handy. Ein mit deinem Konto verknüpftes Handy wird getrennt: Dein Konto ' +
      'behält seine Kopie, und du bleibst angemeldet. Noch nicht synchronisierte Änderungen gehen verloren.',
    warning:
      'Das lässt sich auf diesem Handy nicht rückgängig machen. Um deine Daten später zurückzubekommen, exportier ' +
      'vorher ein Backup oder speichere in dein Konto.',
    word: 'LÖSCHEN',
    typeToConfirm: (word) => `Gib zur Bestätigung ${word} ein`,
    button: 'Alles löschen',
    cancel: 'Abbrechen',
    failed: 'Deine Daten konnten nicht gelöscht werden. Versuch es noch einmal.',
  },
  file: {
    notBackup: 'Das ist keine Backup-Datei von StudentsBudget.',
    newer: 'Dieses Backup stammt aus einer neueren Version der App.',
    incomplete: 'Diese Backup-Datei ist unvollständig.',
    damaged: (problem) => `Diese Backup-Datei ist beschädigt: ${problem}.`,
  },
  problems: {
    entryAccount: 'ein Eintrag nutzt ein Konto, das nicht in der Datei steht',
    transferAccount: 'eine Umbuchung geht an ein Konto, das nicht in der Datei steht',
    entryCategory: 'ein Eintrag nutzt eine Kategorie, die nicht in der Datei steht',
    planCategory: 'der Plan oder die Schätzungen nutzen eine unbekannte Kategorie',
    duplicateId: 'zwei Zeilen haben dieselbe ID',
    weekShape: 'eine gespeicherte Woche läuft nicht von Montag bis Sonntag',
    zeroAmount: 'ein Betrag ist null oder negativ',
    negativeAmount: 'ein Betrag ist negativ',
    impossibleSchedule: 'Fixkosten oder Einnahmen haben einen unmöglichen Zeitplan',
  },
  saved: (dateTime) => `Gespeichert am ${dateTime}`,
};
