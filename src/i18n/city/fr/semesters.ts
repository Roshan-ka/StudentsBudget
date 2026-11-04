import { NNBSP } from '../../messages/fr/count';

// Les textes des semestres en français (src/data/semesters.ts) : sources des dates, noms et sources des parts des frais
// et source de la réinscription. Ils n'ont pas d'id et sortent en partie de modèles, donc chaque texte anglais figure
// ici mot pour mot comme clé : s'il change, city.test.ts signale la traduction comme périmée.

const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';

const basicEn = (semester: string) =>
  `${STWNO}, basic contribution statute (scanned PDF, in German), § 2: €87.00 for summer semester 2027 and €92.00 per semester from winter semester 2027/28; § 3: for students of Universität Regensburg and OTH Regensburg, due with re-registration. This is the ${semester} figure.`;
const basicFr = (semester: string) =>
  `${STWNO}, statut de la contribution de base (PDF scanné, en allemand), § 2${NNBSP}: 87,00 € pour le semestre d’été 2027 et 92,00 € par semestre à partir du semestre d’hiver 2027/28${NNBSP}; § 3${NNBSP}: pour les étudiants de l’Universität Regensburg et de l’OTH Regensburg, à payer avec la réinscription. C’est le montant du ${semester}.`;
const ticketEn = (semester: string) =>
  `${STWNO}, semester ticket statute of 12 Oct 2026 (scanned PDF, in German), § 3: €128.00 for summer semester 2027 and €130.00 for winter semester 2027/28; § 1: for students of OTH Regensburg and Universität Regensburg (with the statute's exemptions), due with re-registration. This is the ${semester} figure.`;
const ticketFr = (semester: string) =>
  `${STWNO}, statut de l’abonnement semestriel du 12 octobre 2026 (PDF scanné, en allemand), § 3${NNBSP}: 128,00 € pour le semestre d’été 2027 et 130,00 € pour le semestre d’hiver 2027/28${NNBSP}; § 1${NNBSP}: pour les étudiants de l’OTH Regensburg et de l’Universität Regensburg (avec les exemptions du statut), à payer avec la réinscription. C’est le montant du ${semester}.`;

export const semesters: Record<string, string> = {
  'Universität Regensburg, academic calendar: "The winter semester begins on 1 October and ends on 31 March."': `Universität Regensburg, calendrier universitaire${NNBSP}: «${NNBSP}Le semestre d’hiver commence le 1er octobre et se termine le 31 mars.${NNBSP}»`,
  'Universität Regensburg, academic calendar: "The summer semester lasts from 1 April to 30 September."': `Universität Regensburg, calendrier universitaire${NNBSP}: «${NNBSP}Le semestre d’été va du 1er avril au 30 septembre.${NNBSP}»`,
  'OTH Regensburg, Studienstart (in German): winter semester 1 October to 14 March': `OTH Regensburg, Studienstart (en allemand)${NNBSP}: semestre d’hiver du 1er octobre au 14 mars`,
  'OTH Regensburg, Studienstart (in German): summer semester 15 March to 30 September': `OTH Regensburg, Studienstart (en allemand)${NNBSP}: semestre d’été du 15 mars au 30 septembre`,
  'Studierendenwerk basic contribution': 'Contribution de base du Studierendenwerk',
  'RVV semester ticket': 'Abonnement semestriel RVV',
  [basicEn('summer 2027')]: basicFr('semestre d’été 2027'),
  [basicEn('winter 2027/28')]: basicFr('semestre d’hiver 2027/28'),
  [ticketEn('summer 2027')]: ticketFr('semestre d’été 2027'),
  [ticketEn('winter 2027/28')]: ticketFr('semestre d’hiver 2027/28'),
  'OTH Regensburg, dates and opening hours (in German): "Rückmeldung für das SoSe 2027: vorauss. ab 07.01.2027", re-registration for summer 2027 expected to open on 7 Jan 2027': `OTH Regensburg, dates et horaires (en allemand)${NNBSP}: «${NNBSP}Rückmeldung für das SoSe 2027: vorauss. ab 07.01.2027${NNBSP}», la réinscription pour l’été 2027 devrait ouvrir le 7 janvier 2027`,
};
