import type { Messages } from '../en';

// Einstellungen → Wöchentliche Erinnerung auf Deutsch (docs/superpowers/plans/2026-11-05-weekly-reminder.md, chunk 4):
// eine ruhige Zeile pro Woche, dass es Zeit für den Check-in ist, über das Konto, aus, bis man sie einschaltet.
export const reminder: Messages['reminder'] = {
  intro:
    'Einmal pro Woche zeigt dieses Handy eine kurze Zeile, dass es Zeit für deinen Check-in ist. Sie sagt nichts ' +
    'über dein Geld und ist aus, bis du sie einschaltest.',
  loading: 'Wird geladen …',
  unavailable: 'Erinnerungen sind in dieser Version der App nicht eingerichtet.',
  signedOut: 'Die Erinnerung kommt über dein Konto: Melde dich zuerst auf diesem Handy an.',
  toAccount: 'Zu „Dein Konto“',
  needsCode: 'Dein Konto hat die zweistufige Anmeldung: Gib zuerst den Code aus deiner Authenticator-App ein.',
  installFirst:
    'Auf dem iPhone oder iPad braucht die Erinnerung die App auf deinem Home-Bildschirm: Tippe in Safari auf Teilen, ' +
    'dann auf „Zum Home-Bildschirm“, und öffne sie von dort.',
  noPush: 'Dieser Browser kann keine Erinnerungen anzeigen. Die Kalender-Erinnerung im Check-in funktioniert überall.',
  denied:
    'Mitteilungen sind für StudentsBudget blockiert. Erlaube sie in den Einstellungen deines Handys oder Browsers ' +
    'und komm dann hierher zurück.',
  day: 'Tag',
  time: 'Uhrzeit',
  hint: 'Egal, welchen Tag du wählst: Der Check-in schaut auf die bisherige Woche, Montag bis Sonntag.',
  turnOn: 'Erinnerung einschalten',
  save: 'Änderungen speichern',
  turnOff: 'Ausschalten',
  status: {
    on: (day: string, time: string) => `Die Erinnerung ist an: ${day.toLowerCase()} um ${time}.`,
    off: 'Die Erinnerung ist aus.',
    dismissed: 'Nichts geändert: Mitteilungen wurden nicht erlaubt.',
    notSupported: 'Den Push-Dienst dieses Browsers kann die App nicht erreichen.',
    failed: 'Das hat nicht geklappt. Prüf deine Verbindung und versuch es noch einmal.',
  },
  calendar:
    'Lieber im Kalender? Der Check-in kann stattdessen eine wöchentliche Erinnerung in deinen Kalender eintragen. ' +
    'Nutze nur eins von beiden, damit du sie nicht doppelt bekommst.',
  toCheckIn: 'Zum Check-in',
  everyDay: ['Montags', 'Dienstags', 'Mittwochs', 'Donnerstags', 'Freitags', 'Samstags', 'Sonntags'],
  summaryOff: 'Aus',
  summaryOn: (day: string, time: string) => `${day} um ${time}`,
};
