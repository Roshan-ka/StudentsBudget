import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// La synchronisation et l'association en français : les codes de problème enregistrés (src/sync/problem.ts), la ligne
// d'état sous « Synchroniser », ce qu'entend un lecteur d'écran ensuite et l'association de ce téléphone.
export const sync: Messages['sync'] = {
  problems: {
    updateNeeded: 'Cette app a besoin d’une mise à jour pour se synchroniser.',
    signedOut: `Ta session a expiré. Déconnecte-toi puis reconnecte-toi${NNBSP}; tes modifications attendent sur ce téléphone.`,
    failed: `Impossible de synchroniser pour l’instant. Tes modifications attendent sur ce téléphone${NNBSP}; réessaie.`,
    heldBack: (count) =>
      byCount(count, {
        one: `${count} modification ne peut pas être synchronisée${NNBSP}: cette app la refuse. Elle reste sur ce téléphone.`,
        other: `${count} modifications ne peuvent pas être synchronisées${NNBSP}: cette app les refuse. Elles restent sur ce téléphone.`,
      }),
  },
  status: {
    offline: 'Hors ligne. Les modifications faites maintenant attendent sur ce téléphone.',
    offlineWaiting: (count) =>
      byCount(count, {
        one: `Hors ligne${NNBSP}: ${count} modification attend sur ce téléphone.`,
        other: `Hors ligne${NNBSP}: ${count} modifications attendent sur ce téléphone.`,
      }),
    notYet: 'Pas encore synchronisé',
    synced: (when) => `Synchronisé ${when}`,
    line: (state, waiting) =>
      waiting === 0
        ? `${state}.`
        : `${state}. ${byCount(waiting, { one: `${waiting} modification en attente`, other: `${waiting} modifications en attente` })}.`,
    justNow: 'à l’instant',
    // « min » est un symbole, sans point, donc la ligne ne finit pas par « min.. ».
    minutesAgo: (minutes) => `il y a ${minutes} min`,
    at: (dateTime) => `le ${dateTime}`,
    before: 'il y a un moment',
    otherAccount: 'Ce téléphone est associé à un autre compte.',
  },
  result: {
    finished: 'Synchronisation terminée.',
    offline: `Pas synchronisé${NNBSP}: tu es hors ligne. Les modifications attendent sur ce téléphone.`,
    otherAccount: `Pas synchronisé${NNBSP}: ce téléphone est associé à un autre compte.`,
    problem: (problem) => `Pas synchronisé${NNBSP}: ${problem}`,
  },
  stale: {
    entries: (count) => byCount(count, { one: `${count} saisie`, other: `${count} saisies` }),
    others: (count) => byCount(count, { one: `${count} autre élément`, other: `${count} autres éléments` }),
  },
  section: {
    heading: 'Synchronisation',
    syncNow: 'Synchroniser',
    automatic: 'Ce téléphone se synchronise tout seul tant que l’appli est ouverte. « Synchroniser » le fait tout de suite.',
  },
  link: {
    heading: 'Associer ce téléphone',
    checking: 'Association de ce téléphone à ton compte…',
    linking: 'Association de ce téléphone…',
    uploaded: 'Ton compte contient maintenant les données de ce téléphone.',
    loaded: (contents) => `Chargé depuis ton compte${NNBSP}: ${contents}.`,
    question: (phone, account) =>
      `Ce téléphone et ton compte contiennent tous deux des données. Ce téléphone${NNBSP}: ${phone}. ` +
      `Ton compte${NNBSP}: ${account}. Lesquelles garder des deux côtés${NNBSP}?`,
    staleWarning: (stale) =>
      `Garder les données de ce téléphone supprime de ton compte ce que lui seul contient (${stale}), et de tes ` +
      'autres téléphones à leur prochaine synchronisation.',
    replaceWarning:
      'Utiliser les données de ton compte remplace tout ce qui est sur ce téléphone. Tu veux une copie ' +
      `avant${NNBSP}? Exporte une sauvegarde dans Réglages → Sauvegarde et données.`,
    keepPhone: 'Garder les données de ce téléphone',
    useAccount: 'Utiliser les données de mon compte',
    otherAccount:
      'Ce téléphone contient les données d’un autre compte, il reste donc séparé de celui-ci. Pour le synchroniser, ' +
      'déconnecte-toi et connecte-toi avec ce compte-là. Pour utiliser ce compte ici à la place, supprime tout sur ' +
      `ce téléphone (Réglages → Sauvegarde et données)${NNBSP}; les modifications pas encore synchronisées sont perdues.`,
    tryAgain: 'Réessayer',
    problems: {
      unfinished:
        'Le dernier enregistrement de ton compte n’est pas allé au bout, et ce téléphone n’a pas de données pour le ' +
        'remplacer, il n’est donc pas encore associé.',
      unreadable:
        'Ton compte contient des données que cette app ne peut pas lire, ce téléphone n’est donc pas associé. Une ' +
        'mise à jour de l’app peut aider.',
      failed: 'Impossible d’associer ce téléphone à ton compte. Vérifie ta connexion et réessaie.',
      offline: 'Tu es hors ligne. Pour associer ce téléphone, il faut une connexion.',
    },
  },
};
