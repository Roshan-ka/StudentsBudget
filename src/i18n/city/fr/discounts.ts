import type { DiscountWords } from '..';
import { NNBSP } from '../../messages/fr/count';

// Les réductions en français, par leur id (src/data/discounts.ts). Seulement les mots : les lieux gardent leur nom
// (sauf un qui contient un mot courant), les adresses restent telles que le lieu les donne. Chaque chiffre de la
// version anglaise figure aussi ici (vérifié dans city.test.ts).

const STADTWERK = 'das Stadtwerk Regensburg';
const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';
/** Les piscines et la patinoire de das Stadtwerk appliquent ainsi le tarif étudiant, et les trois pages le disent. */
const STADTWERK_STUDENTS =
  'Étudiants de 15 ans jusqu’à leur 25e anniversaire, avec un justificatif valable comme la carte étudiante (et une pièce d’identité officielle avec photo sur demande), présenté à l’entrée. Un justificatif présenté plus tard n’est pas accepté.';
const PUPILS_STUDENTS_TRAINEES = 'élèves, étudiants et apprentis';

export const discounts: Record<string, DiscountWords> = {
  'asia-restaurant-sunrise': {
    offer: '10 % de réduction',
    conditions: 'Étudiants, tous les jours, sur présentation de la carte étudiante. Non cumulable avec d’autres offres ou réductions.',
    source: `Asia Restaurant Sunrise, page d’accueil${NNBSP}: 10 % de réduction pour les étudiants, du lundi au dimanche, sur présentation de la carte étudiante${NNBSP}; non cumulable avec d’autres offres ou réductions`,
  },
  'mensa-childrens-plate': {
    offer: 'Une assiette enfant gratuite pour ton enfant, jusqu’à sa sixième année',
    conditions:
      'Pour les parents étudiants qui déjeunent aussi à la Mensa (le restaurant universitaire), avec une carte Mensa assiette enfant. Tu l’obtiens au bureau des cartes de la Mensa (Info-Punkt) avec une copie de l’acte de naissance de l’enfant et ton certificat d’inscription.',
    source: `${STWNO}, Mensa Uni Regensburg${NNBSP}: les enfants d’étudiants reçoivent une assiette enfant gratuite jusqu’à leur sixième année quand le parent déjeune aussi à la Mensa, avec une carte Kinderteller du bureau des cartes de la Mensa`,
  },
  'kinos-im-andreasstadel': {
    offer: '8 € au lieu de 9 € par billet',
    conditions: `Étudiants, avec justificatif valable. Les séances spéciales peuvent avoir d’autres tarifs. Réserver en ligne à l’avance ajoute 10 %${NNBSP}; réserver une place est gratuit.`,
    source: `Kinos im Andreasstadel, tarifs${NNBSP}: 9 € plein tarif, 8 € réduit pour les étudiants avec justificatif valable${NNBSP}; la prévente en ligne ajoute 10 %${NNBSP}; les réservations sont gratuites${NNBSP}; les tarifs des séances spéciales peuvent différer`,
  },
  'staatstheater-regensburg': {
    offer: 'Moitié prix sur les billets normaux, et n’importe quelle place pour 10 € aux représentations marquées U30 (moins de 30 ans)',
    conditions: `Étudiants jusqu’à leur 30e anniversaire, pour les billets en vente libre. Les représentations U30 ont lieu à des dates choisies. Montre ton justificatif avec ton billet à l’entrée. En ligne ou par téléphone, il y a 1,50 € de frais par billet${NNBSP}; au guichet du théâtre ou à la caisse du soir, aucun.`,
    source: `Staatstheater Regensburg, FAQ visiteurs${NNBSP}: 50 % de réduction sur le prix normal en vente libre (Freiverkauf) pour les étudiants jusqu’à leur 30e anniversaire${NNBSP}; représentations U30 à des dates choisies, 10 € pour n’importe quelle place${NNBSP}; 1,50 € de frais par billet en ligne ou par téléphone, aucun au guichet ni à la caisse du soir`,
  },
  'regensburger-turmtheater': {
    offer: '16 € au lieu de 32 € pour les représentations normales',
    conditions: 'Élèves, étudiants et apprentis. Une représentation avec d’autres tarifs l’indique dans sa description.',
    source: `Regensburger Turmtheater, billets${NNBSP}: représentations normales 32 €${NNBSP}; ${PUPILS_STUDENTS_TRAINEES} 50 % de réduction (16 €)${NNBSP}; d’autres tarifs sont indiqués dans les descriptions des représentations`,
  },
  'kunstforum-ostdeutsche-galerie': {
    offer: '4 € au lieu de 6 € l’entrée',
    conditions: 'Élèves, étudiants et apprentis.',
    source: `Kunstforum Ostdeutsche Galerie, ta visite${NNBSP}: entrée 6 €, réduite 4 €${NNBSP}; ${PUPILS_STUDENTS_TRAINEES} figurent sur la liste de ceux qui paient le tarif réduit`,
  },
  'document-kepler': {
    offer: 'Entrée gratuite au lieu de 5 €',
    conditions: 'Étudiants de moins de 30 ans, sur présentation d’une pièce d’identité. Les visites guidées publiques sont payantes à part.',
    source: `Museen der Stadt Regensburg, document Kepler${NNBSP}: adultes 5 €${NNBSP}; gratuit pour les étudiants de moins de 30 ans sur présentation d’une pièce d’identité${NNBSP}; visites guidées publiques 8 €, réduites 5 €`,
  },
  'schloss-thurn-und-taxis': {
    offer: `14 € au lieu de 17 € pour la visite guidée des salles d’apparat et du cloître${NNBSP}; 4 € au lieu de 6 € pour le Trésor et le Marstall (musée des carrosses)`,
    conditions: 'Étudiants, sur présentation de la carte étudiante. Les salles d’apparat ne se visitent qu’avec une visite guidée.',
    source: `Fürst Thurn und Taxis, visiter le Schloss St. Emmeram${NNBSP}: visite guidée des salles d’apparat et du cloître (Prunkräume & Kreuzgang) 17 €, réduite 14 €${NNBSP}; Trésor et Marstall 6 €, réduit 4 €${NNBSP}; réduit pour les élèves et les étudiants sur présentation de leur pièce d’identité`,
  },
  westbad: {
    offer: `4,60 € au lieu de 7,20 € pour 3 heures${NNBSP}; 6,50 € au lieu de 10 € pour la journée`,
    conditions: STADTWERK_STUDENTS,
    source: `${STADTWERK}, tarifs du Westbad${NNBSP}: 3 heures 7,20 €, journée 10,00 €${NNBSP}; réduit 4,60 € et 6,50 € pour les ${PUPILS_STUDENTS_TRAINEES} de 15 ans jusqu’à leur 25e anniversaire${NNBSP}; justificatif à l’entrée, pas après coup`,
  },
  'sportpark-ost-pool': {
    place: 'Piscine Sportpark Ost',
    offer: '2,90 € au lieu de 5 € par entrée',
    conditions: STADTWERK_STUDENTS,
    source: `${STADTWERK}, tarifs de la piscine Sportpark Ost${NNBSP}: entrée simple 5,00 €, réduite 2,90 € pour les ${PUPILS_STUDENTS_TRAINEES} de 15 ans jusqu’à leur 25e anniversaire${NNBSP}; justificatif à l’entrée, pas après coup`,
  },
  'donau-arena-skating': {
    offer: `5 € au lieu de 6 € pour le patinage public${NNBSP}; 6 € au lieu de 7 € pour le patinage disco (Discolauf)`,
    conditions: `${STADTWERK_STUDENTS} Seulement pendant la saison de patinage.`,
    source: `${STADTWERK}, tarifs du patinage public à la Donau-Arena${NNBSP}: entrée simple 6 €, réduite 5 €${NNBSP}; Discolauf 7 €, réduit 6 €${NNBSP}; réduit pour les ${PUPILS_STUDENTS_TRAINEES} de 15 ans jusqu’à leur 25e anniversaire${NNBSP}; justificatif à l’entrée, pas après coup`,
  },
  'boulderwelt-studi-monday': {
    offer: `Une entrée à la journée pour 9,90 € le lundi («${NNBSP}Studi Monday${NNBSP}»)`,
    conditions: 'Étudiants et apprentis avec justificatif valable. Toute la journée le lundi, sauf les jours fériés. La location de chaussons est en plus.',
    source: `Boulderwelt Regensburg, tarifs${NNBSP}: Studi Monday, une entrée à la journée à 9,90 € le lundi toute la journée pour les étudiants et apprentis avec justificatif valable${NNBSP}; pas les jours fériés${NNBSP}; chaussons en location au comptoir, payants`,
  },
  'super-bowl-student-tuesday': {
    offer: 'Bowling à 1 € la partie le mardi',
    conditions: 'Élèves et étudiants.',
    source: `Super Bowl Regensburg, offres${NNBSP}: le mardi, élèves et étudiants paient 1 € la partie («${NNBSP}Studenten Bowling${NNBSP}»)`,
  },
  'alnatura-student-tuesday': {
    offer: '8 % de réduction sur tout ton achat le mardi',
    conditions:
      'Étudiants avec une carte étudiante ou scolaire valable présentée en caisse, dans tous les magasins Alnatura (à Regensburg aussi Donaustaufer Straße 128 et Joseph-Dahlem-Straße 3). Pas sur les consignes (Pfand), les cartes cadeaux, les livres ni le lait infantile, et pas avec d’autres réductions.',
    source: `Alnatura, réduction étudiante${NNBSP}: chaque mardi 8 % de réduction sur tout l’achat pour les étudiants, apprentis et élèves avec une carte étudiante ou scolaire valable, dans tous les magasins Alnatura${NNBSP}; pas sur les consignes, les cartes cadeaux, les livres ni le lait infantile, et non cumulable avec d’autres réductions. Le localisateur de magasins d’Alnatura indique à Regensburg les magasins Dr.-Martin-Luther-Straße 2, Donaustaufer Straße 128 et Joseph-Dahlem-Straße 3`,
  },
  'bellas-kunst-student-haircut': {
    offer: `Coupe homme étudiant${NNBSP}: 30 € au lieu de 36 €`,
    conditions:
      'Étudiants. La liste de prix n’indique pas d’autres conditions. Il y a aussi une coupe femme étudiante à 57 €, tandis que les autres coupes femme coûtent de 48 € à 70 €.',
    source: `Bella's Kunst, liste de prix${NNBSP}: coupe homme 36 €, coupe étudiant 30 €${NNBSP}; coupe femme étudiante 57 €${NNBSP}; autres coupes femme 48 € (Schnitt Spezial), 52 € (courte), 65 € (jusqu’aux épaules), 70 € (longue)`,
  },
  'stadtbuecherei-library-card': {
    offer: '10 € au lieu de 17 € pour une carte annuelle de bibliothèque',
    conditions: 'Étudiants, sur présentation de la carte étudiante lors de la création ou du renouvellement de la carte.',
    source: `Stadt Regensburg, tarifs de la Stadtbücherei${NNBSP}: carte annuelle 17 € pour les adultes, 10 € réduite${NNBSP}; le règlement auquel elle renvoie accorde la carte réduite aux étudiants, apprentis et élèves, sur justificatif comme la carte étudiante lors de la création ou du renouvellement`,
  },
  'vhs-course-fees': {
    offer: '10 % de réduction sur les frais de cours au centre de formation pour adultes',
    conditions: `Étudiants régulièrement inscrits, sur demande${NNBSP}: présente ton justificatif en personne, ou envoie une copie avec le numéro du cours, au moins une semaine avant le début du cours. Non cumulable avec d’autres réductions, pas pour les cours que la VHS ne fait que coorganiser, et la VHS peut exclure des réductions.`,
    source: `Volkshochschule Regensburg, conditions générales${NNBSP}: 10 % de réduction pour les étudiants régulièrement inscrits (ordentlich Studierende) sur demande, avec justificatif au moins une semaine avant le début du cours${NNBSP}; les réductions ne se cumulent pas${NNBSP}; pas pour les activités que la VHS ne fait que coorganiser, et la VHS peut exclure des réductions`,
  },
};
