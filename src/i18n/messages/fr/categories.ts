import type { Messages } from '../en';

// Les catégories intégrées en français. 16 caractères au plus là où un graphique montre le nom sans forme courte
// (vérifié dans src/features/charts/colors.test.ts) ; les noms plus longs en ont une dans charts.shortNames.
export const categories: Messages['categories'] = {
  food: 'Alimentation',
  'eating-out': 'Repas dehors',
  'going-out': 'Sorties',
  transport: 'Transports',
  shopping: 'Achats',
  health: 'Santé et pharmacie',
  'personal-care': 'Soins personnels',
  study: 'Études',
  household: 'Maison',
  travel: 'Voyages',
  gifts: 'Cadeaux',
  other: 'Autres',
  rent: 'Loyer',
  phone: 'Télécoms',
  insurance: 'Assurances',
  subscriptions: 'Abonnements',
  'transport-pass': 'Deutschlandticket / abonnement semestriel',
  gym: 'Sport',
  utilities: 'Charges et Rundfunkbeitrag',
  'one-off': 'Frais ponctuels',
  'income-job': 'Job étudiant',
  'income-parents': 'Parents',
  'income-bafoeg': 'BAföG',
  'income-sperrkonto': 'Compte bloqué',
  'income-scholarship': 'Bourse',
  'income-other': 'Autres revenus',
};
