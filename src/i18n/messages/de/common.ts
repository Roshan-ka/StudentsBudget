import type { Messages } from '../en';

// Text, die mehrere Bereiche teilen: das Datumsfeld, das Betragsfeld, die Quelle einer Spanne, Zählungen.
export const common: Messages['common'] = {
  dateField: {
    label: 'Datum',
    pickDay: 'Tag wählen',
    today: 'Heute',
    yesterday: 'Gestern',
    letters: { day: 'T', month: 'M', year: 'J' },
    hint: (example) => `Tippe es ein, etwa ${example}, oder öffne den Kalender.`,
    notADate: (example) => `Das ist kein Datum. Tippe es etwa so ein: ${example}.`,
    openCalendar: (field) => `Kalender öffnen: ${field}`,
    calendarTitle: 'Datum wählen',
    previousMonth: 'Voriger Monat',
    nextMonth: 'Nächster Monat',
    earlierYears: 'Frühere Jahre',
    laterYears: 'Spätere Jahre',
    chooseMonth: 'Monat wählen',
    chooseYear: 'Jahr wählen',
    goToToday: 'Zu heute',
    close: 'Schließen',
  },
  amountField: {
    positive: 'Gib einen Betrag über 0 ein, etwa 250 oder 12,50.',
    number: 'Gib eine Zahl ein, etwa 250 oder 12,50.',
    overdrawn: 'Überzogen (unter null)',
  },
  source: {
    label: 'Quelle',
    of: (what) => `Quelle: ${what}`,
    checked: (date) => `geprüft am ${date}`,
  },
  accountOption: (name, currency) => `${name} (${currency})`,
  counts: {
    accounts: (count) => `${count} ${count === 1 ? 'Konto' : 'Konten'}`,
    entries: (count) => `${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`,
    plan: 'dein Plan',
  },
  estimate: 'Schätzung',
  /** Einmalige Datenschutzhinweise (`PrivacyNote`), einmal pro Handy, bevor eine Funktion erstmals Daten schickt. */
  legal: {
    back: 'Zurück',
    onlyDeEn: 'Diese Seite gibt es nur auf Deutsch und Englisch.',
    label: 'Rechtliches',
    privacy: 'Datenschutz',
    impressum: 'Impressum',
    privacySummary: 'Was die App speichert und sendet, und deine Rechte',
    impressumSummary: 'Wer StudentsBudget betreibt',
  },
  privacy: {
    label: 'Zu deinen Daten',
    more: 'Mehr in der Datenschutzerklärung',
    continue: 'Weiter',
    cancel: 'Abbrechen',
    account:
      'Dein Konto liegt bei Supabase in Frankfurt (EU): deine E-Mail-Adresse, dein Passwort (nur als Hash ' +
      'gespeichert), die Sprache deines Handys, dein Benutzername mit Status und Jahrgang und eine Kopie der Daten, ' +
      'die du synchronisierst. Andere Studierende sehen nur Benutzername, Status und Jahrgang, neben deinen ' +
      'Beiträgen. Braucht das Konto einen Code, zum Bestätigen oder für ein neues Passwort, kommt er per E-Mail. ' +
      'Du kannst das Konto jederzeit unter Einstellungen → Dein Konto löschen.',
    passkey:
      'Der Passwortmanager deines Handys bewahrt den Passkey auf und kann ihn mit deinen anderen Geräten ' +
      'synchronisieren (zum Beispiel iCloud-Schlüsselbund oder Google Passwortmanager). Dein Konto speichert nur ' +
      'den öffentlichen Schlüssel, mit dem sich niemand anmelden kann.',
    rates:
      'Solange ein Konto eine andere Währung als Euro hat, fragt die App bei Frankfurter (frankfurter.dev) den Kurs ' +
      'der Europäischen Zentralbank ab, höchstens einmal am Tag. Sie schickt nur die Währungscodes; wie jede ' +
      'Website sieht Frankfurter die Internetadresse deines Handys.',
    votes:
      'Angemeldet gehen deine Stimmen beim Synchronisieren an dein Konto und zählen in den Summen, die andere ' +
      'Studierende für dieses Semester sehen. Niemand sieht, wer abgestimmt hat.',
    post:
      'Alle Studierenden mit Konto können lesen, was du hier postest, einen Hack, einen Kommentar oder einen Rabatt, ' +
      'mit Benutzername, Status und Jahrgang, und es melden; Hacks und Rabatte können sie auch bewerten. Du kannst ' +
      'es jederzeit löschen.',
    hackVotes:
      'Deine Stimmen zählen in den Summen, die alle Studierenden am Beitrag sehen; niemand sieht, wer abgestimmt ' +
      'hat. Eine Meldung versteckt den Beitrag sofort für dich und für alle, wenn genug Studierende ihn gemeldet ' +
      'haben, bis die Moderation der App entscheidet.',
    translate:
      'Übersetzen öffnet Google Übersetzer in einem neuen Tab, mit dem Text des Beitrags in der Adresse. Google ' +
      'bekommt den Text und die Internetadresse deines Handys.',
    reminder:
      'Dein Konto (Supabase, in Frankfurt) speichert die Push-Adresse dieses Handys, den Tag und die Uhrzeit, die ' +
      'du wählst, deine Zeitzone und deine Sprache, und passt Zeitzone und Sprache an, wenn sie sich auf dem Handy ' +
      'ändern. Die Erinnerung läuft über den Push-Dienst deines Browser-Herstellers (Apple, Google, Mozilla oder ' +
      'Microsoft), der sieht, dass eine Nachricht ankommt, aber nicht, was darin steht.',
    ai:
      'Die KI-Funktionen schicken, was du schreibst, mit dem, was jede aus deinem Budget braucht (etwa die Namen ' +
      'deiner Kategorien und Konten oder die Zahlen deines Plans), an Groq, einen KI-Dienst in den USA, damit es ' +
      'beantwortet wird. Konto- und Kartennummern, E-Mail-Adressen und Telefonnummern werden vorher entfernt. Dein ' +
      'Konto zählt, wie oft du jede Funktion am Tag nutzt. Du kannst sie unter Einstellungen → Dein Konto ausschalten.',
  },
};
