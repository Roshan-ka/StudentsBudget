import type { Messages } from '../en';

// La copia de seguridad en español: Ajustes → Copia de seguridad (exportar, restaurar, borrarlo todo), la
// restauración en /setup y las comprobaciones de backup.ts.
export const backup: Messages['backup'] = {
  heading: 'Copia de seguridad',
  intro:
    'Todo lo que escribes se queda en este móvil, salvo que lo vincules a tu cuenta. Un archivo de copia de ' +
    'seguridad es una copia que guardas tú, así que exporta una de vez en cuando y guárdala en un lugar seguro.',
  export: {
    heading: 'Exportar una copia de seguridad',
    hint: 'Guarda todo en un archivo. En un iPhone, elige Guardar en Archivos en el menú de compartir.',
    button: 'Exportar copia',
    shareTitle: 'Copia de seguridad de StudentsBudget',
    shared: 'Copia compartida.',
    downloaded: (fileName) => `Descarga iniciada: ${fileName}`,
    shareFailed: 'El menú de compartir no se ha abierto. Puedes descargar el archivo en su lugar.',
    downloadInstead: 'Descargar en su lugar',
    failed: 'No se han podido exportar tus datos.',
  },
  restore: {
    heading: 'Restaurar una copia de seguridad',
    file: 'Archivo para restaurar',
    reading: 'Leyendo…',
    confirmGroup: 'Confirmar la restauración',
    question: { before: '¿Sustituir todos los datos por ', after: '?' },
    linked:
      'Este móvil está vinculado a tu cuenta: tu cuenta y tus otros móviles se actualizan en la próxima ' +
      'sincronización.',
    replace: 'Sustituir todos los datos',
    cancel: 'Cancelar',
    readFailed: 'No se ha podido leer ese archivo.',
    failed: 'No se ha podido restaurar la copia. Los datos de este dispositivo no han cambiado.',
    setupHeading: '¿Tienes una copia? Restáurala',
    setupIntro: '¿Ya usabas StudentsBudget? Elige tu archivo de copia para seguir donde lo dejaste.',
  },
  delete: {
    heading: 'Borrarlo todo',
    intro:
      'Quita de este móvil tu plan, cuentas, registros, semanas guardadas e insignias, respuestas sobre ' +
      'descuentos, perfil y tipos de cambio. Un móvil vinculado a tu cuenta se desvincula: tu cuenta conserva su ' +
      'copia y sigues con la sesión iniciada. Los cambios aún no sincronizados se pierden.',
    warning:
      'Esto no se puede deshacer en este móvil. Para recuperar tus datos más tarde, exporta antes una copia de ' +
      'seguridad o guarda en tu cuenta.',
    word: 'BORRAR',
    typeToConfirm: (word) => `Escribe ${word} para confirmar`,
    button: 'Borrarlo todo',
    cancel: 'Cancelar',
    failed: 'No se han podido borrar tus datos. Inténtalo de nuevo.',
  },
  file: {
    notBackup: 'Este no es un archivo de copia de seguridad de StudentsBudget.',
    newer: 'Esta copia es de una versión más nueva de la app.',
    incomplete: 'Este archivo de copia está incompleto.',
    damaged: (problem) => `Este archivo de copia está dañado: ${problem}.`,
  },
  problems: {
    entryAccount: 'un registro usa una cuenta que no está en el archivo',
    transferAccount: 'una transferencia va a una cuenta que no está en el archivo',
    entryCategory: 'un registro usa una categoría que no está en el archivo',
    planCategory: 'el plan o las estimaciones usan una categoría desconocida',
    duplicateId: 'dos filas tienen el mismo id',
    weekShape: 'una semana guardada no va de lunes a domingo',
    zeroAmount: 'un importe es cero o negativo',
    negativeAmount: 'un importe es negativo',
    impossibleSchedule: 'un gasto fijo o un ingreso tiene una programación imposible',
  },
  saved: (dateTime) => `Guardado el ${dateTime}`,
};
