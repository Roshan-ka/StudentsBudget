import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// Les textes partagés par plusieurs zones : le champ de date, le champ de montant, la source d'une fourchette, les
// décomptes.
export const common: Messages['common'] = {
  dateField: {
    label: 'Date',
    pickDay: 'Choisis un jour',
    today: 'Aujourd’hui',
    yesterday: 'Hier',
    letters: { day: 'J', month: 'M', year: 'A' },
  },
  amountField: {
    positive: 'Saisis un montant supérieur à 0, comme 250 ou 12,50.',
    number: 'Saisis un nombre, comme 250 ou 12,50.',
    overdrawn: 'À découvert (sous zéro)',
  },
  source: {
    label: 'Source',
    of: (what) => `Source${NNBSP}: ${what}`,
    checked: (date) => `vérifié le ${date}`,
  },
  accountOption: (name, currency) => `${name} (${currency})`,
  counts: {
    accounts: (count) => byCount(count, { one: `${count} compte`, other: `${count} comptes` }),
    entries: (count) => byCount(count, { one: `${count} saisie`, other: `${count} saisies` }),
    plan: 'ton plan',
  },
  estimate: 'Estimation',
};
