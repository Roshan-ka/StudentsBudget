import type { Messages } from '../en';

// Die eingebauten Kategorien. Höchstens 16 Zeichen, wo eine Grafik den Namen ohne Kurzform zeigt (getestet in
// src/features/charts/colors.test.ts); längere Namen haben eine Kurzform in charts.shortNames.
export const categories: Messages['categories'] = {
  food: 'Lebensmittel',
  'eating-out': 'Essen auswärts',
  'going-out': 'Ausgehen',
  transport: 'Mobilität',
  shopping: 'Einkäufe',
  health: 'Gesundheit & Apotheke',
  'personal-care': 'Körperpflege',
  study: 'Studienmaterial',
  household: 'Haushalt',
  travel: 'Reisen',
  gifts: 'Geschenke',
  other: 'Sonstiges',
  rent: 'Miete',
  phone: 'Handy & Internet',
  insurance: 'Versicherung',
  subscriptions: 'Abos',
  'transport-pass': 'Deutschlandticket / Semesterticket',
  gym: 'Fitness & Sport',
  utilities: 'Nebenkosten & Rundfunkbeitrag',
  'one-off': 'Einmalige Kosten',
  'income-job': 'Nebenjob',
  'income-parents': 'Eltern',
  'income-bafoeg': 'BAföG',
  'income-sperrkonto': 'Sperrkonto',
  'income-scholarship': 'Stipendium',
  'income-other': 'Andere Einnahmen',
};
