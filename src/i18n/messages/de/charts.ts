import type { Messages } from '../en';

// Grafiken auf Deutsch: Zeitraum und Monat, die vier Grafiken, ihre Legenden, Tooltips, Tabellen und was ein
// Screenreader zu jeder Grafik hört. Ein Zeitraum steht ohne Präposition davor ("Ausgaben nach Kategorie, Oktober
// 2026"), weil er ein Monat oder "August 2026 bis Oktober 2026" sein kann; "Für …" trägt beides.

/** Sätze, mit Leerzeichen verbunden, ohne die fehlenden. */
const sentences = (...parts: (string | null)[]) => parts.filter((part) => part !== null).join(' ');

export const charts: Messages['charts'] = {
  noPlan: 'Richte deinen Plan ein, um zu sehen, wohin das Geld geht.',
  startSetup: 'Einrichtung starten',
  periodLabel: 'Zeitraum',
  period: (months) => (months === 1 ? 'Dieser Monat' : `${months} Monate`),
  monthLabel: 'Monat',
  previous: 'Zurück',
  next: 'Weiter',
  periodRange: (first, last) => `${first} bis ${last}`,
  // Nach "Für": "Für diese 3 Monate sind noch keine Ausgaben erfasst."
  theseMonths: (months) => `diese ${months} Monate`,
  noSpending: (when) => `Für ${when} sind noch keine Ausgaben erfasst.`,
  noIncome: (when) => `Für ${when} sind noch keine Einnahmen erfasst.`,
  nothing: (when) => `Für ${when} ist noch nichts erfasst.`,
  lastSixMonths: 'Letzte 6 Monate',
  countedFrom: (day) => `Umschlag-Ausgaben zählen ab dem ${day}, dem Tag deiner Einrichtung.`,
  series: {
    spent: 'Ausgegeben',
    planned: 'Geplant',
    income: 'Einnahmen',
    saved: 'Gespart',
    short: 'Mehr ausgegeben als eingenommen',
  },
  ofPlanned: (amount, planned) => `${amount} von ${planned}`,
  bucket: 'Alles andere',
  // Höchstens 16 Zeichen (colors.test.ts); Tabelle und Tooltip zeigen den vollen Namen.
  shortNames: { utilities: 'Nebenkosten', 'transport-pass': 'ÖPNV-Ticket', health: 'Gesundheit' },
  styles: { donut: 'Ring', bars: 'Balken', table: 'Tabelle', columns: 'Säulen', line: 'Linie' },
  spending: {
    title: 'Ausgaben nach Kategorie',
    styleLabel: 'Darstellung der Ausgaben',
    category: 'Kategorie',
    notPlanned: 'Nicht geplant',
    nothingSpent: (period) => `Für ${period} noch nichts ausgegeben.`,
    centre: 'ausgegeben',
    caption: (period, note) =>
      sentences(`Ausgaben nach Kategorie, ${period}.`, note, 'Jede Kategorie führt zu ihren Einträgen.'),
    donutSummary: (period, slices, note) =>
      sentences(`Ringdiagramm der Ausgaben, ${period}: ${slices}.`, note, 'Darunter stehen dieselben Zahlen.'),
    barsSummary: (period, withPlanned, note) =>
      sentences(
        `Balkendiagramm der Ausgaben je Kategorie, ${period}${withPlanned ? ', im Vergleich zum Plan' : ''}.`,
        note,
        'Dieselben Zahlen stehen in der Tabelle.',
      ),
  },
  income: {
    title: 'Einnahmen nach Quelle',
    styleLabel: 'Darstellung der Einnahmen',
    source: 'Quelle',
    centre: 'Einnahmen',
    caption: (period) => `Einnahmen nach Quelle, ${period}. Jede Quelle führt zu ihren Einträgen.`,
    donutSummary: (period, slices) =>
      `Ringdiagramm der Einnahmen nach Quelle, ${period}: ${slices}. Darunter stehen dieselben Zahlen.`,
    barsSummary: (period) =>
      `Balkendiagramm der Einnahmen nach Quelle, ${period}. Dieselben Zahlen stehen in der Tabelle.`,
  },
  savings: {
    title: 'Gespart pro Monat',
    styleLabel: 'Darstellung des Gesparten',
    month: 'Monat',
    saved: (amount) => `${amount} gespart`,
    short: (amount) => `${amount} mehr ausgegeben als eingenommen`,
    explain: (period) =>
      `Einnahmen minus Ausgaben, ${period}. Geld, das du zwischen deinen Konten verschiebst, zählt nicht mit.`,
    caption: (period) => `Einnahmen minus Ausgaben pro Monat, ${period}. Jeder Monat führt zu seinen Einträgen.`,
    summary: (line, period, headline) =>
      `${line ? 'Liniendiagramm' : 'Säulendiagramm'} der Einnahmen minus Ausgaben in jedem Monat, ${period}, ` +
      `${headline}. Dieselben Zahlen stehen in der Tabelle.`,
  },
  overTime: {
    title: (category) => `${category} im Zeitverlauf`,
    category: 'Kategorie',
    styleLabel: 'Darstellung der Kategorie',
    caption: (category, period) => `${category} pro Monat, ${period}. Jeder Monat führt zu seinen Einträgen.`,
    summary: (line, category, period) =>
      `${line ? 'Liniendiagramm' : 'Säulendiagramm'} der Ausgaben für ${category} in jedem Monat, ${period}. ` +
      'Dieselben Zahlen stehen in der Tabelle.',
  },
};
