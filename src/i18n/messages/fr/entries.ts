import type { Messages } from '../en';
import { NNBSP } from './count';

// Les saisies en français : la liste, le formulaire, l'ajout rapide et les erreurs de buildEntry.
export const entries: Messages['entries'] = {
  addEntry: 'Ajouter une saisie',
  transfer: 'Virement',
  recurring: 'Automatique',
  noAccount: 'Ajoute d’abord un compte, dans Réglages → Comptes et virements.',
  saveFailed: 'Impossible d’enregistrer la saisie.',
  list: {
    label: 'Saisies',
    unknownAccount: 'Compte inconnu',
    thisMonth: 'Ce mois-ci',
    showAllCategories: (category) => `${category}${NNBSP}: afficher toutes les catégories`,
    monthNav: 'Mois',
    previous: 'Précédent',
    next: 'Suivant',
    nothingYet: 'Rien de saisi ici pour l’instant.',
    nothingYetHint: 'Utilise l’ajout rapide ci-dessus.',
    otherMonthHint: (month, year) =>
      `Indique le jour dans l’ajout rapide, comme «${NNBSP}döner 6 le 3/${month}${year === null ? '' : `/${year}`}${NNBSP}».`,
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
    hint: `Quoi et combien, comme «${NNBSP}döner 6 hier${NNBSP}».`,
    add: 'Ajouter',
    noAmount: `Ajoute un montant, comme «${NNBSP}döner 6${NNBSP}»`,
    incomeLine: `L’ajout rapide sert aux dépenses. Ajoute l’argent reçu dans Saisies → «${NNBSP}Ajouter une saisie${NNBSP}».`,
    futureDate: 'Ce jour n’est pas encore arrivé. L’ajout rapide enregistre ce que tu as déjà dépensé.',
    whichAmount: `Quel montant${NNBSP}?`,
    amountGroup: 'Montant',
    whichCategory: `Quelle catégorie${NNBSP}?`,
    categoryGroup: 'Catégorie',
    more: 'Plus',
    saved: (what) => `Enregistré${NNBSP}: ${what}`,
    undo: 'Annuler',
    undoFailed: 'Impossible d’annuler.',
    notSaved: (line) => `«${NNBSP}${line}${NNBSP}» n’a pas été enregistré.`,
    bringBack: 'Reprendre',
    bringBackNamed: (line) => `Reprendre${NNBSP}: ${line}`,
    mic: 'Dicter une saisie',
    stopMic: 'Arrêter l’écoute',
    listening: 'À l’écoute…',
    /** L’état pendant que l’IA lit une ligne (phase IA, chunk 7). */
    reading: 'Lecture…',
    /** Sous le champ, quand l’IA a refusé et que la ligne a été lue sur le téléphone. */
    aiHint: {
      'daily-limit':
        'Les lectures par IA du jour sont épuisées, donc l’Ajout rapide lit tes lignes sur ce téléphone pour l’instant.',
      'second-step':
        'Cette ligne a été lue sur le téléphone. Pour utiliser l’IA, saisis le code de ton appli d’authentification dans Réglages → Ton compte.',
    },
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
  scan: {
    button: 'Scanner un ticket',
    // Une espace insécable entre le nombre et l’unité.
    firstScan: (size) =>
      `Ton premier scan télécharge une seule fois le lecteur de tickets, environ ${size} Mo. Ensuite, le scan fonctionne hors ligne.`,
    continue: 'Continuer',
    cancel: 'Annuler',
    reading: 'Lecture du ticket…',
    progress: 'Progression de la lecture',
    onPhone: 'Lu sur ce téléphone. La photo n’est ni envoyée ni conservée.',
    photo: 'Photo du ticket',
    checkHeading: 'Vérifie le ticket',
    checkHint: 'Corrige ce qui a été mal lu, puis enregistre.',
    failedHeading: 'Impossible de lire ce ticket',
    failedHint:
      'Les tickets pâlis ou froissés sont difficiles à lire. Saisis ce qui y est écrit, ou essaie une autre photo.',
    offline: 'Tu es hors ligne. Le premier scan a besoin d’une connexion pour télécharger le lecteur de tickets.',
    tryAgain: 'Essayer une autre photo',
    pickCategory: 'Choisis une catégorie.',
    discard: 'Abandonner',
  },
  errors: {
    enterAmount: 'Saisis un montant.',
    noRate: (currency) => `Pas encore de taux de change pour ${currency}. Indiques-en un dans Réglages → Comptes et virements.`,
  },
};
