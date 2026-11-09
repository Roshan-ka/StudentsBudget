import type { Messages } from '../en';

// Optionen → Import und Export auf Deutsch (CSV-Import und -Export, docs/superpowers/plans/2026-11-09-csv-import-export.md):
// die Einträge als Tabellendatei; der Import von Kontoauszügen folgt.
export const importExport: Messages['importExport'] = {
  summary: 'Deine Einträge als Tabellendatei',
  export: {
    heading: 'Als Tabelle exportieren',
    hint: 'Speichert alle Einträge als CSV-Datei für Excel, Numbers oder Google Tabellen. Um deine Daten auf ein anderes Handy zu bringen, nimm das Backup.',
    empty: 'Noch keine Einträge zum Exportieren.',
    button: 'Einträge exportieren',
    shareTitle: 'StudentsBudget-Einträge',
    shared: 'Einträge geteilt.',
    downloaded: (fileName) => `Download gestartet: ${fileName}`,
    shareFailed: 'Das Teilen-Menü hat sich nicht geöffnet. Du kannst die Datei stattdessen herunterladen.',
    downloadInstead: 'Stattdessen herunterladen',
    failed: 'Deine Einträge konnten nicht exportiert werden.',
  },
  columns: { currency: 'Währung', eur: 'Betrag in EUR' },
  transferTo: (account) => `An ${account}`,
};
