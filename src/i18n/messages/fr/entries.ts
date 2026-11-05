import type { Messages } from '../en';
import { NNBSP } from './count';

// Les saisies en français : la liste, le formulaire, l'ajout rapide et les erreurs de buildEntry.
export const entries: Messages['entries'] = {
  addEntry: 'Ajouter une saisie',
  transfer: 'Virement',
  recurring: 'Récurrent',
  noAccount: 'Ajoute d’abord un compte dans les Réglages.',
  saveFailed: 'Impossible d’enregistrer la saisie.',
  list: {
    label: 'Saisies',
    unknownAccount: 'Compte inconnu',
    clear: 'Effacer',
    monthNav: 'Mois',
    previous: 'Précédent',
    next: 'Suivant',
    nothingYet: 'Rien de saisi ici pour l’instant.',
  },
  edit: {
    heading: 'Modifier la saisie',
    deleteQuestion: `Supprimer cette saisie${NNBSP}?`,
    yes: 'Oui',
    cancel: 'Annuler',
    delete: 'Supprimer',
    deleteFailed: 'Impossible de supprimer la saisie.',
  },
  form: {
    saveAnother: 'Enregistrer et en ajouter un autre',
    savedAnother: 'Enregistré. Ajoute le suivant.',
    groups: { flexible: 'Enveloppes', fixed: 'Charges fixes', oneoff: 'Frais ponctuels' },
    typeLabel: 'Type de saisie',
    expense: 'Dépense',
    income: 'Revenu',
    amount: 'Montant',
    account: 'Compte',
    category: 'Catégorie',
    note: 'Note',
    pickDate: 'Choisis une date.',
    saveChanges: 'Enregistrer les modifications',
    saveIncome: 'Enregistrer le revenu',
    saveExpense: 'Enregistrer la dépense',
  },
  quickAdd: {
    label: 'Ajout rapide',
    placeholder: `Quoi et combien, comme «${NNBSP}döner 6${NNBSP}»`,
    add: 'Ajouter',
    noAmount: `Ajoute un montant, comme «${NNBSP}döner 6${NNBSP}»`,
    whichAmount: `Quel montant${NNBSP}?`,
    amountGroup: 'Montant',
    whichCategory: `Quelle catégorie${NNBSP}?`,
    categoryGroup: 'Catégorie',
    more: 'Plus',
    saved: (what) => `Enregistré${NNBSP}: ${what}`,
    undo: 'Annuler',
    undoFailed: 'Impossible d’annuler.',
    mic: 'Dicter une saisie',
    stopMic: 'Arrêter l’écoute',
    listening: 'À l’écoute…',
    micNote: {
      text:
        'Ton navigateur transforme ce que tu dis en texte. Pour cela, il peut envoyer l’enregistrement à son service ' +
        'vocal (Chrome l’envoie à Google). StudentsBudget ne reçoit que le texte.',
      continue: 'Continuer',
      cancel: 'Annuler',
    },
    micErrors: {
      denied: 'Le micro est bloqué. Autorise-le pour ce site dans les réglages de ton navigateur.',
      noSpeech: 'Rien entendu. Réessaie.',
      offline: 'Tu es hors ligne. Pour dicter une saisie, il faut une connexion.',
      noMic: 'Aucun micro trouvé.',
      failed: 'Impossible de comprendre. Réessaie, ou tape-le.',
    },
  },
  errors: {
    enterAmount: 'Saisis un montant.',
    noRate: (currency) => `Pas encore de taux de change pour ${currency}. Indiques-en un dans les Réglages.`,
  },
};
