// The app's frame in English: the bottom navigation and the page headings.
export const shell = {
  /** At most 9 characters each: five sit side by side at 375 px (tested for every offered language). */
  nav: {
    home: 'Home',
    entries: 'Entries',
    charts: 'Charts',
    tips: 'Tips',
    settings: 'Settings',
  },
  /** The navigation's own name, for screen readers. */
  navLabel: 'Main',
  /** The way back from a page of Settings to its list. */
  backToSettings: 'Back to Settings',
  /** The same link before a plan exists: setup is where the person was, and the nav doesn't show yet. */
  backToSetup: 'Back to setup',
  headings: {
    home: 'Home',
    plan: 'Plan',
    profile: 'Profile',
    appearance: 'Appearance',
    accounts: 'Accounts and transfers',
    backup: 'Backup and data',
    moderation: 'Moderation',
    reminder: 'Weekly reminder',
    badges: 'Badges',
    charts: 'Charts',
    checkIn: 'Weekly check-in',
    entries: 'Entries',
    newEntry: 'New entry',
    reveal: 'Month by month',
    account: 'Your account',
    start: 'Welcome',
    settings: 'Settings',
    tips: 'Regensburg tips and discounts',
  },
};
