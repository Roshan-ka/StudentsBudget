import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// La configuration et Modifier le plan en français : l'assistant, ses étapes, les vérifications et lignes de draft.ts
// et l'astuce d'installation. « Ajouter automatiquement » s'appelle pareil que dans les Réglages.
export const setup: Messages['setup'] = {
  headingNew: 'Configure ton plan',
  headingEdit: 'Modifier le plan',
  stepOf: (step, total) => `Étape ${step} sur ${total}`,
  titles: {
    accounts: 'Comptes',
    income: 'Revenus',
    fixed: 'Charges fixes',
    'one-offs': 'Frais ponctuels',
    envelopes: 'Enveloppes',
  },
  accountsInSettings: 'Tes comptes sont déjà configurés, dans Réglages → Comptes et virements.',
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
    checkBudget: 'Vérifie le montant de ton budget du quotidien.',
    addEnvelope: (name) => `Ajoute un montant pour ${name}`,
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
    prefilled: { localBank: 'Banque d’ici', cash: 'Espèces' },
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
    later: `Tu touches le BAföG ou une bourse${NNBSP}? Ajoute-le plus tard dans Réglages → Plan → Modifier le plan.`,
  },
  fixed: {
    intro: `Que paies-tu chaque mois, en euros${NNBSP}? Laisse de côté ce que tu ne paies pas.`,
    rentLabel: 'Loyer par mois',
    rooms: (range) => `Chambres ici${NNBSP}: ${range}`,
    later:
      'Les abonnements, la salle de sport, les charges, le Rundfunkbeitrag et les frais ponctuels comme les frais de ' +
      'semestre peuvent être ajoutés plus tard dans Réglages → Plan → Modifier le plan.',
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
  topics: {
    food: 'alimentation',
    'eating-out': 'repas dehors',
    'going-out': 'sorties',
    transport: 'transports',
    shopping: 'achats',
    other: 'autres choses',
  },
  envelopes: {
    budgetIntroNew: (amount) =>
      `Un budget du quotidien est facultatif. Sans lui, les suggestions répartissent ce qui reste après le loyer et ` +
      `les charges fixes${NNBSP}: ${amount}.`,
    budgetIntroEdit: (amount) =>
      `Un budget du quotidien est facultatif. Sans lui, les suggestions répartissent ce qui reste après le loyer, ` +
      `les charges fixes et ce qui est mis de côté pour les frais ponctuels${NNBSP}: ${amount}.`,
    budgetQuestion: `Combien veux-tu dépenser par mois pour le quotidien, hors loyer et charges fixes${NNBSP}?`,
    typicalSpend: (range) => `Les étudiants d’ici dépensent en général environ ${range} par mois pour cela.`,
    estimates: (list, count) =>
      `${list.charAt(0).toUpperCase()}${list.slice(1)} ${byCount(count, { one: 'est une estimation', other: 'sont des estimations' })}.`,
    whereFrom: 'D’où ça vient',
    askEdit: `Combien veux-tu t’accorder par mois pour chacune, en euros${NNBSP}? Tu peux les modifier à tout moment.`,
    askNew:
      `Combien veux-tu t’accorder par mois pour chacune, en euros${NNBSP}? Tu peux les modifier, et ajouter des ` +
      'enveloppes comme les études ou les voyages, dans Réglages → Plan → Modifier le plan.',
    useSuggested: 'Utiliser les montants suggérés',
    fillsOnly: 'Ne remplit que les enveloppes que tu n’as pas encore définies.',
    studentsHere: 'Étudiants d’ici',
    suggested: (amount) => `Suggéré${NNBSP}: ${amount}`,
    below: 'En dessous de ce dont les étudiants d’ici ont besoin en général.',
    belowSome: (count) => `${count} de ces enveloppes sont en dessous de ce dont les étudiants d’ici ont besoin en général.`,
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
  setupRow: { title: 'Configurer ton plan', summary: 'Ton plan n’est pas encore configuré' },
  editPlan: {
    summary: 'Revenus, charges fixes et enveloppes',
    heading: 'Plan',
    body:
      'Modifie tes enveloppes, ajoute des frais ponctuels comme les frais de semestre et les sources de revenus, ' +
      'les charges fixes et les enveloppes que la configuration a sautées, ou reprends tout le plan.',
    link: 'Modifier le plan',
  },
};
