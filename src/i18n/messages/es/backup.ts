import type { Messages } from '../en';

// La copia de seguridad en español: Ajustes → Copia de seguridad (exportar, restaurar, borrarlo todo), la
// restauración en /setup y las comprobaciones de backup.ts.
export const backup: Messages['backup'] = {
  summary: 'Exportar, restaurar o borrar los datos de este móvil',
  intro: 'Tus datos se quedan en este móvil, salvo que vincules una cuenta.',
  more: '¿Por qué guardar una copia?',
  moreText:
    'Un archivo de copia de seguridad es una copia que guardas tú, así que exporta una de vez en cuando y guárdala ' +
    'en un lugar seguro.',
  export: {
    heading: 'Exportar una copia de seguridad',
    hint: 'Un archivo con todo. En un iPhone, elige Guardar en Archivos.',
    button: 'Exportar copia',
    shareTitle: 'Copia de seguridad de StudentsBudget',
    shared: 'Copia compartida.',
    downloaded: (fileName) => `Descarga iniciada: ${fileName}`,
    shareFailed: 'El menú de compartir no se ha abierto. Puedes descargar el archivo en su lugar.',
    download: 'Descargar',
    failed: 'No se han podido exportar tus datos.',
  },
  restore: {
    heading: 'Restaurar una copia de seguridad',
    intro: 'Sustituye los datos de este móvil por los del archivo.',
    choose: 'Elegir un archivo de copia',
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
    failed: 'No se ha podido restaurar la copia. Los datos de este móvil no han cambiado.',
    setupHeading: '¿Tienes una copia? Restáurala',
    /** Setup's quiet button that opens the file field (13-11-2026). */
    setupButton: 'Restaurar una copia',
  },
  delete: {
    heading: 'Borrarlo todo',
    intro: 'Quita de este móvil tu plan, cuentas, registros y todos tus demás datos.',
    linked:
      'Un móvil vinculado a tu cuenta de StudentsBudget se desvincula: esa cuenta conserva su copia y sigues con la ' +
      'sesión iniciada. Los cambios aún no sincronizados se pierden.',
    warning:
      'Esto no se puede deshacer en este móvil. Para recuperar tus datos más tarde, exporta antes una copia de ' +
      'seguridad o sincronízalos con tu cuenta.',
    word: 'BORRAR',
    typeToConfirm: (word) => `Escribe ${word} para confirmar`,
    button: 'Borrarlo todo',
    cancel: 'Cancelar',
    failed: 'No se han podido borrar tus datos. Inténtalo de nuevo.',
  },
  file: {
    notBackup: 'Este no es un archivo de copia de seguridad de StudentsBudget. Elige una que haya exportado la app: su nombre empieza por studentsbudget-backup.',
    newer: 'Esta copia es de una versión más nueva de la app. Recarga la app con conexión para actualizarla y vuelve a intentarlo.',
    incomplete: 'Este archivo de copia está incompleto. Elige otra copia o exporta una nueva.',
    damaged: (problem) => `Este archivo de copia está dañado: ${problem}. Elige otra copia o exporta una nueva.`,
  },
  problems: {
    entryAccount: 'un registro usa una cuenta que no está en el archivo',
    transferAccount: 'una transferencia va a una cuenta que no está en el archivo',
    entryCategory: 'un registro usa una categoría que no está en el archivo',
    planCategory: 'el plan usa una categoría desconocida',
    duplicateId: 'dos filas tienen el mismo id',
    weekShape: 'una semana guardada no va de lunes a domingo',
    zeroAmount: 'un importe es cero o negativo',
    negativeAmount: 'un importe es negativo',
    impossibleSchedule: 'un gasto fijo o un ingreso tiene una programación imposible',
  },
  saved: (dateTime) => `Guardado el ${dateTime}`,
};
