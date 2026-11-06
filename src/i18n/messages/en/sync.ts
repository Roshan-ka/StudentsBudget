// Sync and linking in English: the stored problem codes (src/sync/problem.ts), the status line under Sync now, what a
// screen reader hears after it, and linking this phone on the account page.

export const sync = {
  /** What stopped or troubled the last sync, as `syncState` keeps it (a code), in words. */
  problems: {
    updateNeeded: 'This app needs an update to sync.',
    signedOut: 'Your sign-in has run out. Sign out and in again; your changes wait on this phone.',
    failed: "Couldn't sync just now. Your changes wait on this phone; try again.",
    heldBack: (count: number) =>
      count === 1
        ? '1 change can’t be synced: this app refuses it. It stays on this phone.'
        : `${count} changes can’t be synced: this app refuses them. They stay on this phone.`,
  },
  /** The status line under Sync now. */
  status: {
    offline: 'Offline. Changes made now wait on this phone.',
    offlineWaiting: (count: number) =>
      `Offline: ${count} ${count === 1 ? 'change waits' : 'changes wait'} on this phone.`,
    notYet: 'Not synced yet',
    synced: (when: string) => `Synced ${when}`,
    /** The line, from "Not synced yet" or "Synced 2 min ago" and the changes waiting. */
    line: (state: string, waiting: number) =>
      waiting === 0 ? `${state}.` : `${state}. ${waiting} ${waiting === 1 ? 'change' : 'changes'} waiting.`,
    justNow: 'just now',
    minutesAgo: (minutes: number) => `${minutes} min ago`,
    /** Anything an hour old or more: "on 29.10.2026, 09:30". */
    at: (dateTime: string) => `on ${dateTime}`,
    /** A time that can't be read. */
    before: 'before',
    otherAccount: 'This phone is linked to another account.',
  },
  /** What a screen reader hears once after Sync now. */
  result: {
    finished: 'Sync finished.',
    offline: 'Not synced: you’re offline. Changes wait on this phone.',
    otherAccount: 'Not synced: this phone is linked to another account.',
    problem: (problem: string) => `Not synced: ${problem}`,
  },
  /** What saving this phone's data would delete from the account (staleSummary). */
  stale: {
    entries: (count: number) => `${count} ${count === 1 ? 'entry' : 'entries'}`,
    others: (count: number) => `${count} ${count === 1 ? 'other item' : 'other items'}`,
  },
  /** Settings → Your account → Sync. */
  section: {
    heading: 'Sync',
    syncNow: 'Sync now',
  },
  /** Linking this phone on the account page (account-link.tsx). */
  link: {
    heading: 'Link this phone',
    checking: 'Linking this phone to your account…',
    linking: 'Linking this phone…',
    uploaded: "Your account now holds this phone's data.",
    /** "Loaded from your account: 2 accounts, 3 entries and your plan." */
    loaded: (contents: string) => `Loaded from your account: ${contents}.`,
    question: (phone: string, account: string) =>
      `This phone and your account both hold data. This phone: ${phone}. Your account: ${account}. Which should both keep?`,
    /** `stale` is what only the account has: "12 entries and 3 other items". */
    staleWarning: (stale: string) =>
      `Keeping this phone's data deletes what only your account has (${stale}) from your account, and from your ` +
      'other phones when they next sync.',
    replaceWarning:
      "Using your account's data replaces everything on this phone. Want a copy first? Export a backup under " +
      'Settings → Backup and data.',
    keepPhone: "Keep this phone's data",
    useAccount: "Use my account's data",
    otherAccount:
      "This phone holds another account's data, so it stays apart from this one. To sync it, sign out and sign in " +
      'with that account. To use this account here instead, delete everything on this phone (Settings → Backup and data); ' +
      'changes not synced yet are lost.',
    tryAgain: 'Try again',
    problems: {
      unfinished:
        "Your account's last save didn't finish, and this phone has no data to put in its place, so it isn't linked yet.",
      unreadable: "Your account holds data this app can't read, so this phone isn't linked. An app update may help.",
      failed: "Couldn't link this phone to your account. Check your connection and try again.",
      offline: "You're offline. Linking this phone needs a connection.",
    },
  },
};
