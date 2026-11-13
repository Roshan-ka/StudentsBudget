import type { Messages } from '../en';
import { byCount, NNBSP } from './count';

// La connexion et la sécurité en français : auth-errors.ts et credentials.ts, le formulaire, l'étape du code, la vue
// une fois connecté (account-view.tsx), Connexion et sécurité, la validation en deux étapes et les clés d'accès.
// « Session ouverte » plutôt que « connecté », qui obligerait à choisir un genre.
export const auth: Messages['auth'] = {
  errors: {
    invalidCredentials: 'E-mail ou mot de passe incorrect.',
    accountExists: 'Cet e-mail a déjà un compte. Connecte-toi plutôt.',
    weakPassword: 'Ce mot de passe est trop facile à deviner. Choisis-en un plus long.',
    checkEmail: 'Vérifie l’adresse e-mail. Il faut un @ et un domaine, comme nom@exemple.com.',
    signupDisabled: 'La création de comptes est désactivée pour l’instant.',
    emailDisabled: 'La connexion par e-mail est désactivée pour l’instant.',
    notConfirmed: 'Ce compte doit encore être confirmé avec le code reçu par e-mail.',
    tooMany: 'Trop de tentatives. Attends une minute, puis réessaie.',
    codeWrongOrExpired: 'Ce code est faux ou a expiré. Regarde le dernier e-mail, ou demande un nouveau code.',
    waitForCode: 'Trop d’e-mails pour l’instant. Attends une minute, puis demande un nouveau code.',
    emailNotSent: 'L’e-mail n’a pas pu être envoyé. Réessaie plus tard.',
    samePassword: 'C’est ton mot de passe actuel. Choisis-en un autre.',
    codeFailed: `Ce code n’a pas marché. Les codes changent toutes les 30 secondes${NNBSP}: saisis le plus récent.`,
    codeExpired: 'Ça a pris un peu trop de temps. Saisis le code le plus récent de ton appli d’authentification.',
    factorGone: 'La validation en deux étapes a été désactivée pour ce compte. Déconnecte-toi, puis reconnecte-toi.',
    setupOpen: 'Une configuration précédente est encore ouverte. Réessaie.',
    enrollOff: 'La validation en deux étapes ne peut pas être activée pour l’instant.',
    verifyOff: 'Les codes ne peuvent pas être vérifiés pour l’instant. Réessaie plus tard.',
    connectionChanged:
      'Ta connexion a changé pendant la vérification du code. Saisis de nouveau le code le plus récent.',
    signInAgain: 'Déconnecte-toi, reconnecte-toi avec ton code, puis réessaie.',
    tooManyPasskeys: 'Ton compte a autant de clés d’accès qu’il peut en garder. Retires-en une d’abord.',
    passkeyOnAccount: 'Cette clé d’accès est déjà sur ton compte.',
    passkeyExpired: 'Ça a pris un peu trop de temps. Réessaie.',
    passkeyOnDevice: 'Cet appareil a déjà une clé d’accès pour ton compte.',
    unreachable: 'Le serveur des comptes est injoignable. Vérifie ta connexion et réessaie.',
    sessionEnded: 'Cette session est terminée. Déconnecte-toi, puis reconnecte-toi.',
    general: 'Un problème est survenu. Réessaie.',
  },
  unavailable: {
    disabled: 'Les clés d’accès sont désactivées pour l’instant.',
    wrongSite: 'Les clés d’accès ne fonctionnent pas sur cette copie de l’app.',
  },
  passkeyUnavailable: (reason) => `${reason} Connecte-toi avec ton e-mail et ton mot de passe.`,
  passkeyFailed: 'Cette clé d’accès n’a pas marché. Réessaie, ou connecte-toi avec ton e-mail et ton mot de passe.',
  offline: 'Tu es hors ligne. Pour te connecter, il faut une connexion.',
  check: {
    enterEmail: 'Saisis ton e-mail.',
    enterPassword: 'Saisis ton mot de passe.',
    shortPassword: (min) => `Utilise au moins ${min} caractères pour le mot de passe.`,
    code: 'Saisis le code à 6 chiffres de ton appli d’authentification.',
    emailCode: 'Saisis le code à 6 chiffres reçu par e-mail.',
  },
  view: {
    off: 'Les comptes ne sont pas configurés sur cette copie de l’app. Tout reste sur ce téléphone.',
    checking: 'Vérification de ton compte…',
  },
  signIn: {
    headingSignIn: 'Se connecter',
    headingCreate: 'Créer un compte',
    optional: 'Facultatif. Sans compte, tout reste sur ce téléphone.',
    iosHint:
      `Sur iPhone, connecte-toi dans l’app de l’écran d’accueil${NNBSP}: Safari et l’app gardent des données et ` +
      'des sessions séparées.',
    email: 'E-mail',
    password: 'Mot de passe',
    minLength: (min) => `Au moins ${min} caractères.`,
    signIn: 'Se connecter',
    create: 'Créer le compte',
    toSignIn: `Tu as un compte${NNBSP}? Connecte-toi`,
    toCreate: `Pas encore de compte${NNBSP}? Crée-en un`,
    forgot: `Mot de passe oublié${NNBSP}?`,
    /** À la création : le nom du premier groupe ; le second est postingName.heading. */
    details: 'Identifiants de connexion',
    /** La ligne entre le formulaire et la clé d’accès. */
    or: 'ou',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
  },
  /** Le code de l’e-mail après la création d’un compte (P2.4). L’adresse est en gras au milieu de la phrase. */
  confirm: {
    heading: 'Confirme ton adresse e-mail',
    prompt: { before: 'Saisis le code à 6 chiffres envoyé à ', after: '. Il est valable 60 minutes.' },
    code: 'Code à 6 chiffres',
    confirm: 'Confirmer',
    sendAgain: 'Envoyer un nouveau code',
    resent: 'Un nouveau code est en route. Utilise le plus récent.',
    back: 'Retour',
  },
  /** « Mot de passe oublié » (P2.4) : l’e-mail, puis son code. L’adresse est en gras au milieu de la phrase. */
  reset: {
    heading: 'Réinitialiser ton mot de passe',
    intro: 'Saisis l’adresse e-mail de ton compte, et nous lui enverrons un code à 6 chiffres.',
    send: 'Envoyer le code',
    prompt: { before: 'Si ', after: ' a un compte, nous lui avons envoyé un code à 6 chiffres. Il est valable 60 minutes.' },
    code: 'Code à 6 chiffres',
    confirm: 'Continuer',
    sendAgain: 'Envoyer un nouveau code',
    resent: 'Un nouveau code est en route. Utilise le plus récent.',
    back: 'Retour',
  },
  /** La dernière étape de « Mot de passe oublié » : connecté avec le code, un nouveau mot de passe la termine. */
  newPassword: {
    heading: 'Choisis un nouveau mot de passe',
    prompt: { before: 'Session ouverte avec ', after: ' grâce au code de ton e-mail. Choisis un nouveau mot de passe pour terminer.' },
    password: 'Nouveau mot de passe',
    save: 'Enregistrer le mot de passe',
    signOut: 'Se déconnecter',
  },
  secondStep: {
    heading: 'Validation en deux étapes',
    prompt: { before: 'Saisis le code de ton appli d’authentification pour ', after: '.' },
    ended: {
      before: 'Cette connexion pour ',
      after: ' est terminée, peut-être parce qu’elle a été achevée sur un autre appareil.',
    },
    signInAgain: 'Se reconnecter',
    code: 'Code à 6 chiffres',
    continue: 'Continuer',
    otherAccount: 'Utiliser un autre compte',
  },
  signedIn: {
    heading: 'Session ouverte',
    as: { before: 'Session ouverte avec ', after: '.' },
    keeps:
      'Te déconnecter synchronise d’abord, puis supprime tes données de ce téléphone. Ton compte te les rend à la prochaine connexion.',
    signOut: 'Se déconnecter',
    syncing: 'Synchronisation, puis déconnexion…',
    confirm: `Te déconnecter de ce téléphone${NNBSP}?`,
    cancel: 'Annuler',
    unsynced: (count) =>
      byCount(count, {
        one: `${count} modification n’est pas encore dans ton compte.`,
        other: `${count} modifications ne sont pas encore dans ton compte.`,
      }),
    unsyncedOffline:
      'Tu n’as pas de connexion. Garde ta session ouverte et synchronise plus tard, ou déconnecte-toi et perds ces modifications.',
    unsyncedFailed:
      'Elles n’ont pas pu être envoyées. Garde ta session ouverte et synchronise plus tard, ou déconnecte-toi et perds ces modifications.',
    stay: 'Garder ma session ouverte',
    signOutAnyway: 'Me déconnecter et les perdre',
    wipeFailed:
      'Ta session est fermée, mais tes données n’ont pas pu être supprimées de ce téléphone. Supprime-les dans Sauvegarde et données.',
    passwordChanged: 'Mot de passe modifié.',
  },
  /** Réglages → Ton compte → Supprimer mon compte (P2.5). Le mot à saisir est celui de Sauvegarde. */
  deleteAccount: {
    heading: 'Supprimer mon compte',
    intro:
      `Supprime ton compte et tout ce qu’il garde, définitivement${NNBSP}: c’est irréversible. Les données de ce ` +
      'téléphone restent, tout comme celles de tes autres téléphones, qui ne sont plus associés.',
    backup: 'Exporter d’abord une sauvegarde',
    password: 'Mot de passe',
    code: 'Code à 6 chiffres',
    codeNeeded: `Ton compte a la validation en deux étapes${NNBSP}: saisis aussi le code de ton appli d’authentification.`,
    button: 'Supprimer mon compte',
    deleting: 'Suppression de ton compte…',
    failed: 'Impossible de supprimer ton compte. Réessaie.',
    done: 'Ton compte est supprimé. Tout ce qui est sur ce téléphone reste.',
  },
  security: {
    heading: 'Connexion et sécurité',
    intro:
      'Tu peux toujours te connecter avec ton mot de passe. Une clé d’accès est un moyen plus rapide. Avec la ' +
      'validation en deux étapes activée, un code de ton appli d’authentification suit l’un comme l’autre, si bien ' +
      'qu’un mot de passe volé n’ouvre rien à lui seul.',
  },
  twoStep: {
    heading: 'Validation en deux étapes',
    badges: { on: 'Activée', off: 'Désactivée', settingUp: 'En configuration' },
    offline: 'Tu es hors ligne. Pour activer ou désactiver la validation en deux étapes, il faut une connexion.',
    checking: 'Vérification de la validation en deux étapes…',
    unknown: 'Impossible de vérifier si la validation en deux étapes est activée.',
    tryAgain: 'Réessayer',
    offIntro:
      'Active-la et la connexion demandera aussi un code à 6 chiffres d’une appli d’authentification, comme Google ' +
      'Authenticator, Microsoft Authenticator ou 2FAS, si bien que ton mot de passe seul n’ouvre plus ton compte.',
    turnOn: 'Activer',
    setupIntro: 'Ajoute StudentsBudget à ton appli d’authentification, puis saisis le code qu’elle affiche.',
    restarted:
      'Cela relance la configuration. Si ton appli d’authentification a déjà une entrée StudentsBudget de la ' +
      `configuration inachevée, supprime-la${NNBSP}: ses codes ne marcheront pas.`,
    openApp: 'Ouvrir dans l’appli d’authentification',
    typeKey: `Ou saisis cette clé dans l’appli${NNBSP}:`,
    scan: `Ou scanne ce code depuis un autre appareil${NNBSP}:`,
    qrAlt: 'QR code pour l’appli d’authentification',
    keepKey:
      'Note la clé et garde-la en lieu sûr, loin de ce téléphone. Si tu perds ton appli d’authentification, saisir ' +
      'la clé dans une nouvelle donne les mêmes codes. Les données de ce téléphone restent de toute façon.',
    code: 'Code à 6 chiffres',
    cancel: 'Annuler',
    onIntro: 'La connexion demande le code de ton appli d’authentification.',
    lostApp:
      `Appli perdue${NNBSP}? Si tu as noté la clé, la saisir dans une nouvelle appli d’authentification donne les ` +
      'mêmes codes.',
    turnOff: 'Désactiver',
    confirmOff:
      `Désactiver la validation en deux étapes${NNBSP}? Ton mot de passe seul ouvrira de nouveau ton compte. Tu ` +
      'pourras ensuite supprimer l’entrée StudentsBudget de ton appli d’authentification.',
    alreadyOn: 'La validation en deux étapes est déjà activée.',
    isOn: 'La validation en deux étapes est activée.',
    isOff: 'La validation en deux étapes est désactivée.',
    setupCancelled: 'Configuration annulée.',
    cancelledElsewhere:
      'Cette configuration a été annulée, peut-être depuis un autre téléphone. Touche Activer pour recommencer.',
  },
  /** Ton compte → Fonctions d’IA (phase IA, chunk 5) : l’interrupteur de ce téléphone, activé au départ. */
  ai: {
    heading: 'Fonctions d’IA',
    use: 'Utiliser les fonctions d’IA sur ce téléphone',
    hint:
      'Elles envoient ce que tu écris à Groq, un service d’IA aux États-Unis, dans la limite d’un quota quotidien ' +
      'pour ton compte. Désactivées, rien ne part chez Groq, et l’Ajout rapide lit tes lignes sur ce téléphone.',
  },
  /** Le nom sous lequel on publie dans le fil d’astuces : demandé à la création du compte, modifiable ensuite. */
  postingName: {
    heading: 'Ton nom sur les publications',
    intro: 'Les autres étudiants le voient à côté de tes publications. Ton adresse e-mail reste cachée.',
    username: 'Nom d’utilisateur',
    usernameHint: `3 à 20 caractères${NNBSP}: lettres a–z, chiffres ou _. Les autres le voient comme @nom.`,
    label: 'Tu es',
    labels: { student: 'En études', graduate: 'Diplômé·e', alumni: 'Alumni' },
    batch: 'Promo (facultatif)',
    batchHint: 'L’année où tu finis ou as fini, par exemple 2027.',
    batchShort: (year) => `Promo ${year}`,
    none: 'Pas encore de nom. Choisis-en un maintenant, ou avant ta première publication.',
    loading: 'Vérification de ton nom…',
    loadFailed: 'Ton nom sur les publications n’a pas pu être lu. Réessaie plus tard.',
    pick: 'Choisir un nom',
    change: 'Modifier',
    save: 'Enregistrer le nom',
    cancel: 'Annuler',
    saved: 'Nom enregistré.',
    errors: {
      empty: 'Saisis un nom d’utilisateur.',
      characters: 'Utilise seulement des lettres a–z, des chiffres et _ dans le nom d’utilisateur.',
      short: 'Le nom d’utilisateur doit avoir au moins 3 caractères.',
      long: 'Le nom d’utilisateur peut avoir au plus 20 caractères.',
      reserved: 'Ce nom d’utilisateur est réservé à l’app. Choisis-en un autre.',
      taken: 'Ce nom d’utilisateur est déjà pris. Choisis-en un autre.',
      batch: 'Saisis la promo comme une année, par exemple 2027.',
      checkFailed: 'Le nom d’utilisateur n’a pas pu être vérifié. Vérifie ta connexion et réessaie.',
      saveFailed: 'Ton nom n’a pas pu être enregistré. Réessaie.',
    },
  },
  /** Connexion et sécurité → Mot de passe : le nouveau ; l’actuel seulement si cette session a commencé avec. */
  changePassword: {
    heading: 'Mot de passe',
    intro:
      `Change le mot de passe avec lequel tu te connectes. Oublié${NNBSP}? Connecte-toi avec une clé d’accès, et tu ` +
      'pourras en choisir un nouveau ici sans l’ancien.',
    open: 'Changer le mot de passe',
    current: 'Mot de passe actuel',
    next: 'Nouveau mot de passe',
    save: 'Enregistrer le mot de passe',
    cancel: 'Annuler',
    changed: 'Mot de passe modifié.',
    wrongCurrent: 'Ce n’est pas ton mot de passe actuel.',
  },
  passkeys: {
    heading: 'Clés d’accès',
    count: (count) =>
      count === 0
        ? 'Aucune pour l’instant'
        : byCount(count, { one: `${count} clé d’accès`, other: `${count} clés d’accès` }),
    intro:
      'Connecte-toi avec Face ID, une empreinte ou le code de ton téléphone au lieu de ton mot de passe. La clé ' +
      `d’accès reste avec toi, sur ton téléphone ou dans ton gestionnaire de mots de passe${NNBSP}; ton compte garde ` +
      'sa clé publique, qui ne permet à personne de se connecter.',
    offline: 'Tu es hors ligne. Les clés d’accès ont besoin d’une connexion.',
    signIn: 'Se connecter avec une clé d’accès',
    checking: 'Vérification de tes clés d’accès…',
    unknown: 'Impossible de charger tes clés d’accès.',
    tryAgain: 'Réessayer',
    unnamed: 'Clé d’accès',
    added: (dateTime) => `Ajoutée le ${dateTime}`,
    lastUsed: (day) => `${NNBSP}; utilisée pour la dernière fois le ${day}`,
    removeOne: (name, dateTime) => `Retirer ${name}, ajoutée le ${dateTime}`,
    remove: 'Retirer',
    removeQuestion:
      `Retirer cette clé d’accès${NNBSP}? Elle ne te connectera plus${NNBSP}; ton mot de passe et toute autre clé ` +
      'd’accès continuent de fonctionner. Tu pourras ensuite la supprimer aussi de ton téléphone ou de ton ' +
      'gestionnaire de mots de passe.',
    cancel: 'Annuler',
    add: 'Ajouter une clé d’accès',
    unsupported: 'Ce navigateur ne peut pas créer de clés d’accès.',
    addFailed: 'Impossible d’ajouter la clé d’accès. Réessaie.',
    removeFailed: 'Impossible de retirer la clé d’accès. Réessaie.',
    addedStatus: 'Clé d’accès ajoutée.',
    removedStatus: 'Clé d’accès retirée.',
  },
};
