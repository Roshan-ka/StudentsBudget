import type { Messages } from '../en';
import { NNBSP } from './count';

// Réglages → Import et export en français (import et export CSV, docs/superpowers/plans/2026-11-09-csv-import-export.md) :
// les saisies dans un fichier pour tableur ; l’import des relevés bancaires suit.
export const importExport: Messages['importExport'] = {
  summary: 'Tes saisies dans un fichier pour tableur',
  export: {
    heading: 'Exporter vers un tableur',
    hint: 'Enregistre toutes les saisies dans un fichier CSV pour Excel, Numbers ou Google Sheets. Pour passer tes données sur un autre téléphone, utilise plutôt la sauvegarde.',
    empty: 'Aucune saisie à exporter pour l’instant.',
    button: 'Exporter les saisies',
    shareTitle: 'Saisies StudentsBudget',
    shared: 'Saisies partagées.',
    downloaded: (fileName) => `Téléchargement lancé${NNBSP}: ${fileName}`,
    shareFailed: 'Le menu de partage ne s’est pas ouvert. Tu peux télécharger le fichier à la place.',
    downloadInstead: 'Télécharger à la place',
    failed: 'Impossible d’exporter tes saisies.',
  },
  columns: { currency: 'Devise', eur: 'Montant en EUR' },
  transferTo: (account) => `Vers ${account}`,
};
