import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// L'onglet Conseils en français : conseils, réductions et les mots de la ligne d'économie. Les conseils, réductions et
// idées d'économie eux-mêmes sont du contenu de la ville ; leurs mots en français vont dans src/i18n/city/fr (chunk 15).
export const tips: Messages['tips'] = {
  tabsLabel: 'Conseils, réductions, astuces ou liste',
  tips: 'Conseils',
  discounts: 'Réductions',
  all: 'Tous',
  more: 'Plus',
  tipsIntro: 'Des façons locales de payer moins quand on est étudiant. Chaque conseil indique sa source.',
  tipsFor: 'Afficher les conseils pour',
  discountsIntro:
    'Réductions étudiantes à Regensburg. Chacune indique où elle est mentionnée. Dis à l’app si une réduction ' +
    `marche encore${NNBSP}: tes réponses sont enregistrées sur ce téléphone. Celles que tu confirmes remontent${NNBSP}; ` +
    'celles que tu marques comme expirées, ou qui n’ont pas été confirmées depuis 8 semaines, descendent.',
  discountsFor: 'Afficher les réductions pour',
  loadFailed: 'Impossible de charger les réductions. Réessaie plus tard.',
  votes: { works: 'Marche encore', outdated: 'Ne marche plus' },
  voteGroup: (place) => `${place}${NNBSP}: ça marche encore${NNBSP}?`,
  markedOutdated: (date) => `Tu as indiqué le ${date} que ça ne marche plus`,
  mayBeOutdated: 'Peut-être obsolète',
  lastConfirmed: (date) => `Confirmé pour la dernière fois le ${date}`,
  /** Ce que les autres étudiants ont confirmé ce semestre (P2.6), visible une fois connecté. */
  confirmations: (count) =>
    byCount(count, { one: `${count} confirmation ce semestre`, other: `${count} confirmations ce semestre` }),
  notWorking: (count) =>
    byCount(count, {
      one: `${count} personne dit que ça ne marche plus`,
      other: `${count} personnes disent que ça ne marche plus`,
    }),
  othersSignIn: 'Connecte-toi pour voir ce que les autres étudiants ont confirmé.',
  saved: 'Enregistré sur ce téléphone.',
  saveFailed: 'Impossible d’enregistrer ta réponse. Réessaie.',
  heard: {
    works: (place) => `${place}${NNBSP}: enregistré comme marchant encore.`,
    outdated: (place) => `${place}${NNBSP}: enregistré comme ne marchant plus.`,
    moves: (saved, direction) => `${saved} ${direction === 'up' ? 'Elle remonte' : 'Elle descend'} dans la liste.`,
    failed: (place) => `${place}${NNBSP}: impossible d’enregistrer ta réponse. Réessaie.`,
  },
  /** Le fil d’astuces : des astuces pour économiser, publiées par des étudiants. */
  checklist: {
    tab: 'Liste',
    intro:
      'Ce qu’il faut faire pendant tes premières semaines, et l’argent que tu peux peut-être demander. Chaque point dit ' +
      'd’où il vient. Tes coches sont enregistrées sur ce téléphone, et dans ton compte une fois le téléphone associé.',
    groups: { 'first-weeks': 'Premières semaines', money: 'Argent à demander' },
    who: { everyone: 'Tout le monde', 'from-abroad': 'Hors de l’UE', bafoeg: 'Avec le BAföG', 'under-25': 'Moins de 25 ans' },
    progress: (done: number, total: number) => `Fait${NNBSP}: ${done} sur ${total}`,
    mark: 'Fait',
    doneOn: (date: string) => `Fait le ${date}`,
    markNamed: (title: string) => `Fait${NNBSP}: ${title}`,
    seeTip: 'Voir le conseil',
    seeTipNamed: (title: string) => `Voir le conseil${NNBSP}: ${title}`,
    saveFailed: 'La coche n’a pas pu être enregistrée. Réessaie.',
  },
  hacks: {
    tab: 'Astuces',
    intro:
      'Des astuces pour économiser, publiées par des étudiants, avec leurs propres mots. L’app ne les vérifie ' +
      `pas${NNBSP}: les votes montrent ce qui a marché.`,
    signedOut: 'Connecte-toi pour lire et publier les astuces des étudiants.',
    toAccount: `Aller à «${NNBSP}Ton compte${NNBSP}»`,
    off:
      'Les publications des étudiants demandent un compte, et les comptes ne sont pas configurés dans cette ' +
      'version de l’app.',
    loading: 'Chargement des publications…',
    loadFailed: 'Les publications n’ont pas pu être chargées. Vérifie ta connexion et réessaie.',
    tryAgain: 'Réessayer',
    lastLoaded: (when) => `Affiché tel que chargé la dernière fois, ${when}.`,
    empty: 'Pas encore de publication.',
    postsFor: 'Afficher les publications pour',
    posts: 'Publications',
    cities: { regensburg: 'Regensburg', anywhere: 'Partout' },
    noName: 'Quelqu’un',
    yours: 'Ta publication',
    form: {
      open: 'Publier une astuce',
      heading: 'Publier une astuce',
      body: 'Ton astuce',
      bodyHint: 'Dis quoi, où et combien, si tu le sais. 10 à 500 caractères.',
      category: 'Catégorie',
      city: 'Où',
      link: 'Lien (facultatif)',
      linkHint: 'Une page qui le montre, commençant par https://',
      post: 'Publier',
      cancel: 'Annuler',
      posted: 'Publié.',
      nameFirst: 'Choisis d’abord le nom sous lequel tes publications paraissent.',
      errors: {
        short: 'Écris au moins 10 caractères.',
        long: 'Reste à 500 caractères au plus.',
        link: 'Donne un lien qui commence par https://, ou laisse le champ vide.',
        dailyLimit: 'Tu as publié 5 astuces en un jour. Publie à nouveau demain.',
        invalid: 'La publication n’a pas pu être enregistrée telle quelle. Vérifie le texte et le lien.',
        offline: 'Tu es hors ligne. Publier demande une connexion.',
        failed: 'La publication n’a pas pu être enregistrée. Réessaie.',
      },
    },
    delete: 'Supprimer',
    deleteQuestion: `Supprimer cette publication${NNBSP}? Plus personne ne la verra.`,
    keep: 'La garder',
    deleted: 'Publication supprimée.',
    deleteFailed: 'La publication n’a pas pu être supprimée. Réessaie.',
    vote: { group: 'Ton vote sur cette publication', up: 'Vote positif', worked: 'Ça a marché', outdated: 'Dépassé' },
    report: 'Signaler',
    which: (author, date) => (author === null ? `une publication du ${date}` : `la publication de ${author}, ${date}`),
    whichMine: (date) => `ta publication, ${date}`,
    named: (button, post) => `${button}${NNBSP}: ${post}`,
    reportQuestion:
      `Signaler cette publication${NNBSP}? Elle disparaît pour toi tout de suite, et pour tous quand assez ` +
      'd’étudiants la signalent.',
    reportCancel: 'Annuler',
    reported: 'Signalé. Tu ne verras plus cette publication.',
    gone: 'Cette publication n’existe plus.',
    voteFailed: 'Ton vote n’a pas pu être enregistré. Réessaie.',
    reportFailed: 'Le signalement n’a pas pu être envoyé. Réessaie.',
    moderation: {
      summary: 'Astuces signalées',
      intro:
        'Les publications que des étudiants ont signalées, le signalement le plus récent d’abord. Masquer retire ' +
        `une publication de tous les fils${NNBSP}; Garder la montre à nouveau et remet ses signalements à zéro.`,
      signedOut: 'Connecte-toi avec le compte de modération pour modérer.',
      notModerator: 'Cette page est pour la modération de l’app.',
      needsCode:
        'Modérer demande une session qui a donné le code de l’appli d’authentification. Active la validation en ' +
        `deux étapes dans «${NNBSP}Ton compte${NNBSP}», puis reconnecte-toi avec le code.`,
      loading: 'Chargement des publications signalées…',
      loadFailed: 'Les publications signalées n’ont pas pu être chargées.',
      tryAgain: 'Réessayer',
      empty: 'Aucune publication signalée.',
      queue: 'Publications signalées',
      reports: (count) =>
        byCount(count, {
          one: `${count} signalement depuis la dernière fois qu’elle a été gardée`,
          other: `${count} signalements depuis la dernière fois qu’elle a été gardée`,
        }),
      states: { hand: 'Masquée par toi', reports: 'Masquée par les signalements', visible: 'Visible' },
      hide: 'Masquer',
      keep: 'Garder',
      hidden: 'Retirée de tous les fils.',
      kept: `Gardée${NNBSP}: elle s’affiche à nouveau.`,
      failed: 'Ça n’a pas marché. Réessaie.',
    },
    comments: {
      toggle: (count) => (count === 0 ? 'Commentaires' : `Commentaires (${count})`),
      list: 'Commentaires',
      loading: 'Chargement des commentaires…',
      loadFailed: 'Les commentaires n’ont pas pu être chargés. Réessaie plus tard.',
      none: 'Pas encore de commentaire.',
      body: 'Ton commentaire',
      bodyHint: 'De 3 à 300 caractères. Tous les étudiants qui ont un compte peuvent le lire.',
      post: 'Commenter',
      posted: 'Commentaire publié.',
      yours: 'Ton commentaire',
      nameFirst: `Choisis d’abord le nom de tes publications${NNBSP}: Réglages → Ton compte → Ton nom sur les publications.`,
      errors: {
        short: 'Écris au moins 3 caractères.',
        long: 'Reste à 300 caractères au plus.',
        dailyLimit: 'Tu as écrit 20 commentaires en une journée. Commente de nouveau demain.',
        gone: 'Cette publication n’existe plus.',
        invalid: 'Le commentaire n’a pas pu être enregistré tel quel. Vérifie le texte.',
        offline: 'Tu es hors ligne. Pour commenter, il faut une connexion.',
        failed: 'Le commentaire n’a pas pu être enregistré. Réessaie.',
      },
      which: (author, date) => (author === null ? `un commentaire du ${date}` : `le commentaire de ${author}, ${date}`),
      whichMine: (date) => `ton commentaire, ${date}`,
      deleteQuestion: `Supprimer ce commentaire${NNBSP}? Plus personne ne le verra.`,
      deleted: 'Commentaire supprimé.',
      deleteFailed: 'Le commentaire n’a pas pu être supprimé. Réessaie.',
      reportQuestion: `Signaler ce commentaire${NNBSP}? Il disparaît aussitôt pour toi, et pour tout le monde dès que assez d’étudiants le signalent.`,
      reported: 'Signalé. Tu ne verras plus ce commentaire.',
      reportFailed: 'Le signalement n’a pas pu être envoyé. Réessaie.',
    },
    translate: 'Traduire',
    counts: (ups, worked, outdated) =>
      `Votes${NNBSP}: ${ups} · A marché${NNBSP}: ${worked} · Dépassé${NNBSP}: ${outdated}`,
  },
  swap: {
    line: (title, saving, per) => `Essaie ça${NNBSP}: ${title} · économise environ ${saving} par ${per}`,
    estimate: (line) => `${line} (estimation)`,
    details: (title) => `Détails${NNBSP}: ${title}`,
    sources: 'D’où viennent ces chiffres',
    sourceOf: (amount) => `D’où viennent ${amount}`,
    relatedTip: 'Conseil lié',
  },
};
