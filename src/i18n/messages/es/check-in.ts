import type { Messages } from '../en';

// La revisión semanal en español: su tarjeta en Inicio, la página y week-line.ts. El servidor MCP la
// sigue llamando en inglés.
export const checkIn: Messages['checkIn'] = {
  card: {
    title: 'Revisión semanal',
    sunday: 'Es domingo: hora de tu revisión semanal.',
    other: 'Tu revisión semanal es el domingo.',
  },
  thisWeek: {
    envelopes: 'Sobres de esta semana',
    bar: (category) => `${category} esta semana`,
    logged: 'Esta semana',
    empty: 'Esta semana aún no hay nada registrado.',
  },
  // Los días de esta semana que aún caen en el mes anterior.
  earlierThisWeek: {
    envelopes: 'Sobres del principio de la semana',
    bar: (category) => `${category} al principio de la semana`,
    logged: 'Principio de la semana',
    empty: 'Al principio de la semana no hay nada registrado.',
  },
  // La tarjeta de la semana: «139 € para gastar» o «9 € de más esta semana».
  week: {
    safe: { before: '', after: ' para gastar' },
    over: { before: '', after: ' de más esta semana' },
    spent: (amount) => `${amount} gastados hasta ahora`,
    bar: 'Gastado esta semana',
  },
  noEnvelopes: 'Ningún sobre tiene importe en tu plan.',
  line: {
    of: (spent, planned, verdict) => `${spent} de ${planned} · ${verdict}`,
    onPlan: 'según el plan',
    under: (amount) => `${amount} por debajo`,
    over: (amount) => `${amount} de más`,
    usedUp: (spent) => `No queda nada este mes · ${spent} gastados`,
    usedUpOver: (spent, over) => `No queda nada este mes · ${spent} gastados · ${over} de más`,
  },
  total: {
    toSpend: (amount) => `En total: ${amount} para gastar esta semana`,
    over: (amount) => `En total: ${amount} de más esta semana`,
  },
  away: {
    lastWeek: 'Estuve fuera la semana pasada',
    thisWeek: 'Estuve fuera esta semana',
    hint:
      'Una semana fuera deja tu racha de registros como está y no cuenta para Semana bajo presupuesto ni Realeza ' +
      'del ramen.',
  },
  add: {
    heading: '¿Se te olvidó algo? Añádelo aquí',
    earlier: 'Añadir algo de un día anterior',
  },
  reminder: 'Añadir un recordatorio semanal al calendario',
  calendarEvent: 'Revisión semanal (StudentsBudget)',
  reminderOr: 'O, en su lugar, una notificación en este móvil:',
  reminderOrLink: 'Recordatorio semanal',
  noPlan: 'Configura tu plan para revisar tu semana.',
};
