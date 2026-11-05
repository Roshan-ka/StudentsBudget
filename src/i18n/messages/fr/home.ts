import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// L'accueil en français : le salut, ce qui reste à dépenser, les enveloppes, le budget suggéré et le total des comptes.

const available = (amount: string) =>
  `Après tes charges fixes et ce que tu mets de côté, il te reste ${amount} par mois.`;

export const home: Messages['home'] = {
  greeting: (name) => `Salut ${name}`,
  acrossAccounts: (total) => `Sur tous les comptes${NNBSP}: ${total}`,
  missingRates: (currencies, count) =>
    byCount(count, {
      one: `Taux de change manquant pour ${currencies}`,
      other: `Taux de change manquants pour ${currencies}`,
    }),
  leftThisMonth: {
    heading: 'Reste à dépenser ce mois-ci',
    overThisMonth: { before: '', after: ' de trop ce mois-ci' },
    weekOver: (amount) => `Cette semaine${NNBSP}: ${amount} de trop`,
    weekSafe: (amount) => `Cette semaine${NNBSP}: ${amount} à dépenser`,
  },
  envelopes: {
    heading: 'Enveloppes',
    barLabel: (category) => `${category} ce mois-ci`,
    left: (left, planned) => `Il reste ${left} sur ${planned} ce mois-ci`,
    over: (over, planned) => `${over} de trop sur les ${planned} prévus ce mois-ci`,
  },
  suggestedBudget: {
    show: 'Voir un budget suggéré',
    updated: 'Enveloppes mises à jour.',
    heading: 'Budget suggéré',
    perMonth: (category) => `${category} par mois`,
    studentsHere: 'Étudiants d’ici',
    lastMonth: (month) => `Tes dépenses en ${month}`,
    nothingToGoOn: 'Pas encore de données',
    nothingAvailable:
      `Rien à répartir pour l’instant${NNBSP}: tes revenus ne laissent rien après les charges fixes et ce que tu ` +
      'mets de côté. Tu peux modifier ton plan dans les Réglages.',
    available,
    availableWithinBudget: (amount, budget) =>
      `${available(amount)} Ces montants respectent ton budget du quotidien de ${budget}.`,
    availableBelowBudget: (amount, budget) =>
      `${available(amount)} C’est moins que ton budget du quotidien de ${budget}, donc ces montants s’en tiennent ` +
      `à ${amount}.`,
    leftForSavings: (amount) => `${amount} restent pour l’épargne`,
    overAvailable: (amount) => `${amount} au-delà de ce qui est disponible`,
    use: 'Utiliser ce budget',
    notNow: 'Pas maintenant',
    moreCategories: 'Plus de catégories',
    replaces: 'L’utiliser remplace les montants de tes enveloppes.',
    fixAmounts: 'Corrige les montants signalés plus haut pour utiliser ce budget.',
    enterOne: 'Saisis au moins un montant pour utiliser ce budget.',
    failed: 'Ça n’a pas été enregistré. Réessaie.',
  },
};
