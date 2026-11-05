// Signing in and security in English: auth-errors.ts and credentials.ts, the sign-in form, the code step and the
// signed-in panel (account-view.tsx), Sign-in and security, two-step sign-in and passkeys.

export const auth = {
  /** What auth-errors.ts says for an answer of the account server, by what it means (BY_CODE maps its codes). */
  errors: {
    invalidCredentials: 'Email or password is wrong.',
    accountExists: 'This email already has an account. Sign in instead.',
    weakPassword: 'This password is too easy to guess. Choose a longer one.',
    checkEmail: 'Check the email address.',
    signupDisabled: 'New accounts are switched off right now.',
    emailDisabled: 'Signing in with email is switched off right now.',
    notConfirmed: 'This account still has to be confirmed with the code from its email.',
    tooMany: 'Too many tries. Wait a minute, then try again.',
    codeWrongOrExpired: 'That code is wrong or has expired. Check the newest email, or send a new code.',
    waitForCode: 'Too many emails for now. Wait a minute, then send a new code.',
    emailNotSent: "The email couldn't be sent. Try again later.",
    samePassword: "That's your current password. Choose a different one.",
    codeFailed: 'That code didn’t work. Codes change every 30 seconds: enter the newest one.',
    codeExpired: 'That took a little long. Enter the newest code from your authenticator app.',
    factorGone: 'Two-step sign-in was turned off for this account. Sign out, then sign in again.',
    setupOpen: 'An earlier set-up is still open. Try again.',
    enrollOff: 'Two-step sign-in can’t be turned on right now.',
    verifyOff: 'Codes can’t be checked right now. Try again later.',
    connectionChanged: 'Your connection changed while checking the code. Enter the newest code again.',
    signInAgain: 'Sign out, sign in again with your code, then try once more.',
    tooManyPasskeys: 'Your account has as many passkeys as it can keep. Remove one first.',
    passkeyOnAccount: 'This passkey is already on your account.',
    passkeyExpired: 'That took a little long. Try again.',
    passkeyOnDevice: 'This device already has a passkey for your account.',
    unreachable: "The account server can't be reached. Check your connection and try again.",
    sessionEnded: 'This sign-in has ended. Sign out, then sign in again.',
    general: 'Something went wrong. Try again.',
  },
  /** Why passkeys can't be used here at all. */
  unavailable: {
    disabled: 'Passkeys are switched off right now.',
    wrongSite: 'Passkeys don’t work on this copy of the app.',
  },
  /** A passkey sign-in that can't work here: the reason, then the way that always works. */
  passkeyUnavailable: (reason: string) => `${reason} Sign in with your email and password.`,
  passkeyFailed: 'That passkey didn’t work. Try again, or sign in with your email and password.',
  offline: "You're offline. Signing in needs a connection.",
  /** credentials.ts: what stops the fields before anything is sent. */
  check: {
    enterEmail: 'Enter your email.',
    enterPassword: 'Enter your password.',
    shortPassword: (min: number) => `Use at least ${min} characters for the password.`,
    code: 'Enter the 6-digit code from your authenticator app.',
    emailCode: 'Enter the 6-digit code from the email.',
  },
  view: {
    off: "Accounts aren't set up in this copy of the app. Everything stays on this phone.",
    checking: 'Checking your account…',
  },
  signIn: {
    headingSignIn: 'Sign in',
    headingCreate: 'Create an account',
    optional: 'Optional. Without an account, everything stays on this phone.',
    iosHint: 'On iPhone, sign in inside the Home Screen app: Safari and the app keep separate data and sign-ins.',
    email: 'Email',
    password: 'Password',
    minLength: (min: number) => `At least ${min} characters.`,
    signIn: 'Sign in',
    create: 'Create account',
    toSignIn: 'Have an account? Sign in',
    toCreate: 'New here? Create an account',
    forgot: 'Forgot your password?',
  },
  /** The code from the sign-up email (P2.4). The email sits in bold between the parts of a sentence. */
  confirm: {
    heading: 'Confirm your email',
    prompt: { before: 'Enter the 6-digit code we sent to ', after: '. It works for 60 minutes.' },
    code: '6-digit code',
    confirm: 'Confirm',
    sendAgain: 'Send a new code',
    resent: 'A new code is on its way. Use the newest one.',
    back: 'Back',
  },
  /** "Forgot password" (P2.4): the email, then its code. The email sits in bold between the parts of a sentence. */
  reset: {
    heading: 'Reset your password',
    intro: "Enter your account's email, and we'll send it a 6-digit code.",
    send: 'Send code',
    prompt: { before: 'If ', after: ' has an account, we sent it a 6-digit code. It works for 60 minutes.' },
    code: '6-digit code',
    confirm: 'Continue',
    sendAgain: 'Send a new code',
    resent: 'A new code is on its way. Use the newest one.',
    back: 'Back',
  },
  /** The last step of "Forgot password": signed in with the code, a new password finishes it. */
  newPassword: {
    heading: 'Choose a new password',
    prompt: { before: 'Signed in as ', after: ' with the code from your email. Choose a new password to finish.' },
    password: 'New password',
    save: 'Save password',
    signOut: 'Sign out',
  },
  /** The code step of signing in. The email sits in bold between the parts of a sentence. */
  secondStep: {
    heading: 'Two-step sign-in',
    prompt: { before: 'Enter the code from your authenticator app for ', after: '.' },
    ended: { before: 'This sign-in for ', after: ' has ended, maybe because it was finished on another device.' },
    signInAgain: 'Sign in again',
    code: '6-digit code',
    continue: 'Continue',
    otherAccount: 'Use a different account',
  },
  signedIn: {
    heading: 'Signed in',
    as: { before: 'Signed in as ', after: '.' },
    keeps: 'Signing out keeps your data on this phone.',
    signOut: 'Sign out',
    syncing: 'Syncing, then signing out…',
    passwordChanged: 'Password changed.',
  },
  /** Settings → Your account → Delete my account (P2.5). The word to type is Backup's (`backup.delete.word`). */
  deleteAccount: {
    heading: 'Delete my account',
    intro:
      "Deletes your account and everything it keeps, for good: this can't be undone. The data on this phone stays, " +
      "and so does the data on your other phones; they're no longer linked.",
    backup: 'Download a backup first',
    password: 'Password',
    code: '6-digit code',
    codeNeeded: 'Your account has two-step sign-in: enter the code from your authenticator app too.',
    button: 'Delete my account',
    deleting: 'Deleting your account…',
    failed: "Couldn't delete your account. Try again.",
    done: 'Your account is deleted. Everything on this phone stays.',
  },
  security: {
    heading: 'Sign-in and security',
    intro:
      'You can always sign in with your password. A passkey is a quicker way in. With two-step sign-in on, a code ' +
      'from your authenticator app follows either, so a stolen password alone opens nothing.',
  },
  twoStep: {
    heading: 'Two-step sign-in',
    badges: { on: 'On', off: 'Off', settingUp: 'Setting up' },
    offline: "You're offline. Turning two-step sign-in on or off needs a connection.",
    checking: 'Checking two-step sign-in…',
    unknown: "Couldn't check whether two-step sign-in is on.",
    tryAgain: 'Try again',
    offIntro:
      'Turn it on and signing in also asks for a 6-digit code from an authenticator app, such as Google ' +
      'Authenticator, Microsoft Authenticator or 2FAS, so your password alone no longer opens your account.',
    turnOn: 'Turn on',
    setupIntro: 'Add StudentsBudget to your authenticator app, then enter the code it shows.',
    restarted:
      'This starts the set-up again. If your authenticator app already has a StudentsBudget entry from the ' +
      "unfinished one, delete it: its codes won't work.",
    openApp: 'Open in authenticator app',
    typeKey: 'Or type this key into the app:',
    scan: 'Or scan this code from another device:',
    qrAlt: 'QR code for the authenticator app',
    keepKey:
      'Write the key down and keep it somewhere safe, away from this phone. If you lose your authenticator app, ' +
      'typing the key into a new one gives the same codes. The data on this phone stays either way.',
    code: '6-digit code',
    cancel: 'Cancel',
    onIntro: 'Signing in asks for the code from your authenticator app.',
    lostApp: 'Lost the app? If you wrote the key down, typing it into a new authenticator app gives the same codes.',
    turnOff: 'Turn off',
    confirmOff:
      'Turn off two-step sign-in? Your password alone will open your account again. You can then delete the ' +
      'StudentsBudget entry from your authenticator app.',
    /** What a screen reader hears after a step. */
    alreadyOn: 'Two-step sign-in is already on.',
    isOn: 'Two-step sign-in is on.',
    isOff: 'Two-step sign-in is off.',
    setupCancelled: 'Set-up cancelled.',
    cancelledElsewhere: 'This set-up was cancelled, maybe from another phone. Turn on to start again.',
  },
  /** One-time data-protection notes (`PrivacyNote`): before the first account and the first passkey on a phone. */
  privacy: {
    label: 'About your data',
    continue: 'Continue',
    cancel: 'Cancel',
    account:
      'Your account is kept by Supabase, in Frankfurt (EU): your email, your password (stored only as a hash), ' +
      'your phone’s language and a copy of the data you sync. If the account needs a code, to confirm it or for a ' +
      'new password, it comes by email. You can delete the account at any time in Settings.',
    passkey:
      'Your phone’s password manager keeps the passkey, and may sync it to your other devices (iCloud Keychain or ' +
      'Google Password Manager, for example). Your account keeps only its public key, which can’t sign anyone in.',
  },
  /** Sign-in and security → Password: a new password, the current one asked when this session signed in with it. */
  changePassword: {
    heading: 'Password',
    intro:
      'Change the password you sign in with. Forgot it? Sign in with a passkey, and you can set a new one here ' +
      'without the old one.',
    open: 'Change password',
    current: 'Current password',
    next: 'New password',
    save: 'Save password',
    cancel: 'Cancel',
    changed: 'Password changed.',
    wrongCurrent: "That isn't your current password.",
  },
  passkeys: {
    heading: 'Passkeys',
    /** The card's status: how many the account has. */
    count: (count: number) => (count === 0 ? 'None yet' : count === 1 ? '1 passkey' : `${count} passkeys`),
    intro:
      "Sign in with Face ID, a fingerprint or your phone's PIN instead of your password. The passkey stays with you, " +
      "on your phone or in your password manager; your account keeps its public key, which can't sign anyone in.",
    offline: "You're offline. Passkeys need a connection.",
    signIn: 'Sign in with a passkey',
    orPassword: 'Or with your email and password:',
    checking: 'Checking your passkeys…',
    unknown: "Couldn't load your passkeys.",
    tryAgain: 'Try again',
    /** A passkey the account has no name for. */
    unnamed: 'Passkey',
    added: (dateTime: string) => `Added ${dateTime}`,
    lastUsed: (day: string) => `; last used ${day}`,
    removeOne: (name: string, dateTime: string) => `Remove ${name}, added ${dateTime}`,
    remove: 'Remove',
    removeQuestion:
      'Remove this passkey? It will stop signing you in; your password and any other passkey keep working. You can ' +
      'then delete it from your phone or password manager too.',
    cancel: 'Cancel',
    add: 'Add a passkey',
    unsupported: "This browser can't make passkeys.",
    addFailed: 'Couldn’t add the passkey. Try again.',
    removeFailed: 'Couldn’t remove the passkey. Try again.',
    addedStatus: 'Passkey added.',
    removedStatus: 'Passkey removed.',
  },
};
