import type { Messages } from '../en';
import { byCount } from './count';

// La configuración y Editar plan en español: el asistente, sus pasos, las comprobaciones y líneas de draft.ts y la
// pista de instalación. "Añadir automáticamente" se llama igual que en Ajustes.
export const setup: Messages['setup'] = {
  headingNew: 'Configura tu plan',
  headingEdit: 'Editar plan',
  stepOf: (step, total) => `Paso ${step} de ${total}`,
  titles: {
    accounts: 'Cuentas',
    income: 'Ingresos',
    fixed: 'Gastos fijos',
    'one-offs': 'Gastos puntuales',
    envelopes: 'Sobres',
  },
  accountsInSettings: 'Tus cuentas ya están configuradas en Ajustes → Cuentas y transferencias.',
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
    checkOneOff: (name, number) => (name === null ? `Revisa el importe del gasto puntual ${number}.` : `Revisa el importe de ${name}.`),
    dueMonth: 'Elige un mes posterior a este.',
    checkBudget: 'Revisa el importe de tu presupuesto del día a día.',
    addEnvelope: (name) => `Añade un importe para ${name}`,
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
    prefilled: { localBank: 'Banco de aquí', cash: 'Efectivo' },
  },
  income: {
    intro: '¿Cuánto entra cada mes, en euros? Deja fuera lo que no recibes. Si varía, pon una estimación baja.',
    savings: {
      before: '¿Vives de tus ahorros? Añade lo que usas cada mes en Otros ingresos y desactiva ',
      automatic: 'Añadir automáticamente',
      after: ', para que el dinero que ya está en tu cuenta no cuente dos veces.',
    },
    later: '¿Recibes BAföG o una beca? Añádelo más tarde en Ajustes → Plan → Editar plan.',
    more: '¿Ahorros, BAföG o una beca?',
    moreEdit: '¿Vives de tus ahorros?',
  },
  fixed: {
    intro: '¿Qué pagas cada mes, en euros? Deja fuera lo que no pagas.',
    rentLabel: 'Alquiler al mes',
    rooms: (range) => `Habitaciones aquí: ${range}`,
    later:
      'Las suscripciones, el gimnasio, los suministros, el Rundfunkbeitrag y los gastos puntuales como la cuota ' +
      'semestral se pueden añadir más tarde en Ajustes → Plan → Editar plan.',
    more: '¿Gimnasio, suscripciones, la cuota semestral?',
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
  topics: {
    food: 'comida y súper',
    'eating-out': 'comer fuera',
    'going-out': 'ocio',
    transport: 'transporte',
    shopping: 'compras',
    other: 'otras cosas',
  },
  envelopes: {
    budgetIntroNew: (amount) =>
      `Un presupuesto del día a día es opcional. Sin él, las sugerencias reparten lo que queda tras el alquiler y los gastos fijos: ${amount}.`,
    budgetIntroEdit: (amount) =>
      'Un presupuesto del día a día es opcional. Sin él, las sugerencias reparten lo que queda tras el alquiler, los ' +
      `gastos fijos y lo que se aparta para gastos puntuales: ${amount}.`,
    budgetQuestion: '¿Cuánto quieres gastar al mes en el día a día, sin contar el alquiler ni tus gastos fijos?',
    typicalSpend: (range) => `Los estudiantes de aquí suelen gastar unos ${range} al mes en esto.`,
    estimates: (list, count) =>
      `${list.charAt(0).toUpperCase()}${list.slice(1)} ${byCount(count, { one: 'es una estimación', other: 'son estimaciones' })}.`,
    whereFrom: 'De dónde sale esto',
    askEdit: '¿Cuánto quieres permitirte al mes para cada uno, en euros? Puedes cambiarlo cuando quieras.',
    askNew:
      '¿Cuánto quieres permitirte al mes para cada uno, en euros? Puedes cambiarlos, y añadir sobres como ' +
      'material de estudio o viajes, en Ajustes → Plan → Editar plan.',
    useSuggested: 'Usar los importes sugeridos',
    fillsOnly: 'Solo rellena los sobres que aún no has puesto.',
    studentsHere: 'Estudiantes aquí',
    suggested: (amount) => `Sugerido: ${amount}`,
    below: 'Por debajo de lo que suelen necesitar los estudiantes de aquí.',
    belowSome: (count) => `${count} de estos sobres están por debajo de lo que suelen necesitar los estudiantes de aquí.`,
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
      'Cambia tus sobres, añade gastos puntuales como la cuota semestral y las fuentes de ingresos, los gastos ' +
      'fijos y los sobres que la configuración se saltó, o repasa todo el plan otra vez.',
    link: 'Editar plan',
  },
  /** El chat de configuración (fase de IA, chunk 12): en el primer paso de una configuración nueva, con sesión, con IA. */
  chat: {
    open: 'Configurar chateando',
    openHint: 'Cuéntale a la app sobre tu dinero con tus propias palabras, y el chat rellena los pasos para que los revises.',
    switchedOff: 'El chat de configuración está desactivado en este móvil. Las funciones de IA se activan en Ajustes → Tu cuenta.',
    heading: 'Configurar chateando',
    intro:
      'Di lo que entra cada mes, tu alquiler y otros gastos fijos, y cómo quieres gastar el resto. El chat rellena ' +
      'los pasos; no se guarda nada hasta que los revises y toques Guardar plan.',
    message: 'Tu mensaje',
    messageHint: 'Por ejemplo «Recibo 500 € de mis padres y pago 400 € de alquiler».',
    send: 'Enviar',
    thinking: 'Pensando…',
    you: 'Tú',
    reply: 'El chat',
    filled: 'Rellenado',
    sources: 'Fuentes',
    budget: 'Presupuesto del día a día',
    accounts: 'Tus cuentas',
    /** Una cosa que rellenó una respuesta: «Alquiler: 400,00 €». */
    line: (name: string, amount: string) => `${name}: ${amount}`,
    full: 'Un chat no da para más. Revisa los pasos para seguir.',
    review: 'Revisar los pasos',
    problems: {
      dailyLimit: 'Has usado los mensajes del chat de hoy. Rellena los pasos tú mismo o vuelve a intentarlo mañana.',
      busy: 'El chat está ocupado ahora mismo. Inténtalo de nuevo en un momento o rellena los pasos tú mismo.',
      refused: 'El chat no puede responder a eso aquí. Prueba a decirlo de otra forma.',
      unavailable: 'No se puede conectar con el chat ahora mismo. Inténtalo más tarde o rellena los pasos tú mismo.',
      offline: 'Estás sin conexión. El chat necesita conexión.',
      timeout: 'El chat tardó demasiado en responder. Inténtalo de nuevo.',
      signedOut: 'Vuelve a iniciar sesión en Tu cuenta para usar el chat.',
      needsCode: 'Introduce el código de tu app de autenticación en Ajustes → Tu cuenta para usar el chat.',
      failed: 'Algo salió mal con esa respuesta. Inténtalo de nuevo.',
    },
  },
};
