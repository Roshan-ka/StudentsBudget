import type { Messages } from '../en';
import { byCount } from './count';

// Ajustes → Importar y exportar en español (importación y exportación CSV,
// docs/superpowers/plans/2026-11-09-csv-import-export.md): un extracto bancario hacia dentro, los registros hacia fuera
// en un archivo de hoja de cálculo.
export const importExport: Messages['importExport'] = {
  summary: 'Importar un extracto bancario o exportar tus registros',
  import: {
    heading: 'Importar un extracto bancario',
    hint:
      'Descarga un extracto en CSV desde la web o la app de tu banco y elígelo aquí. Se reconocen los extractos de ' +
      'Sparkasse, DKB, N26 y Revolut. El archivo se lee solo en este móvil y no se guarda.',
    file: 'Archivo del extracto (CSV)',
    noPlan: 'Primero configura tu plan: la importación cuenta cada fila en él.',
    toSetup: 'Ir a la configuración',
    reading: 'Leyendo el archivo…',
    recognised: (bank, rows, from, to) => `${bank}: ${byCount(rows, { one: `${rows} fila`, other: `${rows} filas` })}, del ${from} al ${to}`,
    account: 'Importar en',
    submit: 'Importar',
    choose: 'Elegir otro archivo',
    problems: {
      tooBig: 'Este archivo es demasiado grande para un extracto: como mucho 2 MB y 5000 filas.',
      empty: 'Este archivo no tiene filas que la app pueda leer.',
      unknown: 'La app no reconoce las columnas de este archivo. Funcionan los extractos de Sparkasse, DKB, N26 y Revolut.',
      creditCard: (bank) =>
        `Es una exportación de tarjeta de crédito de ${bank}, que la app aún no sabe leer. Exporta en su lugar el extracto de tu cuenta corriente.`,
      failed: 'No se ha podido leer el archivo.',
      noRate: (currency) =>
        `Todavía no hay tipo de cambio para ${currency}. Introduce uno en Ajustes → Cuentas y transferencias y vuelve a importar.`,
      noAccount: 'Esa cuenta ya no existe. Elige otra.',
      saveFailed: 'No se ha podido guardar la importación.',
    },
  },
  result: {
    heading: 'Importación terminada',
    added: (entries, transfers) => {
      const counted = byCount(entries, { one: `${entries} registro añadido`, other: `${entries} registros añadidos` });
      return transfers === 0
        ? `${counted}.`
        : `${counted}, ${byCount(transfers, { one: 'uno de ellos una transferencia', other: `${transfers} de ellos transferencias` })}.`;
    },
    nothing: 'Nada nuevo: cada fila ya estaba en la app o se ha dejado fuera.',
    opening: (account, amount) =>
      `El saldo inicial de ${account} se ha movido ${amount}: algunas filas son de antes de que añadieras la cuenta, así que su saldo de hoy sigue igual.`,
    skipped: (count) => `Dejadas fuera (${count})`,
    reasons: {
      unreadable: 'No se puede leer',
      pending: 'Aún pendiente en el banco',
      internal: 'Un movimiento dentro del banco',
      zero: 'Un importe de cero',
      currency: 'No está en la moneda de la cuenta',
      future: 'Con fecha posterior a hoy',
      beforePlan: 'De antes de empezar tu plan',
      otherCurrencyTransfer: 'Una transferencia a una cuenta en otra moneda',
      noTransferAccount: 'No hay cuenta en la app para la transferencia',
      duplicate: 'Ya está en la app',
    },
    undo: 'Deshacer esta importación',
    undone: (count) =>
      `Importación deshecha: ${byCount(count, { one: `${count} registro quitado`, other: `${count} registros quitados` })}.`,
    another: 'Importar otro archivo',
  },
  export: {
    heading: 'Exportar a una hoja de cálculo',
    hint: 'Guarda todos los registros en un archivo CSV para Excel, Numbers o Google Sheets. Para pasar tus datos a otro móvil, usa la copia de seguridad.',
    empty: 'Todavía no hay registros que exportar.',
    button: 'Exportar registros',
    shareTitle: 'Registros de StudentsBudget',
    shared: 'Registros compartidos.',
    downloaded: (fileName) => `Descarga iniciada: ${fileName}`,
    shareFailed: 'El menú de compartir no se ha abierto. Puedes descargar el archivo en su lugar.',
    downloadInstead: 'Descargar en su lugar',
    failed: 'No se han podido exportar tus registros.',
  },
  columns: { currency: 'Moneda', eur: 'Importe en EUR' },
  transferTo: (account) => `A ${account}`,
};
