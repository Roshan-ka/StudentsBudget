import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// Réglages → Import et export en français (import et export CSV, docs/superpowers/plans/2026-11-09-csv-import-export.md) :
// un relevé bancaire en entrée, les saisies en sortie dans un fichier pour tableur.
export const importExport: Messages['importExport'] = {
  summary: 'Importer un relevé bancaire ou exporter tes saisies',
  import: {
    heading: 'Importer un relevé bancaire',
    hint:
      'Télécharge un relevé au format CSV depuis le site ou l’appli de ta banque, puis choisis-le ici. Les relevés de ' +
      'Sparkasse, DKB, N26 et Revolut sont reconnus. Le fichier est lu sur ce téléphone seulement et n’est pas conservé.',
    file: 'Fichier du relevé (CSV)',
    noPlan: `Commence par configurer ton plan${NNBSP}: l’import compte chaque ligne dedans.`,
    toSetup: 'Aller à la configuration',
    reading: 'Lecture du fichier…',
    recognised: (bank, rows, from, to) =>
      `${bank}${NNBSP}: ${byCount(rows, { one: `${rows} ligne`, other: `${rows} lignes` })}, du ${from} au ${to}`,
    account: 'Importer dans',
    submit: 'Importer',
    choose: 'Choisir un autre fichier',
    problems: {
      tooBig: `Ce fichier est trop gros pour un relevé${NNBSP}: 2 Mo et 5${NNBSP}000 lignes au plus.`,
      empty: 'Ce fichier n’a aucune ligne que l’appli puisse lire.',
      creditCard: (bank) =>
        `C’est un export de carte de crédit ${bank}, que l’appli ne sait pas encore lire. Exporte plutôt le relevé de ton compte courant.`,
      failed: 'Impossible de lire le fichier.',
      noRate: (currency) =>
        `Il n’y a pas encore de taux de change pour ${currency}. Saisis-en un dans Réglages → Comptes et virements, puis importe à nouveau.`,
      noAccount: 'Ce compte n’existe plus. Choisis-en un autre.',
      saveFailed: 'Impossible d’enregistrer l’import.',
    },
  },
  match: {
    heading: `Quelle colonne contient quoi${NNBSP}?`,
    intro:
      `L’appli ne reconnaît pas les colonnes de ce fichier. Indique ce que contient chaque colonne${NNBSP}: elle retient ` +
      'ton choix pour le prochain fichier avec les mêmes colonnes.',
    remembered: 'Associé comme pour ton dernier fichier avec ces colonnes.',
    date: 'Date',
    dateOrder: 'Les dates sont écrites',
    orders: { dmy: 'Jour d’abord (31.10.2026)', ymd: 'Année d’abord (2026-10-31)', mdy: 'Mois d’abord (10/31/2026)' },
    amountKind: 'Le montant est',
    amountKinds: { one: 'Dans une colonne, avec un moins pour les sorties', two: `Dans deux colonnes${NNBSP}: débit et crédit` },
    amount: 'Montant',
    out: 'Débit (sorties)',
    in: 'Crédit (entrées)',
    payee: 'Qui a été payé, ou t’a payé',
    purpose: 'Détails (facultatif)',
    currency: 'Devise (facultatif)',
    none: 'Aucune',
    preview: 'Les premières lignes, telles que l’appli les lit',
    unreadable: 'Illisible avec ces colonnes',
    use: 'Utiliser ces colonnes',
    twice: 'Choisis une colonne différente pour chacun.',
    file: (rows, from, to) => `Ton fichier${NNBSP}: ${byCount(rows, { one: `${rows} ligne`, other: `${rows} lignes` })}, du ${from} au ${to}`,
  },
  result: {
    heading: 'Import terminé',
    added: (entries, transfers) => {
      const counted = byCount(entries, { one: `${entries} saisie ajoutée`, other: `${entries} saisies ajoutées` });
      return transfers === 0
        ? `${counted}.`
        : `${counted}, dont ${byCount(transfers, { one: `${transfers} virement`, other: `${transfers} virements` })}.`;
    },
    nothing: `Rien de nouveau${NNBSP}: chaque ligne était déjà dans l’appli, ou a été laissée de côté.`,
    opening: (account, amount) =>
      `Le solde de départ de ${account} a bougé de ${amount}${NNBSP}: certaines lignes datent d’avant l’ajout du compte, donc son solde d’aujourd’hui reste le même.`,
    skipped: (count) => `Laissées de côté (${count})`,
    reasons: {
      unreadable: 'Illisible',
      pending: 'Encore en attente à la banque',
      internal: 'Un mouvement interne à la banque',
      zero: 'Un montant nul',
      currency: 'Pas dans la devise du compte',
      future: 'Datée d’après aujourd’hui',
      beforePlan: 'D’avant le début de ton plan',
      otherCurrencyTransfer: 'Un virement vers un compte dans une autre devise',
      noTransferAccount: 'Aucun compte dans l’appli pour ce virement',
      duplicate: 'Déjà dans l’appli',
    },
    undo: 'Annuler cet import',
    undone: (count) =>
      `Import annulé${NNBSP}: ${byCount(count, { one: `${count} saisie retirée`, other: `${count} saisies retirées` })}.`,
    another: 'Importer un autre fichier',
  },
  export: {
    heading: 'Exporter vers un tableur',
    hint: 'Enregistre toutes les saisies dans un fichier CSV pour Excel, Numbers ou Google Sheets. Pour passer tes données sur un autre téléphone, utilise plutôt la sauvegarde.',
    empty: 'Aucune saisie à exporter pour l’instant.',
    button: 'Exporter les saisies',
    shareTitle: 'Saisies StudentsBudget',
    shared: 'Saisies partagées.',
    downloaded: (fileName) => `Téléchargement lancé${NNBSP}: ${fileName}`,
    shareFailed: 'Le menu de partage ne s’est pas ouvert. Tu peux télécharger le fichier à la place.',
    download: 'Télécharger',
    failed: 'Impossible d’exporter tes saisies.',
  },
  columns: { currency: 'Devise', eur: 'Montant en EUR' },
  transferTo: (account) => `Vers ${account}`,
};
