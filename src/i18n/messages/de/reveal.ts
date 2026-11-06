import type { Messages } from '../en';

// Der Schätzungsvergleich auf Deutsch: seine Karte auf der Startseite, die Seite und Monat für Monat aus
// reveal-text.ts.
export const reveal: Messages['reveal'] = {
  card: {
    open: 'Sieh, wie gut deine Schätzungen waren',
    label: 'Deine Schätzungen',
    unlocksOn: (day) => `Deine Schätzungen werden am ${day} freigeschaltet.`,
    whatsThis: 'Was ist das?',
  },
  locked: {
    unlocksOn: (day) => `Deine Schätzungen werden am ${day} freigeschaltet. Erfass weiter deine Ausgaben.`,
    explain: (days) =>
      'Bei der Einrichtung hast du geschätzt, was du jeden Monat ausgibst. ' +
      `Nach ${days} Tagen mit Einträgen siehst du, wie deine Schätzungen zu dem passen, was du wirklich ausgegeben hast.`,
  },
  listLabel: 'Deine Schätzungen',
  guessLine: (guessed, actual) => `Du hast ${guessed} geschätzt. Es waren ${actual}.`,
  scaled: (from, to) => `Deine Ausgaben vom ${from} bis zum ${to}, hochgerechnet auf einen Monat mit 30 Tagen.`,
  adjust: 'Plan bearbeiten',
  noGuesses: 'Bei der Einrichtung wurden keine Schätzungen gespeichert, also gibt es nichts zu vergleichen.',
  monthByMonth: 'Monat für Monat',
  recap: {
    savings: (label, amount) => `${label}: ${amount} übrig → Rücklagen`,
    over: (label, amount) => `${label}: ${amount} über dem Plan`,
    onPlan: (label) => `${label}: genau im Plan`,
  },
  noPlan: 'Richte deinen Plan ein, um deine Schätzungen mit deinen Ausgaben zu vergleichen.',
  startSetup: 'Einrichtung starten',
};
