import type { ChecklistWords } from '..';
import { NNBSP } from '../../messages/fr/count';

// La liste de contrôle en français, par son id (src/data/checklist.ts). Seulement les mots : groupe, public, conseil,
// liens et dates de vérification restent dans les données, et chaque chiffre de la version anglaise figure aussi ici
// (vérifié dans city.test.ts, comme l'espace fine avant : ; ? !). Un point qui s'appuie sur un conseil cite sa source
// avec les mêmes mots que le conseil.

const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';

export const checklist: Record<string, ChecklistWords> = {
  'register-your-address': {
    title: 'Déclare ton adresse',
    body: 'Déclare-toi au bureau des déclarations de la ville dans les deux semaines qui suivent ton emménagement.',
    source: `Bundesmeldegesetz, § 17, al. 1${NNBSP}: toute personne qui emménage dans un logement doit se déclarer au bureau des déclarations dans les deux semaines suivant l’emménagement`,
  },
  'health-insurance-for-enrolment': {
    title: 'Fais transmettre ton assurance maladie à l’université',
    body: `Ta caisse d’assurance maladie publique envoie la preuve par voie électronique, avec le numéro de l’université H0000341${NNBSP}; une preuve papier n’est pas acceptée. Assuré en privé ou à l’étranger${NNBSP}? Une caisse publique vérifie ta situation et l’envoie.`,
    source: `Universität Regensburg, preuve d’assurance maladie${NNBSP}: requise sous forme électronique, envoyée par la caisse publique avec le numéro de l’université H0000341${NNBSP}; les attestations papier ne suffisent plus depuis le 1er janv. 2022${NNBSP}; les assureurs privés et étrangers ne peuvent pas l’envoyer, une caisse publique vérifie donc la situation et l’envoie`,
  },
  'residence-permit': {
    title: 'Demande ton titre de séjour',
    body: `Tu viens d’un pays hors de l’UE${NNBSP}? Fais ta demande au service des étrangers de la ville avant l’expiration de ton visa d’entrée, ou dans tes 90 premiers jours si tu es venu sans visa.`,
    source: `Universität Regensburg, International Office, titre de séjour pour les étudiants hors UE${NNBSP}: à demander au service des étrangers compétent avant l’expiration d’un éventuel visa${NNBSP}; sans visa, dans les 90 premiers jours du séjour`,
  },
  'open-a-bank-account': {
    title: 'Ouvre un compte bancaire',
    body: 'Toute personne en séjour régulier dans l’UE a droit à un compte de base, même sans domicile fixe.',
    source: `Zahlungskontengesetz, § 31, al. 1${NNBSP}: tout consommateur en séjour régulier dans l’Union européenne, y compris sans domicile fixe, a droit à un compte de paiement de base`,
  },
  'register-for-the-rundfunkbeitrag': {
    title: 'Règle la redevance audiovisuelle (Rundfunkbeitrag)',
    body: `Un seul adulte par logement s’inscrit et paie${NNBSP}; en colocation, mettez-vous d’accord sur qui le fait.`,
    source: `ARD ZDF Deutschlandradio Beitragsservice, informations pour les étudiants${NNBSP}: 18,36 € par mois et par logement${NNBSP}; un seul adulte par logement s’inscrit et paie`,
  },
  'apply-for-bafoeg': {
    title: 'Demande le BAföG',
    body: `Fais ta demande via BAföG Digital le plus tôt possible${NNBSP}: il est versé à partir du mois où ta demande arrive, jamais avant le début de tes études.`,
    source: `${STWNO}, BAföG${NNBSP}: demande via BAföG Digital, le plus tôt possible${NNBSP}; l’aide est accordée à partir du mois de réception de la demande, au plus tôt dès le début des études${NNBSP}; le bureau de Regensburg traite l’Universität Regensburg et l’OTH Regensburg`,
  },
  'claim-the-study-start-grant': {
    title: 'Demande l’aide au démarrage des études',
    body: `Tu commences tes premières études, tu as moins de 25 ans et tu touches des aides sociales${NNBSP}? Une aide unique de 1${NNBSP}000 € que tu ne rembourses jamais.`,
    source: `${STWNO}, BAföG Studienstarthilfe${NNBSP}: une aide unique de 1${NNBSP}000 €, non remboursable, pour les personnes qui commencent pour la première fois des études à temps plein, ont moins de 25 ans et touchent des aides sociales${NNBSP}; demande via BAföG Digital avant la fin du mois suivant le début des études`,
  },
  'keep-kindergeld': {
    title: 'Garde les allocations familiales (Kindergeld)',
    body: 'Tes parents peuvent toucher le Kindergeld pour toi pendant tes premières études, jusqu’à la veille de tes 25 ans.',
    source: `Bundesagentur für Arbeit, Familienkasse, Kindergeld à partir de 18 ans${NNBSP}: versé entre 18 ans et 25 ans révolus pour un enfant en première formation ou en premières études${NNBSP}; la 25e année se termine la veille du 25e anniversaire`,
  },
  'stay-on-family-insurance': {
    title: 'Reste sur l’assurance familiale',
    body: 'Gratuite jusqu’à tes 25 ans tant que tu gagnes peu. Vérifie avant d’accepter un emploi plus important.',
    source: `${STWNO}, assurance maladie et dépendance${NNBSP}: assurance familiale gratuite jusqu’au 25e anniversaire${NNBSP}; en 2026, jusqu’à 565 € par mois d’un emploi normal ou 603 € d’un minijob`,
  },
  'check-wohngeld': {
    title: 'Vérifie l’aide au logement (Wohngeld)',
    body: `Pas de droit au BAföG en principe${NNBSP}? Le Wohngeld peut aider à payer le loyer si Regensburg est ta résidence principale.`,
    source: `${STWNO}, Wohngeld${NNBSP}: possible seulement sans droit au BAföG en principe, et la ville d’études doit être la résidence principale`,
  },
  'rundfunkbeitrag-exemption': {
    title: 'Demande l’exonération de la redevance',
    body: `Tu touches le BAföG et tu ne vis pas chez tes parents${NNBSP}? Tu peux en être exonéré sur demande.`,
    source: `ARD ZDF Deutschlandradio Beitragsservice, informations pour les étudiants${NNBSP}: les bénéficiaires du BAföG qui ne vivent pas chez leurs parents peuvent en être exonérés sur demande`,
  },
};
