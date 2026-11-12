import type { Messages } from '../en';

// Le cadre de l'app en français : la navigation du bas et les titres des pages (plan 2, chunk 10).
export const shell: Messages['shell'] = {
  // 9 caractères au plus : cinq tiennent côte à côte à 375 px. « Graphiques » est trop long, d'où « Graphes ».
  nav: {
    home: 'Accueil',
    entries: 'Saisies',
    charts: 'Graphes',
    tips: 'Conseils',
    settings: 'Réglages',
  },
  navLabel: 'Menu principal',
  backToSettings: 'Retour aux réglages',
  backToSetup: 'Retour à la configuration',
  headings: {
    home: 'Accueil',
    plan: 'Plan',
    profile: 'Profil',
    appearance: 'Apparence',
    accounts: 'Comptes et virements',
    backup: 'Sauvegarde et données',
    importExport: 'Import et export',
    moderation: 'Modération',
    reminder: 'Rappel hebdomadaire',
    badges: 'Badges',
    charts: 'Graphiques',
    checkIn: 'Bilan hebdomadaire',
    entries: 'Saisies',
    newEntry: 'Nouvelle saisie',
    reveal: 'Mois par mois',
    account: 'Ton compte',
    start: 'Bienvenue',
    ask: 'Questions',
    settings: 'Réglages',
    tips: 'Conseils et réductions à Regensburg',
    privacy: 'Politique de confidentialité',
    impressum: 'Mentions légales (Impressum)',
  },
};
