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
};
