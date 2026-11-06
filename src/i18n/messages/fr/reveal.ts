import type { Messages } from '../en';
import { NNBSP } from './count';

// Le mois par mois en français : la ligne de l'accueil, la page et les lignes de reveal-text.ts.
export const reveal: Messages['reveal'] = {
  link: (month) => `Vois comment s’est passé ${month}`,
  intro: 'Comment chaque mois écoulé s’est passé par rapport à tes enveloppes.',
  notYet: (month) => `Ton premier bilan arrive une fois ${month} terminé.`,
  adjust: 'Modifier mes enveloppes',
  recap: {
    savings: (label, amount) => `${label}${NNBSP}: ${amount} restants → épargne`,
    over: (label, amount) => `${label}${NNBSP}: ${amount} au-delà du plan`,
    onPlan: (label) => `${label}${NNBSP}: pile dans le plan`,
  },
  noPlan: 'Configure ton plan pour voir comment se passe chaque mois.',
  startSetup: 'Commencer la configuration',
};
