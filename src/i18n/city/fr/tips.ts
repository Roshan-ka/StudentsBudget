import type { TipWords } from '..';
import { NNBSP } from '../../messages/fr/count';

// Les conseils en français, par leur id (src/data/tips.ts). Seulement les mots : chiffres, liens, dates de vérification
// et catégories restent dans les données, et chaque chiffre de la version anglaise figure aussi ici (vérifié dans
// city.test.ts, comme l'espace fine avant : ; ? !). Les noms de lieux, d'organismes et d'offres restent tels quels.

const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';

export const tips: Record<string, TipWords> = {
  'cafeteria-surprise-bags': {
    title: 'Prends un panier surprise à la cafétéria',
    body: 'Les cafétérias Milchbar, Sammelgebäude (UR) et Architektur (OTH) vendent leurs restes à petit prix via Too Good To Go dans les 30 dernières minutes.',
    source: `${STWNO}, page sur le gaspillage alimentaire${NNBSP}: paniers surprise via Too Good To Go dans les 30 dernières minutes aux cafétérias Milchbar, Sammelgebäude et Architektur, pas tous les jours`,
  },
  'eat-at-the-mensa': {
    title: 'Mange à la Mensa',
    body: 'À la Mensa de l’Uni Regensburg, les plats principaux commencent à 2,30 € pour les étudiants. Les invités paient 6,10 € pour la même assiette.',
    source: `${STWNO}, menu de la Mensa Uni Regensburg${NNBSP}: le plat principal le moins cher coûtait 2,30 € pour les étudiants, 3,30 € pour le personnel et 6,10 € pour les invités chaque jour ouvré du 19 au 30 octobre 2026 (le menu change chaque jour)`,
  },
  'tap-your-student-id': {
    title: 'Pose ta carte étudiante à la caisse',
    body: `Tu paies par carte ou avec ton téléphone${NNBSP}? Pose aussi ta carte étudiante sur le terminal de la caisse, sinon tu paies le prix fort.`,
    source: `${STWNO}, page de la Mensa Uni Regensburg${NNBSP}: les caisses n’acceptent pas d’espèces${NNBSP}; il faut aussi poser la carte de la Mensa ou la carte étudiante sur le terminal pour avoir le prix étudiant`,
  },
  'theatre-at-half-price': {
    title: 'Va au théâtre à moitié prix',
    body: `Les étudiants de moins de 30 ans paient moitié prix au Staatstheater${NNBSP}; les représentations U30 coûtent 10 € pour n’importe quelle place. Achète au guichet pour éviter les frais de 1,50 €.`,
    source: `Staatstheater Regensburg, FAQ visiteurs${NNBSP}: 50 % de réduction sur le prix normal jusqu’au 30e anniversaire${NNBSP}; représentations U30 à 10 € pour n’importe quelle place${NNBSP}; 1,50 € de frais par billet en ligne ou par téléphone, aucun au guichet`,
  },
  'historisches-museum-free': {
    title: 'Visite gratuitement le Historisches Museum',
    body: 'Les étudiants de moins de 30 ans entrent gratuitement au Historisches Museum de la ville (les adultes paient 5 €). Prends ta carte étudiante.',
    source: `Museen der Stadt Regensburg, Historisches Museum${NNBSP}: adultes 5 €${NNBSP}; gratuit pour les étudiants de moins de 30 ans avec leur carte, et pour tout le monde le premier dimanche du mois`,
  },
  'hdbg-museum-free': {
    title: 'Visite gratuitement le musée d’histoire bavaroise',
    body: 'Les étudiants de moins de 30 ans entrent gratuitement à la Haus der Bayerischen Geschichte (les adultes paient 7 €), y compris dans la Bayernausstellung 2026/27.',
    source: `Haus der Bayerischen Geschichte, tarifs valables du 8 juillet 2026 au 7 août 2027${NNBSP}: adultes 7 €, étudiants de moins de 30 ans gratuit`,
  },
  'cinema-student-price': {
    title: 'Réserve tes places de cinéma gratuitement',
    body: 'Aux Kinos im Andreasstadel, les étudiants paient 8 € au lieu de 9 €. Réserve gratuitement plutôt que d’acheter en ligne, ce qui ajoute 10 %.',
    source: `Kinos im Andreasstadel, tarifs${NNBSP}: 9 € plein tarif, 8 € réduit pour les étudiants avec justificatif${NNBSP}; la prévente en ligne ajoute 10 %${NNBSP}; les réservations sont gratuites`,
  },
  'register-in-person': {
    title: 'Inscris-toi en personne pour des bons gratuits',
    body: `Déclare ta résidence principale en personne dans un Bürgerbüro${NNBSP}: le pack de bienvenue contient des bons pour une visite guidée de la ville et une sortie au théâtre.`,
    source: `Stadt Regensburg, pack de bienvenue${NNBSP}: remis lors de l’inscription en personne${NNBSP}; avec une résidence principale, il contient des bons pour une visite guidée de la ville et une sortie au théâtre`,
  },
  'campus-bike-repair': {
    title: 'Répare ton vélo chez Campus Bike Repair',
    body: 'Un atelier vélo mobile avec outils et rustines vient chaque semaine sur le campus de l’UR. Apporte toi-même les pièces spéciales.',
    source: `Universität Regensburg, UR Health «${NNBSP}Move${NNBSP}»${NNBSP}: l’atelier mobile Campus Bike Repair vient chaque semaine sur le campus avec outils et matériel de réparation${NNBSP}; les pièces spéciales ne sont pas fournies`,
  },
  'fashion-for-free': {
    title: 'Trouve des vêtements à Fashion for Free',
    body: 'Le Studierendenwerk organise chaque semestre une bourse aux vêtements gratuite, et tu n’as pas besoin d’apporter de vêtements. Sa page d’actualités donne la prochaine date à Regensburg.',
    source: `${STWNO}, actualité «${NNBSP}Fashion for free im STWNO${NNBSP}» (6 août 2026)${NNBSP}: gratuit pour tous, sans don, chaque semestre${NNBSP}; à Regensburg le 9 décembre 2026 dans la salle des invités de la Mensa de l’UR`,
  },
  'free-psychological-counselling': {
    title: 'Profite du soutien psychologique gratuit',
    body: 'Le Studierendenwerk propose un accompagnement individuel gratuit en allemand ou en anglais, en personne, par téléphone ou en vidéo.',
    source: `${STWNO}, soutien psychologique${NNBSP}: accompagnement individuel gratuit à court et moyen terme en personne, par téléphone ou en vidéo, en allemand et en anglais`,
  },
  'borrow-course-books': {
    title: 'Emprunte tes manuels au lieu de les acheter',
    body: 'Emprunte les manuels de base de la Lehrbuchsammlung de la bibliothèque centrale de l’UR pour quatre semaines, prolongeables jusqu’à 12 semaines.',
    source: `Bibliothèque de l’Universität Regensburg, prêt de documents imprimés${NNBSP}: la collection de manuels se prête pour quatre semaines, prolongeables jusqu’à 12 semaines`,
  },
  'scan-for-free': {
    title: 'Scanne gratuitement les livres de la bibliothèque',
    body: 'Scanne gratuitement les livres de la salle de lecture sur les scanners de livres de la bibliothèque de l’UR et enregistre-les sur ta propre clé USB.',
    source: `Bibliothèque de l’Universität Regensburg, prêt de documents imprimés, salles de lecture${NNBSP}: scanner sur les scanners de livres est gratuit, enregistrement sur ta propre clé USB`,
  },
  'day-trips-on-the-semester-ticket': {
    title: 'Fais des excursions avec l’abonnement semestriel',
    body: 'Depuis l’hiver 2026/27, l’abonnement semestriel couvre de nouveau les trains de Regensburg jusqu’à Neustadt an der Donau, sans supplément.',
    source: `${STWNO}, abonnement semestriel de Regensburg${NNBSP}: à partir du semestre d’hiver 2026/27, le tronçon ferroviaire de Sinzing/Riegling à Neustadt a. d. Donau fait de nouveau partie de la zone de l’abonnement`,
  },
  studienstarthilfe: {
    title: `Demande l’aide au début des études de 1${NNBSP}000 €`,
    body: `En première année, moins de 25 ans et avec des aides comme le Bürgergeld ou le Wohngeld${NNBSP}? Demande une aide unique de 1${NNBSP}000 € avant la fin du mois suivant ton début d’études.`,
    source: `${STWNO}, BAföG Studienstarthilfe${NNBSP}: une aide unique de 1${NNBSP}000 €, non remboursable, pour les personnes qui commencent pour la première fois des études à temps plein, ont moins de 25 ans et touchent des aides sociales${NNBSP}; demande via BAföG Digital avant la fin du mois suivant le début des études`,
  },
  'apply-for-a-dorm-room': {
    title: 'Postule pour une chambre du Studierendenwerk',
    body: `Les chambres en résidence les moins chères coûtent environ 215 € par mois${NNBSP}; une chambre en colocation coûte en moyenne 459–561 €. Tu peux postuler en ligne à tout moment.`,
    source: `Universität Regensburg, vivre à Regensburg${NNBSP}: les chambres du Studierendenwerk les moins chères coûtent environ 215 €${NNBSP}; une chambre moyenne en colocation 459–561 € (Moses Mendelssohn Institut, sept. 2026)${NNBSP}; pas de date limite de candidature`,
  },
  'check-wohngeld': {
    title: 'Vérifie si tu as droit au Wohngeld',
    body: `Pas de droit au BAföG en principe, par exemple parce que tu dépasses la limite d’âge${NNBSP}? Le Wohngeld peut t’aider pour le loyer si Regensburg est ta résidence principale.`,
    source: `${STWNO}, Wohngeld${NNBSP}: possible seulement sans droit au BAföG en principe, et la ville d’études doit être la résidence principale`,
  },
  'free-tenancy-advice': {
    title: 'Obtiens des conseils gratuits sur ton bail',
    body: `Un problème avec ton propriétaire${NNBSP}? Le service social du Studierendenwerk t’oriente vers le Mieterverein local pour des conseils gratuits.`,
    source: `${STWNO}, conseil en droit du bail${NNBSP}: conseils gratuits du Mieterverein local de Regensburg, sur orientation du service social`,
  },
  'stay-on-family-insurance': {
    title: 'Reste dans l’assurance maladie familiale',
    body: 'La couverture gratuite par l’assurance maladie publique d’un parent dure jusqu’à tes 25 ans si tu gagnes moins de 565 € par mois (603 € en minijob, 2026).',
    source: `${STWNO}, assurance maladie et dépendance${NNBSP}: assurance familiale gratuite jusqu’au 25e anniversaire${NNBSP}; en 2026, jusqu’à 565 € par mois d’un emploi normal ou 603 € d’un minijob`,
  },
  'software-from-campus-it': {
    title: 'Obtiens Office via l’université',
    body: `Avant de payer Office 365 ou SPSS, regarde l’offre logicielle de Campus IT à l’UR${NNBSP}: les licences campus sont gratuites ou à prix réduit pour les étudiants.`,
    source: `Universität Regensburg Campus IT, logiciels${NNBSP}: licences campus gratuites ou à prix spéciaux${NNBSP}; les étudiants ont des réductions sur des logiciels comme SPSS et Office 365`,
  },
  'ride-on-your-semester-ticket': {
    title: 'Voyage sur le réseau RVV avec ton abonnement semestriel',
    body: 'Tes frais de semestre comprennent déjà 126 € pour des trajets illimités en bus et en train sur le réseau RVV. Ta carte étudiante plus une pièce d’identité avec photo font office de billet.',
    source: `RVV, abonnement semestriel${NNBSP}: 126 € obligatoires par semestre pour des trajets illimités sur tout le réseau RVV${NNBSP}; le billet est la carte étudiante plus une carte d’identité ou un passeport`,
  },
  'upgrade-to-deutschlandticket': {
    title: 'Passe au Deutschlandticket pour 22 €',
    body: `L’extension coûte 22 € par mois en plus de ton abonnement semestriel. Prends-la pour les mois où tu voyages${NNBSP}; résilie-la avant le 10 pour le mois suivant.`,
    source: `RVV, abonnement semestriel${NNBSP}: depuis le 1er octobre 2026, le supplément étudiant de Regensburg est de 22,00 € par mois${NNBSP}; un abonnement mensuel, résiliable avant le 10 du mois`,
  },
  'try-university-sport': {
    title: 'Essaie le sport universitaire avant une salle de sport',
    body: 'URsport, au Sportzentrum de l’UR, propose salle de sport, piscine, sauna et cours au tarif étudiant pour les étudiants de l’UR et de l’OTH. Compare avant de t’inscrire.',
    source: `Sportzentrum de l’Universität Regensburg, plateforme URsport${NNBSP}: les étudiants de l’UR et de l’OTH se connectent et achètent au tarif étudiant${NNBSP}; salle de sport, piscine et sauna via l’app`,
  },
  'split-the-rundfunkbeitrag': {
    title: 'Ne paie qu’un Rundfunkbeitrag par logement',
    body: `La redevance coûte 18,36 € par mois et par logement, pas par personne. En colocation, une personne s’inscrit et vous la partagez${NNBSP}; les autres se désinscrivent.`,
    source: `ARD ZDF Deutschlandradio Beitragsservice, informations pour les étudiants${NNBSP}: 18,36 € par mois et par logement${NNBSP}; un seul adulte par logement s’inscrit et paie`,
  },
  'rundfunkbeitrag-bafoeg-exemption': {
    title: 'Demande l’exonération du Rundfunkbeitrag',
    body: 'Si tu touches le BAföG et ne vis pas chez tes parents, demande l’exonération de la redevance de 18,36 € par mois. Elle n’est pas automatique.',
    source: `ARD ZDF Deutschlandradio Beitragsservice, informations pour les étudiants${NNBSP}: les bénéficiaires du BAföG qui ne vivent pas chez leurs parents peuvent en être exonérés sur demande`,
  },
};
