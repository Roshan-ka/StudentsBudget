import type { Messages } from '../en';

// Text, die mehrere Bereiche teilen: das Datumsfeld, das Betragsfeld, die Quelle einer Spanne, Zählungen.
export const common: Messages['common'] = {
  dateField: {
    label: 'Datum',
    pickDay: 'Tag wählen',
    today: 'Heute',
    yesterday: 'Gestern',
  },
  amountField: {
    positive: 'Gib einen Betrag über 0 ein, etwa 250 oder 12,50.',
    number: 'Gib eine Zahl ein, etwa 250 oder 12,50.',
    overdrawn: 'Überzogen (unter null)',
  },
  source: {
    label: 'Quelle',
    of: (what) => `Quelle: ${what}`,
    checked: (date) => `geprüft am ${date}`,
  },
  accountOption: (name, currency) => `${name} (${currency})`,
  counts: {
    accounts: (count) => `${count} ${count === 1 ? 'Konto' : 'Konten'}`,
    entries: (count) => `${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`,
    plan: 'dein Plan',
  },
  estimate: 'Schätzung',
};
