import type { Messages } from '../en';
import { NNBSP } from './count';

// Les graphiques en français : la période et le mois, les quatre graphiques, leurs légendes, infobulles, tableaux et
// ce qu'entend un lecteur d'écran pour chacun. Une période suit une virgule (« Dépenses par catégorie, octobre 2026 »),
// car elle peut être un mois ou « août 2026 à octobre 2026 ».

/** Des phrases jointes par une espace, sans celles qui manquent. */
const sentences = (...parts: (string | null)[]) => parts.filter((part) => part !== null).join(' ');

export const charts: Messages['charts'] = {
  noPlan: 'Configure ton plan pour voir où va l’argent.',
  startSetup: 'Commencer la configuration',
  periodLabel: 'Période',
  period: (months) => (months === 1 ? 'Ce mois-ci' : `${months} mois`),
  monthLabel: 'Mois',
  previous: 'Précédent',
  next: 'Suivant',
  periodRange: (first, last) => `${first} à ${last}`,
  // Après « en » : « Aucune dépense saisie en ces 3 mois pour l’instant. »
  theseMonths: (months) => `ces ${months} mois`,
  noSpending: (when) => `Aucune dépense saisie en ${when} pour l’instant.`,
  noIncome: (when) => `Aucun revenu saisi en ${when} pour l’instant.`,
  nothing: (when) => `Rien de saisi en ${when} pour l’instant.`,
  lastSixMonths: '6 derniers mois',
  countedFrom: (day) =>
    `Les dépenses des enveloppes comptent à partir du ${day}, le jour où tu as configuré ton plan.`,
  series: {
    spent: 'Dépensé',
    planned: 'Prévu',
    income: 'Revenus',
    saved: 'Épargné',
    short: 'Plus dépensé que gagné',
  },
  ofPlanned: (amount, planned) => `${amount} sur ${planned}`,
  bucket: 'Tout le reste',
  // 16 caractères au plus (colors.test.ts) ; le tableau et l'infobulle montrent le nom complet.
  shortNames: { utilities: 'Charges', 'transport-pass': 'Pass transport', health: 'Santé' },
  styles: { donut: 'Anneau', bars: 'Barres', table: 'Tableau', columns: 'Colonnes', line: 'Ligne' },
  spending: {
    title: 'Dépenses par catégorie',
    styleLabel: 'Affichage des dépenses',
    category: 'Catégorie',
    notPlanned: 'Non prévu',
    // La période peut être un intervalle, d'où les deux-points.
    nothingSpent: (period) => `Pas encore de dépense${NNBSP}: ${period}.`,
    centre: 'dépensé',
    caption: (period, note) =>
      sentences(`Dépenses par catégorie, ${period}.`, note, 'Chaque catégorie mène à ses saisies.'),
    donutSummary: (period, slices, note) =>
      sentences(
        `Graphique en anneau des dépenses, ${period}${NNBSP}: ${slices}.`,
        note,
        'Les mêmes chiffres figurent en dessous.',
      ),
    barsSummary: (period, withPlanned, note) =>
      sentences(
        `Graphique en barres des dépenses par catégorie, ${period}${withPlanned ? ', par rapport au prévu' : ''}.`,
        note,
        'Les mêmes chiffres figurent dans le tableau.',
      ),
  },
  income: {
    title: 'Revenus par source',
    styleLabel: 'Affichage des revenus',
    source: 'Source',
    centre: 'revenus',
    caption: (period) => `Revenus par source, ${period}. Chaque source mène à ses saisies.`,
    donutSummary: (period, slices) =>
      `Graphique en anneau des revenus par source, ${period}${NNBSP}: ${slices}. Les mêmes chiffres figurent en dessous.`,
    barsSummary: (period) =>
      `Graphique en barres des revenus par source, ${period}. Les mêmes chiffres figurent dans le tableau.`,
  },
  savings: {
    title: 'Épargné chaque mois',
    styleLabel: 'Affichage de l’épargne',
    month: 'Mois',
    saved: (amount) => `${amount} épargnés`,
    short: (amount) => `${amount} dépensés en plus des revenus`,
    explain: (period) =>
      `Revenus moins dépenses, ${period}. L’argent que tu transfères entre tes comptes n’est pas compté.`,
    caption: (period) => `Revenus moins dépenses par mois, ${period}. Chaque mois mène à ses saisies.`,
    summary: (line, period, headline) =>
      `${line ? 'Graphique en ligne' : 'Graphique en colonnes'} des revenus moins les dépenses de chaque mois, ` +
      `${period}, ${headline}. Les mêmes chiffres figurent dans le tableau.`,
  },
  overTime: {
    title: (category) => `${category} au fil du temps`,
    category: 'Catégorie',
    styleLabel: 'Affichage de la catégorie',
    caption: (category, period) => `${category} par mois, ${period}. Chaque mois mène à ses saisies.`,
    summary: (line, category, period) =>
      `${line ? 'Graphique en ligne' : 'Graphique en colonnes'} des dépenses en ${category} chaque mois, ${period}. ` +
      'Les mêmes chiffres figurent dans le tableau.',
  },
};
