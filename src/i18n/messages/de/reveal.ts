import type { Messages } from '../en';

// Monat für Monat auf Deutsch: die Zeile auf der Startseite, die Seite und die Zeilen aus reveal-text.ts.
export const reveal: Messages['reveal'] = {
  link: (month) => `Sieh, wie der ${month} gelaufen ist`,
  intro: 'So lief jeder vergangene Monat gegen deine Umschläge.',
  notYet: (month) => `Deinen ersten Rückblick gibt es, sobald der ${month} vorbei ist.`,
  notYetTitle: 'Noch kein Rückblick',
  recap: {
    savings: (amount) => `${amount} übrig → Rücklagen`,
    over: (amount) => `${amount} über dem Plan`,
    onPlan: 'Genau im Plan',
  },
  spentOf: (spent, planned) => `${spent} von ${planned} ausgegeben`,
  noPlan: 'Richte deinen Plan ein, um zu sehen, wie jeder Monat läuft.',
};
