import type { Messages } from '../en';
import { NNBSP } from './count';

// Le compte en français : la ligne « Ton compte » de la liste des Réglages, la ligne pour se connecter sous la
// configuration et la page de départ.
// « Session ouverte » plutôt que « connecté », qui obligerait à choisir un genre.
export const account: Messages['account'] = {
  card: {
    heading: 'Ton compte',
    signedIn: (email) => `Session ouverte avec ${email}.`,
    secondStep: (email) =>
      `Connexion presque terminée avec ${email}${NNBSP}: saisis le code de ton appli d’authentification.`,
    signedOut: `Facultatif${NNBSP}: connecte-toi ou crée un compte. Sans compte, tout reste sur ce téléphone.`,
  },
  setupLink: {
    question: `Tu utilises StudentsBudget sur un autre téléphone${NNBSP}?`,
    signedIn: 'Récupère tes données depuis ton compte',
    secondStep: 'Termine la connexion pour récupérer tes données',
  },
  start: {
    /** Au-dessus du titre, avec une épingle. */
    place: 'Pour les étudiants à Regensburg',
    headline: 'Ton argent, bien rangé pour ta vie d’étudiant.',
    pitch: 'Conçu pour tes premiers mois dans une nouvelle ville, avec des prix que tu peux vérifier.',
    /** Ce que fait l’appli, une ligne chacune, dans une carte. */
    features: {
      plan: 'Planifier ton mois',
      log: 'Noter tes dépenses en quelques secondes',
      week: 'Connaître ton budget de la semaine',
      tips: 'Des astuces locales, avec leurs sources',
    },
    signIn: 'J’ai un compte',
    create: 'Créer un compte',
    guest: 'Continuer sans compte',
    signedOut: 'Ta session est fermée. Tes données ont été supprimées de ce téléphone.',
    back: 'Retour',
    /** Les formulaires des pages de départ (13-11-2026) : leur grand titre et la ligne en dessous. */
    signInHeading: 'Se connecter',
    signInLine: 'Ton plan et tes saisies reviennent depuis ton compte.',
    createHeading: 'Créer ton compte',
    createLine: 'Sauvegarde ton plan et utilise-le sur chaque téléphone.',
  },
};
