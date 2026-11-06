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
    pitch: 'Your student budget in Regensburg: plan it, log it, save.',
    withAccount: 'With an account',
    signIn: 'I have an account',
    create: 'Create an account',
    accountWhy: 'With an account, your plan is backed up and on every phone you sign in on.',
    withoutAccount: 'Without an account',
    guest: 'Continue as guest',
    guestNote: 'Your data stays on this phone only. You can create an account later in Settings.',
    back: 'Back',
    /** Under the sign-in form on the start page. */
    afterSignIn: 'Once you are signed in, the app gets your data from your account. If it is still empty, you set up your plan next.',
  },
};
