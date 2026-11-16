import type { Messages } from '../en';

// Le mois par mois en français : la ligne de l'accueil, la page et les lignes de reveal-text.ts.
export const reveal: Messages['reveal'] = {
  link: (month) => `Vois comment s’est passé ${month}`,
  intro: 'Comment chaque mois écoulé s’est passé par rapport à tes enveloppes.',
  notYet: (month) => `Ton premier bilan arrive une fois ${month} terminé.`,
  adjust: 'Modifier les enveloppes',
  recap: {
    savings: (amount) => `${amount} restants → épargne`,
    over: (amount) => `${amount} au-delà du plan`,
    onPlan: 'Pile dans le plan',
  },
  spentOf: (spent, planned) => `${spent} dépensés sur ${planned}`,
  noPlan: 'Configure ton plan pour voir comment se passe chaque mois.',
};
