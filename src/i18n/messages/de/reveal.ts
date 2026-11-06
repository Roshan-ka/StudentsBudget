import type { Messages } from '../en';

// Monat für Monat auf Deutsch: die Zeile auf der Startseite, die Seite und die Zeilen aus reveal-text.ts.
export const reveal: Messages['reveal'] = {
  link: (month) => `Sieh, wie der ${month} gelaufen ist`,
  intro: 'So lief jeder vergangene Monat gegen deine Umschläge.',
  notYet: (month) => `Deinen ersten Rückblick gibt es, sobald der ${month} vorbei ist.`,
  adjust: 'Meine Umschläge anpassen',
  recap: {
    savings: (label, amount) => `${label}: ${amount} übrig → Rücklagen`,
    over: (label, amount) => `${label}: ${amount} über dem Plan`,
    onPlan: (label) => `${label}: genau im Plan`,
  },
  noPlan: 'Richte deinen Plan ein, um zu sehen, wie jeder Monat läuft.',
  startSetup: 'Einrichtung starten',
};
