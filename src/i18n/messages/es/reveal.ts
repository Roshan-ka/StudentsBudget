import type { Messages } from '../en';

// La comparación de estimaciones en español: su tarjeta en Inicio, la página y el mes a mes de reveal-text.ts.
export const reveal: Messages['reveal'] = {
  card: {
    open: 'Mira qué tal fueron tus estimaciones',
    label: 'Tus estimaciones',
    unlocksOn: (day) => `Tus estimaciones se desbloquean el ${day}.`,
    whatsThis: '¿Qué es esto?',
  },
  locked: {
    unlocksOn: (day) => `Tus estimaciones se desbloquean el ${day}. Sigue registrando.`,
    explain: (days) =>
      'Al configurar el plan estimaste lo que gastas cada mes. ' +
      `Tras ${days} días de registros, verás cómo se comparan tus estimaciones con lo que gastaste de verdad.`,
  },
  listLabel: 'Tus estimaciones',
  guessLine: (guessed, actual) => `Estimaste ${guessed}. Fueron ${actual}.`,
  scaled: (from, to) => `Tus gastos del ${from} al ${to}, llevados a un mes de 30 días.`,
  adjust: 'Editar plan',
  noGuesses: 'Al configurar el plan no se guardaron estimaciones, así que no hay nada que comparar.',
  monthByMonth: 'Mes a mes',
  recap: {
    partial: (month, from) => `${month} (contado desde el ${from})`,
    leftOver: (label, amount) => `${label}: sobraron ${amount}`,
    savings: (label, amount) => `${label}: sobraron ${amount} → ahorro`,
    over: (label, amount) => `${label}: ${amount} por encima del plan`,
    onPlan: (label) => `${label}: justo según el plan`,
  },
  noPlan: 'Configura tu plan para comparar tus estimaciones con lo que gastas.',
  startSetup: 'Empezar la configuración',
};
