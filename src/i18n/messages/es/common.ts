import type { Messages } from '../en';
import { byCount } from './count';

// Textos que comparten varias áreas: el campo de fecha, el de importe, la fuente de una horquilla y los recuentos.
export const common: Messages['common'] = {
  dateField: {
    label: 'Fecha',
    pickDay: 'Elige un día',
    today: 'Hoy',
    yesterday: 'Ayer',
    letters: { day: 'D', month: 'M', year: 'A' },
  },
  amountField: {
    positive: 'Escribe un importe mayor que 0, como 250 o 12,50.',
    number: 'Escribe un número, como 250 o 12,50.',
    overdrawn: 'En descubierto (bajo cero)',
  },
  source: {
    label: 'Fuente',
    of: (what) => `Fuente: ${what}`,
    checked: (date) => `comprobado el ${date}`,
  },
  accountOption: (name, currency) => `${name} (${currency})`,
  counts: {
    accounts: (count) => byCount(count, { one: `${count} cuenta`, other: `${count} cuentas` }),
    entries: (count) => byCount(count, { one: `${count} registro`, other: `${count} registros` }),
    plan: 'tu plan',
  },
  estimate: 'Estimación',
};
