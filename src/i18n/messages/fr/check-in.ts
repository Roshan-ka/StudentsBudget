import type { Messages } from '../en';
import { NNBSP } from './count';

// Le bilan hebdomadaire en français : sa carte sur l'accueil, la page et week-line.ts. Le serveur MCP
// continue de l'appeler en anglais. « En déplacement » plutôt que « absent », qui obligerait à choisir un genre.
export const checkIn: Messages['checkIn'] = {
  card: {
    title: 'Bilan hebdomadaire',
    sunday: `C’est dimanche${NNBSP}: l’heure de ton bilan hebdomadaire.`,
    other: 'Ton bilan hebdomadaire a lieu le dimanche.',
  },
  thisWeek: {
    against: 'Cette semaine par rapport à ton plan',
    logged: 'Cette semaine',
    empty: 'Rien de saisi cette semaine pour l’instant.',
  },
  // Les jours de cette semaine qui tombent encore dans le mois précédent.
  earlierThisWeek: {
    against: 'Début de semaine par rapport à ton plan',
    logged: 'Début de semaine',
    empty: 'Rien de saisi en début de semaine.',
  },
  noEnvelopes: 'Aucune enveloppe n’a de montant dans ton plan.',
  line: {
    planned: (planned, spent, verdict) => `${planned} prévus · ${spent} dépensés · ${verdict}`,
    onPlan: 'conforme au plan',
    under: (amount) => `${amount} en dessous`,
    over: (amount) => `${amount} de trop`,
    usedUp: (spent) => `Plus rien ce mois-ci · ${spent} dépensés`,
    usedUpOver: (spent, over) => `Plus rien ce mois-ci · ${spent} dépensés · ${over} de trop`,
  },
  total: {
    toSpend: (amount) => `Au total${NNBSP}: ${amount} à dépenser cette semaine`,
    over: (amount) => `Au total${NNBSP}: ${amount} de trop cette semaine`,
  },
  away: {
    lastWeek: 'J’étais en déplacement la semaine dernière',
    thisWeek: 'J’étais en déplacement cette semaine',
    hint:
      'Une semaine en déplacement garde ta série de saisies telle quelle et ne compte pas pour Semaine sous budget ' +
      'ni Royauté du ramen.',
  },
  add: {
    heading: `Un oubli${NNBSP}? Ajoute-le ici`,
    earlier: 'Ajouter quelque chose d’un jour précédent',
  },
  reminder: 'Ajouter un rappel hebdomadaire au calendrier',
  noPlan: 'Configure ton plan pour faire le bilan de ta semaine.',
  startSetup: 'Commencer la configuration',
};
