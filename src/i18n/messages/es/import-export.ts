import type { Messages } from '../en';

// Ajustes → Importar y exportar en español (importación y exportación CSV,
// docs/superpowers/plans/2026-11-09-csv-import-export.md): los registros en un archivo de hoja de cálculo; la
// importación de extractos bancarios llegará después.
export const importExport: Messages['importExport'] = {
  summary: 'Tus registros en un archivo de hoja de cálculo',
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
