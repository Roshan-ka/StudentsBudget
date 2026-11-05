import type { Messages } from '../en';
import { byCount } from './count';

// La configuración y Editar plan en español: el asistente, sus pasos, las comprobaciones y líneas de draft.ts y la
// pista de instalación. "Añadir automáticamente" se llama igual que en Ajustes.
export const setup: Messages['setup'] = {
  headingNew: 'Configura tu plan',
  headingEdit: 'Ajusta tu plan',
  stepOf: (step, total) => `Paso ${step} de ${total}`,
  titles: {
    'city-rent': 'Ciudad y alquiler',
    accounts: 'Cuentas',
    income: 'Ingresos',
    fixed: 'Gastos fijos',
    'one-offs': 'Gastos puntuales',
    guesses: 'Estimaciones',
    envelopes: 'Sobres',
  },
  accountsInSettings: 'Tus cuentas ya están configuradas en Ajustes.',
  saveFailed: 'No se ha podido guardar tu plan. Inténtalo de nuevo.',
  back: 'Atrás',
  next: 'Siguiente',
  save: 'Guardar plan',
  problems: {
    checkAmount: (name) => `Revisa el importe de ${name}.`,
    addAccount: 'Añade al menos una cuenta',
    nameAccounts: 'Ponle nombre a cada cuenta.',
    checkOpening: (name, number) => `Revisa el saldo inicial de ${name ?? `la cuenta ${number}`}.`,
    foreignAmount: (currency, name) => `Escribe el importe en ${currency} de ${name}.`,
    nameOneOffs: 'Ponle nombre a cada gasto puntual.',
    checkOneOff: (name, number) => `Revisa el importe de ${name ?? `el gasto puntual ${number}`}.`,
    dueMonth: 'Elige un mes posterior a este.',
    checkGuess: (name) => `Revisa la estimación de ${name}.`,
    checkBudget: 'Revisa el importe de tu presupuesto del día a día.',
    addEnvelope: (name) => `Añade un importe para ${name}`,
  },
  cityRent: {
    city: 'Ciudad',
    onlyCity: 'Por ahora, Regensburg es la única ciudad.',
    rent: 'Alquiler al mes',
    rooms: (range) => `Habitaciones aquí: ${range}`,
  },
  accounts: {
    intro: '¿Dónde está tu dinero? El saldo inicial es lo que hay hoy en cada cuenta.',
    account: (number) => `Cuenta ${number}`,
    name: 'Nombre',
    type: 'Tipo',
    bank: 'Banco',
    cash: 'Efectivo',
    currency: 'Moneda',
    opening: 'Saldo inicial',
    remove: (number) => `Quitar la cuenta ${number}`,
    add: 'Añadir cuenta',
    prefilled: { localBank: 'Banco de aquí', homeBank: 'Banco de casa', cash: 'Efectivo' },
  },
  income: {
    intro: '¿Cuánto entra cada mes, en euros? Deja fuera lo que no recibes. Si varía, pon una estimación baja.',
    savings: {
      before: '¿Vives de tus ahorros? Añade lo que usas cada mes en Otros ingresos y desactiva ',
      automatic: 'Añadir automáticamente',
      after: ', para que el dinero que ya está en tu cuenta no cuente dos veces.',
    },
    later: '¿Recibes BAföG o una beca? Añádelo más tarde en Editar plan, en Ajustes.',
  },
  fixed: {
    intro: '¿Qué pagas cada mes, en euros? Tu alquiler ya está incluido desde el paso 1. Deja fuera lo que no pagas.',
    later:
      'Las suscripciones, el gimnasio, los suministros y el Rundfunkbeitrag se pueden añadir más tarde en Editar ' +
      'plan, en Ajustes.',
    rent: (amount) => `Alquiler: ${amount} al mes`,
  },
  oneOffs: {
    intro:
      'Gastos grandes que llegan una sola vez, como una cuota semestral o una fianza. Apartamos una parte cada mes ' +
      'hasta el mes del pago. Sáltate este paso si no tienes ninguno. Un gasto sin importe no se guarda.',
    oneOff: (number) => `Gasto puntual ${number}`,
    name: 'Nombre',
    amount: 'Importe',
    leftOut: 'Sin importe, este gasto no se guarda.',
    due: 'Mes del pago',
    remove: (number) => `Quitar el gasto puntual ${number}`,
    add: 'Añadir un gasto puntual',
    feeOffer: (amount, month) => `Añadir la cuota semestral${amount === null ? '' : `: ${amount}`}, a pagar en ${month}`,
  },
  guesses: {
    intro:
      'Hazle caso a tu intuición, en euros. Pon 0 si no gastas nada en ello. Sáltate las que no tengas claras. ' +
      'Las estimaciones se guardan una vez y no se pueden cambiar después.',
    question: (topic) => `¿Cuánto crees que gastas al mes en ${topic}?`,
  },
  topics: {
    food: 'comida y súper',
    'eating-out': 'comer fuera',
    'going-out': 'ocio',
    transport: 'transporte',
    shopping: 'compras',
    other: 'otras cosas',
  },
  envelopes: {
    budgetIntro: 'Un presupuesto del día a día es opcional: con uno, cada sobre de abajo recibe un importe sugerido.',
    budgetQuestion: '¿Cuánto quieres gastar al mes en el día a día, sin contar el alquiler ni tus gastos fijos?',
    typicalSpend: (range) => `Los estudiantes de aquí suelen gastar unos ${range} al mes en esto.`,
    estimates: (list, count) =>
      `${list.charAt(0).toUpperCase()}${list.slice(1)} ${byCount(count, { one: 'es una estimación', other: 'son estimaciones' })}.`,
    whereFrom: 'De dónde sale esto',
    askEdit: '¿Cuánto quieres permitirte al mes para cada uno, en euros? Puedes cambiarlo cuando quieras.',
    askNew:
      '¿Cuánto quieres permitirte al mes para cada uno, en euros? Puedes cambiarlos, y añadir sobres como ' +
      'material de estudio o viajes, en Editar plan, en Ajustes.',
    useSuggested: 'Usar los importes sugeridos',
    fillsOnly: 'Solo rellena los sobres que aún no has puesto.',
    studentsHere: 'Estudiantes aquí',
    suggested: (amount) => `Sugerido: ${amount}`,
    below: 'Por debajo de lo que suelen necesitar los estudiantes de aquí.',
  },
  lines: {
    available: (amount) => `Disponible: ${amount}`,
    planned: (amount) => `Previsto: ${amount}`,
    overBy: (amount) => `${amount} de más`,
    ofBudget: (planned, budget) => `${planned} de tu presupuesto de ${budget}`,
    overBudget: (over, budget) => `${over} por encima de tu presupuesto de ${budget}`,
    range: (label, range) => `${label}: ${range}`,
    rangeEstimate: (label, range) => `${label}: ${range} (estimación)`,
  },
  installHint:
    'Instálala primero: toca Compartir → Añadir a pantalla de inicio y configúrala allí. Lo que escribas en Safari ' +
    'se queda en Safari.',
  setupRow: { title: 'Configura tu plan', summary: 'Tu plan aún no está configurado' },
  editPlan: {
    summary: 'Ingresos, gastos fijos y sobres',
    heading: 'Plan',
    body:
      'Cambia tus sobres y gastos puntuales, añade las fuentes de ingresos, los gastos fijos y los sobres que la ' +
      'configuración se saltó, o repasa todo el plan otra vez. Las estimaciones de la ' +
      'configuración no cambian.',
    link: 'Editar plan',
  },
};
