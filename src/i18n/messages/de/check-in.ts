import type { Messages } from '../en';

// Der wöchentliche Check-in auf Deutsch: seine Karte auf der Startseite, die Seite und week-line.ts.
// Der MCP-Server ruft sie weiter auf Englisch auf.
export const checkIn: Messages['checkIn'] = {
  card: {
    title: 'Wöchentlicher Check-in',
    sunday: 'Es ist Sonntag – Zeit für deinen wöchentlichen Check-in.',
    other: 'Dein wöchentlicher Check-in ist am Sonntag.',
  },
  thisWeek: {
    against: 'Diese Woche im Vergleich zu deinem Plan',
    logged: 'Diese Woche',
    empty: 'Diese Woche ist noch nichts erfasst.',
  },
  // Die Tage dieser Woche, die noch im Vormonat liegen.
  earlierThisWeek: {
    against: 'Anfang der Woche im Vergleich zu deinem Plan',
    logged: 'Anfang der Woche',
    empty: 'Anfang der Woche ist nichts erfasst.',
  },
  noEnvelopes: 'Kein Umschlag hat in deinem Plan einen Betrag.',
  line: {
    planned: (planned, spent, verdict) => `${planned} geplant · ${spent} ausgegeben · ${verdict}`,
    onPlan: 'genau im Plan',
    under: (amount) => `${amount} unter Plan`,
    over: (amount) => `${amount} zu viel`,
    usedUp: (spent) => `Diesen Monat nichts mehr übrig · ${spent} ausgegeben`,
    usedUpOver: (spent, over) => `Diesen Monat nichts mehr übrig · ${spent} ausgegeben · ${over} zu viel`,
  },
  total: {
    toSpend: (amount) => `Insgesamt: ${amount} für diese Woche`,
    over: (amount) => `Insgesamt: ${amount} zu viel diese Woche`,
  },
  away: {
    lastWeek: 'Ich war letzte Woche weg',
    thisWeek: 'Ich war diese Woche weg',
    hint:
      'Eine Woche, in der du weg warst, lässt deine Eintragsserie, wie sie ist, und zählt nicht für Unter-Budget-Woche ' +
      'oder Ramen-Majestät.',
  },
  add: {
    heading: 'Etwas vergessen? Trag es hier nach',
    earlier: 'Etwas von einem früheren Tag nachtragen',
  },
  reminder: 'Wöchentliche Erinnerung in den Kalender eintragen',
  calendarEvent: 'Wöchentlicher Check-in (StudentsBudget)',
  reminderOr: 'Oder stattdessen eine Mitteilung auf diesem Handy:',
  reminderOrLink: 'Wöchentliche Erinnerung',
  noPlan: 'Richte deinen Plan ein, um auf deine Woche zu schauen.',
  startSetup: 'Einrichtung starten',
};
