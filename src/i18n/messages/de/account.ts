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
};
