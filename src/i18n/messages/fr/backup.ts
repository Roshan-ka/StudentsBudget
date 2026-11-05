import type { Messages } from '../en';
import { NNBSP } from './count';

// La sauvegarde en français : Réglages → Sauvegarde (exporter, restaurer, tout supprimer), la restauration sur /setup
// et les vérifications de backup.ts.
export const backup: Messages['backup'] = {
  heading: 'Sauvegarde',
  summary: 'Exporter, restaurer ou supprimer les données de ce téléphone',
  intro:
    'Tout ce que tu saisis reste sur ce téléphone, sauf si tu l’associes à ton compte. Un fichier de sauvegarde est ' +
    'une copie que tu gardes toi-même, alors exportes-en une de temps en temps et garde-la en lieu sûr.',
  export: {
    heading: 'Exporter une sauvegarde',
    hint: 'Enregistre tout dans un seul fichier. Sur un iPhone, choisis Enregistrer dans Fichiers dans le menu de partage.',
    button: 'Exporter la sauvegarde',
    shareTitle: 'Sauvegarde StudentsBudget',
    shared: 'Sauvegarde partagée.',
    downloaded: (fileName) => `Téléchargement lancé${NNBSP}: ${fileName}`,
    shareFailed: 'Le menu de partage ne s’est pas ouvert. Tu peux télécharger le fichier à la place.',
    downloadInstead: 'Télécharger à la place',
    failed: 'Impossible d’exporter tes données.',
  },
  restore: {
    heading: 'Restaurer une sauvegarde',
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
    failed: 'Impossible de restaurer la sauvegarde. Les données de cet appareil n’ont pas changé.',
    setupHeading: `Tu as une sauvegarde${NNBSP}? Restaure-la`,
    setupIntro: `Tu as déjà utilisé StudentsBudget${NNBSP}? Choisis ton fichier de sauvegarde pour reprendre là où tu en étais.`,
  },
  delete: {
    heading: 'Tout supprimer',
    intro:
      'Retire de ce téléphone ton plan, tes comptes, tes saisies, les semaines enregistrées et les badges, tes ' +
      `réponses sur les réductions, ton profil et les taux de change. Un téléphone associé à ton compte est dissocié${NNBSP}: ` +
      'ton compte garde sa copie, et ta session reste ouverte. Les modifications pas encore synchronisées sont perdues.',
    warning:
      'Impossible d’annuler sur ce téléphone. Pour récupérer tes données plus tard, exporte d’abord une sauvegarde ' +
      'ou enregistre dans ton compte.',
    word: 'SUPPRIMER',
    typeToConfirm: (word) => `Saisis ${word} pour confirmer`,
    button: 'Tout supprimer',
    cancel: 'Annuler',
    failed: 'Impossible de supprimer tes données. Réessaie.',
  },
  file: {
    notBackup: 'Ce n’est pas un fichier de sauvegarde StudentsBudget.',
    newer: 'Cette sauvegarde vient d’une version plus récente de l’app.',
    incomplete: 'Ce fichier de sauvegarde est incomplet.',
    damaged: (problem) => `Ce fichier de sauvegarde est endommagé${NNBSP}: ${problem}.`,
  },
  problems: {
    entryAccount: 'une saisie utilise un compte qui n’est pas dans le fichier',
    transferAccount: 'un virement va vers un compte qui n’est pas dans le fichier',
    entryCategory: 'une saisie utilise une catégorie qui n’est pas dans le fichier',
    planCategory: 'le plan ou les estimations utilisent une catégorie inconnue',
    duplicateId: 'deux lignes ont le même id',
    weekShape: 'une semaine enregistrée ne va pas du lundi au dimanche',
    zeroAmount: 'un montant est nul ou négatif',
    negativeAmount: 'un montant est négatif',
    impossibleSchedule: 'une charge fixe ou un revenu a une programmation impossible',
  },
  saved: (dateTime) => `Enregistré le ${dateTime}`,
};
