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
    pitch: 'Dein Budget fürs Studium in Regensburg: planen, erfassen, sparen.',
    withAccount: 'Mit Konto',
    signIn: 'Ich habe ein Konto',
    create: 'Konto erstellen',
    accountWhy: 'Mit Konto ist dein Plan gesichert und auf jedem Handy da, auf dem du dich anmeldest.',
    withoutAccount: 'Ohne Konto',
    guest: 'Ohne Konto weiter',
    guestNote: 'Deine Daten bleiben nur auf diesem Handy. Ein Konto kannst du später in den Einstellungen anlegen.',
  },
};
