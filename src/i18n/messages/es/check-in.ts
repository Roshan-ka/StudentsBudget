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
    against: 'Esta semana frente a tu plan',
    logged: 'Esta semana',
    empty: 'Esta semana aún no hay nada registrado.',
  },
  // Los días de esta semana que aún caen en el mes anterior.
  earlierThisWeek: {
    against: 'Principio de la semana frente a tu plan',
    logged: 'Principio de la semana',
    empty: 'Al principio de la semana no hay nada registrado.',
  },
  noEnvelopes: 'Ningún sobre tiene importe en tu plan.',
  line: {
    planned: (planned, spent, verdict) => `${planned} previstos · ${spent} gastados · ${verdict}`,
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
  startSetup: 'Empezar la configuración',
};
