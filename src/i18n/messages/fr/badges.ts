import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// Les badges en français : noms et progression (badges.ts), la page des badges et la carte de l'accueil. Le bilan
// (check-in.ts) et l'introduction d'ici en nomment certains : si un nom change, tous changent. « Défi latte » plutôt
// qu'un « survivant », qui obligerait à choisir un genre.

const weeks = (count: number) => byCount(count, { one: `${count} semaine`, other: `${count} semaines` });

export const badges: Messages['badges'] = {
  names: {
    'under-budget-week': 'Semaine sous budget',
    'logging-streak': 'Série de saisies',
    'ramen-royalty': 'Royauté du ramen',
    'latte-survivor': 'Défi latte',
  },
  progress: {
    underBudgetCount: (count) => `${weeks(count)} sous budget`,
    underBudgetOf: (count, goal) => `${count} sur ${goal} semaines`,
    streakStart: 'Une série commence par une semaine où tu saisis toi-même les dépenses des enveloppes',
    streakNew: 'Une nouvelle série commence par une semaine où tu saisis toi-même les dépenses des enveloppes',
    streakPaused: (count) => `Ta série est en pause à ${weeks(count)}`,
    streakOf: (count, goal) => `${count} sur ${goal} semaines d’affilée`,
    streakRun: (count) => `${weeks(count)} d’affilée`,
    ramenFirst: 'Ta première semaine complète de courses fixe la référence',
    ramenBest: (amount, weekOf, earned) =>
      `Semaine de courses la moins chère jusqu’ici${NNBSP}: ${amount} (semaine du ${weekOf})` +
      `${earned ? '' : '. Une semaine moins chère le décroche'}`,
    latteFirstLogging: 'Ton premier mois complet de saisies fixe la référence',
    latteFirstEatingOut: 'Ton premier mois complet avec des repas dehors fixe la référence',
    latteTarget: (amount, month) =>
      `Un mois avec ${amount} ou moins en repas dehors le décroche (la moitié de ce que tu as dépensé en ${month})`,
    latteHit: (month, amount, markAmount, markMonth) =>
      `${month}${NNBSP}: ${amount} en repas dehors, contre ${markAmount} en ${markMonth}`,
  },
  tiers: { bronze: 'Bronze', silver: 'Argent', gold: 'Or' },
  notEarned: 'Pas encore obtenu',
  earned: (date) => `Obtenu le ${date}`,
  tierEarned: (tier, date) => `${tier} · obtenu le ${date}`,
  rules: {
    underBudget: (gold, wholeSemester) =>
      'Compte une semaine où tu saisis toi-même les dépenses des enveloppes et ne dépenses pas plus que leur part de ' +
      `tes enveloppes${NNBSP}: ce qui en restait au début de la semaine, réparti sur les semaines restantes du mois. ` +
      `Bronze à 4 semaines, argent à 12, or à ${gold}${wholeSemester ? `${NNBSP}: un semestre entier` : ''}.`,
    streak: 'Des semaines d’affilée où tu saisis toi-même les dépenses des enveloppes. Obtenu à 4 semaines.',
    ramen: 'Obtenu pour une semaine complète qui coûte moins en courses que toutes les semaines précédentes.',
    latte:
      'Obtenu pour un mois avec au plus la moitié des repas dehors de ton premier mois complet qui en avait. Seuls ' +
      'comptent les mois où tu saisis toi-même les dépenses des enveloppes.',
  },
  howItWorks: 'Comment fonctionnent les badges',
  intro:
    'Chaque semaine est enregistrée à partir du mercredi qui suit sa fin, la prochaine fois que tu ouvres l’app, si ' +
    'bien que les dépenses saisies pour elle le lundi ou le mardi comptent encore. Tes badges viennent de ces ' +
    'semaines et de tes saisies. Une semaine que tu marques en déplacement dans le bilan garde ta série telle quelle ' +
    'et ne compte pas pour Semaine sous budget ni Royauté du ramen.',
  listLabel: 'Tes badges',
  noPlan: 'Configure ton plan pour commencer à obtenir des badges.',
  startSetup: 'Commencer la configuration',
  card: {
    heading: 'Badges',
    earnedOf: (earned, total) => `${earned} sur ${total} obtenus`,
    next: (name) => `Prochain${NNBSP}: ${name}`,
    seeAll: 'Voir tous les badges',
  },
};
