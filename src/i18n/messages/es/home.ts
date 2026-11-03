import type { Messages } from '../en';
import { byCount } from './count';

// Inicio en español: el saludo, lo que queda este mes, los sobres, el presupuesto sugerido y el total de las cuentas.

const available = (amount: string) => `Tras tus gastos fijos y lo que apartas, tienes ${amount} al mes.`;

export const home: Messages['home'] = {
  greeting: (name) => `Hola, ${name}`,
  acrossAccounts: (total) => `En todas las cuentas: ${total}`,
  missingRates: (currencies, count) =>
    byCount(count, {
      one: `Falta el tipo de cambio de ${currencies}`,
      other: `Faltan los tipos de cambio de ${currencies}`,
    }),
  leftThisMonth: {
    heading: 'Disponible este mes',
    overThisMonth: ' de más este mes',
    weekOver: (amount) => `Esta semana: ${amount} de más`,
    weekSafe: (amount) => `Esta semana: ${amount} para gastar`,
  },
  envelopes: {
    heading: 'Sobres',
    barLabel: (category) => `${category} este mes`,
    left: (left, planned) => `Quedan ${left} de ${planned} este mes`,
    over: (over, planned) => `${over} de más sobre los ${planned} previstos este mes`,
  },
  suggestedBudget: {
    show: 'Ver un presupuesto sugerido',
    updated: 'Sobres actualizados.',
    heading: 'Presupuesto sugerido',
    perMonth: (category) => `${category} al mes`,
    studentsHere: 'Estudiantes aquí',
    lastMonth: (month) => `Tus gastos en ${month}`,
    nothingToGoOn: 'Aún no hay datos',
    nothingAvailable:
      'Todavía no hay nada que repartir: tus ingresos no dejan nada tras los gastos fijos y lo que apartas. ' +
      'Puedes cambiar tu plan en Ajustes.',
    available,
    availableWithinBudget: (amount, budget) =>
      `${available(amount)} Estos importes se ajustan a tu presupuesto del día a día de ${budget}.`,
    availableBelowBudget: (amount, budget) =>
      `${available(amount)} Es menos que tu presupuesto del día a día de ${budget}, así que estos importes se ` +
      `ajustan a ${amount}.`,
    leftForSavings: (amount) => `${amount} quedan para ahorrar`,
    overAvailable: (amount) => `${amount} por encima de lo disponible`,
    use: 'Usar este presupuesto',
    notNow: 'Ahora no',
    replaces: 'Al usarlo, se sustituyen los importes de tus sobres.',
    fixAmounts: 'Corrige los importes marcados arriba para usar este presupuesto.',
    enterOne: 'Escribe al menos un importe para usar este presupuesto.',
    failed: 'No se ha guardado. Inténtalo de nuevo.',
  },
};
