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
};
