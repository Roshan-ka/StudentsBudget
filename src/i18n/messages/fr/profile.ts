import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// Le profil en français : Réglages → Profil, les vérifications de profile.ts et la note sur les frais de semestre.
// « Frais de semestre » est le nom des frais ponctuels proposés.
export const profile: Messages['profile'] = {
  heading: 'Profil',
  intro:
    'Ton profil est enregistré sur ce téléphone et figure dans chaque sauvegarde que tu exportes, ainsi que dans ton ' +
    'compte quand tu y enregistres.',
  name: 'Ton prénom',
  nameHint: 'Facultatif. L’accueil te salue avec ce prénom.',
  university: 'Université',
  notSet: 'Non renseigné',
  otherUniversity: 'Autre',
  semesterStart: 'Début du semestre',
  semesterEnd: 'Fin du semestre',
  weeks: (weeks) =>
    byCount(weeks, {
      one: `Ton semestre${NNBSP}: ${weeks} semaine.`,
      other: `Ton semestre${NNBSP}: ${weeks} semaines.`,
    }),
  period: (term, university, period) =>
    `${term} à ${university}${NNBSP}: ${period}. Modifie les dates si les tiennes diffèrent.`,
  winter: 'Semestre d’hiver',
  summer: 'Semestre d’été',
  save: 'Enregistrer le profil',
  clearDates: 'Effacer les dates du semestre',
  saved: 'Profil enregistré.',
  saveFailed: 'Impossible d’enregistrer ton profil. Réessaie.',
  problems: {
    both: 'Indique les deux dates du semestre, ou laisse les deux vides.',
    full: 'Saisis chaque date du semestre en entier.',
    year: 'Saisis l’année de chaque date du semestre sur quatre chiffres, comme 2026.',
    endAfterStart: 'Choisis une date de fin après la date de début.',
    tooLong: 'Un semestre dure un an au plus. Choisis une date de fin plus tôt.',
  },
  semesterFee: 'Frais de semestre',
  fee: {
    noFee: 'Aucune page n’indique encore les frais de ce semestre, c’est donc à toi de saisir le montant.',
    dueReRegistration: (month) => `À payer en ${month}, quand la réinscription doit ouvrir.`,
    dueBeforeSemester: (month) => `À payer en ${month}, le mois avant le début du semestre.`,
    reRegistration: 'réinscription',
  },
};
