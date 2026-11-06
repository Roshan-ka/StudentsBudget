import type { Messages } from '../en';

// Der Rahmen der App auf Deutsch: die Navigation unten und die Seitenüberschriften (Plan 1, Chunk 10).
export const shell: Messages['shell'] = {
  // Höchstens 9 Zeichen: fünf stehen bei 375 px nebeneinander. "Einstellungen" ist zu lang, daher "Optionen".
  nav: {
    home: 'Start',
    entries: 'Einträge',
    charts: 'Grafiken',
    tips: 'Tipps',
    settings: 'Optionen',
  },
  navLabel: 'Hauptmenü',
  backToSettings: 'Zurück zu den Einstellungen',
  backToSetup: 'Zurück zur Einrichtung',
  headings: {
    home: 'Start',
    plan: 'Plan',
    profile: 'Profil',
    appearance: 'Aussehen',
    accounts: 'Konten und Umbuchungen',
    backup: 'Backup und Daten',
    moderation: 'Moderation',
    reminder: 'Wöchentliche Erinnerung',
    badges: 'Abzeichen',
    charts: 'Grafiken',
    checkIn: 'Wöchentlicher Check-in',
    entries: 'Einträge',
    newEntry: 'Neuer Eintrag',
    reveal: 'Schätzung und Wirklichkeit',
    account: 'Dein Konto',
    settings: 'Einstellungen',
    tips: 'Tipps und Rabatte in Regensburg',
  },
};
