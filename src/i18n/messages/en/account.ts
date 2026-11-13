// The account in English: Settings' Your account card and the setup page's line about it. Signing in, two-step
// sign-in and passkeys join in chunk 7.
export const account = {
  card: {
    heading: 'Your account',
    signedIn: (email: string) => `Signed in as ${email}.`,
    secondStep: (email: string) => `Almost signed in as ${email}: enter the code from your authenticator app.`,
    signedOut: 'Optional: sign in or create an account. Without one, everything stays on this phone.',
    manage: 'Manage account',
    finish: 'Finish signing in',
    signIn: 'Sign in',
  },
  /** At the top of a new setup: a second phone can get its data from the account instead of setting up again. */
  setupLink: {
    question: 'Using StudentsBudget on another phone?',
    signedIn: 'Get your data from your account',
    secondStep: 'Finish signing in to get your data',
    signedOut: 'Sign in to get your data',
  },
  /** The start page (06-11-2026): a phone with no plan and nobody signed in chooses how to begin. */
  start: {
    /** Above the headline, with a pin. */
    place: 'For students in Regensburg',
    headline: 'Your money, sorted for student life.',
    pitch: 'Plan your month, log spending in seconds, and see local prices with their sources.',
    /** What the app does, one line each, in one card. */
    features: {
      plan: 'Plan your month',
      log: 'Log spending in seconds',
      week: 'Know your weekly budget',
      tips: 'Local tips with sources',
    },
    signIn: 'I have an account',
    create: 'Create an account',
    guest: 'Continue without an account',
    /** On the start page, once, after signing out. */
    signedOut: "You're signed out. Your data was removed from this phone.",
    back: 'Back',
    /** The start pages' forms (13-11-2026): their big heading and the line under it. */
    signInHeading: 'Sign in',
    signInLine: 'Your plan and entries come back from your account.',
    createHeading: 'Create your account',
    createLine: 'Back up your plan and use it on every phone.',
  },
};
