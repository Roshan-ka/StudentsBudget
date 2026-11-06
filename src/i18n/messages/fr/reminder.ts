import type { Messages } from '../en';
import { NNBSP } from './count';

// Réglages → Rappel hebdomadaire en français (docs/superpowers/plans/2026-11-05-weekly-reminder.md, chunk 4) : une
// ligne calme par semaine pour dire que c'est l'heure du bilan, via le compte, désactivée tant qu'on ne l'active pas.
export const reminder: Messages['reminder'] = {
  intro:
    'Une fois par semaine, ce téléphone affiche une courte ligne pour te dire que c’est l’heure de ton bilan ' +
    'hebdomadaire. Elle ne dit rien de ton argent, et elle reste désactivée tant que tu ne l’actives pas.',
  loading: 'Chargement…',
  unavailable: 'Les rappels ne sont pas configurés dans cette version de l’appli.',
  signedOut: `Le rappel passe par ton compte${NNBSP}: connecte-toi d’abord sur ce téléphone.`,
  toAccount: `Aller à «${NNBSP}Ton compte${NNBSP}»`,
  needsCode: `Ton compte a la validation en deux étapes${NNBSP}: saisis d’abord le code de ton appli d’authentification.`,
  installFirst:
    `Sur un iPhone ou un iPad, le rappel a besoin de l’appli sur ton écran d’accueil${NNBSP}: dans Safari, touche ` +
    `Partager, puis «${NNBSP}Sur l’écran d’accueil${NNBSP}», et ouvre-la depuis là.`,
  noPush: 'Ce navigateur ne peut pas afficher de rappels. Le rappel dans le calendrier, depuis le bilan, marche partout.',
  denied:
    'Les notifications sont bloquées pour StudentsBudget. Autorise-les dans les réglages de ton téléphone ou de ton ' +
    'navigateur, puis reviens ici.',
  day: 'Jour',
  time: 'Heure',
  hint: `Quel que soit le jour choisi, le bilan regarde la semaine en cours, du lundi au dimanche.`,
  turnOn: 'Activer le rappel',
  save: 'Enregistrer les modifications',
  turnOff: 'Désactiver',
  status: {
    on: (day: string, time: string) => `Le rappel est activé${NNBSP}: ${day.toLowerCase()} à ${time}.`,
    off: 'Le rappel est désactivé.',
    dismissed: `Rien n’a changé${NNBSP}: les notifications n’ont pas été autorisées.`,
    notSupported: 'L’appli ne peut pas envoyer au service push de ce navigateur.',
    failed: 'Ça n’a pas marché. Vérifie ta connexion et réessaie.',
  },
  calendar:
    `Tu préfères ton calendrier${NNBSP}? Le bilan peut y ajouter un rappel hebdomadaire à la place. Garde l’un des ` +
    'deux, pour ne pas recevoir les deux.',
  toCheckIn: 'Ouvrir le bilan',
  everyDay: ['Le lundi', 'Le mardi', 'Le mercredi', 'Le jeudi', 'Le vendredi', 'Le samedi', 'Le dimanche'],
  summaryOff: 'Désactivé',
  summaryOn: (day: string, time: string) => `${day} à ${time}`,
};
