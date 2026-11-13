import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// Questions en français (phase IA, chunk 10, docs/superpowers/plans/2026-11-09-ai-phase-1.md) : des questions sur son
// propre budget, avec des réponses tirées du plan, des opérations et des données sourcées de l’appli sur Regensburg.
export const ask: Messages['ask'] = {
  intro:
    `Pose une question sur ton propre budget${NNBSP}: ce qui reste, où va ton argent ou comment dépenser moins à ` +
    'Regensburg. Les réponses s’appuient sur ton plan, tes dernières opérations et les données sourcées de l’appli sur Regensburg.',
  question: 'Ta question',
  questionHint: '300 caractères au plus. Chaque question compte dans les six du jour.',
  submit: 'Demander',
  thinking: 'Réflexion…',
  asked: 'Ta question',
  answer: 'Réponse',
  left: (count: number) =>
    byCount(count, { one: `Encore ${count} question aujourd’hui.`, other: `Encore ${count} questions aujourd’hui.` }),
  full: 'Ça fait six questions dans cette conversation. Recommence pour en poser d’autres.',
  startOver: 'Recommencer',
  estimate:
    `Certains montants de cette réponse ne viennent ni de tes données ni des données sourcées sur Regensburg${NNBSP}: ` +
    'prends-les comme des estimations.',
  sources: 'Sources',
  semester: (term: string, university: string) => `${term} à ${university}`,
  fee: (university: string) => `Contribution semestrielle à ${university}`,
  problems: {
    dailyLimit: 'Les questions du jour sont épuisées. Reviens demain.',
    busy: 'Trop de questions arrivent en ce moment. Réessaie un peu plus tard.',
    refused: 'L’appli ne peut pas répondre à cette question ici.',
    failed: 'Un problème est survenu avec la réponse. Repose ta question.',
    unavailable: 'Aucune réponse possible pour le moment. Réessaie un peu plus tard.',
    offline: 'Tu es hors ligne. Les réponses ont besoin d’une connexion.',
    timeout: 'La réponse a mis trop de temps. Repose ta question.',
  },
  unavailable: 'Les questions ne font pas partie de cette version de l’appli.',
  loading: 'Chargement…',
  signedOut: `Les questions passent par ton compte${NNBSP}: connecte-toi d’abord sur ce téléphone.`,
  needsCode: `Ton compte a la validation en deux étapes${NNBSP}: saisis d’abord le code de ton appli d’authentification.`,
  toAccount: `Aller à «${NNBSP}Ton compte${NNBSP}»`,
  switchedOff: `Les fonctions IA sont désactivées sur ce téléphone. Tu peux les réactiver dans les Réglages, sous «${NNBSP}Ton compte${NNBSP}».`,
  noPlan: 'Les réponses s’appuient sur ton plan, alors configure-le d’abord.',
  toSetup: 'Configurer ton plan',
  link: 'Pose une question sur ton budget',
  close: 'Fermer',
};
