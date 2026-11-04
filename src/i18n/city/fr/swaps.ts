import type { SwapWords } from '..';
import { NNBSP } from '../../messages/fr/count';

// Les idées d'économie en français, par leur id (src/data/swaps.ts). Seulement les mots ; « per » est l'unité de la
// ligne d'économie (« économise environ 10 € par repas »). Chaque chiffre de la version anglaise figure aussi ici.

export const swaps: Record<string, SwapWords> = {
  'mensa-instead-of-restaurant': {
    title: 'Mange à la Mensa plutôt qu’au restaurant',
    body: 'Pendant la semaine du 19 au 23 octobre, le plat principal médian de la Mensa de l’Uni Regensburg coûtait 3,80 € aux étudiants, et le moins cher 2,30 €. Un repas dans un restaurant bon marché coûte environ 14,50 €. Un jour où tu mangerais dehors, la Mensa est l’assiette la moins chère.',
    per: 'repas',
    source: `Numbeo, «${NNBSP}Meal at an Inexpensive Restaurant${NNBSP}» à Regensburg${NNBSP}: 14,50 € (données participatives${NNBSP}; pour toute la ville, 246 entrées de 15 contributeurs sur les 12 derniers mois, mis à jour le 20 octobre 2026)`,
    toSource: `Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg${NNBSP}: prix étudiant médian des plats principaux du menu pendant la semaine du 19 au 23 octobre 2026, un instantané (la page du menu montre la semaine en cours)`,
  },
  'cinema-student-price': {
    title: 'Va au cinéma au tarif étudiant',
    body: `Montre ton justificatif étudiant aux Kinos im Andreasstadel${NNBSP}: un billet pour une séance normale coûte 8 € au lieu de 9 €.`,
    per: 'billet',
    source: `Kinos im Andreasstadel, tarifs${NNBSP}: plein tarif 9 €, réduit 8 € pour les étudiants sur présentation d’un justificatif au cinéma${NNBSP}; les événements spéciaux peuvent différer`,
  },
  'deutschlandticket-for-travel-months': {
    title: 'Prends le Deutschlandticket pour un mois de voyage',
    body: `Estimation${NNBSP}: l’économie suppose une journée de Bayern-Ticket dans le mois, et chaque journée de plus s’y ajoute. Un Bayern-Ticket d’une journée coûte 34 €. L’extension étudiante vers le Deutschlandticket coûte 22 € par mois à Regensburg et vaut toute la journée dans les trains locaux et régionaux de toute l’Allemagne. C’est un abonnement mensuel${NNBSP}: résilie-le avant le 10 d’un mois et il se termine avec ce mois, si bien que tu peux le garder seulement pour les mois où tu voyages.`,
    per: 'mois',
    source: `Estimation (suppose une journée de Bayern-Ticket dans le mois). Deutsche Bahn, Bayern-Ticket${NNBSP}: 1 personne, 2e classe, une journée, 34 €`,
    toSource: `RVV, abonnement semestriel${NNBSP}: depuis le 1er octobre 2026, le supplément étudiant de Regensburg pour le Deutschlandticket est de 22,00 € par mois${NNBSP}; un abonnement mensuel, résiliable avant le 10 du mois`,
  },
};
