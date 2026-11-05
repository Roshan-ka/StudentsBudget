import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// Les textes partagés par plusieurs zones : le champ de date, le champ de montant, la source d'une fourchette, les
// décomptes.
export const common: Messages['common'] = {
  dateField: {
    label: 'Date',
    pickDay: 'Choisis un jour',
    today: 'Aujourd’hui',
    yesterday: 'Hier',
    letters: { day: 'J', month: 'M', year: 'A' },
  },
  amountField: {
    positive: 'Saisis un montant supérieur à 0, comme 250 ou 12,50.',
    number: 'Saisis un nombre, comme 250 ou 12,50.',
    overdrawn: 'À découvert (sous zéro)',
  },
  source: {
    label: 'Source',
    of: (what) => `Source${NNBSP}: ${what}`,
    checked: (date) => `vérifié le ${date}`,
  },
  accountOption: (name, currency) => `${name} (${currency})`,
  counts: {
    accounts: (count) => byCount(count, { one: `${count} compte`, other: `${count} comptes` }),
    entries: (count) => byCount(count, { one: `${count} saisie`, other: `${count} saisies` }),
    plan: 'ton plan',
  },
  estimate: 'Estimation',
  /** Notes uniques sur les données (`PrivacyNote`), une fois par téléphone, avant le premier envoi d’une fonction. */
  privacy: {
    label: 'À propos de tes données',
    continue: 'Continuer',
    cancel: 'Annuler',
    account:
      `Ton compte est gardé par Supabase, à Francfort (UE)${NNBSP}: ton adresse e-mail, ton mot de passe (stocké ` +
      'seulement sous forme de hachage), la langue de ton téléphone et une copie des données que tu synchronises. ' +
      'Si le compte a besoin d’un code, pour le confirmer ou pour un nouveau mot de passe, il arrive par e-mail. ' +
      'Tu peux supprimer le compte à tout moment dans les Réglages.',
    passkey:
      'Le gestionnaire de mots de passe de ton téléphone garde la clé d’accès et peut la synchroniser avec tes ' +
      'autres appareils (le trousseau iCloud ou le Gestionnaire de mots de passe de Google, par exemple). Ton ' +
      'compte ne garde que sa clé publique, qui ne permet à personne de se connecter.',
    rates:
      'Tant qu’un compte utilise une autre devise que l’euro, l’app demande à Frankfurter (frankfurter.dev) le ' +
      'taux de la Banque centrale européenne, au plus une fois par jour. Elle n’envoie que les codes des ' +
      `devises${NNBSP}; comme tout site web, Frankfurter voit l’adresse internet de ton téléphone.`,
    votes:
      'Avec un compte, tes votes y vont quand tu synchronises, et comptent dans les totaux que les autres ' +
      'étudiants voient pour ce semestre. Personne ne voit qui a voté.',
  },
};
