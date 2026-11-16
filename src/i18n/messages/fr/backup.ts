import type { Messages } from '../en';
import { NNBSP } from './count';

// La sauvegarde en français : Réglages → Sauvegarde (exporter, restaurer, tout supprimer), la restauration sur /setup
// et les vérifications de backup.ts.
export const backup: Messages['backup'] = {
  summary: 'Exporter, restaurer ou supprimer les données de ce téléphone',
  intro: 'Tes données restent sur ce téléphone, sauf si tu associes un compte.',
  more: `Pourquoi garder une sauvegarde${NNBSP}?`,
  moreText:
    'Un fichier de sauvegarde est une copie que tu gardes toi-même, alors exportes-en une de temps en temps et ' +
    'garde-la en lieu sûr.',
  export: {
    heading: 'Exporter une sauvegarde',
    hint: 'Un seul fichier avec tout. Sur un iPhone, choisis Enregistrer dans Fichiers.',
    button: 'Exporter la sauvegarde',
    shareTitle: 'Sauvegarde StudentsBudget',
    shared: 'Sauvegarde partagée.',
    downloaded: (fileName) => `Téléchargement lancé${NNBSP}: ${fileName}`,
    shareFailed: 'Le menu de partage ne s’est pas ouvert. Tu peux télécharger le fichier à la place.',
    download: 'Télécharger',
    failed: 'Impossible d’exporter tes données.',
  },
  restore: {
    heading: 'Restaurer une sauvegarde',
    intro: 'Remplace les données de ce téléphone par celles du fichier.',
    choose: 'Choisir un fichier de sauvegarde',
    file: 'Fichier à restaurer',
    reading: 'Lecture…',
    confirmGroup: 'Confirmer la restauration',
    question: { before: 'Remplacer toutes les données par ', after: `${NNBSP}?` },
    linked:
      `Ce téléphone est associé à ton compte${NNBSP}: ton compte et tes autres téléphones suivent à la prochaine ` +
      'synchronisation.',
    replace: 'Remplacer toutes les données',
    cancel: 'Annuler',
    readFailed: 'Impossible de lire ce fichier.',
    tooLarge: 'Ce fichier dépasse 20 Mo, trop pour une sauvegarde StudentsBudget. Choisis-en un exporté par l’app.',
    failed: 'Impossible de restaurer la sauvegarde. Les données de ce téléphone n’ont pas changé.',
    setupHeading: `Tu as une sauvegarde${NNBSP}? Restaure-la`,
    /** Setup's quiet button that opens the file field (13-11-2026). */
    setupButton: 'Restaurer une sauvegarde',
  },
  delete: {
    heading: 'Tout supprimer',
    intro: 'Retire de ce téléphone ton plan, tes comptes, tes saisies et toutes tes autres données.',
    linked:
      `Un téléphone associé à ton compte StudentsBudget est dissocié${NNBSP}: ce compte garde sa copie, et ta ` +
      'session reste ouverte. Les modifications pas encore synchronisées sont perdues.',
    warning:
      'Impossible d’annuler sur ce téléphone. Pour récupérer tes données plus tard, exporte d’abord une sauvegarde ' +
      'ou synchronise-les avec ton compte.',
    word: 'SUPPRIMER',
    typeToConfirm: (word) => `Saisis ${word} pour confirmer`,
    button: 'Tout supprimer',
    cancel: 'Annuler',
    failed: 'Impossible de supprimer tes données. Réessaie.',
  },
  file: {
    notBackup: 'Ce n’est pas un fichier de sauvegarde StudentsBudget. Choisis-en un exporté par l’app. Son nom commence par studentsbudget-backup.',
    newer: 'Cette sauvegarde vient d’une version plus récente de l’app. Recharge l’app avec Internet pour la mettre à jour, puis réessaie.',
    incomplete: 'Ce fichier de sauvegarde est incomplet. Choisis une autre sauvegarde ou exportes-en une nouvelle.',
    damaged: (problem) => `Ce fichier de sauvegarde est endommagé${NNBSP}: ${problem}. Choisis une autre sauvegarde ou exportes-en une nouvelle.`,
  },
  problems: {
    entryAccount: 'une saisie utilise un compte qui n’est pas dans le fichier',
    transferAccount: 'un virement va vers un compte qui n’est pas dans le fichier',
    entryCategory: 'une saisie utilise une catégorie qui n’est pas dans le fichier',
    planCategory: 'le plan utilise une catégorie inconnue',
    duplicateId: 'deux lignes ont le même id',
    weekShape: 'une semaine enregistrée ne va pas du lundi au dimanche',
    zeroAmount: 'un montant est nul ou négatif',
    negativeAmount: 'un montant est négatif',
    impossibleSchedule: 'une charge fixe ou un revenu a une programmation impossible',
  },
  saved: (dateTime) => `Enregistré le ${dateTime}`,
};
