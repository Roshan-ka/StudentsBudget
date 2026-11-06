import type { Messages } from '../en';
import { NNBSP } from './count';

// Le compte en français : la carte « Ton compte » dans les Réglages et la ligne qui en parle dans la configuration.
// « Session ouverte » plutôt que « connecté », qui obligerait à choisir un genre.
export const account: Messages['account'] = {
  card: {
    heading: 'Ton compte',
    signedIn: (email) => `Session ouverte avec ${email}.`,
    secondStep: (email) =>
      `Connexion presque terminée avec ${email}${NNBSP}: saisis le code de ton appli d’authentification.`,
    signedOut: `Facultatif${NNBSP}: connecte-toi ou crée un compte. Sans compte, tout reste sur ce téléphone.`,
    manage: 'Gérer le compte',
    finish: 'Terminer la connexion',
    signIn: 'Se connecter',
  },
  setupLink: {
    question: `Tu utilises StudentsBudget sur un autre téléphone${NNBSP}?`,
    signedIn: 'Récupère tes données depuis ton compte',
    secondStep: 'Termine la connexion pour récupérer tes données',
    signedOut: 'Connecte-toi pour récupérer tes données',
  },
  start: {
    pitch: `Ton budget d’étudiant à Regensburg${NNBSP}: planifier, noter, épargner.`,
    withAccount: 'Avec un compte',
    signIn: 'J’ai un compte',
    create: 'Créer un compte',
    accountWhy: 'Avec un compte, ton plan est sauvegardé et disponible sur chaque téléphone où tu te connectes.',
    withoutAccount: 'Sans compte',
    guest: 'Continuer sans compte',
    guestNote: 'Tes données restent uniquement sur ce téléphone. Tu pourras créer un compte plus tard dans les Réglages.',
    signedOut: 'Ta session est fermée. Tes données ont été supprimées de ce téléphone.',
    back: 'Retour',
    afterSignIn: 'Une fois la session ouverte, l’appli récupère tes données depuis ton compte. S’il est encore vide, tu configures ensuite ton plan.',
  },
};
