import type { Messages } from '../en';

// Das Profil auf Deutsch: Einstellungen → Profil, die Prüfungen aus profile.ts und der Hinweis zum Semesterbeitrag.
// "Semesterbeitrag" ist der Name der angebotenen einmaligen Kosten; eine so benannte Zeile zählt als Beitrag.
export const profile: Messages['profile'] = {
  heading: 'Profil',
  summaryNone: 'Noch nicht ausgefüllt',
  intro:
    'Dein Profil liegt auf diesem Handy. Es kommt in jedes Backup, das du exportierst, und in dein Konto, wenn du ' +
    'dorthin speicherst.',
  name: 'Dein Name',
  nameHint: 'Freiwillig. Die Startseite begrüßt dich mit diesem Namen.',
  university: 'Hochschule',
  notSet: 'Nicht angegeben',
  otherUniversity: 'Andere',
  semesterStart: 'Semesterbeginn',
  semesterEnd: 'Semesterende',
  weeks: (weeks) => `Dein Semester: ${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'}.`,
  period: (term, university, period) =>
    `${term} an der ${university}: ${period}. Ändere die Daten, wenn deine anders sind.`,
  winter: 'Wintersemester',
  summer: 'Sommersemester',
  save: 'Profil speichern',
  clearDates: 'Semesterdaten löschen',
  saved: 'Profil gespeichert.',
  saveFailed: 'Dein Profil konnte nicht gespeichert werden. Versuch es noch einmal.',
  problems: {
    both: 'Gib beide Semesterdaten an oder lass beide leer.',
    full: 'Gib jedes Semesterdatum vollständig ein.',
    year: 'Gib das Jahr jedes Semesterdatums vierstellig ein, etwa 2026.',
    endAfterStart: 'Wähle ein Ende nach dem Beginn.',
    tooLong: 'Ein Semester dauert höchstens ein Jahr. Wähle ein früheres Ende.',
  },
  semesterFee: 'Semesterbeitrag',
  fee: {
    noFee: 'Noch nennt keine Seite den Beitrag für dieses Semester, also trägst du den Betrag selbst ein.',
    dueReRegistration: (month) => `Fällig im ${month}, wenn die Rückmeldung voraussichtlich beginnt.`,
    dueBeforeSemester: (month) => `Fällig im ${month}, dem Monat vor Semesterbeginn.`,
    reRegistration: 'Rückmeldung',
  },
};
