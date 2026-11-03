import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// La configuration et Modifier le plan en français : l'assistant, ses étapes, les vérifications et lignes de draft.ts
// et l'astuce d'installation. « Ajouter automatiquement » s'appelle pareil que dans les Réglages.
export const setup: Messages['setup'] = {
  headingNew: 'Configure ton plan',
  headingEdit: 'Ajuste ton plan',
  stepOf: (step, total) => `Étape ${step} sur ${total}`,
  titles: {
    'city-rent': 'Ville et loyer',
    accounts: 'Comptes',
    income: 'Revenus',
    fixed: 'Charges fixes',
    'one-offs': 'Frais ponctuels',
    guesses: 'Estimations',
    envelopes: 'Enveloppes',
  },
  accountsInSettings: 'Tes comptes sont déjà configurés dans les Réglages.',
  saveFailed: 'Impossible d’enregistrer ton plan. Réessaie.',
  back: 'Retour',
  next: 'Suivant',
  save: 'Enregistrer le plan',
  problems: {
    checkAmount: (name) => `Vérifie le montant pour ${name}.`,
    addAccount: 'Ajoute au moins un compte',
    nameAccounts: 'Donne un nom à chaque compte.',
    checkOpening: (name, number) =>
      name === null ? `Vérifie le solde initial du compte ${number}.` : `Vérifie le solde initial de ${name}.`,
    foreignAmount: (currency, name) => `Saisis le montant en ${currency} pour ${name}.`,
    nameOneOffs: 'Donne un nom à chaque frais ponctuel.',
    checkOneOff: (name, number) =>
      name === null ? `Vérifie le montant des frais ponctuels ${number}.` : `Vérifie le montant pour ${name}.`,
    dueMonth: 'Choisis un mois après celui-ci.',
    checkGuess: (name) => `Vérifie l’estimation pour ${name}.`,
    checkBudget: 'Vérifie le montant de ton budget du quotidien.',
    addEnvelope: (name) => `Ajoute un montant pour ${name}`,
  },
  cityRent: {
    city: 'Ville',
    onlyCity: 'Regensburg est la seule ville pour l’instant.',
    rent: 'Loyer par mois',
    rooms: (range) => `Chambres ici${NNBSP}: ${range}`,
  },
  accounts: {
    intro: `Où vit ton argent${NNBSP}? Le solde initial, c’est ce qu’il y a aujourd’hui sur chaque compte.`,
    account: (number) => `Compte ${number}`,
    name: 'Nom',
    type: 'Type',
    bank: 'Banque',
    cash: 'Espèces',
    currency: 'Devise',
    opening: 'Solde initial',
    remove: (number) => `Retirer le compte ${number}`,
    add: 'Ajouter un compte',
    prefilled: { localBank: 'Banque d’ici', homeBank: 'Banque du pays', cash: 'Espèces' },
  },
  income: {
    intro:
      `Combien entre chaque mois, en euros${NNBSP}? Laisse de côté ce que tu ne reçois pas. Si ça varie, saisis une ` +
      'estimation basse.',
    savings: {
      before: `Tu vis de tes économies${NNBSP}? Ajoute ce que tu utilises chaque mois sous Autres revenus et désactive `,
      automatic: 'Ajouter automatiquement',
      after: ', pour que l’argent déjà sur ton compte ne compte pas deux fois.',
    },
    later: `Tu touches le BAföG ou une bourse${NNBSP}? Ajoute-le plus tard sous Modifier le plan, dans les Réglages.`,
  },
  fixed: {
    intro:
      `Que paies-tu chaque mois, en euros${NNBSP}? Ton loyer est déjà pris en compte depuis l’étape 1. Laisse de ` +
      'côté ce que tu ne paies pas.',
    later:
      'Les abonnements, la salle de sport, les charges et le Rundfunkbeitrag peuvent être ajoutés plus tard sous ' +
      'Modifier le plan, dans les Réglages.',
    rent: (amount) => `Loyer${NNBSP}: ${amount} par mois`,
  },
  oneOffs: {
    intro:
      'De grosses dépenses qui n’arrivent qu’une fois, comme des frais de semestre ou une caution. On en met une part ' +
      'de côté chaque mois jusqu’au mois de l’échéance. Passe cette étape si tu n’en as pas. Des frais sans montant ' +
      'ne sont pas enregistrés.',
    oneOff: (number) => `Frais ponctuels ${number}`,
    name: 'Nom',
    amount: 'Montant',
    leftOut: 'Sans montant, ces frais ne sont pas enregistrés.',
    due: 'Mois de l’échéance',
    remove: (number) => `Retirer les frais ponctuels ${number}`,
    add: 'Ajouter des frais ponctuels',
    feeOffer: (amount, month) =>
      `Ajouter les frais de semestre${amount === null ? '' : `${NNBSP}: ${amount}`}, à payer en ${month}`,
  },
  guesses: {
    intro:
      'Fie-toi à ton intuition, en euros. Saisis 0 si tu n’y dépenses rien. Passe celles dont tu doutes. Les ' +
      'estimations sont enregistrées une fois et ne peuvent plus être modifiées ensuite.',
    question: (topic) => `Combien penses-tu dépenser par mois en ${topic}${NNBSP}?`,
  },
  topics: {
    food: 'alimentation',
    'eating-out': 'repas dehors',
    'going-out': 'sorties',
    transport: 'transports',
    shopping: 'achats',
    other: 'autres choses',
  },
  envelopes: {
    budgetIntro: `Un budget du quotidien est facultatif${NNBSP}: avec lui, chaque enveloppe ci-dessous reçoit un montant suggéré.`,
    budgetQuestion: `Combien veux-tu dépenser par mois pour le quotidien, hors loyer et charges fixes${NNBSP}?`,
    typicalSpend: (range) => `Les étudiants d’ici dépensent en général environ ${range} par mois pour cela.`,
    estimates: (list, count) =>
      `${list.charAt(0).toUpperCase()}${list.slice(1)} ${byCount(count, { one: 'est une estimation', other: 'sont des estimations' })}.`,
    whereFrom: 'D’où ça vient',
    askEdit: `Combien veux-tu t’accorder par mois pour chacune, en euros${NNBSP}? Tu peux les modifier à tout moment.`,
    askNew:
      `Combien veux-tu t’accorder par mois pour chacune, en euros${NNBSP}? Tu peux les modifier, et ajouter des ` +
      'enveloppes comme les études ou les voyages, sous Modifier le plan, dans les Réglages.',
    useSuggested: 'Utiliser les montants suggérés',
    fillsOnly: 'Ne remplit que les enveloppes que tu n’as pas encore définies.',
    studentsHere: 'Étudiants d’ici',
    suggested: (amount) => `Suggéré${NNBSP}: ${amount}`,
    below: 'En dessous de ce dont les étudiants d’ici ont besoin en général.',
  },
  lines: {
    available: (amount) => `Disponible${NNBSP}: ${amount}`,
    planned: (amount) => `Prévu${NNBSP}: ${amount}`,
    overBy: (amount) => `${amount} de trop`,
    ofBudget: (planned, budget) => `${planned} de ton budget de ${budget}`,
    overBudget: (over, budget) => `${over} au-delà de ton budget de ${budget}`,
    range: (label, range) => `${label}${NNBSP}: ${range}`,
    rangeEstimate: (label, range) => `${label}${NNBSP}: ${range} (estimation)`,
  },
  installHint:
    `Installe d’abord l’app${NNBSP}: touche Partager → Sur l’écran d’accueil, puis configure-la là-bas. Ce que tu ` +
    'saisis dans Safari reste dans Safari.',
  editPlan: {
    heading: 'Plan',
    body:
      'Modifie tes enveloppes et tes frais ponctuels, ajoute les sources de revenus, les charges fixes et les ' +
      'enveloppes que la configuration a sautées, ou reprends tout le plan. Les comptes sont plus bas. Les ' +
      'estimations de la configuration ne changent pas.',
    link: 'Modifier le plan',
  },
};
