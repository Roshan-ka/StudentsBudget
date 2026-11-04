import type { Messages } from '../en';

// Anmeldung und Sicherheit auf Deutsch: auth-errors.ts und credentials.ts, das Anmeldeformular, der Code-Schritt, die
// Ansicht nach dem Anmelden (account-view.tsx), Anmeldung und Sicherheit, zweistufige Anmeldung und Passkeys.
export const auth: Messages['auth'] = {
  errors: {
    invalidCredentials: 'E-Mail oder Passwort stimmt nicht.',
    accountExists: 'Für diese E-Mail gibt es schon ein Konto. Melde dich stattdessen an.',
    weakPassword: 'Dieses Passwort ist zu leicht zu erraten. Wähle ein längeres.',
    checkEmail: 'Prüf die E-Mail-Adresse.',
    signupDisabled: 'Neue Konten sind gerade abgeschaltet.',
    emailDisabled: 'Die Anmeldung per E-Mail ist gerade abgeschaltet.',
    notConfirmed: 'Dieses Konto muss erst mit dem Code aus seiner E-Mail bestätigt werden.',
    tooMany: 'Zu viele Versuche. Warte eine Minute und versuch es dann noch einmal.',
    codeWrongOrExpired: 'Dieser Code ist falsch oder abgelaufen. Schau in die neueste E-Mail oder lass dir einen neuen Code schicken.',
    waitForCode: 'Gerade zu viele E-Mails. Warte eine Minute und lass dir dann einen neuen Code schicken.',
    emailNotSent: 'Die E-Mail konnte nicht gesendet werden. Versuch es später noch einmal.',
    samePassword: 'Das ist dein aktuelles Passwort. Wähle ein anderes.',
    codeFailed: 'Dieser Code hat nicht funktioniert. Codes ändern sich alle 30 Sekunden: Gib den neuesten ein.',
    codeExpired: 'Das hat etwas zu lange gedauert. Gib den neuesten Code aus deiner Authenticator-App ein.',
    factorGone: 'Die zweistufige Anmeldung wurde für dieses Konto ausgeschaltet. Melde dich ab und wieder an.',
    setupOpen: 'Eine frühere Einrichtung ist noch offen. Versuch es noch einmal.',
    enrollOff: 'Die zweistufige Anmeldung lässt sich gerade nicht einschalten.',
    verifyOff: 'Codes lassen sich gerade nicht prüfen. Versuch es später noch einmal.',
    connectionChanged: 'Deine Verbindung hat sich beim Prüfen des Codes geändert. Gib den neuesten Code noch einmal ein.',
    signInAgain: 'Melde dich ab, mit deinem Code wieder an und versuch es dann noch einmal.',
    tooManyPasskeys: 'Dein Konto hat so viele Passkeys, wie es behalten kann. Entferne zuerst einen.',
    passkeyOnAccount: 'Dieser Passkey ist schon in deinem Konto.',
    passkeyExpired: 'Das hat etwas zu lange gedauert. Versuch es noch einmal.',
    passkeyOnDevice: 'Dieses Gerät hat schon einen Passkey für dein Konto.',
    unreachable: 'Der Kontoserver ist nicht erreichbar. Prüf deine Verbindung und versuch es noch einmal.',
    sessionEnded: 'Diese Anmeldung ist beendet. Melde dich ab und wieder an.',
    general: 'Etwas ist schiefgelaufen. Versuch es noch einmal.',
  },
  unavailable: {
    disabled: 'Passkeys sind gerade abgeschaltet.',
    wrongSite: 'Passkeys funktionieren in dieser Kopie der App nicht.',
  },
  passkeyUnavailable: (reason) => `${reason} Melde dich mit deiner E-Mail und deinem Passwort an.`,
  passkeyFailed: 'Dieser Passkey hat nicht funktioniert. Versuch es noch einmal oder melde dich mit E-Mail und Passwort an.',
  offline: 'Du bist offline. Zum Anmelden braucht es eine Verbindung.',
  check: {
    enterEmail: 'Gib deine E-Mail ein.',
    enterPassword: 'Gib dein Passwort ein.',
    shortPassword: (min) => `Nimm für das Passwort mindestens ${min} Zeichen.`,
    code: 'Gib den 6-stelligen Code aus deiner Authenticator-App ein.',
    emailCode: 'Gib den 6-stelligen Code aus der E-Mail ein.',
  },
  view: {
    off: 'Konten sind in dieser Kopie der App nicht eingerichtet. Alles bleibt auf diesem Handy.',
    checking: 'Dein Konto wird geprüft …',
  },
  signIn: {
    headingSignIn: 'Anmelden',
    headingCreate: 'Konto erstellen',
    optional: 'Freiwillig. Ohne Konto bleibt alles auf diesem Handy.',
    iosHint:
      'Auf dem iPhone meldest du dich in der App auf dem Home-Bildschirm an: Safari und die App haben getrennte Daten ' +
      'und Anmeldungen.',
    email: 'E-Mail',
    password: 'Passwort',
    minLength: (min) => `Mindestens ${min} Zeichen.`,
    signIn: 'Anmelden',
    create: 'Konto erstellen',
    toSignIn: 'Schon ein Konto? Anmelden',
    toCreate: 'Neu hier? Konto erstellen',
    forgot: 'Passwort vergessen?',
  },
  /** Der Code aus der E-Mail nach dem Erstellen eines Kontos (P2.4). Die E-Mail-Adresse steht fett mitten im Satz. */
  confirm: {
    heading: 'E-Mail-Adresse bestätigen',
    prompt: { before: 'Gib den 6-stelligen Code ein, den wir an ', after: ' geschickt haben. Er gilt 60 Minuten.' },
    code: '6-stelliger Code',
    confirm: 'Bestätigen',
    sendAgain: 'Neuen Code senden',
    resent: 'Ein neuer Code ist unterwegs. Nimm den neuesten.',
    back: 'Zurück',
  },
  /** „Passwort vergessen“ (P2.4): die E-Mail-Adresse, dann ihr Code. Die Adresse steht fett mitten im Satz. */
  reset: {
    heading: 'Passwort zurücksetzen',
    intro: 'Gib die E-Mail-Adresse deines Kontos ein, dann schicken wir ihr einen 6-stelligen Code.',
    send: 'Code senden',
    prompt: { before: 'Wenn ', after: ' ein Konto hat, haben wir dorthin einen 6-stelligen Code geschickt. Er gilt 60 Minuten.' },
    code: '6-stelliger Code',
    confirm: 'Weiter',
    sendAgain: 'Neuen Code senden',
    resent: 'Ein neuer Code ist unterwegs. Nimm den neuesten.',
    back: 'Zurück',
  },
  /** Der letzte Schritt von „Passwort vergessen“: mit dem Code angemeldet, ein neues Passwort schließt ab. */
  newPassword: {
    heading: 'Neues Passwort wählen',
    prompt: { before: 'Angemeldet als ', after: ' mit dem Code aus deiner E-Mail. Wähle zum Abschluss ein neues Passwort.' },
    password: 'Neues Passwort',
    save: 'Passwort speichern',
    signOut: 'Abmelden',
  },
  secondStep: {
    heading: 'Zweistufige Anmeldung',
    prompt: { before: 'Gib den Code aus deiner Authenticator-App für ', after: ' ein.' },
    ended: {
      before: 'Diese Anmeldung für ',
      after: ' ist beendet, vielleicht weil sie auf einem anderen Gerät abgeschlossen wurde.',
    },
    signInAgain: 'Wieder anmelden',
    code: '6-stelliger Code',
    continue: 'Weiter',
    otherAccount: 'Anderes Konto nutzen',
  },
  signedIn: {
    heading: 'Angemeldet',
    as: { before: 'Angemeldet als ', after: '.' },
    keeps: 'Beim Abmelden bleiben deine Daten auf diesem Handy.',
    signOut: 'Abmelden',
    syncing: 'Wird synchronisiert, dann abgemeldet …',
    passwordChanged: 'Passwort geändert.',
  },
  /** Einstellungen → Dein Konto → Mein Konto löschen (P2.5). Das Wort zum Eintippen ist das von Backup. */
  deleteAccount: {
    heading: 'Mein Konto löschen',
    intro:
      'Löscht dein Konto und alles, was es speichert, endgültig: Das lässt sich nicht rückgängig machen. Die Daten ' +
      'auf diesem Handy bleiben, ebenso die auf deinen anderen Handys; sie sind dann nicht mehr verknüpft.',
    backup: 'Vorher ein Backup exportieren',
    password: 'Passwort',
    code: '6-stelliger Code',
    codeNeeded: 'Dein Konto hat die zweistufige Anmeldung: Gib auch den Code aus deiner Authenticator-App ein.',
    button: 'Mein Konto löschen',
    deleting: 'Dein Konto wird gelöscht …',
    failed: 'Dein Konto konnte nicht gelöscht werden. Versuch es noch einmal.',
    done: 'Dein Konto ist gelöscht. Alles auf diesem Handy bleibt.',
  },
  security: {
    heading: 'Anmeldung und Sicherheit',
    intro:
      'Mit deinem Passwort kannst du dich immer anmelden. Ein Passkey ist der schnellere Weg. Ist die zweistufige ' +
      'Anmeldung an, folgt auf beides ein Code aus deiner Authenticator-App, sodass ein gestohlenes Passwort allein ' +
      'nichts öffnet.',
  },
  twoStep: {
    heading: 'Zweistufige Anmeldung',
    badges: { on: 'An', off: 'Aus', settingUp: 'Wird eingerichtet' },
    offline: 'Du bist offline. Zum Ein- oder Ausschalten der zweistufigen Anmeldung braucht es eine Verbindung.',
    checking: 'Zweistufige Anmeldung wird geprüft …',
    unknown: 'Es ließ sich nicht prüfen, ob die zweistufige Anmeldung an ist.',
    tryAgain: 'Noch einmal versuchen',
    offIntro:
      'Schalte sie ein, und die Anmeldung fragt zusätzlich nach einem 6-stelligen Code aus einer Authenticator-App ' +
      'wie Google Authenticator, Microsoft Authenticator oder 2FAS. Dann öffnet dein Passwort allein dein Konto nicht ' +
      'mehr.',
    turnOn: 'Einschalten',
    setupIntro: 'Füg StudentsBudget zu deiner Authenticator-App hinzu und gib dann den Code ein, den sie anzeigt.',
    restarted:
      'Damit beginnt die Einrichtung von vorn. Hat deine Authenticator-App schon einen StudentsBudget-Eintrag aus der ' +
      'nicht abgeschlossenen Einrichtung, lösch ihn: Seine Codes funktionieren nicht.',
    openApp: 'In der Authenticator-App öffnen',
    typeKey: 'Oder gib diesen Schlüssel in die App ein:',
    scan: 'Oder scanne diesen Code mit einem anderen Gerät:',
    qrAlt: 'QR-Code für die Authenticator-App',
    keepKey:
      'Schreib den Schlüssel auf und bewahr ihn sicher auf, nicht auf diesem Handy. Verlierst du deine ' +
      'Authenticator-App, gibt eine neue mit diesem Schlüssel dieselben Codes. Die Daten auf diesem Handy bleiben so ' +
      'oder so.',
    code: '6-stelliger Code',
    cancel: 'Abbrechen',
    onIntro: 'Die Anmeldung fragt nach dem Code aus deiner Authenticator-App.',
    lostApp:
      'App verloren? Wenn du den Schlüssel aufgeschrieben hast, gibt eine neue Authenticator-App damit dieselben Codes.',
    turnOff: 'Ausschalten',
    confirmOff:
      'Zweistufige Anmeldung ausschalten? Dann öffnet dein Passwort allein wieder dein Konto. Den ' +
      'StudentsBudget-Eintrag kannst du danach aus deiner Authenticator-App löschen.',
    alreadyOn: 'Die zweistufige Anmeldung ist schon an.',
    isOn: 'Die zweistufige Anmeldung ist an.',
    isOff: 'Die zweistufige Anmeldung ist aus.',
    setupCancelled: 'Einrichtung abgebrochen.',
    cancelledElsewhere:
      'Diese Einrichtung wurde abgebrochen, vielleicht auf einem anderen Handy. Tipp auf Einschalten, um neu zu beginnen.',
  },
  passkeys: {
    heading: 'Passkeys',
    count: (count) => (count === 0 ? 'Noch keine' : count === 1 ? '1 Passkey' : `${count} Passkeys`),
    intro:
      'Melde dich mit Face ID, einem Fingerabdruck oder der PIN deines Handys an statt mit deinem Passwort. Der ' +
      'Passkey bleibt bei dir, auf deinem Handy oder in deinem Passwortmanager; dein Konto behält seinen öffentlichen ' +
      'Schlüssel, mit dem sich niemand anmelden kann.',
    offline: 'Du bist offline. Passkeys brauchen eine Verbindung.',
    signIn: 'Mit einem Passkey anmelden',
    orPassword: 'Oder mit deiner E-Mail und deinem Passwort:',
    checking: 'Deine Passkeys werden geprüft …',
    unknown: 'Deine Passkeys ließen sich nicht laden.',
    tryAgain: 'Noch einmal versuchen',
    unnamed: 'Passkey',
    added: (dateTime) => `Hinzugefügt am ${dateTime}`,
    lastUsed: (day) => `; zuletzt genutzt am ${day}`,
    removeOne: (name, dateTime) => `${name} entfernen, hinzugefügt am ${dateTime}`,
    remove: 'Entfernen',
    removeQuestion:
      'Diesen Passkey entfernen? Er meldet dich dann nicht mehr an; dein Passwort und jeder andere Passkey ' +
      'funktionieren weiter. Danach kannst du ihn auch von deinem Handy oder aus deinem Passwortmanager löschen.',
    cancel: 'Abbrechen',
    add: 'Passkey hinzufügen',
    unsupported: 'Dieser Browser kann keine Passkeys erstellen.',
    addFailed: 'Der Passkey ließ sich nicht hinzufügen. Versuch es noch einmal.',
    removeFailed: 'Der Passkey ließ sich nicht entfernen. Versuch es noch einmal.',
    addedStatus: 'Passkey hinzugefügt.',
    removedStatus: 'Passkey entfernt.',
  },
};
