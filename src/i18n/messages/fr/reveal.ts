import type { Messages } from '../en';
import { NNBSP } from './count';

// La comparaison des estimations en français : sa carte sur l'accueil, la page et le mois par mois de reveal-text.ts.
export const reveal: Messages['reveal'] = {
  card: {
    open: 'Vois ce que valaient tes estimations',
    label: 'Tes estimations',
    unlocksOn: (day) => `Tes estimations se débloquent le ${day}.`,
    whatsThis: `C’est quoi${NNBSP}?`,
  },
  locked: {
    unlocksOn: (day) => `Tes estimations se débloquent le ${day}. Continue de saisir.`,
    explain: (days) =>
      'Lors de la configuration, tu as estimé ce que tu dépenses chaque mois. ' +
      `Après ${days} jours de saisies, tu verras comment tes estimations se comparent à ce que tu as vraiment dépensé.`,
  },
  listLabel: 'Tes estimations',
  guessLine: (guessed, actual) => `Tu avais estimé ${guessed}. C’était ${actual}.`,
  scaled: (from, to) => `Tes dépenses du ${from} au ${to}, ramenées à un mois de 30 jours.`,
  adjust: 'Ajuster mon plan',
  noGuesses: 'Aucune estimation n’a été enregistrée lors de la configuration, il n’y a donc rien à comparer.',
  monthByMonth: 'Mois par mois',
  recap: {
    partial: (month, from) => `${month} (compté à partir du ${from})`,
    leftOver: (label, amount) => `${label}${NNBSP}: ${amount} restants`,
    savings: (label, amount) => `${label}${NNBSP}: ${amount} restants → épargne`,
    over: (label, amount) => `${label}${NNBSP}: ${amount} au-delà du plan`,
    onPlan: (label) => `${label}${NNBSP}: pile dans le plan`,
  },
  noPlan: 'Configure ton plan pour comparer tes estimations à tes dépenses.',
  startSetup: 'Commencer la configuration',
};
