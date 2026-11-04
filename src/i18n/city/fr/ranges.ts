import type { RangeWords } from '..';
import { NNBSP } from '../../messages/fr/count';

// Les sources des fourchettes de la configuration et de l'accueil en français, par catégorie (CITIES.regensburg.ranges
// dans src/data/cities.ts). 'Estimate' reste 'Estimate' : l'app affiche pour cela son propre mot (« Estimation »).

export const ranges: Record<string, RangeWords> = {
  rent: {
    source: `Universität Regensburg${NNBSP}: chambre du Studierendenwerk la moins chère environ 215 €, chambre en colocation 459–561 €`,
  },
  food: {
    source: `DSW, 22e Sozialerhebung 2021, moyenne nationale 194 € (pas Regensburg), ramenée à sept. 2026 avec les prix alimentaires de Destatis${NNBSP}; la fourchette de ±30 % est notre hypothèse`,
  },
  'eating-out': { source: 'Estimate' },
  'going-out': { source: 'Estimate' },
  transport: { source: 'Estimate' },
  shopping: {
    source: `DSW, 22e Sozialerhebung 2021, moyenne nationale pour les vêtements 40 € (pas Regensburg), ramenée à sept. 2026 avec l’indice des prix à la consommation de Destatis${NNBSP}; la fourchette de ±30 % est notre hypothèse`,
  },
  other: {
    source: `DSW, 22e Sozialerhebung 2021, moyenne nationale pour les autres dépenses 109 € (pas Regensburg), ramenée à sept. 2026 avec l’indice des prix à la consommation de Destatis${NNBSP}; la fourchette de ±30 % est notre hypothèse`,
  },
};
