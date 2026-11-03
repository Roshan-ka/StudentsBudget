import type { Messages } from '../en';

// Las categorías integradas en español. Como mucho 16 caracteres donde un gráfico muestra el nombre sin forma corta
// (comprobado en src/features/charts/colors.test.ts); los nombres más largos tienen una en charts.shortNames.
export const categories: Messages['categories'] = {
  food: 'Alimentación',
  'eating-out': 'Comer fuera',
  'going-out': 'Ocio',
  transport: 'Transporte',
  shopping: 'Compras',
  health: 'Salud y farmacia',
  'personal-care': 'Cuidado personal',
  study: 'Estudios',
  household: 'Hogar',
  travel: 'Viajes',
  gifts: 'Regalos',
  other: 'Otros',
  rent: 'Alquiler',
  phone: 'Móvil e internet',
  insurance: 'Seguros',
  subscriptions: 'Suscripciones',
  'transport-pass': 'Deutschlandticket / abono semestral',
  gym: 'Deporte',
  utilities: 'Suministros y Rundfunkbeitrag',
  'one-off': 'Gastos puntuales',
  'income-job': 'Trabajo',
  'income-parents': 'Padres',
  'income-bafoeg': 'BAföG',
  'income-sperrkonto': 'Cuenta bloqueada',
  'income-scholarship': 'Beca',
  'income-other': 'Otros ingresos',
};
