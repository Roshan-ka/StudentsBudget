import type { Messages } from '../en';

// Los registros en español: la lista, el formulario, Añadir rápido y los errores de buildEntry.
export const entries: Messages['entries'] = {
  addEntry: 'Añadir registro',
  transfer: 'Transferencia',
  recurring: 'Recurrente',
  noAccount: 'Primero añade una cuenta en Ajustes → Cuentas y transferencias.',
  saveFailed: 'No se ha podido guardar el registro.',
  list: {
    label: 'Registros',
    unknownAccount: 'Cuenta desconocida',
    clear: 'Quitar',
    monthNav: 'Mes',
    previous: 'Anterior',
    next: 'Siguiente',
    nothingYet: 'Aquí aún no hay nada registrado.',
  },
  edit: {
    heading: 'Editar registro',
    deleteQuestion: '¿Borrar este registro?',
    yes: 'Sí',
    cancel: 'Cancelar',
    delete: 'Borrar',
    deleteFailed: 'No se ha podido borrar el registro.',
  },
  form: {
    saveAnother: 'Guardar y añadir otro',
    savedAnother: 'Guardado. Añade el siguiente.',
    groups: { flexible: 'Sobres', fixed: 'Gastos fijos', oneoff: 'Gastos puntuales' },
    typeLabel: 'Tipo de registro',
    expense: 'Gasto',
    income: 'Ingreso',
    amount: 'Importe',
    account: 'Cuenta',
    category: 'Categoría',
    note: 'Nota',
    pickDate: 'Elige una fecha.',
    saveChanges: 'Guardar cambios',
    saveIncome: 'Guardar ingreso',
    saveExpense: 'Guardar gasto',
  },
  quickAdd: {
    label: 'Añadir rápido',
    hint: 'Qué y cuánto, como “döner 6”.',
    add: 'Añadir',
    noAmount: 'Añade un importe, como “döner 6”',
    whichAmount: '¿Qué importe?',
    amountGroup: 'Importe',
    whichCategory: '¿Qué categoría?',
    categoryGroup: 'Categoría',
    more: 'Más',
    saved: (what) => `Guardado: ${what}`,
    undo: 'Deshacer',
    undoFailed: 'No se ha podido deshacer.',
    mic: 'Dictar un registro',
    stopMic: 'Dejar de escuchar',
    listening: 'Escuchando…',
    /** El estado mientras la IA lee una línea (fase de IA, chunk 7). */
    reading: 'Leyendo…',
    /** Bajo el campo, cuando la IA dijo que no y la línea se leyó en el móvil. */
    aiHint: {
      'daily-limit': 'Has usado las lecturas con IA de hoy, así que Añadir rápido lee tus líneas en este móvil por ahora.',
      'second-step':
        'Esta línea se leyó en el móvil. Para usar la IA, introduce el código de tu app de autenticación en Ajustes → Tu cuenta.',
    },
    micNote: {
      text:
        'Tu navegador convierte lo que dices en texto. Para ello puede enviar la grabación a su servicio de voz ' +
        '(Chrome la envía a Google). StudentsBudget solo recibe el texto.',
      continue: 'Continuar',
      cancel: 'Cancelar',
    },
    micErrors: {
      denied: 'El micrófono está bloqueado. Permítelo para este sitio en los ajustes de tu navegador.',
      noSpeech: 'No se ha oído nada. Inténtalo de nuevo.',
      offline: 'No tienes conexión. Para dictar un registro hace falta conexión.',
      noMic: 'No se ha encontrado ningún micrófono.',
      failed: 'No se ha podido entender. Inténtalo de nuevo o escríbelo.',
    },
  },
  errors: {
    enterAmount: 'Escribe un importe.',
    noRate: (currency) => `Aún no hay tipo de cambio para ${currency}. Pon uno en Ajustes → Cuentas y transferencias.`,
  },
};
