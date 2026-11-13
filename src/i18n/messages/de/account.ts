import type { Messages } from '../en';

// Das Konto auf Deutsch: die Karte "Dein Konto" in den Einstellungen und die Zeile dazu auf der Einrichtungsseite.
export const account: Messages['account'] = {
  card: {
    heading: 'Dein Konto',
    signedIn: (email) => `Angemeldet als ${email}.`,
    secondStep: (email) => `Fast angemeldet als ${email}: Gib den Code aus deiner Authenticator-App ein.`,
    signedOut: 'Freiwillig: Melde dich an oder erstelle ein Konto. Ohne Konto bleibt alles auf diesem Handy.',
    manage: 'Konto verwalten',
    finish: 'Anmeldung abschließen',
    signIn: 'Anmelden',
  },
  setupLink: {
    question: 'Nutzt du StudentsBudget schon auf einem anderen Handy?',
    signedIn: 'Hol deine Daten aus deinem Konto',
    secondStep: 'Schließ die Anmeldung ab, um deine Daten zu holen',
    signedOut: 'Melde dich an, um deine Daten zu holen',
  },
  start: {
    /** Über der Überschrift, mit einer Stecknadel. */
    place: 'Für Studierende in Regensburg',
    headline: 'Dein Geld, sortiert fürs Studentenleben.',
    pitch: 'Plane deinen Monat, erfasse Ausgaben in Sekunden und sieh lokale Preise mit ihren Quellen.',
    /** Was die App kann, je eine Zeile, in einer Karte. */
    features: {
      plan: 'Deinen Monat planen',
      log: 'Ausgaben in Sekunden erfassen',
      week: 'Dein Wochenbudget kennen',
      tips: 'Lokale Tipps mit Quellen',
    },
    signIn: 'Ich habe ein Konto',
    create: 'Konto erstellen',
    guest: 'Ohne Konto weiter',
    signedOut: 'Du bist abgemeldet. Deine Daten sind von diesem Handy gelöscht.',
    back: 'Zurück',
    /** Die Formulare der Startseiten (13-11-2026): ihre große Überschrift und die Zeile darunter. */
    signInHeading: 'Anmelden',
    signInLine: 'Dein Plan und deine Einträge kommen aus deinem Konto zurück.',
    createHeading: 'Dein Konto erstellen',
    createLine: 'Sichere deinen Plan und nutze ihn auf jedem Handy.',
  },
};
