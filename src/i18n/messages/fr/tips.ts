import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// L'onglet Conseils en français : conseils, réductions et les mots de la ligne d'économie. Les conseils, réductions et
// idées d'économie eux-mêmes sont du contenu de la ville ; leurs mots en français vont dans src/i18n/city/fr (chunk 15).
export const tips: Messages['tips'] = {
  tabsLabel: 'Conseils ou réductions',
  tips: 'Conseils',
  discounts: 'Réductions',
  all: 'Tous',
  more: 'Plus',
  tipsIntro: 'Des façons locales de payer moins quand on est étudiant. Chaque conseil indique sa source.',
  tipsFor: 'Afficher les conseils pour',
  discountsIntro:
    'Réductions étudiantes à Regensburg. Chacune indique où elle est mentionnée. Dis à l’app si une réduction ' +
    `marche encore${NNBSP}: tes réponses sont enregistrées sur ce téléphone. Celles que tu confirmes remontent${NNBSP}; ` +
    'celles que tu marques comme expirées, ou qui n’ont pas été confirmées depuis 8 semaines, descendent.',
  discountsFor: 'Afficher les réductions pour',
  loadFailed: 'Impossible de charger les réductions. Réessaie plus tard.',
  votes: { works: 'Marche encore', outdated: 'Ne marche plus' },
  voteGroup: (place) => `${place}${NNBSP}: ça marche encore${NNBSP}?`,
  markedOutdated: (date) => `Tu as indiqué le ${date} que ça ne marche plus`,
  mayBeOutdated: 'Peut-être obsolète',
  lastConfirmed: (date) => `Confirmé pour la dernière fois le ${date}`,
  /** Ce que les autres étudiants ont confirmé ce semestre (P2.6), visible une fois connecté. */
  confirmations: (count) =>
    byCount(count, { one: `${count} confirmation ce semestre`, other: `${count} confirmations ce semestre` }),
  notWorking: (count) =>
    byCount(count, {
      one: `${count} personne dit que ça ne marche plus`,
      other: `${count} personnes disent que ça ne marche plus`,
    }),
  othersSignIn: 'Connecte-toi pour voir ce que les autres étudiants ont confirmé.',
  saved: 'Enregistré sur ce téléphone.',
  saveFailed: 'Impossible d’enregistrer ta réponse. Réessaie.',
  heard: {
    works: (place) => `${place}${NNBSP}: enregistré comme marchant encore.`,
    outdated: (place) => `${place}${NNBSP}: enregistré comme ne marchant plus.`,
    moves: (saved, direction) => `${saved} ${direction === 'up' ? 'Elle remonte' : 'Elle descend'} dans la liste.`,
    failed: (place) => `${place}${NNBSP}: impossible d’enregistrer ta réponse. Réessaie.`,
  },
  swap: {
    line: (title, saving, per) => `Essaie ça${NNBSP}: ${title} · économise environ ${saving} par ${per}`,
    estimate: (line) => `${line} (estimation)`,
    details: (title) => `Détails${NNBSP}: ${title}`,
    sources: 'D’où viennent ces chiffres',
    sourceOf: (amount) => `D’où viennent ${amount}`,
    relatedTip: 'Conseil lié',
  },
};
